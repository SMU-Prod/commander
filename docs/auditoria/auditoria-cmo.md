# Auditoria CMO — Commander (pré-lançamento)

**Data:** 07/08/2026
**Escopo:** receita, aquisição, ativação, retenção, marca e plano de 90 dias. Não é auditoria de código.
**Fontes verificadas:** espec de negócio (`C:\Users\erick\Downloads\COMMANDER_especificacao_completa.md`), espec v2 (`C:\Users\erick\GEST-NAV\docs\superpowers\specs\2026-08-06-commander-v2-design.md`), código real em `C:\Users\erick\GEST-NAV\web` (rotas, menu, motor de alertas).

**Estado confirmado no código:** a única rota pública é `/login`; a raiz redireciona para `/hoje` (área logada). "Assinatura e faturas" existe apenas como placeholder "Em breve" no Menu. Zero billing, zero analytics, zero pixel, zero landing. O motor de alertas push+e-mail existe (`/api/alertas/disparar`) mas não há cron agendado. Marketplace é vitrine sem transação.

---

## Sumário executivo

O Commander tem um produto de gestão razoavelmente completo e **nenhuma máquina de receita ao redor dele**. Hoje é impossível: descobrir o produto (sem página pública), entender o preço (sem página de preços), pagar (sem gateway) e medir qualquer coisa (sem analytics). A promo de 100 fundadores existe só no papel — não há onde assinar. O maior risco não é concorrência: é lançar um app com cara de lista de texto para um público que compra estética, e queimar a primeira impressão numa praça pequena onde todo mundo se conhece. A boa notícia: o mercado-alvo é concentrado (3-4 marinas cobrem a maioria dos barcos de 40-60 pés do RJ), o canal de confiança já existe (o comandante) e não há concorrente nacional com Pix, português e marketplace.

**Tese central de GTM:** o comandante é o canal, a marina é o ponto de venda, o dossiê de revenda é a narrativa, e os 100 fundadores se conquistam por concierge — não por tráfego.

---

## 1. Aquisição — hoje ninguém descobre o Commander

### Estado atual
- Não existe site. `/` → redirect para `/hoje` → middleware manda para `/login`. Um dono de lancha que receber o link vê um formulário de login de um produto que ele nunca ouviu falar.
- Sem SEO (nada indexável), sem redes sociais, sem material comercial, sem analytics para saber se alguém sequer tentou entrar.

### O que falta, em ordem de prioridade

1. **Landing page pública** (bloqueador absoluto). Uma página: promessa ("Gestão completa da sua embarcação"), 3 blocos de valor (alertas de vencimento / histórico que valoriza a revenda / comandantes verificados), screenshots bonitos (só depois da repaginação 1.5), preço com a promo fundadores + contador regressivo real ("restam 87 vagas"), CTA "Quero ser fundador" → formulário curto → WhatsApp. Custo: 1-2 dias de trabalho. Retorno: é a fundação de todo o resto.
2. **Analytics + pixel** (PostHog ou Plausible + Meta Pixel) no dia 1 da landing. Sem isso, todo real gasto em canal é dinheiro às cegas.
3. **Perfil Instagram** com conteúdo de bastidor de marina (não de app). Nesse nicho o Instagram é vitrine de credibilidade, não canal de conversão.

### Canais reais para dono de lancha 40-60 pés no RJ (ranqueados)

