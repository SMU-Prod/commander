# COMMANDER
## Especificação de produto — versão completa para desenvolvimento

---

## 0. O que é o Commander, em uma frase

Um app onde o **proprietário de embarcação** gerencia tudo do seu barco (documentação, manutenção, histórico técnico, gastos) e, na mesma plataforma, contrata **comandantes e prestadores de serviço verificados** — com pagamento intermediado pela plataforma nos primeiros contatos.

Três tipos de usuário:
- **PROP** — proprietário da embarcação (paga assinatura mensal)
- **CMDT** — comandante/tripulação (acesso vinculado à embarcação do PROP + perfil público no marketplace)
- **PRESTADOR** — mecânico, eletricista, prestador de serviço náutico (perfil público no marketplace, fase 2)

---

## 1. Identidade visual

- **Nome**: Commander
- **Conceito de logo**: duas letras "M" espelhadas, remetendo a comando, confiança e controle no mar — forma sugere proa de embarcação/brasão náutico
- **Paleta**: azul marinho (navy) como base + dourado como cor de destaque/ação, sobre branco/off-white
- **Modo de exibição**: o app oferece **Light mode (padrão) e Dark mode (opcional, ativável em configurações)**
  - Light mode: fundo claro, navy usado em texto/ícones/cabeçalho, dourado como destaque — prioriza legibilidade em uso ao ar livre/sol forte (contexto real de uso: marina, convés)
  - Dark mode: fundo navy escuro, texto claro, dourado como destaque — visual "premium/yacht clube", oferecido como preferência do usuário
  - Ambos os modos usam a mesma paleta base e o mesmo sistema de componentes — não são duas identidades visuais diferentes, só duas variações de tema
- Os mockups já validados usam cards com cantos arredondados (10-12px), fundo levemente destacado do plano de fundo, e sistema de status em três cores (verde = ok, amarelo = atenção, vermelho = crítico)

---

## 2. Modelo de negócio

| Receita | Valor | Observação |
|---|---|---|
| Assinatura PROP | R$ 119,00/mês | Inclui 1 acesso CMDT vinculado |
| Promoção de lançamento | R$ 69,99/mês | Válida para os primeiros 100 assinantes |
| Marinheiro/CMDT listado no marketplace | R$ 19,99/mês | Cobrança a ativar depois da fase inicial |
| Prestador de serviço listado | Grátis na fase 1 | Cobrança futura (R$19,99) só após massa crítica de leads gerados pela plataforma |
| Selo ouro de venda | Consultoria avulsa | Avaliação presencial feita pela equipe, precifica à parte |
| Comissão sobre 1º fechamento (diária de CMDT) | 10% do valor total | Ver regra completa na seção 7 |
| Anúncios | Fixo ou freelance | **Fora do escopo desta fase — revisar depois** |

**Princípio de caixa**: a plataforma **nunca retém saldo de terceiros**. Pagamentos de diária/serviço passam por gateway com split e repasse no mesmo dia. Assinatura é cobrança direta e recorrente da empresa Commander.

---

## 3. Estrutura geral do app

```
COMMANDER
│
├── Conta PROP (proprietário)
│   └── Embarcação
│       ├── Dados gerais
│       ├── Motores
│       ├── Casco
│       ├── Elétrica
│       ├── Documentos
│       ├── Fotos
│       ├── Contatos
│       ├── Comandantes disponíveis (atalho pro marketplace)
│       ├── Selo ouro de venda
│       └── Gastos financeiros
│
├── Conta CMDT (comandante/tripulação)
│   ├── Acesso vinculado à(s) embarcação(ões) que atende — permissões definidas pelo PROP
│   └── Perfil público no marketplace
│       ├── Vagas fixas
│       ├── Diárias
│       └── Avaliações
│
└── Conta PRESTADOR (mecânico, eletricista etc — fase 2)
    └── Perfil público no marketplace
        ├── Trabalhos em aberto
        ├── Avaliações
        └── Chat
```

---

## 4. Módulo PROP — ficha da embarcação

Tela principal com abas na lateral. A visão geral (Dados gerais) mostra: dados básicos, vencimentos próximos em semáforo, contatos salvos e comandantes disponíveis na semana — ponto de entrada rápido pras informações mais urgentes.

