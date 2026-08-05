# App Náutico — Especificação v1.1

> Revisão completa da v0.1 (gerada por GPT). Decisões desta versão: **mobile-first (PWA)**,
> **gestão do barco como coração do MVP**, marketplace entra simples e evolui na Fase 2.
> Nome provisório: **GestNav** (candidatos: Bordo, Timoneiro — decidir antes do lançamento).
>
> **v1.1 (05/08/2026):** adiciona a camada de rastreamento GPS e telemetria (§12) e a
> estratégia de infraestrutura com custo operacional quase zero (§13).

---

## 1. Visão e posicionamento

**O problema real:** hoje o proprietário gerencia o barco com uma mistura de planilha, caderno,
WhatsApp do mecânico e memória. Ninguém sabe ao certo quando vence o seguro, quantas horas
tem o motor de boreste ou quando foi a última docagem. O concorrente a ser batido não é outro
app — é a planilha + WhatsApp.

**A promessa:** *abrir o app e saber em 5 segundos se o barco está em dia.* Tudo que vence
(revisão, óleo, seguro, docagem) monitorado automaticamente, com o histórico completo da
embarcação num lugar só.

**O que NÃO é:** um cadastro digital. Ficha sem alerta é planilha bonita. O produto é o motor
de alertas + o diário de bordo; a ficha é consequência.

---

## 2. Usuários e papéis

| Papel | Quem é | O que faz |
|---|---|---|
| **PROP** (proprietário) | Dono da conta e da assinatura | Tudo: ficha, custos, documentos, convites, permissões |
| **CMDT** (comandante/tripulação) | Convidado pelo PROP, 1 acesso incluso | Depende do nível de acesso (abaixo) |

**Níveis de acesso do CMDT (só dois no MVP — sem matriz customizável):**
- **Completo** — vê e edita tudo, exceto assinatura/pagamento e exclusão da embarcação.
- **Operacional** — registra horas, eventos, fotos e abastecimento; vê status e alertas;
  **não vê** custos, documentos nem contatos.

Futuro (fora do MVP): prestadores de serviço como terceiro papel; cursos com certificação.

---

## 3. Modelo de negócio

| Item | Valor | Observações |
|---|---|---|
| Assinatura PROP (1 embarcação + 1 CMDT) | R$ 119/mês | Cobrança **por embarcação**, não por conta. 2º barco = 2ª assinatura (com desconto a definir) |
| Promoção fundadores (100 primeiros) | R$ 69,99/mês | Preço vitalício enquanto assinar — vira argumento de urgência |
| Marinheiro/tripulante no marketplace | R$ 19,99/mês | Só começa a cobrar quando houver vitrine com tráfego real |
| Selo Ouro de venda | Consultoria avulsa | Avaliação presencial — Fase 2 |
| Anúncios | Fixo/freelance | Fase 3 — só com base de usuários formada |
| Prestadores (mecânico, eletricista) | Grátis na Fase 1 | Cobrança futura (R$ 19,99) após massa crítica de leads |

**Decisões pendentes:** trial gratuito (sugestão: 14 dias sem cartão), política multi-embarcação,
cota de armazenamento de fotos/anexos inclusa (sugestão: 5 GB) e preço do upgrade.

---

## 4. Conceitos-chave do produto

Estes 5 conceitos substituem a "lista de campos por aba" da v0.1. Tudo no app deriva deles.

### 4.1 Item Monitorado (o padrão que unifica tudo)

Quase tudo que a v0.1 descrevia repete o mesmo mecanismo: *algo que vence por horas de uso
e/ou por data, o que ocorrer primeiro — com histórico e anexos.* Em vez de modelar motor, óleo,
filtro, gerador, docagem e seguro como estruturas diferentes, existe **um único conceito**:

> **Item Monitorado** = nome + a que pertence (motor BB, gerador, casco, embarcação) +
> regra de vencimento (a cada X horas e/ou a cada Y meses / em data fixa) + status semáforo.

Exemplos: "Revisão — Motor BB (a cada 500 h)", "Troca de óleo — Motor BE (a cada 250 h ou
12 meses)", "Antifouling (a cada 18 meses)", "Seguro (vence 12/03/2027)", "Vistoria da Marinha".