| # | Canal | Como funciona | CAC estimado | Nota |
|---|---|---|---|---|
| 1 | **Comandante embaixador** | CMDT gerencia 2-5 barcos e tem a confiança do dono. Perfil grátis + R$ 100-150 por dono convertido | **R$ 100-200** | O melhor canal. O marinheiro é quem sofre com a planilha — ele vende o alívio |
| 2 | **Rede direta do fundador** | Círculo do Erick + indicações 1:1 | ~R$ 0-50 | Primeiros 10-20 assinantes saem daqui |
| 3 | **Parceria com marinas** | Marina da Glória, BR Marinas (Verolme, Frade, Bracuhy, Piratas — Angra), Marina Porto Búzios. Oferta: dashboard da frota/benefício ao cliente em troca de indicação ou rev-share 10-15% | R$ 100-300 | 3-4 contratos cobrem a maior parte do TAM do RJ. Risco: marinas pedem exclusividade |
| 4 | **Revendas e brokers** | Estaleiros/dealers (Schaefer, Fibrafort, Triton, Focker, Azimut, Intermarine, Okean) e brokers de seminovos: 1 ano de Commander de brinde na entrega do barco | R$ 400-800 (12 meses subsidiados) | Broker é aliado natural da narrativa "barco com dossiê vende melhor" |
| 5 | **Grupos de WhatsApp** | Grupos de marina/condomínio náutico/turmas de Angra. Entrada via membro (comandante ou fundador), nunca spam | ~R$ 0 | Canal onde esse público realmente vive. Conteúdo: alerta útil ("vistoria da Marinha muda em X"), não propaganda |
| 6 | **Rio Boat Show** (Marina da Glória, ~abr/2027) | Não pagar estande próprio no ano 1 (R$ 50-150k). Pegar carona no estande de um estaleiro/marina parceira + ativação de guerrilha | R$ 500-1.500 | Planejar desde já; é o evento âncora do ano |
| 7 | **Seguradoras náuticas** (Essor, Porto Seguro, Mapfre) | Histórico de manutenção reduz sinistro → desconto na apólice para usuário Commander | médio prazo | Parceria de credibilidade, não de volume, no ano 1 |
| 8 | **Meta/Google Ads** | Público minúsculo e mal segmentável; "app gestão embarcação" tem volume de busca quase nulo | R$ 800-2.000+ | **Não fazer no ano 1.** Só remarketing de visitantes da landing (verba mínima) |

**Tamanho de mercado (ordem de grandeza):** lanchas de 40-60 pés no RJ ≈ 2.000-3.000 cascos (Glória ~400 vagas molhadas; complexo BR Marinas em Angra ~2.000+ vagas somadas; Verolme ~450; Búzios/Cabo Frio o restante — nem toda vaga é 40-60 pés). TAM RJ ≈ R$ 250-350k MRR teórico a preço cheio. **Meta realista ano 1: 3-4% de penetração = 80-100 assinantes = R$ 8-12k MRR.** É um nicho: o jogo é penetração profunda em poucas marinas, não mídia paga.

---

## 2. Ativação e valor percebido — o "aha" está atrás de 40 minutos de digitação

### Diagnóstico
- **Aha moment real:** o primeiro alerta que salva o dono de um problema — "seu seguro vence em 15 dias", "faltam 37h para a troca de óleo". É genuinamente bom.
- **Problema:** para chegar lá, o dono precisa cadastrar motores (marca, série, horas, intervalos), documentos (validades) e itens — dados que ele **não tem na cabeça**. Estão na pasta no barco ou na memória do marinheiro. Time-to-value hoje: dias a semanas. Para um produto que quer cobrar R$ 119/mês, é mortal: o churn de trial acontece antes do primeiro alerta.
- Segundo agravante: quem tem os dados (CMDT) não é quem paga (PROP). O onboarding atual pede ao pagador o trabalho que é do operador.

### Correções, em ordem de impacto

1. **Concierge de onboarding para os 100 fundadores** (fazer coisas que não escalam). A equipe cadastra o barco: visita de 1h na marina ou call de 40 min com o marinheiro. Custo ~R$ 80-150/barco; garante ativação ~100%, gera relacionamento e vira o argumento de venda ("a gente monta o dossiê do seu barco pra você"). **É a decisão de ativação mais importante do lançamento.**
2. **Cadastro pelo comandante:** o fluxo de convite CMDT já existe — inverter o onboarding: o dono assina, convida o marinheiro, e o app guia o marinheiro a preencher a ficha. Gamificar com a barra de completude do Selo Ouro (já especificada).
3. **Importação por foto:** fotografar TIE, apólice e plaqueta do motor → OCR pré-preenche (LLM de visão resolve isso barato hoje). Reduz o cadastro de documento de 5 min para 30 s.
4. **Templates por modelo:** Schaefer 510, Fibrafort F460 etc. já vêm com motorização típica e intervalos de revisão padrão — o dono só confirma.
5. **Valor antes do cadastro:** boletim do mar + trilha GPS já funcionam sem nenhum dado do barco. Colocar na frente do onboarding: o app é útil no minuto 1, e o cadastro vem depois.