### 4.1 Dados gerais
Nome da embarcação, ano, estaleiro, modelo, comprimento, boca, calado, casco (material/nº), TIE, capitania de origem, propulsão, marina onde fica.

### 4.2 Motores
Cadastro **separado por motor** (BB / BE têm horas, histórico e alertas independentes).

**Identificação**: marca, modelo, nº de série, nº de motor/identificação interna, ano de fabricação, potência (HP), tipo de combustível, BB/BE.

**Horas e utilização**: horas atuais, última atualização das horas, histórico de horas, média de uso, data da última leitura.

**Manutenção**: última revisão (data + horas + o que foi feito). Próxima revisão com **dois campos obrigatórios e independentes**: por horas E por data — o sistema deve considerar vencido quando **qualquer um dos dois** for atingido primeiro. Status semáforo: 🟢 OK / 🟡 próxima / 🔴 vencida.

**Óleo e filtros**: tipo/especificação do óleo, quantidade, última troca (data + horas), próxima troca, filtro de óleo/combustível/ar/outros — cada item com status próprio.

**Histórico**: lista cronológica com data, horas, descrição do serviço, prestador, custo (opcional), anexo (nota fiscal/relatório).

**Documentos do motor**: notas fiscais, relatórios, manuais, garantia, fotos.

**Alertas automáticos** (funcionalidade central — é o que torna o cadastro uma ferramenta de gestão, não só uma ficha estática): disparar notificação quando revisão vencer (por hora ou data) ou estiver próxima (ex: "faltam 37h para a troca de óleo").

### 4.3 Casco
Organizado por **categoria**, cada uma com status semáforo e histórico próprio:
- Deck
- Fibra
- Inox
- Vidros
- Estofados
- Outros

Cada categoria registra: última intervenção (pintura/reparo/revisão), avarias pendentes, histórico cronológico com anexos.

### 4.4 Elétrica
- **Baterias**: tipo, quantidade, última troca
- **Gerador**: marca/modelo, nº de série, horas de uso, última manutenção, próxima manutenção (mesmo padrão horas/data dos motores)
- **Painel/sistema de bordo**: descrição do sistema instalado
- **Suporte e peças**: contato de revenda autorizada + prestador elétrico verificado (campo vazio até existir prestador cadastrado)
- **Histórico**: mesmo padrão cronológico dos motores

### 4.5 Documentos
Lista com validade e status semáforo (30/15/5 dias antes do vencimento dispara alerta): seguro (apólice + seguradora), vistoria da Marinha, TIE, licença de navegação, certificado de segurança, documento de propriedade.

### 4.6 Fotos
Estrutura de álbuns (Exterior, Interior, Convés, Documentação visual). Cota de nuvem inclusa no plano; upgrade pago se exceder o limite. Barra de progresso mostrando uso atual da cota.

### 4.7 Contatos
Lista de prestadores/pessoas de confiança do proprietário: nome, especialidade, telefone, avaliação (nota dada pelo próprio PROP), histórico de serviços prestados por esse contato.

### 4.8 Comandantes disponíveis
Atalho dentro da ficha da embarcação que puxa, do marketplace, os comandantes verificados disponíveis para o período — permite contratar sem sair do contexto do barco.

### 4.9 Selo ouro de venda
- Checklist de requisitos (dados completos, documentos em dia, histórico de motores completo, fotos atualizadas, docagem em dia, avaliação presencial concluída etc.)
- Barra de progresso (ex: 7 de 10 completos)
- Botão "Solicitar avaliação presencial" → aciona a equipe Commander, que vai ao local, avalia fisicamente a embarcação e qualifica o selo
- Selo é um diferencial de venda: embarcação com Selo Ouro sinaliza histórico de manutenção e documentação em dia para um comprador

### 4.10 Gastos financeiros
Painel de controle de despesas — **não é carteira, é acompanhamento pessoal do PROP**, já que a plataforma não retém saldo de terceiros.
- Resumo do mês: total gasto + quebra por categoria (ex: diárias de CMDT, manutenção)
- Gráfico de gasto mensal dos últimos 6 meses
- Lançamentos recentes com ícone por tipo, descrição e valor
- Gastos com diária de CMDT (pagos via plataforma) entram **automaticamente**; demais custos (manutenção, peças, docagem etc.) o PROP lança **manualmente**, podendo vincular o lançamento à aba correspondente (ex: um lançamento de manutenção de motor pode linkar ao histórico da aba Motores)