O semáforo é calculado, nunca preenchido à mão:
- 🟢 **OK** — folga acima da margem
- 🟡 **Atenção** — dentro da margem (documentos: 30 dias; horas: 15% do intervalo)
- 🔴 **Vencido** — passou do limite

Registrar um serviço no diário **zera o ciclo do item automaticamente**.

### 4.2 Diário de Bordo (histórico unificado)

Uma única linha do tempo da embarcação, em vez de histórico espalhado por aba. Todo evento tem:
data, horas do motor no momento, tipo (manutenção, abastecimento, navegação, avaria, docagem,
leitura de horas), descrição, prestador (link para Contatos), custo (opcional) e anexos
(NF, relatório, foto). As telas de Motor, Elétrica e Casco mostram **recortes filtrados** do
mesmo diário — não são históricos separados.

Efeito colateral valioso: o diário completo é o dossiê de venda da embarcação (base do Selo Ouro).

### 4.3 Registro Rápido (o hábito que alimenta tudo)

Sem dado novo, alerta não funciona. O fluxo mais importante do app é o de 30 segundos ao
voltar do mar: **horas BB / horas BE / litros abastecidos (opcional) / observação (opcional)**.
Um botão sempre visível na Home. É isso que mantém médias de uso e alertas por horas vivos.

### 4.4 Alertas

Motor de regras único sobre os Itens Monitorados:
- Documentos: avisos a 30/15/5 dias do vencimento e no dia.
- Por horas: aviso ao entrar na margem de 15% (ex.: "troca de óleo em 37 h") e ao vencer.
- Canais no MVP: push (PWA instalado) + e-mail. WhatsApp na Fase 2 (API paga — avaliar custo).
- Central de alertas na Home; crítico (🔴) sempre no topo, impossível de não ver.

### 4.5 Completude da ficha