**Métrica de ativação (definir e medir):** barco com ≥1 motor com horas + ≥3 documentos com validade + push aceito, **em até 7 dias**. Meta com concierge: ≥80%. Sem concierge, hoje, estimaria <25%.

---

## 3. Retenção — alerta sozinho não segura assinatura

### Diagnóstico
Alerta é o gancho certo, mas é evento raro (mensal, na melhor hipótese) e de "manutenção do medo". Entre um alerta e outro não há motivo para abrir o app → a assinatura vira "mais uma cobrança no cartão" → churn na primeira revisão de gastos do dono (e esse público revisa).

### O que adicionar (ordem de esforço × impacto)

1. **Relatório mensal por e-mail** — "Seu barco em agosto: 14h de motor, R$ 8.450 em gastos, 2 itens vencem em setembro". Esforço baixo (motor de e-mail já existe), cria hábito mensal e justifica a fatura **mesmo sem abrir o app**. É a defesa nº 1 contra churn.
2. **Custo por hora navegada** — o número que esse público comenta no píer. Deriva dos gastos + horímetro já existentes. Vicia e gera boca a boca.
3. **Dossiê de venda / Selo Ouro** — o histórico acumulado vira ativo financeiro na revenda (barco documentado vende mais rápido e melhor, como carro com revisões de concessionária). Transforma cancelar em "queimar patrimônio": quanto mais tempo assinante, mais valioso o dossiê. **É o melhor anti-churn estrutural do produto.**
4. **Sazonalidade:** uso real do barco: 2-4 saídas/mês no verão, quase zero no inverno → churn de inverno é certeza no plano mensal. Resposta: **plano anual com 2 meses grátis** empurrado desde o início, e pauta de inverno ("docagem e manutenção é agora") para o relatório mensal.

**Métricas:** retenção D30 ≥ 85% e M3 ≥ 75% nos fundadores (com concierge, abaixo disso o problema é produto, não marketing).

---

## 4. Monetização — preço certo, urgência desperdiçada, ovo-e-galinha administrável

### Preço
- **R$ 119/mês está certo, talvez barato.** Custo mensal de uma lancha de 50 pés no RJ: R$ 15-30k (vaga R$ 4-8k, marinheiro R$ 3-5k CLT/diárias, seguro, combustível, manutenção). Commander = ~0,5% do custo do barco. **Preço não será a objeção; confiança e valor percebido serão.** Há espaço para R$ 149-199 no futuro com ancoragem ("menos que meia diária do seu marinheiro").
- **Ancoragem hoje inexistente:** sem página de preços não há como ancorar nada. Na landing: R$ 119 riscado → R$ 69,99 fundador → e o plano anual como oferta principal.

### Promo 100 fundadores — desperdiçada
- Sem landing, sem contador, sem prazo, sem como pagar, a promo não gera urgência nem existe publicamente. Pior: **não há billing implementado (fase 6 do roadmap)** — se um fundador quiser pagar hoje, não consegue.
- **Correção imediata: pré-venda manual.** Link de pagamento (Pix/cartão via Asaas ou InfinitePay, sem integração — dá pra ter no ar em 1 dia) + planilha de controle + ativação manual da conta. Fatura pelo gateway de verdade quando a fase 6 chegar. Receita e validação **antes** do código de cobrança.
- **Fundador tem que ser status, não desconto:** preço R$ 69,99 travado enquanto assinar, selo "Fundador #23" no perfil, grupo de WhatsApp com o fundador da empresa, prioridade no concierge. Contador regressivo real na landing.

### Marketplace (comissão 10%, R$ 350 no 1º fechamento, R$ 19,99 CMDT)
- Modelo bem desenhado (split, sem retenção de saldo, piso R$ 25 — ok). O risco de "queimar o 1º fechamento" já foi aceito conscientemente na espec; concordo com a decisão.
- **Ovo-e-galinha: o lado fácil é o comandante** (quer trabalho, custo zero de entrada). Recrutar **20-30 CMDTs verificados de Glória + Angra ANTES do lançamento público** — vitrine curada com foto e perfil bons. Vitrine vazia no dia 1 mata a percepção premium; vitrine com 25 comandantes reais de rosto conhecido na marina vende sozinha.
- **Não cobrar os R$ 19,99 do CMDT tão cedo** (a espec já prevê "depois", manter firme por 12+ meses): o comandante é canal de aquisição, fonte de dados do barco e povoamento do marketplace. Cobrar dele cedo é taxar o próprio motor de crescimento.
- **Não prometer "verificado" em material público antes do parecer jurídico** (§6 da espec) — ver riscos.