---

## 5. Permissões do CMDT dentro da embarcação

O acesso do CMDT **espelha todas as abas do PROP** (Motores, Elétrica, Casco, Documentos, Fotos, Contatos etc.). O PROP define, por embarcação, e por aba, se o CMDT pode:
- **Ver**
- **Editar**

Implementação sugerida: matriz de permissão (aba × visualizar/editar), configurável pelo PROP na tela de gerenciamento do CMDT vinculado à embarcação.

---

## 6. Perfil público do Comandante (marketplace)

Tela separada da ficha da embarcação — é a "vitrine" do CMDT para ser contratado por qualquer PROP da plataforma.

**Cabeçalho**: avatar, nome, selo de verificado (carteira/documentação conferida pelo RH da Commander), certificação/especialidade, localização, rating geral (estrelas).

**Métricas em destaque**: vagas fixas ativas, diárias fechadas no mês, total histórico de trampos.

**Ofertas de trabalho**:
- **Vagas fixas** — oportunidades de contrato permanente/temporada
- **Diárias** — trabalhos avulsos/pontuais

**Avaliações**: lista de avaliações recentes (nota + comentário), feitas por proprietários que efetivamente contrataram pela plataforma.

**Verificação (crivo de RH)**: antes de o CMDT poder anunciar publicamente, a equipe Commander confere documentação e carteira profissional. Selo de "verificado" só aparece após essa checagem.

> ⚠️ **Nota jurídica** — o processo de verificação de carteira/RH deve ser validado com advogado antes do lançamento público, para mapear responsabilidade civil em caso de problema causado por um CMDT aprovado pela plataforma.

---

## 7. Precificação de diárias e regra de comissão

### Regra de preço
- **1º fechamento de cada CMDT, valendo globalmente (não importa qual PROP)**: preço fixo definido pela plataforma — atualmente **R$ 350,00**
- **A partir do 1º fechamento pago pela plataforma**: o CMDT libera a definição de preço próprio para todos os fechamentos seguintes, com qualquer PROP

### Pacotes de diárias (após liberado)
- O CMDT decide se **ativa ou não** a opção de pacote — não define o valor do desconto livremente
- Degraus de desconto **padronizados pela plataforma** (ex.: 2–3 diárias = desconto padrão A; 4+ diárias = desconto padrão B — valores exatos a definir)
- Quando o PROP seleciona múltiplas diárias na solicitação, o sistema calcula automaticamente o total aplicando o pacote, se o CMDT tiver ativado

### Comissão
- **10% sobre o valor total da transação** do(s) fechamento(s) sujeitos à regra de preço fixo/comissão
- Piso mínimo sugerido: **R$ 25** (evita comissão desproporcional em trabalhos de valor baixo)
- Fluxo: PROP paga o valor total dentro do app → plataforma retém a comissão → repasse do valor líquido ao CMDT no mesmo dia (a confirmar prazo exato com o gateway escolhido)

### Risco conhecido (aceito, não bloqueante para o MVP)
Como a liberação é global por CMDT (não por par PROP-CMDT), um CMDT pode "queimar" o primeiro fechamento combinando um valor baixo com um PROP conhecido, destravando preço livre rapidamente. **Decisão do produto: não travar isso agora.** Se virar problema relevante de receita, avaliar mudar para regra "por par" em versão futura.

---

## 8. Módulo PRESTADOR (fase 2 — mesma lógica de pagamento)

- **Sem vagas fixas** — apenas **Trabalhos em aberto**: avisos postados pelo PROP com demanda pontual (título do serviço, valor, local, tempo de publicação)
- Trabalhos já aceitos por outro prestador aparecem esmaecidos/indisponíveis na lista
- **Avaliações**: mesmo esquema do CMDT, dado por quem contratou
- **Chat**: mesmo módulo de conversa usado com o CMDT, contextualizado por conversa/trabalho
- Cadastro **gratuito na fase 1** — cobrança dos R$19,99/mês só depois de a plataforma gerar volume real de leads

---

## 9. Módulo de pagamento e assinatura