Barra de progresso "Ficha 78% completa" com o próximo passo sugerido ("adicione a apólice do
seguro"). Cria o hábito de completar dados sem formulário gigante no onboarding — e é a mesma
mecânica que depois vira o checklist do Selo Ouro.

---

## 5. Arquitetura de informação (mobile-first)

Sem abas laterais (padrão desktop da v0.1). Navegação por **4 abas inferiores + botão de ação**:

```
┌─────────────────────────────┐
│  [conteúdo da aba]          │
│                             │
│            (+) Registrar    │  ← botão flutuante: Registro Rápido
├─────────────────────────────┤
│  Hoje │ Barco │ Diário │ Rede │
└─────────────────────────────┘
```

- **Hoje** — status geral (semáforo), alertas, vencimentos dos próximos 30 dias, atalho de
  registro. É a tela dos 5 segundos.
- **Barco** — a ficha por sistemas: Motores, Elétrica, Casco, Documentos, Fotos, Dados gerais.
  Cada sistema abre seu detalhe (ex.: Motor BB com horímetro, itens monitorados e histórico filtrado).
- **Diário** — linha do tempo completa com filtros por sistema e por tipo de evento.
- **Rede** — contatos do barco (com avaliação e histórico de serviços) + comandantes disponíveis
  (vitrine do marketplace).

Desktop: mesmo conteúdo em layout de duas colunas (navegação vira sidebar). Bônus, não prioridade.

---

## 6. Telas do MVP

1. **Onboarding** — cadastro em 3 passos curtos: (1) barco (nome, estaleiro/modelo, ano, marina);
   (2) motores (quantos, marca/modelo, horas atuais); (3) vencimentos críticos (seguro, TIE).
   Todo o resto entra depois via completude da ficha. Nunca um formulário de 40 campos.
2. **Hoje** — descrita acima.
3. **Barco** (hub de sistemas) + **detalhe de Motor** (horímetro, itens monitorados, especificação
   de óleo/filtros, documentos do motor, histórico filtrado) + **detalhe de Elétrica** (gerador com
   horas próprias, baterias, painel) + **Casco** (material, antifouling, docagem, avarias) +
   **Documentos** (lista com validade e semáforo, upload de PDF/foto) + **Fotos** (galeria).
4. **Diário de Bordo** — timeline + tela de novo evento.
5. **Registro Rápido** — modal de 30 segundos.
6. **Rede** — contatos + comandantes disponíveis (perfil com foto, categoria de habilitação,
   disponibilidade e botão WhatsApp — ver §8 sobre o que o MVP promete).
7. **Convite do CMDT** — PROP convida por link/WhatsApp, escolhe nível (Completo/Operacional).
8. **Assinatura** — checkout (Stripe), promo fundadores, gestão do plano.

---

## 7. Modelo de dados (entidades principais)

| Entidade | Campos-chave | Observações |
|---|---|---|
| `usuario` | nome, e-mail, telefone | auth padrão |
| `embarcacao` | nome, estaleiro, modelo, ano, comprimento, boca, calado, casco (material/nº), TIE, capitania, propulsão, marina | dados gerais da v0.1 preservados |
| `vinculo` | usuário ↔ embarcação, papel (PROP/CMDT), nível de acesso | 1 PROP + N CMDT |
| `equipamento` | tipo (motor/gerador/bateria/outro), posição (BB/BE/central), marca, modelo, nº série, ano, potência, combustível, horas atuais, última leitura | motores e gerador são o mesmo tipo de coisa com horas próprias |
| `item_monitorado` | nome, alvo (embarcação ou equipamento), intervalo em horas e/ou meses, data/horas do último ciclo, margem | ver §4.1 — o coração do sistema |
| `evento` | data, tipo, horas no momento, descrição, custo, contato (prestador), item_monitorado (opcional), anexos | o Diário de Bordo; se ligado a um item, zera o ciclo |
| `documento` | tipo (seguro, TIE, vistoria…), arquivo, validade | validade gera item monitorado por data |
| `contato` | nome, especialidade, telefone, avaliação (1–5 do PROP) | histórico = eventos ligados a ele |
| `perfil_comandante` | dados profissionais, categoria de habilitação, disponibilidade, status de verificação | marketplace — ver §8 |
| `assinatura` | plano, status, gateway | Stripe |

Anexos e fotos em storage com cota por embarcação.

---

## 8. Marketplace no MVP — versão honesta

A v0.1 prometia "crivo de RH" e "verificação de carteira" — isso cria **responsabilidade civil**
antes de existir receita para bancá-la. No MVP:

- Comandantes se cadastram (R$ 19,99/mês quando houver tráfego), preenchem perfil e disponibilidade.
- A vitrine aparece na aba Rede do proprietário; contato direto via WhatsApp.
- O selo **"Verificado"** existe na interface, mas **nenhum perfil o recebe** até o processo de
  verificação ser validado por advogado (o que se verifica, o que se declara, termo de
  responsabilidade). Perfis sem selo exibem "documentação declarada pelo profissional".
- O app **não intermedeia pagamento nem contratação** no MVP — é vitrine + contato.

Isso preserva o roadmap sem assumir risco jurídico no dia 1.

---

## 9. Selo Ouro de venda — Fase 2

Mantido como está na v0.1 (checklist + barra de progresso + avaliação presencial), mas sai do
MVP. A fundação já fica pronta: a completude da ficha (§4.5) e o diário completo (§4.2) **são**
o checklist do selo. Quando lançar, é uma tela nova sobre dados que já existem.

---

## 10. Fases

| Fase | Escopo | Critério de pronto |
|---|---|---|
| **F1 — MVP** | Telas do §6, alertas push+e-mail, assinatura, convite CMDT, vitrine simples de comandantes, **GPS Tier 0** (trilha pelo celular + boletim do mar) | Proprietário real usando por 30 dias sem voltar pra planilha |
| **F1.5** | **Tier 1**: integração Traccar + modo marina (antifurto) + monitor de bateria; venda do kit rastreador instalado | Primeiros 10 rastreadores ativos |
| **F2** | Verificação de comandantes (pós-advogado), Selo Ouro, WhatsApp nos alertas, relatório anual de custos, **Tier 2**: telemetria NMEA 2000 como premium | Primeira receita de comandante + primeiro selo emitido |
| **F3** | Prestadores de serviço como papel, anúncios, cursos com certificação, multi-embarcação com desconto | Massa crítica definida em F2 |

---

## 11. Direção visual — "painel de instrumentos"

Para não ter cara de template: a estética vem do mundo do próprio produto — o **cockpit
noturno** (Garmin/Raymarine). Fundo azul-marinho profundo (não preto puro), números de
horímetro em fonte mono tabular, semáforo como luzes de instrumento, hairlines discretas.
Uma assinatura visual: o **horímetro digital** dos motores como elemento central da ficha.
Protótipo navegável publicado junto com esta espec valida a direção.

---

## 12. Camada de rastreamento e telemetria (GPS)

Três níveis, do custo zero à máxima tecnologia. O princípio: **o hardware é pago pelo
proprietário; a plataforma só opera software** — assim o custo operacional não cresce com a frota.

### Tier 0 — GPS do celular + dados do mar (custo zero, entra no MVP)

- **Trilha de navegação:** com o app aberto durante o passeio (mesmo padrão de uso do
  Navionics), o celular grava a rota — distância, velocidade média/máxima, tempo de operação.
  A trilha vira um evento no Diário de Bordo com mapa.
- **Horas sugeridas automaticamente:** tempo em deslocamento acima de ~2 nós ≈ tempo de motor.
  Ao encerrar a navegação, o Registro Rápido já vem preenchido — o dono só confirma.
- **Boletim do mar na Home:** altura de onda, período, vento e temperatura da água via
  Open-Meteo Marine (API gratuita, previsão de 7 dias). A tela "Hoje" responde também
  "dá pra sair hoje?". *Atenção: gratuita para uso não comercial; a licença comercial da
  Open-Meteo (~€29/mês) entra quando houver receita.*
- **Tráfego AIS ao redor:** via aisstream.io (WebSocket gratuito de posições AIS), exibir
  embarcações com transponder próximas durante a navegação. Se o barco do usuário tiver
  transponder AIS Classe B, a própria posição dele chega de graça — sem hardware extra.
  *Limite honesto: a maioria das lanchas de recreio no Brasil não transmite AIS, e a
  cobertura depende de estações costeiras — é complemento, não o rastreio principal.*

### Tier 1 — Rastreador 4G + antifurto (hardware do dono, plataforma quase zero)

- **Servidor:** [Traccar](https://www.traccar.org/) — open source, gratuito, suporta 200+
  protocolos e 2.000+ modelos de rastreador, com geofence e REST API. Uma única instância
  (VPS de ~R$ 25–50/mês, ou Oracle Cloud Always Free) atende a frota inteira.
- **Hardware:** rastreador 4G à prova d'água (Teltonika IP67 na faixa premium; genéricos
  GT06/Coban a partir de ~R$ 150) + chip M2M (~R$ 15–20/mês) — **comprados pelo dono**,
  com opção de a plataforma vender o kit instalado com margem (receita nova).
- **O que destrava:**
  - **Modo marina (antifurto):** geofence da marina → push imediato "seu barco saiu da
    marina e você não está nele". As rastreadoras náuticas brasileiras (Olicar, Savcar,
    Maximize, Probase…) vendem só isso por R$ 60–120/mês — aqui vira recurso do plano.
  - Posição em tempo real e histórico de rotas sem o celular a bordo.
  - **Tensão da bateria de bordo:** a maioria dos rastreadores reporta a voltagem da
    alimentação → alerta "bateria do barco em 11,8 V" antes de o dono chegar na marina e
    não conseguir dar partida. Integra direto com a aba Elétrica.