---

## 5. Marca e narrativa — o risco do "grotesco"

### Diagnóstico
A identidade promete yacht clube (navy + dourado, "premium") e o app hoje entrega listas de texto — o próprio dono chamou de "grotesco". Para este público **a dissonância é fatal**: gente que compra barco de R$ 3-8 milhões compra estética e status. A venda vai acontecer com o celular na mão, no píer, mostrando a tela para um vizinho de vaga — se a tela não impressionar em 5 segundos, não há segunda chance. E a praça é minúscula: a primeira impressão ruim circula nos mesmos 5 grupos de WhatsApp onde o produto precisaria crescer.

### Decisões
1. **Gate de lançamento: repaginação 1.5 pronta antes de qualquer exposição pública** (landing com screenshot, demo em marina, post). Fundadores recrutados 1:1 toleram app feio com concierge; público frio, jamais. Priorizar as 2 telas de demo: **Início (card do barco + semáforo)** e **ficha do motor com horímetro** — são elas que aparecem no píer.
2. **Narrativa de lançamento: "o dossiê do seu barco".** Ganha de "gestão" (genérico, cheiro de ERP) e de "segurança" (dono não admite desleixo). *"Seu barco com histórico completo: manutenção em dia, documentos alertados, e um dossiê que vale dinheiro na hora de vender."* Aponta para o Selo Ouro, dá argumento ao broker e ao marinheiro, e transforma assinatura em investimento patrimonial. Mensagens de apoio: "chega de depender da memória do marinheiro" / "tudo do barco no seu bolso".
3. **Assets mínimos pré-lançamento:** landing premium; vídeo de 60s (barco + marina + telas, sem cara de screencast); one-pager PDF para marinas/brokers; template de proposta para parceria.

---

## 6. Riscos de GTM

| Risco | Gravidade | Mitigação |
|---|---|---|
| **Jurídico — vínculo empregatício e responsabilidade por CMDT "verificado"** | Alta (bloqueia fase 7 e limita o discurso desde já) | Parecer advogado ANTES de material público usar "verificado". Até lá: "documentação conferida". Contratos posicionando a Commander como intermediária, sem definir escala/supervisão (já mapeado na espec §6/§9 — executar) |
| **Concorrência real: planilha + WhatsApp + caderno do marinheiro** | Alta (é inércia, não feature) | Concierge elimina o custo de troca; o comandante-canal converte o guardião do status quo em vendedor |
| **Apps internacionais (Boat Fix, Fleet Monitor, BoatOn)** | Baixa hoje | Sem português, sem Pix, sem marketplace BR, sem presença local. Janela aberta ~18-24 meses; mover rápido nas marinas é a defesa |
| **Sazonalidade náutica** | Média | Lançar set-out (pré-temporada: docagem/preparação = pitch perfeito; verão = uso máximo). Plano anual contra churn de inverno. Rio Boat Show ~abril como marco de escala |
| **Vender promo sem conseguir cobrar** (billing é fase 6) | Alta | Pré-venda manual via link de pagamento já (seção 4) |
| **Dependência de poucas marinas / pedido de exclusividade** | Média | Nunca dar exclusividade de plataforma; no máximo exclusividade de benefício por 6 meses |
| **Praça pequena castiga lançamento ruim** | Alta | Gate visual (1.5) + fundadores fechados 1:1 antes de qualquer exposição ampla |
| **Zero instrumentação** | Alta | Analytics no dia 1 da landing; sem funil medido não há CAC, não há decisão |

---

## 7. Plano de lançamento — 90 dias

**Pré-condições de produto (paralelo, semanas 1-6):** repaginação 1.5 concluída; cron dos alertas ligado (o motor existe e está parado — é o coração do produto desligado); fase 2-3 do roadmap.