**Formas de pagamento aceitas**: cartão de crédito (principal) e Pix recorrente. **Sem boleto.**

### Telas do fluxo
1. **Escolha do plano** — valor (com preço promocional em destaque quando aplicável), lista do que está incluso, botão "Assinar agora"
2. **Forma de pagamento** — seleção entre cartão (padrão pré-selecionado) e Pix recorrente; formulário de dados do cartão
3. **Confirmação + liberação de acesso** — assinatura ativa, liberação do app completo, chamada para convidar o CMDT caso ainda não tenha sido feito
4. **Gestão da assinatura** (dentro de configurações) — plano atual, valor, data da próxima cobrança, histórico de faturas (para contabilidade), opção de cancelamento

### Gateway de pagamento
A definir entre: Pagar.me, Asaas, Iugu ou Stripe Connect — todos suportam split de pagamento nativo, o que resolve tanto a cobrança de assinatura quanto o repasse automático da diária ao CMDT.

> ⚠️ **Nota jurídica** — a Commander deve se posicionar contratualmente como mera intermediária de pagamento entre PROP e CMDT/Prestador, sem definir escala de trabalho ou supervisionar a execução do serviço, para evitar caracterização de vínculo empregatício.

---

## 10. Livro de Bordo (nova aba na ficha da embarcação)

Aba própria, separada das demais — é registro de operação/uso, não ficha técnica.

**Campos por saída registrada:**
- Data da saída
- Hora de saída / hora de retorno (duração calculada automaticamente)
- Comandante/tripulação a bordo (puxa de quem está vinculado à embarcação)
- Destino/rota (texto livre ou marcação simples)
- Condições do mar no dia (puxado automaticamente da API de meteorologia usada nos alertas)
- Observações (ocorrência, abastecimento, algo notável)

**Sinergia com Motores**: ao final de cada saída, o app sugere atualizar as horas dos motores com base na duração registrada (ex: "essa saída durou 4h — atualizar horas dos motores?"). Resolve o problema de ninguém manter "horas do motor" atualizado manualmente, aproveitando um hábito mais natural (registrar quando saiu/voltou).

**Valor adicional**: documentação formal de uso da embarcação — útil para seguro, para revenda (comprova baixo uso) e juridicamente (comprova quem estava a bordo em determinada data).

---

## 11. Marketplace de Parceiros Comerciais

Novo tipo de conta: **Parceiro Comercial**, além de PROP/CMDT/Prestador. Painel próprio, simples, sem as abas de embarcação. **Todas as categorias abaixo entram juntas no MVP** — decisão do produto: multiplicar as fontes de receita paralelas (parceiro comercial paga independentemente de já existir volume de proprietários na base), acelerando capital de giro em vez de depender só da assinatura do PROP.

### Categorias de parceiro

1. **Marina**
2. **Posto de combustível marítimo**
3. **Pousada com acesso náutico** (vaga própria e/ou poita)
4. **Restaurante com acesso náutico** (vaga própria e/ou poita)

### Planos (mesma tabela para todas as categorias)

| Plano | O que inclui | Preço/mês |
|---|---|---|
| **Básico** | Aparece na lista/mapa da região, com nome, endereço, contato | R$ 100 |
| **Destaque** | Tudo do básico + preço editável pelo próprio parceiro + posição prioritária no mapa/lista | R$ 200 |

Sem opção de banner/anúncio por enquanto — mesma lógica de "marketplace e anúncios adiados" (ver seção 13).

**Fase de lançamento**: oferecer grátis ou com desconto agressivo (ex: R$49) para os primeiros parceiros de cada categoria, em troca de eles alimentarem preço/disponibilidade atualizados e ajudarem a validar o modelo. Preço cheio da tabela entra depois que cada categoria já tiver parceiros suficientes pra virar prova social entre si.

### Campos por categoria

**Marina / Posto** (já detalhado):
- Vagas disponíveis (mensal), vagas para diária, preço da diária de vaga, preço do diesel (condicional a ter posto próprio), horário, telefone, e-mail, distância (automática)

**Pousada com acesso náutico**:
- Tipo de acesso: vaga própria / poita / ambos
- Quantidade de vagas ou poitas disponíveis
- Calado máximo suportado
- Preço da diária de vaga/poita
- Traslado até a pousada incluso (sim/não)
- Horário de funcionamento / check-in náutico
- Telefone, e-mail
- Distância (automática, GPS)

