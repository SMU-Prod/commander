# App Náutico — Especificação v1.0

> Revisão completa da v0.1 (gerada por GPT). Decisões desta versão: **mobile-first (PWA)**,
> **gestão do barco como coração do MVP**, marketplace entra simples e evolui na Fase 2.
> Nome provisório: **GestNav** (candidatos: Bordo, Timoneiro — decidir antes do lançamento).

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
| **F1 — MVP** | Telas do §6, alertas push+e-mail, assinatura, convite CMDT, vitrine simples de comandantes | Proprietário real usando por 30 dias sem voltar pra planilha |
| **F2** | Verificação de comandantes (pós-advogado), Selo Ouro, WhatsApp nos alertas, relatório anual de custos | Primeira receita de comandante + primeiro selo emitido |
| **F3** | Prestadores de serviço como papel, anúncios, cursos com certificação, multi-embarcação com desconto | Massa crítica definida em F2 |

---

## 11. Direção visual — "painel de instrumentos"

Para não ter cara de template: a estética vem do mundo do próprio produto — o **cockpit
noturno** (Garmin/Raymarine). Fundo azul-marinho profundo (não preto puro), números de
horímetro em fonte mono tabular, semáforo como luzes de instrumento, hairlines discretas.
Uma assinatura visual: o **horímetro digital** dos motores como elemento central da ficha.
Protótipo navegável publicado junto com esta espec valida a direção.

---

## 12. Riscos e pendências

1. **Jurídico (bloqueia F2):** verificação de carteira/antecedentes de comandantes — validar
   com advogado o que pode ser "verificado" vs "declarado", e o termo de responsabilidade.
2. **Hábito de registro:** se o proprietário não registrar horas, os alertas por horas morrem.
   Mitigação: Registro Rápido de 30 s + lembrete inteligente ("saiu no fim de semana? registre as horas").
3. **Push no iOS:** exige PWA instalado na tela de início (iOS 16.4+). O onboarding precisa
   guiar a instalação. E-mail é o fallback sempre ativo.
4. **Cota de storage:** fotos de barco pesam; definir cota e compressão desde o dia 1.
5. **Nome e marca:** decidir nome definitivo e registrar domínio antes do checkout existir.

## 13. Perguntas em aberto (para o Erick)

- Preço multi-embarcação: 2º barco paga cheio ou tem desconto?
- Trial: 14 dias sem cartão, ok?
- Alerta por WhatsApp já no MVP (tem custo por mensagem) ou só F2?
- Nome do produto: GestNav, Bordo, Timoneiro ou outro?