### Fase A — Fundação de receita (semanas 1-4)
- **S1:** Landing page no ar (promessa, preço, contador de vagas fundador, CTA → WhatsApp). Analytics + pixel. Definir e instrumentar métrica de ativação.
- **S2:** Link de pagamento manual (Asaas/InfinitePay) — pré-venda fundador funcionando de ponta a ponta. Roteiro do concierge de onboarding (checklist de 1h). One-pager PDF.
- **S3:** Recrutar 10 comandantes de Glória/Angra para a vitrine (perfil grátis + promessa de leads). Vender para 5 fundadores da rede direta, **com concierge completo em cada um** — são o laboratório.
- **S4:** Vídeo 60s + Instagram no ar. Primeira conversa formal com 2 marinas (Glória + uma de Angra). Ligar o cron de alertas para os fundadores ativos.
- **Meta D30:** 10 fundadores pagos · ativação ≥80% · 10 CMDTs na vitrine · landing medindo visita→lead→venda.

### Fase B — Motor de indicação (semanas 5-8)
- **S5:** Programa comandante embaixador formal: R$ 100-150 por dono convertido (ou 2 meses de destaque na vitrine). Entrar em 3-5 grupos de WhatsApp via fundadores/CMDTs, com conteúdo útil.
- **S6:** Fechar 1ª parceria de marina piloto (benefício aos clientes + indicação). Primeira ronda de entrevistas de valor com os 10 fundadores → ajustar narrativa da landing.
- **S7:** Relatório mensal por e-mail v1 no ar (defesa de churn). Oferta de plano anual (2 meses grátis) para a base.
- **S8:** Demo day informal no píer da marina parceira (café + demo 1:1, sem palco). Revisão de CAC por canal com dados reais.
- **Meta D60:** 30 fundadores pagos · ≥30% vindos de indicação CMDT · retenção D30 ≥85% · 1 marina parceira ativa · 20 CMDTs na vitrine.

### Fase C — Escala na praça (semanas 9-13)
- **S9-10:** Segunda marina (Angra ou Búzios). Abordar 2 brokers/revendas com o pitch do dossiê ("barco com Selo Ouro vende melhor") — piloto de brinde de 12 meses na entrega de barco.
- **S11:** Case de fundador (vídeo curto: dono + marinheiro + barco). Testar remarketing mínimo (só visitantes da landing, R$ 1-2k).
- **S12:** Iniciar negociação de presença no Rio Boat Show 2027 via estande de parceiro. Parecer jurídico do "verificado" encomendado (pré-requisito da fase 7).
- **S13:** Retro dos 90 dias: CAC por canal, cohort de retenção, decisão de dobrar aposta (comandante vs marina) e gatilho para fase transacional do marketplace.
- **Meta D90:** **60-80 fundadores pagos (R$ 4,5-6k MRR)** · ativação D7 ≥75% · retenção D30 ≥85% · ≥40% das vendas por indicação · 2 marinas + 1 broker parceiros · 25-30 CMDTs na vitrine.

### Métricas que importam (nada de vaidade)
1. **Assinantes pagantes** (pré-venda conta; cadastro grátis não conta)
2. **Ativação D7** (barco com motor+horas, 3 docs com validade, push aceito)
3. **Retenção D30 / M3** por cohort
4. **% de vendas por indicação** (mede se o motor comandante/boca-a-boca liga)
5. **CAC por canal** vs LTV estimado (R$ 69,99 × margem × vida média — a R$ 69,99 e 24 meses de vida, LTV ~R$ 1.400: qualquer CAC < R$ 400 é saudável)

### Orçamento estimado dos 90 dias
Concierge (80 onboardings × R$ 120) ~R$ 10k · comissões embaixador (25 × R$ 125) ~R$ 3k · vídeo + foto + landing ~R$ 8k · eventos/demo days ~R$ 3k · remarketing teste ~R$ 2k · jurídico ~R$ 5-8k → **~R$ 31-34k para chegar a R$ 5-6k MRR com motor de indicação validado.** Payback ~6 meses; para um nicho com churn estruturalmente defendido pelo dossiê, é um bom negócio.