**Restaurante com acesso náutico**:
- Tipo de acesso: vaga própria / poita / ambos
- Quantidade de vagas/poitas disponíveis
- Calado máximo suportado
- Vaga cobrada ou cortesia para quem consome (campo relevante comercialmente — muitos restaurantes preferem oferecer vaga grátis como isca para atrair cliente)
- Tipo de culinária / faixa de preço
- Horário de funcionamento
- Aceita reserva pela plataforma (sim/não — se sim, integração de reserva é item de fase futura)
- Telefone, e-mail
- Distância (automática, GPS)

### Regras gerais (todas as categorias)

- Limite de 1 atualização de preço/disponibilidade por dia
- Preço/disponibilidade exibe "atualizado há X dias/horas"; se não atualizado há mais de 30 dias, o app sinaliza isso ao proprietário em vez de mostrar dado potencialmente desatualizado como se fosse atual
- Métricas visíveis ao parceiro: nº de proprietários que visualizaram o perfil no período — reforça valor percebido na hora da renovação

### Visualização para o cliente (PROP) — Mapa

- Mapa da região (Google Maps SDK ou Mapbox) com pino diferenciado por categoria (marina, posto, pousada, restaurante) e destaque visual para parceiros do plano Destaque
- Toque no pino abre card resumido; toque no card expande para perfil completo do parceiro (banner, badge de plano, informações principais em destaque, descrição, dados práticos, botões de ação como rota/ligar/reservar quando aplicável)

### Argumento comercial de venda por categoria

- **Marina/Posto**: vendem estrutura/commodity — argumento é visibilidade + comparação de preço
- **Pousada**: vende-se como "apareça para quem já decidiu passear de barco na região — hóspede de ticket alto planejando com antecedência"
- **Restaurante**: vende-se como "atraia cliente novo de embarcação decidindo onde ancorar para comer" — pode justificar parceria por permuta (vaga sempre grátis pro Commander em troca de isenção de mensalidade), não só cobrança direta

---

## 12. Funcionalidades de retenção e engajamento (validadas nesta rodada)

- **Corretor/corretora de seguro náutico parceira** — cotação/renovação de seguro direto pelo app, acionada automaticamente perto do vencimento (ver Documentos). Modelo: comissão de indicação por lead fechado, sem necessidade de integração técnica complexa no início (link/formulário direto).
- **Chat direto com a equipe Commander** — canal de dúvida rápida dentro do app (WhatsApp Business API ou ferramenta tipo Zendesk/Intercom conectada).
- **Alertas meteorológicos** — usando API real (ex: Open-Meteo, StormGlass, Windy API), avisando sobre condição desfavorável de navegação para a região da marina do usuário.
- **Lembretes de boa prática (nunca alegações de fato inventadas)** — ex: "recomenda-se aquecer o motor após períodos parados — já fez isso essa semana?", ou alertas baseados em dado real já existente no app (tempo desde a última atualização de horas/uso).

---

## 13. Fora do escopo desta fase (adiado, não remover da visão de produto)

- Módulo de marketplace de anúncios (fixo/freelance) para monetização adicional
- Cursos de postura e conduta a bordo de yachts, com certificação para marinheiros (mencionado como visão futura)
- Regra de comissão "por par PROP-CMDT" (só se a regra global se mostrar insuficiente)

---

## 14. Checklist do que falta especificar em detalhe

- [ ] Tela de convite do CMDT pelo PROP + tela de matriz de permissões (aba × visualizar/editar)
- [ ] Definição final do gateway de pagamento
- [ ] Valores exatos dos degraus de desconto por pacote de diária
- [ ] Validação jurídica do modelo de comissão/vínculo trabalhista e do processo de verificação de RH
- [ ] Telas de onboarding inicial (cadastro de PROP, CMDT, Prestador, Parceiro Comercial)
- [ ] Especificação de notificações push/e-mail para os alertas automáticos (motores, documentos, gerador, meteorologia)
- [ ] Escolha final entre Google Maps SDK e Mapbox para o módulo de mapa
- [ ] Definir corretora de seguro náutico parceira