### Tier 2 — Telemetria NMEA 2000 (máxima tecnologia, premium)

- **Gateway:** Yacht Devices YDWG-02 (~€ 200) ou Raspberry Pi com
  [Signal K](https://signalk.org/) (open source) conectado à rede NMEA 2000 do barco
  (padrão em barcos 2010+ com IPS/pods, como o perfil-alvo).
- **O que destrava:** horas de motor reais lidas do barramento (PGN 127489), RPM, fluxo e
  nível de combustível, temperaturas e alarmes do motor — **a ficha se atualiza sozinha**,
  o Registro Rápido vira opcional e os alertas por horas ficam exatos.
- Requer internet a bordo (roteador 4G) — mesmo chip M2M do Tier 1 pode servir.
- Posicionamento de produto: plano premium ("o barco que se gerencia sozinho") ou serviço
  de instalação avulso. Nenhum concorrente nacional oferece isso integrado à manutenção.

**Sequência recomendada:** Tier 0 no MVP; integração Traccar (Tier 1) logo atrás — o modo
marina é argumento de venda forte e o custo de plataforma é um VPS; Tier 2 na Fase 2 como
premium/upsell.

---

## 13. Infraestrutura — custo operacional quase zero

Regra: tudo em managed services com free tier **que permita uso comercial**, pagando só
quando a receita existir. (Vercel Hobby proíbe uso comercial — por isso Cloudflare.)

| Camada | Escolha | Free tier | Quando começa a custar |
|---|---|---|---|
| Front + API | Next.js na Cloudflare (Workers/Pages via OpenNext) | 100 mil req/dia, uso comercial permitido | Muito além de 500 assinantes (US$ 5/mês no plano pago) |
| Banco + Auth + Storage | Supabase | 500 MB banco, 500 MB storage, 50 mil MAU, uso comercial ok | Pro US$ 25/mês quando o banco crescer (ou para evitar o auto-pause de 7 dias sem tráfego — mitigável com cron ping no início) |
| Fotos/anexos | Cloudflare R2 | 10 GB grátis, sem taxa de egresso | ~US$ 0,015/GB/mês acima disso |
| Push | Web Push (padrão aberto) | Gratuito, sem serviço pago | Nunca |
| E-mail transacional | Resend | 3 mil e-mails/mês | US$ 20/mês acima disso |
| Pagamento | Stripe | Sem mensalidade | % por transação (só quando há receita) |
| Rastreamento | Traccar self-hosted | Software gratuito | VPS R$ 25–50/mês quando o Tier 1 ativar |
| Mar/clima | Open-Meteo Marine | Gratuito não comercial, sem API key | ~€ 29/mês na licença comercial, quando houver receita |
| AIS | aisstream.io | Gratuito (WebSocket) | — |

**Conta realista:** do lançamento até ~100 assinantes, o custo mensal fica entre **R$ 0 e
~R$ 200** (Supabase Pro + VPS do Traccar sendo os primeiros itens pagos). Com 100 fundadores
a R$ 69,99 (≈ R$ 7 mil/mês de receita), a infraestrutura consome menos de 3% da receita.
WhatsApp nos alertas segue fora do MVP: a API da Meta cobra por conversa e é o único canal
com custo variável por usuário — e-mail + push cobrem o MVP de graça.

---

## 14. Riscos e pendências

1. **Jurídico (bloqueia F2):** verificação de carteira/antecedentes de comandantes — validar
   com advogado o que pode ser "verificado" vs "declarado", e o termo de responsabilidade.
2. **Hábito de registro:** se o proprietário não registrar horas, os alertas por horas morrem.
   Mitigação: Registro Rápido de 30 s + lembrete inteligente ("saiu no fim de semana? registre as horas").
3. **Push no iOS:** exige PWA instalado na tela de início (iOS 16.4+). O onboarding precisa
   guiar a instalação. E-mail é o fallback sempre ativo.
4. **Cota de storage:** fotos de barco pesam; definir cota e compressão desde o dia 1.
5. **Nome e marca:** decidir nome definitivo e registrar domínio antes do checkout existir.
6. **GPS em background no iOS:** PWA não rastreia com a tela bloqueada — a trilha do Tier 0
   funciona com o app aberto (padrão Navionics). Rastreio 24 h de verdade é o Tier 1
   (hardware). Não prometer no marketing o que o Tier 0 não entrega.
7. **LGPD:** posição do barco é dado sensível na prática (revela onde a pessoa está).
   Política de privacidade clara, retenção definida e posição visível só para PROP e CMDT
   autorizado.
8. **Licença Open-Meteo:** free tier é não comercial — orçar a licença (~€ 29/mês) no
   momento em que o produto cobrar assinatura.

## 15. Perguntas em aberto (para o Erick)

- Preço multi-embarcação: 2º barco paga cheio ou tem desconto?
- Trial: 14 dias sem cartão, ok?
- Alerta por WhatsApp já no MVP (tem custo por mensagem) ou só F2?
- Nome do produto: GestNav, Bordo, Timoneiro ou outro?
- Kit rastreador (Tier 1): vender instalado com margem, ou só homologar aparelhos que o
  dono compra por conta própria?
- Tier 1 incluso na assinatura de R$ 119 ou plano separado (ex.: +R$ 29,90/mês)?
