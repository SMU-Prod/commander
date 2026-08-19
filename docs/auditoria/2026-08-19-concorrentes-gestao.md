# Concorrentes de GESTÃO de embarcação — o que existe lá fora e como eles ganham dinheiro

**Data da pesquisa:** 19/08/2026
**Escopo:** o barco **parado**. Manutenção, documento, custo, tripulação, marina, cota, revenda.
Navegação é outra frente e não está aqui.
**Alvo de comparação:** Commander — R$ 49,90/mês (plano Commander) e R$ 69,90/mês (Pro),
confirmados em `web/lib/domain/planos.ts`.

---

## REGRAS QUE GOVERNARAM CADA LINHA

1. **[VERIFICADO]** = a página foi aberta e lida. A URL está do lado.
2. **[ALEGADO]** = a empresa diz de si mesma, ou a imprensa repete, sem segunda fonte.
3. **"não encontrado"** é resposta legítima e aparece muitas vezes aqui. **Nenhum número deste
   documento foi estimado, inferido ou arredondado por conveniência.**
4. Onde o Commander está atrás, está escrito que está atrás.

### O que NÃO foi possível verificar, e por quê

| Item | Motivo |
|---|---|
| **Downloads de qualquer app, de qualquer concorrente** | Google Play é SPA e não renderiza; a App Store não publica downloads. **Não há um único número de instalação neste documento.** Todo "100k+ downloads" que circula por aí vem de agregador terceiro — descarte. |
| **Tamanho de time de qualquer empresa** | LinkedIn inacessível. O único headcount que apareceu (100–115 na Boatsetter+GetMyBoat) é de imprensa, não fonte primária. |
| **Rodadas de investimento dos concorrentes de gestão** | Crunchbase 403, PitchBook e Tracxn com paywall. Os dados de funding aqui vêm de PR oficial ou imprensa. |
| Preço de Seahub, IDEA Yacht, Vessel Vanguard, Voly, Molo/Storable, SpeedyDock, Scribble, Boat Fix, GOST | Venda consultiva. Seis páginas de `/pricing` diferentes retornaram **404**. |
| **Comissão exata da Click&Boat** | Os T&C definem o conceito e **nunca quantificam**. A central de ajuda retornou 403 duas vezes. |
| Take rate do Dockwa sobre reservas | Não publicado. |
| NORMAM da Marinha (regra brasileira de vistoria) | `marinha.mil.br/dpc/normas` retorna **403**. **Nada é afirmado neste documento sobre a regra brasileira.** |
| Custo do MRAA CPO na fonte oficial | `cpoboats.com` derruba a conexão TLS. Os números vieram da imprensa setorial. |
| Preço do Garmin OnDeck; Vesper Cortex, Glomex ZigBoat, Mercury VesselView, Volvo Penta Easy Connect, Sea-Fi, Yacht Protector | Sites retornaram 404, 403, 522 ou recusaram conexão. |
| Encerramento oficial do Nautic-On (Brunswick) | Nenhum anúncio localizado; `nautic-on.com` retorna 403. Só há indícios (ver ficha). |

> **Dois números falsos que circulam e devem ser rejeitados ativamente:** "SpeedyDock a partir de
> US$ 0,99/mês" (é *placeholder* do Capterra, não preço) e "Boatrax US$ 9,99/mês" (só aparece em
> sites de conteúdo gerado por IA; o site real da Boatrax devolve HTTP 402).
>
> **Aviso geral sobre este nicho.** Existe uma camada espessa de conteúdo gerado por IA
> publicando "Top 10 Yacht Management Software 2026" com preços que **se contradizem entre si** —
> o mesmo produto aparece a US$ 49 num site e US$ 140 em outro. Todos esses números foram
> descartados. Se você vir preço de concorrente que não bate com este documento, provavelmente
> veio de lá.

### Achado de método que vale repetir

A **API pública do iTunes** (`itunes.apple.com/lookup?id=` e `/search?term=`) devolve nota e
contagem real de avaliações sem bloqueio. Foi assim que saíram os números de iOS deste documento.

---

## VEREDITO EM DOZE LINHAS

1. **O mercado de software de gestão de barco está cheio de produto e vazio de usuário.** Yacht
   Manager App tem 4 avaliações. Seahub tem 3. TheBoatApp tem 1. Vessel Vanguard tem 9. **Um
   único produto do nicho passou de 100: o YachtWave, que é grátis — e tem 164.**
2. **Esse mercado não se ganha com funcionalidade. Ganha-se com distribuição.** Sua ficha por
   hubs não vence ninguém; seu canal de marina/posto/loja pode.
3. **Apareceu um concorrente que não estava na sua lista e é a ameaça de produto: YachtWave.**
   Grátis até 3 barcos e 5 tripulantes, 4,8 com 164 avaliações, atualizado há dois dias,
   diagnóstico por IA e telemetria sem taxa extra.
4. **Apareceu uma ameaça pior, e ela já ocupou a sua tese: Siren Marine, da Yamaha.** O app é
   grátis, funciona **sem hardware**, faz manutenção com lembrete por horas de motor, guarda
   manuais e float plan — e vende com a frase **"Build resale value with a full maintenance
   history at your fingertips"**. Verifiquei com meus olhos.
5. **A pergunta mais dura do dossiê é quem paga.** Em todo o software de marina e operação
   levantado — Dockwa, Molo, Scribble, SpeedyDock, DockMaster, Marina Master — a **única** receita
   direta do dono encontrada foi o Dockwa+ a US$ 84/ano, que é clube de desconto, não software.
6. **Seu preço está no vale mais hostil da tabela.** Caro demais para brigar com o grátis do
   YachtWave e da Siren, e com os US$ 4,17/mês do Yacht Manager App; barato demais para carregar a
   promessa profissional que sustenta US$ 34+/mês.
7. **O maior buraco técnico é telemetria.** Seu horímetro é digitado à mão — e isso está escrito
   no código como decisão, não como esquecimento (`lib/domain/leituras.ts`: *"horímetro é dado de
   gente, não telemetria"*).
8. **A tese do dossiê que valoriza na revenda NÃO tem prova.** O "10 a 20%" que circula é conteúdo
   de SEO de corretora, sem fonte primária. Nenhum estudo existe.
9. **Mas há uma brecha real e verificada:** o "Carfax dos barcos" (Boat History Report, US$ 59,99)
   **exclui explicitamente registros de manutenção**. O histórico de serviço é justamente o que
   ninguém tem no relatório — e é o que você tem.
10. **A vistoria paga dentro do app não é invenção sua.** Vistoria é exigida para financiar e
    segurar barco usado nos EUA, custa US$ 20–35 por pé, e já existe um selo setorial que junta
    inspeção + histórico + **garantia** (MRAA CPO). **Só que lá quem paga é o revendedor.**
11. **Cotas: você acertou a coluna vazia e errou o tamanho do mercado.** "Cota" no sentido de iate
    fracionado é minúscula (menos de duas dezenas de embarcações nos EUA). O que cresce é **clube
    de barco** (Freedom Boat Club, 450 unidades, 640 mil saídas em 2025).
12. **Duas empresas morreram durante a pesquisa e as duas ensinam a mesma coisa.** Snag-A-Slip
    entrou em **Chapter 7 em outubro de 2025**; YachtNeeds sumiu das lojas em 2022. As duas eram
    marketplace puro sem sistema de registro embaixo. **Se o Marketplace virar o produto principal
    do Commander em vez de camada sobre o dossiê, esse é o desfecho.**

---

## 1. O MAPA — cinco mercados que o dono confunde com um só

| Categoria | O que vende de verdade | Quem paga | Exemplos |
|---|---|---|---|
| **Gestão do barco** (seu concorrente direto) | organização | o dono, direto no cartão | YachtWave, Yacht Manager App, Boating Suite, TheBoatApp |
| **Gestão profissional de iate** | conformidade (ISM/SMS, MLC, USCG) | gestora, family office, operador comercial | IDEA Yacht, Seahub, Vessel Vanguard, Voly, Yotha |
| **Monitoramento com hardware** | prevenção de perda catastrófica | o dono, e o estaleiro que embarca de fábrica | Siren Marine, GOST, Yacht Sentinel, Boat Fix, Sentinel Marine, FloatHub |
| **Marina / vaga / operação** | o sistema de registro da marina | **a marina** | Dockwa, Marina Master, Molo/Storable, DockMaster, Scribble, SpeedyDock |
| **Charter P2P** | **a apólice de seguro**, não o app | o dono, via comissão retida | Boatsetter+GetMyBoat, Click&Boat, Sailo, Barqo, SamBoat |

O erro de leitura mais caro seria tratar os cinco como o mesmo concorrente. **O pagador é
diferente em cada um, e é o pagador que define o produto.**

---

## 2. TABELA MÓDULO × CONCORRENTE × COMMANDER

Legenda: **S** = tem · **N** = não tem (verificado por ausência) · **p** = parcial · **?** = não verificado

### 2.1 Contra a gestão de embarcação (concorrência direta)

| Módulo | **Commander** | YachtWave | Yacht Manager App | Siren Marine | Seahub | IDEA Yacht | Vessel Vanguard | Boating Suite |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Manutenção preventiva | **S** (horas, meses e data fixa) | S | S | S (grátis, por garantia/horas) | S (horímetro por componente) | S | S | S |
| Manutenção **preditiva** (fluido, IA) | **N** | S (AI Mechanic) | N | N | S (curva de óleo) | ? | S | N |
| Telemetria automática | **N — por decisão** | S (sem taxa extra) | N | S (com hardware) | N | ? | N | N |
| Diário / log de bordo | **S** (trilha GPS + GPX) | S | S | p (float plan) | S | S | S | S |
| Documentos com vencimento | **S** | S | S | p (manuais) | S | S | S | ? |
| Controle de custos | **S** (recorrentes + relatórios) | S (a partir de US$ 39) | S | N | S | S | ? | S |
| Tripulação | **S** (carteira) | S | S | N | S (MLC, Hours of Rest) | S | ? | ? |
| **Permissão granular** | **S — 15 áreas × ver/editar** | ? | S (por seção) | N | S | S | ? | ? |
| Cotas / copropriedade | **S** (Enterprise) | N | N | N | N | N | N | p |
| **Votação de orçamento** | **S** | N | N | N | N | N | N | N |
| Agenda de reserva | **S** | N | S | N | N | N | N | N |
| Checklist | **S** | S | S | N | S | S | S | ? |
| Painel de marina/parceiro | **S** (6 tipos) | N | N | N | N | N | N | N |
| **Marketplace de serviços** | **S** (sem comissão) | N | N | N | N | N | N | N |
| Laudo / vistoria no app | **S** (Gold, pago) | N | N | N | N | N | N | N |
| **Histórico p/ revenda** | **S** (transferência leva tudo) | p (OEM) | N | **S (e é grátis)** | N | p [ALEGADO] | N | N |
| Conformidade regulatória | **N** | N | N | N | S | S | S | N |

### 2.2 Contra marina, clube, cota e charter

| Módulo | **Commander** | Dockwa | Marina Master | SpeedyDock | DockMaster | Molo/Storable | Nautical Monkey | NauticEd | Boatsetter | GetMyBoat | Click&Boat | Wavve |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Manutenção preventiva | **S** | N | p (marina) | **S** | N | N | p | N | N | N | N | N |
| Log / diário de bordo | **S** | N | N | N | N | N | N | N | N | N | N | N |
| Documentos do barco | **S** | p | p (seguro) | **S** | N | p | p | N | N | N | N | N |
| **Custos do DONO** | **S** | **N** | **N** | **N** | **N** | **N** | **S** | N | **N** | **N** | **N** | **N** |
| Tripulação e permissões | **S** | N | N | **S** | N | N | S | N | N | N | N | N |
| **Cotas / copropriedade** | **S** | **N** | **N** | **N** | **N** | **N** | **S** | **S** | **N** | **N** | **N** | **N** |
| Agenda de reserva | **S** | S (vaga) | S (vaga) | S | S | S | **S** | **S** | S | S | S | N |
| Checklist | **S** | N | N | **S** | N | N | S | N | N | N | N | N |
| Integração com marina | **S** | S | S | S | S | S | N | N | N | N | N | N |
| Laudo / vistoria | **S** | N | N | **S** | N | N | N | N | N | N | N | N |
| Histórico p/ revenda | **S** | N | N | N | p (dealer) | N | N | N | N | N | N | N |

**Três leituras que importam mais que a tabela:**

1. **As colunas "custos do dono" e "cotas" estão praticamente vazias no mercado inteiro.** Entre
   todas as empresas vivas mapeadas, **duas** fazem cota (Nautical Monkey e NauticEd, ambas
   baratas e rasas) e **duas** fazem custo do dono (YachtWave, só a partir de US$ 39/mês, e
   Nautical Monkey). **Nenhum dos grandes toca em nenhum dos dois.**
2. **Diário de bordo está quase 100% vazio.** Vinte e tantas empresas, uma delas com três décadas
   de mercado, e quase ninguém faz logbook. Isso pode ser oportunidade — **ou pode ser que
   ninguém pague por isso.** Teste antes de investir mais.
3. **As sete últimas linhas da tabela 2.1 são quase todas suas sozinho. As três primeiras são
   quase todas dos outros.** Você ganhou a metade de baixo e perdeu a metade de cima — e a metade
   de cima é a que o dono usa toda semana.

---

## 3. FICHAS — GESTÃO DE EMBARCAÇÃO (concorrência direta)

### 3.1 Siren Marine (Yamaha) — a ameaça mais séria, e ela já ocupou a sua tese

Adquirida pela **Yamaha Motor** — anúncio em 16/12/2021, fechamento em 13/01/2022, **valor não
divulgado**. Fundada em 2011, Newport, Rhode Island. [VERIFICADO — release Yamaha]

**O que importa aqui não é o hardware. É a camada grátis.** A página oficial de owner center da
Yamaha diz, textualmente [VERIFICADO por mim em primeira mão —
https://yamahaoutboards.com/owner-center/siren-connected-boat]:

> *"Right out of the box, the Siren Connected Boat App allows you to: store all boat, location,
> and outboard info; track maintenance and access how-to videos; and elect to receive service
> reminders based on warranty or engine hours"*
> *"Track DIY and dealer-completed outboard maintenance"*
> *"Save a float plan and access videos, manuals, and more"*
> **"Build resale value with a full maintenance history at your fingertips"**

O app é **download gratuito** na App Store e no Google Play. As funções de monitoramento remoto
exigem o hardware Siren 3/3 Pro e assinatura; **manutenção, lembrete de serviço, manuais, float
plan e histórico para revenda não exigem hardware nenhum.**

Em **08/04/2026** lançaram uma reformulação do módulo de manutenção com registro passo a passo de
serviço DIY **mais** histórico de oficina no mesmo lugar — um dossiê de procedência com duas
fontes. [VERIFICADO — release Yamaha]

**Hardware e assinatura** [VERIFICADO — sirenmarine.com/collections/subscriptions e /pages/hardware]:

| Hardware | US$ | | Assinatura celular | US$ |
|---|---|---|---|---|
| Siren 3 | 299,99 | | Mensal | 22,00 |
| Siren 3 Pro | 799,99 | | Sazonal (abr–out) | 150,00 |
| Sensor wireless (cada) | 139,09 | | **Anual** | **225,00** |
| Antena SirenSat | 259,99 | | 3 anos | 575,00 |
| | | | 5 anos | 900,00 |

SirenSat (satélite, exige o plano celular em paralelo): US$ 350/ano, 700/2 anos, 1.050/3 anos.
O preço de entrada **caiu de US$ 599 para US$ 299,99** em cerca de 9 anos.

**Não tem:** controle de custos, cotas, agenda de reserva, tripulação com permissões, checklist,
integração com marina, laudo/vistoria estruturado, marketplace.

**Quem paga:** o dono. E o **estaleiro** — Siren 3 sai **instalado de fábrica** em barcos Yamaha
Sport Boat de 29 pés, distribuído por 2.100+ concessionárias Yamaha nos EUA [ALEGADO].

**Tração** [VERIFICADO via API iTunes]: **4,2 de 5 com 1.192 avaliações**, publicado pela Yamaha
Motor Co. Ltd., primeira versão fev/2024, atualizado 14/07/2026. **É a maior tração de app de
gestão de barco de todo este dossiê, e por uma ordem de grandeza.**

**O que fazem melhor — e dói:**
- **Eles já vendem a sua promessa central, de graça, com a marca Yamaha em cima.** "Build resale
  value with a full maintenance history" é literalmente a frase do Commander.
- **O histórico deles mistura o que o dono digitou com dado real de motor e uso.** Isso é um
  dossiê de revenda muito mais difícil de contestar do que uma planilha preenchida à mão.
- **Assinatura de US$ 225/ano com churn baixíssimo, porque tem uma caixa parafusada no barco.**
  Software puro não copia isso.
- **1.192 avaliações contra 164 do melhor app de gestão puro.** Canal de fábrica ganha.

### 3.2 YachtWave — o melhor produto puro de software, e é grátis

**Módulos** [VERIFICADO — yachtwave.com/owners]: painel, ficha do barco, manuais/fotos/documentos,
motor e mecânica, **AI Mechanic (diagnóstico por IA)**, tarefas atribuíveis, checklists, log de
manutenção, equipamentos, inventário por localização, **logbook com leituras (tanques, horímetro,
posição)**, compartilhamento com família e tripulação, **offline**, **despesas com leitura de
recibo**, tarefas recorrentes, frota multi-barco, **tickets para tripulação reportar problema**,
**telemetria de motor e localização**, plataforma de entrega com marca própria para estaleiros.

**Não tem** [VERIFICADO]: cotas, agenda de reserva, marketplace, integração com marina,
laudo/vistoria. Transferência entre donos na revenda: **não confirmada**.

**Preço** [VERIFICADO por mim em primeira mão — yachtwave.com/pricing]:

| Plano | Preço |
|---|---|
| **Personal** | **US$ 0/barco/mês — até 3 barcos e 5 tripulantes** |
| Personal+ | US$ 9/barco/mês |
| Essentials | US$ 19/barco/mês |
| Pro | US$ 39/barco/mês (aqui entra controle de custos) |
| Ultimate | US$ 49/barco/mês (API, marca OEM) |

Cobrança **por barco**, não por usuário. Anual economiza até 17%. Teste de 15 dias.
**"No Extra Subscription Fees"** para telemetria e leituras automáticas via YachtLINK.

**Quem paga:** o dono (US$ 0–9), o gestor de iate (US$ 19–49) e o **estaleiro/OEM** (Delivery
Platform — o barco sai da fábrica já dentro do app). **Três bolsos.**

**Tração** [VERIFICADO — App Store]: **4,8 de 5 com 164 avaliações**, v4.6.4 **atualizada há 2
dias**. Downloads, investimento e time: não encontrado.

**O que fazem melhor:**
- **O plano grátis deles é maior que o seu.** Personal cobre 3 barcos e 5 tripulantes com
  manutenção, checklist, documentos e inventário completos. Seu `proprietario_free` é *"1
  embarcação; 2 Diários completos; o resto em demonstração"*. **Você cobra R$ 49,90 por algo que
  eles dão de graça, com mais barcos.**
- **AI Mechanic.** Diagnóstico a partir dos manuais e do histórico.
- **Canal OEM com CAC zero e trava de saída.**
- **Cadência de release medida em dias.**

### 3.3 Yacht Manager App — o mais parecido em escopo, metade do seu preço

**Módulos** [VERIFICADO — yachtmanagerapp.com/details]: manutenção com lembretes
(diários/semanais/mensais/anuais/pré e pós-temporada), checklists de pré-viagem, segurança e
marina, inventário com alerta de quantidade, documentos com escaneamento e **rastreio de
vencimento**, custos, combustível, reparos, rotas, calendário, lista de convidados e cardápio,
**"sea toys"** (jet ski, tender) como ativos filhos do barco, API nos planos maiores.
**Tripulação com acesso total ou limitado por seção** — é uma matriz de permissão.

**Não tem** [VERIFICADO]: marketplace, painel de parceiro, cotas, laudo, histórico de revenda.

**Preço** [VERIFICADO por mim — yachtmanagerapp.com/pricing]: BOAT 1 **US$ 49,99/ano** (1 usuário,
1 barco) · BOAT 2 US$ 99,99 · YACHT 6 US$ 299,99 · YACHT 12 US$ 399,99 · VESSEL 24/36 US$ 599,99 e
799,99. Anual, **por embarcação**. Sem plano gratuito.

> **BOAT 1 dá US$ 4,17/mês** — menos da metade do que você quer cobrar, com permissão por seção.

**Tração** [VERIFICADO]: **4,0 de 5 com apenas 4 avaliações**. v1.3.8 de 10/12/2025. Desenvolvedor
ManagerApp d.o.o. Fundação, investimento, time: não encontrado.

**O que fazem melhor:** preço; escada até 36 usuários sem sair do autoatendimento; e o conceito de
**"sea toys"** — jet ski, tender e SUP como ativos filhos. É exatamente o que o dono carioca tem
parado junto com o barco, e você não modela isso.

### 3.4 Seahub — manutenção por condição, de verdade

**Módulos** [VERIFICADO — seahubsoftware.com]: equipamentos com nº de série, manutenção planejada,
**defeitos e manutenção não planejada**, checklists (rondas de praça de máquinas, incêndio),
**ISM/SMS com drills**, inventário, pedidos, documentos com vencimento de certificado, **análise
de fluidos com tendência**, **horímetro por componente**, projetos de estaleiro com custos e
contratados, garantias, frota, acesso multi-departamento, tripulação com licenças, contratos e
**Hours of Rest**, daily logs.

**Não tem:** cotas, agenda de reserva, marketplace, painel de parceiro, trilha GPS.

**Preço:** sem página pública [VERIFICADO]. Capterra registra **a partir de A$ 80 por
feature/mês**, sem versão gratuita — modelo **por módulo**.

**Tração** [VERIFICADO]: 3,7 com **3 avaliações**; v4.0.2 de **27/01/2025** — **mais de 18 meses
sem release no mobile**.

**O que fazem melhor:** **análise de óleo com curva histórica** é manutenção preditiva real, muito
acima de um semáforo. E **"manutenção não planejada"** como fluxo próprio — o barco real é
majoritariamente conserto imprevisto, e você trata isso como ocorrência genérica.

### 3.5 IDEA Yacht — 25 anos vendendo a sua tese, sem nunca prová-la

**Módulos** [VERIFICADO — idea-yacht.com]: base de dados da embarcação, documentos, Hours of Rest,
finanças, estoque e peças, mobile, crewboard com check-in/out, logs & rounds, ISM, **fotos 360°
para reparo e refit**, base de tripulação e convidados, **snag list**. Linhas: IDEA YACHT, FLEET,
**GT** (embarcação menor) e ASSET.

**Preço:** **não encontrado.** Nenhuma página pública.

**Tração:** fundada em **2001** [VERIFICADO]. "+600 bases customizadas" para embarcações de 20 a
180+ metros [ALEGADO].

**Por que essa ficha importa:** a página deles para donos diz **"Protect your asset's value through
consistent, high-standard management"** e *"it also protects the yacht's long-term value, ensuring
it remains a premium asset"* [VERIFICADO — idea-yacht.com/yacht-software/for-owners/]. **É a sua
tese de revenda, dita por outra empresa, há 25 anos — como marketing, sem um único número.** E a
página **não menciona transferência do histórico ao novo dono.**

### 3.6 Vessel Vanguard — vende custo de parada, não organização

**Módulos** [VERIFICADO]: manutenção com atribuição e histórico, inventário hierárquico de peças,
logbook eletrônico com registro de viagem e incidente, **SMS de segurança com requisitos da
USCG**, equipamentos com garantias, documentos, checklists sazonais, serviços OEM, análise de
fluidos, offline.

**Não tem:** marketplace, painel de parceiro, cotas, agenda, custos, integração com marina.

**Preço:** **`/pricing` retorna 404** [VERIFICADO]. Circulam duas faixas contraditórias em fontes
secundárias. **Não use nenhuma — não encontrado.**

**Tração** [VERIFICADO]: 3,7 com 9 avaliações, atualizado há ~5 dias. **Várias avaliações relatam
que não é possível criar conta.**

**O que fazem melhor:** o argumento de venda — **"um dia de barco parado custa mais que um ano de
assinatura"**. Você ancora em organização, e organização concorre com uma planilha grátis.

### 3.7 Os vivos com preço público (âncoras de preço)

| Produto | Preço [VERIFICADO] | Nota / avaliações | Última atualização |
|---|---|---|---|
| **Boating Suite** | US$ 7,99/mês ou **US$ 59,99/ano** | 3,2 ★ / 21 | 30/03/2025 |
| **YachtsApp** | Basic US$ 59,99/ano · Pro US$ 249,99/ano | 5,0 ★ / 1 | data inconsistente |
| **Boat Manager** | **US$ 9,99/ano** | sem avaliações suficientes | 03/08/2026 |
| **TheBoatApp** | Free + Gold/Pro (valor não encontrado) | 4,0 ★ / 1 | há 4 dias |
| **BoatCloud** | **US$ 1.800 por usuário/ano** [Capterra] | 3,5 ★ / 2 | não obtido |

**Boating Suite menciona transparência para barcos com múltiplos sócios** — é o que mais perto
chega de "cotas" entre os apps de dono. As avaliações registram irritação da base antiga com a
virada para assinatura.

### 3.8 Os que não existem, ou morreram

- **YachtNeeds — morto, e nunca foi o que você pensava.** Era um **diretório de fornecedores** para
  tripulação de superiate (+26.000 serviços, +900 portos), lançado em nov/2015 [VERIFICADO —
  superyachtnews.com]. **Nunca teve manutenção, diário, documentos, custos, permissões, cotas ou
  laudo.** App removido das lojas em 01/12/2022 [ALEGADO — manchete do The Triton; o corpo do
  artigo retorna 404]. `yachtneeds.net` está com **certificado SSL expirado**, e
  `blog.yachtneeds.net` **não resolve DNS** [VERIFICADO].
- **Boatly — não existe.** `boatly.com` é página com logo e botão de login, zero produto.
  `boatly.co` **não resolve DNS** [VERIFICADO]. Provável confusão com Boatrax ou Boating Suite.
- **Nautic-On (Brunswick) — forte indício de descontinuação.** Não consta na lista de marcas da
  Brunswick [VERIFICADO — brunswick.com/brands]; **não há app "Nautic-On" na App Store**
  [VERIFICADO]; a cobertura da imprensa setorial **para em agosto de 2020** [VERIFICADO].
  `nautic-on.com` retorna 403 e **nenhum anúncio oficial de encerramento foi localizado.**
- **Correções na sua lista:** *Triton* é um **jornal** de yachting. *Hoylu* é quadro branco
  colaborativo genérico. *Waterway Guide* é guia de navegação. *BoatCloud* é gestão de **marina**.

---

## 4. FICHAS — MONITORAMENTO COM HARDWARE

### 4.1 Seakeeper Ride — **NÃO é software. Risque da lista.**

Digo com todas as letras porque a confusão é fácil: **Seakeeper Ride é hardware puro de controle
de atitude de casco** (VACS), montado no gio, que reduz de 45% a 70% de arfagem e balanço
**enquanto o barco navega** — começa a atuar a 10 mph. **Não funciona com o barco parado.**
[VERIFICADO — ride.seakeeper.com e /faq]

**Zero módulos de gestão.** Não há manutenção, diário, documentos, custos, tripulação, cotas,
reserva, checklist, marina, laudo ou revenda. Não há sequer monitoramento remoto — **exige um MFD
compatível a bordo** (Garmin, Raymarine, Simrad, Navico, Lowrance, Furuno, Humminbird, B&G), e a
interface vive no MFD, não no celular. A única "manutenção" citada é inspecionar o anodo de zinco
a cada 3 meses. **Preço: não divulgado.** Sem assinatura. Garantia de 2 anos.

**Não disputa nada com o Commander.** Se aparece na sua pesquisa, é ruído de marca.

### 4.2 GOST Global — segurança patrimonial, zero gestão

**Quatro linhas apenas** [VERIFICADO — gostglobal.com/products-overview]: Security Monitoring,
NAV Tracking (satélite Inmarsat, geofence, trilha de 90 dias exportável), Video Surveillance com
IA, Asset Tracking.

**Não tem, nenhum:** manutenção, horímetro, diário, documentos, custos, tripulação, cotas, reserva,
checklist, marina, laudo, revenda. Confirmado em duas páginas oficiais distintas. **É uma empresa
de segurança patrimonial que por acaso flutua.**

**Preço:** não publica — só cotação. Revenda encontrada: **Nav-Tracker 1.0 Elite a US$ 2.069,99**
[VERIFICADO — nvnmarine.com] e **pacote GNT-Evolution Hardwired a US$ 4.999,99** [VERIFICADO].
Airtime de US$ 432/ano com 150 mensagens [ALEGADO — não abri a fonte]. **Hardware obrigatório, sem
freemium.**

**Quem paga:** dono de barco grande, frota e **estaleiro** (9 logos de fabricantes no site). O
pacote é vendido como **"insurance compliant"** — o que sugere **exigência** de seguradora, mais
forte que desconto, mas nenhum nome divulgado.

**Tração:** fundada em 2005 como Paradox Marine [ALEGADO]. App "GOST Specter AI": **5,0 com apenas
2 avaliações** [VERIFICADO].

**O que fazem melhor:** satélite Inmarsat em vez de celular — funciona onde não há sinal. Sirene,
strobe e imobilizador agem fisicamente. Vídeo com IA responde *quem está no meu barco agora*.

### 4.3 Yacht Sentinel — o único com desconto de seguro nominal e verificável

**Atenção: o domínio é `yacht-sentinel.com`, com hífen.** Yacht Sentinel France, Boulogne-Billancourt.

**Módulos** [VERIFICADO — /boat-owner/]: geofence, alarme de bateria, inclinação, G-shock, 40+
alarmes, câmera com detecção de intruso, NMEA2000/J1939/CAN, atualização a cada 2 minutos, nível
de combustível, alarme de garra de âncora e encalhe, digital switching, hotspot WiFi.
**Tem "journey history logs" (diário de viagens)** e **"document management system"**. Tem
"automated maintenance notifications" — mas é notificação disparada por sensor, **não agenda
preventiva**. Manutenção por horímetro: **não encontrado**.

**Não tem:** custos, cotas, agenda de reserva, tripulação com permissões, checklist, marina, laudo,
histórico estruturado de revenda.

**Preço** [VERIFICADO — /support/]: **YS Pro a €1.590** (sem IVA e sem frete). Assinatura por zona:
**Standard (Europa, Reino Unido, Turquia, EUA) €10/mês**; Zona J €15; Zona I €20; Zona H €25; Zona
A1 €50. **Inconsistência:** a home anuncia €20/mês enquanto a página de suporte lista €10 para o
Standard — ambos verificados, não sei qual vige. Hardware obrigatório, sem freemium.

**Quem paga:** dono, seguradora (ver 4.7) e **estaleiro** — a Yacht Sentinel publica na App Store
um app **white-label chamado "Fountaine Pajot"**, o estaleiro francês de catamarãs [VERIFICADO].
Isso é embarque de fábrica com a marca do estaleiro por cima.

**Tração:** "desenvolvendo desde 2008", 100+ países [ALEGADO]. Os três apps na App Store americana
("Yacht Sentinel Hub", "YS Pro" e "Fountaine Pajot") têm **0 avaliações** [VERIFICADO]. **Presença
norte-americana praticamente nula — o jogo deles é Europa.**

### 4.4 Boat Fix — vende gente, não software

**Módulos** [VERIFICADO]: bateria, bomba de porão, distância percorrida, **horas de motor**,
geofence, desconexão de shore power, GPS a cada 8 segundos em movimento. Registra horas mas a
empresa é explícita que "não monitora outras funções do motor", e **não há agenda preventiva por
horímetro**.

**O produto real é humano:** central de monitoramento 24/7 com operadores nos EUA, **helpline
mecânica de emergência 24/7** e **suporte por videochamada durante a pane** [VERIFICADO —
boatfix.com/services].

**Não tem:** manutenção agendada, diário, documentos, custos, tripulação, cotas, reserva, checklist,
marina, laudo, revenda. Confirmado em três páginas oficiais.

**Preço:** o site **não publica** — três dispositivos marcados "Call for Pricing". Verificado em
terceiros: **US$ 168/ano de renovação** no programa da America's Boating Club [VERIFICADO —
usps.org] e **CAD 30,00/mês** no Canadá [VERIFICADO]. **Trava dura:** *"If you cancel, your device
will be shut off... you will need to purchase a new device to resume service."* **Cancelou, o
hardware vira lixo.**

**Quem paga:** donos, concessionárias, estaleiros, locadoras e **seguradoras** — para quem vendem
precificação de risco, modelos preditivos e um recurso de **"Incident Review" para determinar culpa
em sinistro** [VERIFICADO — boatfix.com/insurance]. Parceria nominal com a Charter Lakes Marine
Insurance, sem percentual divulgado.

**Tração** [VERIFICADO]: app "Boat Fix Pro" com **4,2 e apenas 10 avaliações**, publicado por uma
pessoa física. Fundação, downloads, rodadas e time: não encontrado.

**O que fazem melhor:** competem com **pessoas atendendo o telefone às 3h da manhã de domingo**.
Quando o alarme de água alta dispara, um humano liga para o dono e para a marina; quando o motor
morre no canal, um mecânico entra em videochamada. É seguro-assistência disfarçado de telemetria.

### 4.5 Sentinel Marine Solutions — não estava na sua lista e deveria estar

Empresa distinta da Yacht Sentinel. **É o concorrente estrangeiro de hardware funcionalmente mais
próximo do Commander.**

**Módulos** [VERIFICADO — sentinelmarine.net/boat-owner]: bateria, shore power, porão, geofence,
detecção de movimento, NMEA2000, **rastreamento de manutenção, lembretes de serviço, viagens
auto-registradas, documentos digitais e checklists**.

**Preço** [VERIFICADO — /pricing]: bundles de **€699 (SafeGuard) a €2.599 (Flagship)**, com planos
anuais **S €150 / M €224 / L €310**.

**Tração:** fundada em 2015; reivindica **45.000+ usuários, 40+ parceiros OEM e 400+ frotas**
[ALEGADO]. App com **4,55 e 44 avaliações** [VERIFICADO]. **As 44 avaliações não sustentam bem a
alegação de 45 mil usuários.**

### 4.6 FloatHub e Boat Command

- **FloatHub** — hardware de US$ 179 a US$ 299; **plano Basic a US$ 0,00/mês** (monitoramento
  contínuo, painel, 24h de histórico) e Enhanced a **US$ 9,99/mês ou US$ 99,99/ano** [VERIFICADO —
  floathub.com/plan/pricing]. **A assinatura mais barata do mercado.** Sem módulos de gestão.
- **Boat Command — pivotou.** Hoje vende **VMS regulatório para pesca comercial**, aprovado por
  ASMFC, ODFW e NOAA, a partir de **US$ 548**; o produto legado está em liquidação por US$ 225.
  Publicidade explícita: **"no activation or software fees"** — sem assinatura. Suporte atendido
  por `support@viatrax.com`, indicando mudança de controle. [VERIFICADO — boatcommand.com]
- **Garmin OnDeck** — existe, é hub de hardware. **Preço não encontrado** (URLs retornaram 404).
  O app ActiveCaptain tem **3,95 com 5.065 avaliações** [VERIFICADO].
- **Argo / argonav.io** — é app de **navegação**, não de gestão. Grátis com premium a US$ 39,99/ano
  [VERIFICADO]. **Não é concorrente.**
- **Não verificados:** Vesper Cortex (erro 522), Glomex ZigBoat (404), Mercury VesselView (403),
  Volvo Penta Easy Connect (404), Sea-Fi (não tentado), Yacht Protector (conexão recusada).

### 4.7 Desconto de seguro — a evidência dura

**Só uma empresa nomeia seguradoras com percentual: a Yacht Sentinel**
[VERIFICADO — yacht-sentinel.com/insurance/].

| Seguradora | Desconto | Cobertura |
|---|---|---|
| **Topsail Insurance** | **7,5% a 10%** | Lanchas, iates e botes, mundial |
| **Must Assurances** | **5% a 10%** | Todos os tipos, Europa e Caribe |
| **Insurnet** | **7,5% a 10%** | Nacional e multinacional |

As demais são vagas ou anônimas. A **Siren Marine** afirma duas faixas diferentes no próprio site,
sem nomear ninguém: *"anywhere from 4% to 10%"* numa página e *"from 5% – 15%"* em outra — **as
duas se contradizem parcialmente** [VERIFICADO em ambas]. **Boat Fix** tem parceria com a Charter
Lakes sem percentual. **GOST** vende pacote "insurance compliant", sem nome e sem número. A faixa
de "10% a 25%" que circula na imprensa vem de **corretora, não de seguradora**, e não nomeia
ninguém.

**Leitura para o Commander:** o desconto de seguro é real, mas **modesto — 5% a 10% na evidência
dura**. Não é isso que vende o produto. É argumento de fechamento, não de abertura.

### 4.8 Dados de sensor como histórico de revenda — quem já faz

**Uma empresa faz explicitamente: a Siren Marine.** *"Build resale value with a full maintenance
history at your fingertips"* [VERIFICADO]. **E o recurso está na camada grátis, sem hardware** —
eles usam o histórico de revenda como isca de aquisição para depois vender o equipamento.

Nenhuma outra empresa deste grupo comercializa histórico como ativo de revenda. GOST, Boat Fix,
Yacht Sentinel e Seakeeper **não mencionam revenda em lugar nenhum**.

---

## 5. FICHAS — MARINA, CLUBE, COTA E CHARTER

### 5.1 Dockwa — o maior de reserva de vaga, e o preço mais transparente do segmento

Subsidiária do The Wanderlust Group. **Comprou o Marinas.com em jan/2017** — diretório com 15.000
marinas e 75.000 locais náuticos, mais os domínios reservenow.com, marinafinder.com e boatbuzz.com
[ALEGADO].

**Módulos** [VERIFICADO — marinas.dockwa.com/marina-software]: Leads, Transient, Captains &
Contracts (contrato digital + assinatura), POS, Fuel Management, Spaces (mapa e inventário de
vagas), Dry Stack, Revenue Management, Boater CRM, Billings & Payments, Insights, Telescope
(precificação por demanda), integrações contábeis.

**Não tem:** manutenção preventiva (há um "Service Management" em *Early Access*, sem descrição
pública), diário, custos do dono, tripulação, cotas, checklist, laudo, revenda. Documentos: só o
contrato de vaga.

**Preço** [VERIFICADO — marinas.dockwa.com/marina-software-pricing, anual]:

| Módulo | US$/mês | | Add-on | US$/mês |
|---|---|---|---|---|
| **Leads** | **0 — "Always"** | | Dry Stack | 99 |
| Transient | a partir de 169 | | Integrations | 84 |
| Captains & Contracts | a partir de 180 | | Insights | 139 |
| Spaces | a partir de 180 | | | |
| Fuel Management | a partir de 199 | | | |
| Point of Sale | a partir de 249 | | | |

**Por marina, modular — não por vaga.** Mais **2–3% de processamento** em todo cartão; a marina
pode repassar **convenience fee de até 4%** ao barqueiro, **proibida em CA, CT, MA, ME, NY, Porto
Rico e Canadá** [VERIFICADO]. **Take rate sobre reservas: não encontrado.** Um review no Capterra
indica que migraram de % puro para **% + assinatura** [ALEGADO].

**Lado do dono:** grátis. Existe o **Dockwa+ a US$ 84,00/ano** — até 50% de desconto em dockagem
transiente e em combustível [VERIFICADO]. **É clube de desconto, não software.**

**Tração:** 4.000+ marinas, 8.000+ operadores, 400.000+ barqueiros [ALEGADO]. **iOS: 4,86 com
33.060 avaliações**, lançado em 2015, atualizado 02/08/2026 [VERIFICADO]. Em jan/2022 falavam em
865 marinas — **cresceu ~4,6x em quatro anos**. **Série B US$ 14,2M em out/2020** [ALEGADO] e
**Série C US$ 30M em 19/01/2022, liderada pela Thursday Ventures** [VERIFICADO — PR Newswire].
*(A Tracxn diz "US$ 28,6M em 7 rodadas", mas B + C sozinhas somam US$ 44,2M — o número da Tracxn
está errado ou separa a subsidiária da holding.)*

**O que fazem melhor:** efeito de rede de dois lados que não se compra; **compraram o topo de funil
em 2017**; **33 mil avaliações com 4,86** é prova social praticamente inatingível para um entrante;
e preço público com tier grátis vitalício enquanto o resto do setor obriga a ligar.

### 5.2 Snag-A-Slip — **EMPRESA MORTA, e é a lição mais valiosa do dossiê**

**Chapter 7 protocolado em 03/10/2025**, U.S. Bankruptcy Court do Distrito de Delaware, **caso nº
1:25-bk-11798**, descrito como "liquidação voluntária de massa **sem ativos**". Barqueiros com
reserva foram orientados a falar direto com a marina. [VERIFICADO — Pirate's Guide to Boating,
09/10/2025]

Confirmação independente por infraestrutura: `snagaslip.com` retorna **404**; `marinalife.com` (a
marca irmã) dá **erro de TLS**; e **nenhum app "Snag-A-Slip" existe mais na App Store** — a busca
retorna Dockwa, PierShare, MarineTraffic, BoatUS e Sea Tow, e nenhuma ocorrência do nome
[VERIFICADO].

Fundada em 2015 em Baltimore por Dan Cowens; levantou US$ 1,2M em 2017 [ALEGADO — Baltimore Sun].
**Causa da morte:** perdeu para o Dockwa e não conseguiu levantar capital nem segurar lealdade
contra um rival com VC que expandiu via Marinas.com.

> **A lição.** Marketplace puro de reserva, **sem software de gestão embaixo**, é negócio que
> quebra. O Snag-A-Slip tinha app bom, marca, dez anos e capital. Morreu porque o valor estava na
> *operação da marina*, não na *transação da reserva*. **Quem só intermedeia vira commodity e
> perde para quem é sistema de registro.** É a mesma morte do YachtNeeds, por outro caminho.

### 5.3 Marina Master — e uma correção de domínio

**O domínio que você me passou está errado.** `marinamaster.com` faz **302 para atom.com** — um
marketplace de domínios à venda. **O site real é `marina-master.com`, com hífen** [VERIFICADO].
Marina Master Ltd., negócio familiar em Ljubljana, Eslovênia.

**Módulos (20+)** [VERIFICADO]: CRM, reservas, faturamento, contabilidade, analytics, POS e venda
de combustível, **Boatyard/Shipyard**, Yacht Club, Charter, **myMarina** (portal do cliente),
hospedagem, F&B, Dock Walk, Movement Control (RFID/NFC/QR/ultrassom), leitura de medidores, CCTV,
feed bancário, Asset Management, Timesheets, Loyalty, terminal de pagamento, FaceID.

**Vereditos um a um:** manutenção preventiva existe, **mas do lado da marina** — para o dono é só
abrir chamado. **Diário de bordo NÃO existe** (Movement Control é entrada/saída da vaga).
Documentos: **parcial** — no myMarina o dono atualiza documento de seguro, é repositório, não
gestão com vencimento. Custos: só da marina; **custo total de propriedade NÃO existe**. Tripulação
e permissões **NÃO existe para o dono**. **Cotas NÃO existe** (o "Yacht Club" é membresia).
Checklist **NÃO existe** como módulo. Laudo e revenda: **NÃO existem**.

O app myMarina dá ao dono: reserva de vaga, check-in automático, atualizar seguro, pedir
içamento/combustível/F&B, pagar faturas, **CCTV ao vivo do barco** e renovação de contrato.

**Preço:** **US$ 100 por usuário/mês** (inicial) [VERIFICADO — Capterra/GetApp]; modular conforme
número de vagas e funcionalidades. O site oficial não publica. Free trial e versão gratuita: sim.

**Quem paga:** **marina, clube, estaleiro ou resort. Nunca o dono.** O dono é usuário carona do
app da marina dele.

**Tração:** 5,0 com 9 avaliações no Capterra e no GetApp. **Idade contraditória:** o site diz "mais
de 33 anos", Capterra e GetApp dizem "mais de 28" — ambos verificados, incompatíveis. Rodadas,
downloads e time: não encontrado.

**O que fazem melhor:** back-office financeiro de verdade (razão geral, feed bancário, câmbio, POS
de combustível, F&B); **mundo físico** (RFID no portão, CCTV ao vivo, medidores por vaga); três
décadas de relacionamento; e **distribuição com CAC zero** — a marina compra e todos os donos dela
ganham o app.

### 5.4 SpeedyDock — o concorrente de funcionalidade mais perigoso do dossiê

**É o único de todo o levantamento que já construiu manutenção preventiva, checklist, documentos,
permissões e vistoria no mesmo produto.**

**Tem** [VERIFICADO — speedydock.com]:
- **Manutenção preventiva** recorrente por embarcação; registro de problema com foto, status e
  responsável; histórico pesquisável por barco; **bloqueio automático de reserva durante manutenção**
- **Checklist** de saída e retorno configurável, contagem de inventário, **captura de assinatura**,
  upload de foto, **vídeo obrigatório pré-partida opcional**
- **Documentos** com upload obrigatório por tipo (licença, seguro, certificação), **controle de
  validade e expiração**, regras de retenção
- **Permissões** Admin/Management/Employee/Member/Renter, **MFA**, acesso por barco e por nível,
  **imposição de certificação de capitão** (recusa reserva de quem não tem habilitação válida)
- **Laudo/vistoria:** formulário configurável + documentação fotográfica de dano no retorno +
  trilha de auditoria
- Agenda em tempo real com sync de calendário, detecção de conflito e créditos de membro
- Dry stack, launch/retrieval, mapeamento de vagas

**Não tem:** diário de bordo, custos do dono, **cotas/copropriedade** (boat club é *associação*,
não copropriedade — não há rateio nem titularidade fracionada), histórico para revenda, horímetro.

**Preço: não publicado.** `/pricing` dá **404**. Pagamentos via AnchorPay próprio, taxa não
divulgada. **5,0 com apenas 5 avaliações** — amostra irrelevante. "500+ operadores nos EUA"
[ALEGADO]. **Nenhuma rodada encontrada.**

**Por que importa:** não é seu concorrente hoje porque atende **operador**, não **dono**. Mas
**parte de 5 dos 11 módulos prontos e bem feitos.** No dia em que decidir atender o dono, ele não
reescreve nada — você é que parte do zero na parte operacional. **A brecha:** tudo lá é do
operador; o barco é ativo da empresa, não patrimônio de uma pessoa.

### 5.5 Nautical Monkey — o único que ataca COTAS de frente

Austin, Texas. Posicionamento literal: *"the best Boat Sharing Program and Boat Partnership Service
company"* [VERIFICADO — nauticalmonkey.com].

**Tem:** **cotas** (percentual de cota, início e fim por membro), agenda de reserva para dividir
uso, permissões (admin adiciona por e-mail), **checklist dinâmico de check on/off**, **controle de
custos** (*"Expense Tracker… add expense, income, and reconciliation of your boat"*), **contrato de
sociedade** ("Boat Sharing Partnership Agreement"). Manutenção: **parcial** — membros abrem
chamado, não há plano preventivo.

**Não tem:** log de bordo, integração com marina, laudo, revenda, votação de orçamento.

**Preço** [VERIFICADO por mim em primeira mão — nauticalmonkey.com/pricing]:

| Plano | Preço |
|---|---|
| Personal | **Grátis** (só você) |
| **Advanced** | **US$ 7,95/mês por barco** ou US$ 49,95/ano — inclui agenda e checklist com sócios, **rastreio de despesas** |
| Deluxe Business | US$ 49/mês — até 5 barcos, 10 membros por barco |
| Premium Business | US$ 199/mês — até 25 barcos, membros ilimitados |

**Tração: não encontrado.** Não localizei app com esse nome na App Store.

**Relevância máxima: se cota é o seu diferencial, este é o benchmark funcional — não o Marina
Master.**

### 5.6 NauticEd myBoat — cota barata, com a melhor mecânica de agenda

**Tem** [VERIFICADO — nauticed.org/boatpartnership]: reservas online com **alocação igualitária
auto-selecionada**, **solicitação de troca (swap)**, lista de espera, **"grab and go" de 48 horas**,
**prevenção de monopólio de uso**, cancelamento sem penalidade.

**Não tem:** manutenção, rateio automático de despesa, votação, documentos.

**Preço** [VERIFICADO]: **Boat Partnership US$ 4,44/usuário/mês** (anual) · Enterprise Starter
US$ 98/mês · Enterprise US$ 198/mês · Enterprise Plus US$ 275/mês (todos + US$ 249 de setup) ·
**acordo de sociedade jurídico US$ 149** (pagamento único).

**Tração: não encontrado.**

**O que fazem melhor:** a mecânica de justiça da agenda. *Swap*, waitlist e anti-monopolização
resolvem a briga real de sociedade de barco — quem fica com o feriado — de um jeito que o Commander
não tem.

### 5.7 Boatsetter + GetMyBoat — fundiram, e o produto deles é seguro

**Notícia que muda o mapa: Boatsetter e GetMyBoat anunciaram fusão em 18/12/2025** [VERIFICADO —
PR Newswire]. Michael Farb comanda a entidade combinada, sede em Miami; valor não divulgado; ambas
as marcas seguem ativas. Investidores da entidade fundida: **Level Equity, Centerbridge Partners e
Yanmar**.

**O que os dois têm:** listagem, calendário, precificação, Instant Book, mensageria, check-in/out
da reserva, add-ons, repasse financeiro, seguro P2P GEICO/BoatUS embutido (Boatsetter).

**O que NÃO têm — verifiquei um a um, e é a lista inteira:** manutenção preventiva, diário,
documentos do barco, custos do dono, tripulação e permissões, cotas, checklist, integração com
marina, laudo/vistoria, histórico para revenda. **Nenhum deles existe.** O "check-in/check-out"
**não é vistoria** — é confirmação de início e fim da locação.

**Take rate — Boatsetter** [VERIFICADO — boatsetter.com/boating-resources/boatsetter-owner-payout-and-fees]:
**dono fica com 90%** se traz seguro comercial próprio (**take rate 10%**); **fica com 65% a 80%**
se usa o seguro deles (**take rate 20% a 35%**). Sem taxa de listagem, sem assinatura. Reembolso de
combustível via Stripe a 2,7% + US$ 0,55.

**Take rate — GetMyBoat, a tabela mais transparente do setor** [VERIFICADO — getmyboat.com/for-owners]:

| Situação | Taxa do dono |
|---|---|
| Reserva pela plataforma, EUA | **11,5%** |
| Reserva pela plataforma, internacional | **14,5%** |
| **Reserva direta via "Getmyboat Charge", EUA** | **1,5%** |
| Reserva direta, internacional | 3% |

Taxa do locatário: 13% EUA / 16% internacional [ALEGADO]. Take rate combinado de ~24,5% a 30,5%
numa reserva de plataforma.

**Tração** [VERIFICADO via API iTunes]: Boatsetter locatário **4,81 com 18.845 avaliações**;
Boatsetter dono **4,75 com 2.490**; GetMyBoat **4,92 com 13.590**. Boatsetter fundada em 2012
(Collaborative Boating, Inc.); **Série B US$ 38M em 02/08/2022** [VERIFICADO — BusinessWire];
funding total ~US$ 74,6M [ALEGADO]. Time combinado 100 a 115 pessoas [ALEGADO].
*(Inconsistência não resolvida: o PR fala em "meio bilhão em reservas em 50 países", a GetMyBoat
diz "184 países", e a imprensa local reportou "US$ 100M+ este ano". Os três não fecham.)*

**O que fazem melhor:**
1. **Seguro como produto, não como parceria.** A apólice P2P com GEICO/BoatUS cobre dono, locatário
   e capitão por reserva. É anos de negociação com resseguro, e é a única razão pela qual um dono
   entrega o barco a um estranho. **É o fosso real deles — não o software.**
2. **Take rate elástico atrelado a risco.** 10% de quem traz seguro próprio, até 35% de quem usa o
   deles. **Eles monetizam a apólice, não a feature.**
3. **O modelo "Charge" a 1,5%** é a jogada mais inteligente do setor: cobram quase nada para
   processar a reserva que o dono trouxe sozinho, e com isso capturam o dado da transação direta —
   que é o que impede o dono de sair da plataforma.
4. **Capital para comprar o concorrente.** Fundiram com o maior rival global.

### 5.8 Click&Boat — o líder europeu, e a comissão é secreta de propósito

**Módulos** [VERIFICADO — clickandboat.com/en/professional-boat-owners]: painel de reservas,
listagem com fotos, mensageria, pagamento e caução, disponibilidade, ofertas promocionais.

**Não tem** — verifiquei os onze: manutenção, diário, documentos, custos, tripulação, cotas,
checklist, contratos, marina, laudo, revenda. **Nenhum existe.**

**Preço — deliberadamente opaco.** Os **Termos e Condições oficiais não publicam nenhum
percentual** [VERIFICADO — abri a página]. O texto define "Click&Boat Commission" como "uma
porcentagem incluída no Preço do Proprietário" que **"pode variar conforme os acordos contratuais
entre a Click&Boat e o Proprietário"**. A central de ajuda, que teria os números, retornou **403**
duas vezes. Fontes secundárias variam de 7% a 26% e **se contradizem entre si — não use nenhuma**.

> **Conclusão honesta: a comissão da Click&Boat é negociada caso a caso e não é pública. Isso é
> escolha de negócio** — permite cobrar mais do dono amador e menos da frota profissional sem que
> um descubra o preço do outro.

**Tração:** **investimento significativo da Permira + Boats Group em 17/07/2021**, valor,
participação e valuation **não divulgados** [VERIFICADO]. **Adquiriu a Nautal** (Barcelona), sua
principal rival europeia, em **28/07/2020** [VERIFICADO — Crunchbase e comunicado oficial]. **iOS:
4,6 com 482 avaliações.** Fundação contraditória: 2013 (Crunchbase) vs **2014** (comunicado
Permira) — ambos verificados, incompatíveis.

*Correção de hipótese que não se sustentou:* **não há evidência de que a Click&Boat pertença ao
Dream Yacht Group.** O que existe é PPF + Groupe Bénéteau adquirindo maioria do Dream Yacht Group —
operação separada. Não confunda.

**O que fazem melhor:** consolidação europeia executada (compraram a maior rival do continente);
sócio estratégico e não só financeiro (**Boats Group**, dona do Boat Trader e do YachtWorld, entrega
distribuição em inventário náutico que dinheiro sozinho não compra); e **comissão privada**, que é
margem que um player pequeno e transparente não consegue extrair.

### 5.9 "Pier" — **NÃO EXISTE**

Não existe empresa, produto ou app chamado "Pier" no mercado náutico. Cinco evidências
independentes [todas VERIFICADAS]:

1. `pier.com` faz 302 para `domaineasy.com/buy-domain/` — domínio à venda.
2. `getpier.com` faz 302 para HugeDomains, listado por **US$ 1.995**.
3. Busca na API da App Store por "pier", 25 resultados: **nenhum app náutico**. O "Pier." real é
   um **seguro digital brasileiro** (Pier Serviços Digitais, 4,89 com 57 avaliações, categoria
   Finance) — **provavelmente a origem da confusão, já que é BR**.
4. Busca por "pier boat", 20 resultados: nenhum app chamado "Pier".
5. `pierapp.com`: página em árabe com "site em breve", da InnovaWide. Casca vazia.

**Os três "Pier" reais com que você pode ter confundido:**
- **Pick a Pier** (pickapier.com) — **o candidato mais provável.** Marketplace de reserva de vaga
  + gestão documental ligando barqueiro e marina, **200+ marinas europeias**, vivo em 2026
  [VERIFICADO]. Fundada em 2017 em Tel Aviv; **US$ 4M em Série A**; 11–50 funcionários [ALEGADO].
  **Não é gestão de barco:** manutenção, custos, tripulação e cotas não existem.
- **PierVantage** — software de estaleiro com contabilidade. Quem paga é o estaleiro. [ALEGADO]
- **EasyPier** — software de gestão de marina. [ALEGADO]

*Honestidade:* existe um app `id1542638864` chamado "Pier Management". A Apple retornou **429**
duas vezes e não consegui confirmar. Ele **não aparece em nenhuma busca náutica** da API, o que
sugere fortemente que não é do setor.

### 5.10 Wavve Boating — app de navegação, não é concorrente

**Tem** [VERIFICADO — wavveboating.com]: 17.000+ cartas oficiais, **sombreamento de profundidade
ajustado ao calado do seu barco**, maré em tempo real, previsão de 7 dias, POIs da comunidade,
auto-rota, cartas offline, integração com display SeaDoo, fleet sharing.

**Não tem — todos os onze:** manutenção, diário, documentos, custos, tripulação, cotas, agenda,
checklist, marina (é só POI no mapa), laudo, revenda. **A sobreposição em gestão é zero.** O risco
é futuro: se entrarem em manutenção, já têm base instalada.

**Preço** [VERIFICADO]: **US$ 11,99/mês ou US$ 69,99/ano**. Trial de 14 dias sem cartão. **Sem
tiers premium** — "ambos os planos dão acesso idêntico". **Por usuário, não por barco.**

**Tração** [VERIFICADO]: **4,75 com 6.193 avaliações**, v5.9.0 atualizada **17/08/2026**, primeiro
lançamento em 12/08/2017 — nove anos.

**O que fazem melhor — e esta é a tática mais acionável de todo o dossiê:** o blog deles **ranqueia
no Google para o preço dos concorrentes** — "Savvy Navvy Cost and Pricing Guide", "Argo Boating App
Pricing Guide", "Navionics Pricing", "C-MAP Cost & Pricing", "Aqua Map Pricing Guide". Interceptam
a busca de compra do rival e convertem. **Custa quase nada e é 100% replicável no Brasil.**

### 5.11 Os outros de marina e charter, em resumo

| Empresa | Status e preço |
|---|---|
| **Molo → Storable Marine** | Adquirida pela Storable em ago/2021; **unificada com a Stellar sob a marca Storable Marine em 21/11/2025** [VERIFICADO — PR Newswire]. Tem gestão de espaços, reservas, **Service Management** (ordem de serviço reativa, não preventiva), POS, CRM, 80+ relatórios. **Preço não encontrado** (`/pricing` dá 404). *Nota de domínio: `molo.com` é uma marca dinamarquesa de moda infantil; o site real é getmolo.com / storablemarine.com.* |
| **DockMaster (Valsoft)** | Adquirida pela Valsoft em 2017 [VERIFICADO]. O mais ERP do grupo: utilidades por medidor, inventário com ordem de compra, **Sales Management** (contrato de venda de barco, F&I, comissões), **financeiro completo com razão geral e conciliação bancária**, agente de voz por IA. **US$ 165 por feature/mês** [VERIFICADO — Capterra]. Sem trial, sem versão grátis. **3,9 com 18 avaliações — a pior nota do dossiê**, com reviews chamando de "legacy system". |
| **Scribble Software / MARINAGO** | Independente, sem aquisição. Locais, mapa da propriedade, contratos com e-signature, faturamento, **integração com bomba de combustível e pay-at-pump**, portal do técnico, Sage Intacct e QuickBooks. **Preço não encontrado** em quatro páginas. **Fundação não encontrada.** |
| **"Marina Manager"** | **NÃO EXISTE como empresa.** É termo genérico de categoria e nome do cargo em inglês. Confusão provável com o Marina Master. Outros reais da categoria: Marinacloud, HarbaMaster, EliteMarinas, Northstar, e o **Marina Edge Pro** a **CA$ 35,95/mês flat** [ALEGADO — Capterra]. |
| **Zizoo** | **ABSORVIDA.** `zizoo.com` faz 301 permanente para borrowaboat.com [VERIFICADO]. |
| **Boatim** | **MORTA/PARADA.** O site mostra só **"WE ARE BACK SOON"**. Sem produto, sem descrição de negócio [VERIFICADO]. |
| **Borrow A Boat** | **Viva.** 20.000+ barcos em 800+ locais, 4,7 com 8.539 avaliações. **Comissão não divulgada.** |
| **Sailo** | **Viva.** 30.000+ barcos, 4,9 com 25.107 avaliações. **Comissão não divulgada.** |
| **Barqo** | **Viva** (Holanda). 4,6 com 30.773 avaliações. **Comissão não divulgada.** |
| **SamBoat** | **Viva.** Listar é grátis, dono define preço e caução. **Comissão não divulgada.** |
| **Nautal** | Adquirida pela Click&Boat em 28/07/2020. Site retorna 403 — estado atual da marca não verificado. |
| **Yotha** | **Não é marketplace.** É **gestão de superiate** em Mônaco: gestão técnica, administração financeira, gestão de tripulação, manutenção e certificação, com software cloud onde o dono tem acesso direto às despesas. **Conceitualmente é o mais próximo do Commander — mas é serviço humano premium, não app.** Preço não divulgado. |
| **Deckee** | App **grátis** com cartas, rampas, checklist de segurança e **logbook automático**. **Quem paga são governos e guardas costeiras** — modelo B2G. O consumidor nunca paga. |

**Padrão do segmento charter P2P, sem exceção:** listagem + calendário + mensagem + pagamento, e
nada mais. **Manutenção, diário, documentos, custos, cotas, checklist, laudo e revenda não existem
em nenhum deles.**

---

## 6. AS TRÊS PERGUNTAS DE NEGÓCIO

### 6.1 A tese do "dossiê que valoriza na revenda" se sustenta?

**Resposta curta: a promessa não tem prova, o buraco de mercado que ela mira é real — e a Yamaha
já plantou bandeira nele, de graça.** São três coisas diferentes e vale separar.

**O que NÃO existe, e eu procurei:**

- **Nenhum estudo, nenhuma pesquisa, nenhum dado primário** relacionando histórico documentado a
  preço de revenda de embarcação. Procurei inclusive modelo hedônico acadêmico aplicado a barco
  usado. **Não existe.**
- O número que circula — **"10 a 20% a mais"** — vem de **conteúdo de SEO de corretora de iates**,
  assinado por "Jason", sem sobrenome e sem fonte [VERIFICADO —
  yachtingexperts.com/maximizing-boat-resale-value-your-2026-sellers-guide/]. A mesma página afirma
  que investir US$ 1.500–3.000/ano em manutenção correlaciona com US$ 5.000–15.000 a mais na venda,
  **também sem fonte**. Abri a página e confirmei: não há referência a estudo, pesquisa ou base.
- Consultores de compra sérios são **qualitativos, nunca quantitativos**. A Blue Matter Marine
  Consulting diz que um arquivo bem mantido "pode mostrar propriedade disciplinada" e que um
  arquivo fino "pode apontar incerteza que deveria se refletir na transação" [VERIFICADO —
  thebluematter.com]. **Nenhum percentual.**

**O que EXISTE, e muda a conversa:**

- **O "Carfax dos barcos" já existe, é grande, e NÃO tem o que você tem.** O Boat History Report
  reúne "120 milhões de registros e 1,4 milhão de eventos negativos" [ALEGADO], é parceiro do
  programa CPO da MRAA e trabalha com State Farm, Progressive e Farm Bureau [VERIFICADO].
  **E exclui explicitamente registros de manutenção e serviço** [VERIFICADO —
  dollarbreak.com/boat-history-report-review/, que lista *"Maintenance and service records"* entre
  os itens **não incluídos**].
- **Existe disposição a pagar comprovada por histórico de barco — mas ela mora no COMPRADOR, na
  hora da transação, e é pagamento único de US$ 59,99** (ou US$ 99,99 por seis) [VERIFICADO].
  **Não é assinatura, e não é o dono que paga.**
- Existe um selo setorial que empacota isso e funciona: **MRAA Certified Pre-Owned** — inspeção de
  **130 pontos**, validação de terceiro (Boat History Report + Titan Certified), exigência de
  histórico sem ocorrência negativa, e **garantia limitada de 55 horas ou 3 meses** [VERIFICADO —
  Soundings]. Custa **US$ 215 de taxa inicial** e **menos de US$ 300 por barco e um motor** para
  não-membros [VERIFICADO — Trade Only Today]. **Quem paga é o revendedor**, mirando o mercado de
  seminovos de **US$ 10 bilhões** na América do Norte.

**E o que atingiu a tese em cheio:**

**A Siren Marine, que é da Yamaha, já vende exatamente essa promessa — de graça, sem hardware.**
*"Build resale value with a full maintenance history at your fingertips"*, na página oficial de
owner center da Yamaha [VERIFICADO por mim]. Não é uma frase parecida com a sua; **é a sua frase.**
E ela vem acompanhada de um histórico que mistura registro manual do dono com dado real de motor e
uso — **procedência com duas fontes**, o que é mais difícil de contestar do que um dossiê digitado
à mão. O recurso está na camada grátis, funcionando como isca de aquisição para vender hardware
depois. Distribuído por 2.100+ concessionárias Yamaha e com **1.192 avaliações** no app.

**Veredito honesto.** A frase *"seu dossiê aumenta o valor do barco na revenda"* **não pode ser
dita como fato** — não existe evidência, e citar percentual seria repetir marketing alheio. E ela
também **não é mais um diferencial**, porque a Yamaha diz a mesma coisa de graça.

O que **é** verificável e defensável: *"o histórico de manutenção é a única parte do passado do
barco que nenhum relatório de histórico cobre, e quando você vende, ele vai junto."* Essa promessa
é mais estreita, mais sólida, e — na parte da transferência — **ainda é sua sozinho**: o Boat
History Report não tem manutenção, a IDEA não menciona transferência, e a Siren não tem fluxo de
passagem de dono. **A tese não morre. Ela encolhe para o único pedaço que ninguém ocupou: o
momento da transferência.**

E há um alerta de modelo embutido: **o mercado precifica histórico no momento da venda, não
mensalmente.** Se a revenda é a promessa central, o dinheiro tende a aparecer numa taxa de
transferência ou de relatório na venda — máquina que você já tem em `/barco/transferir` — e não na
mensalidade.

### 6.2 Quem cobra por vistoria/laudo dentro do app, e quanto? Existe mercado?

**Resposta curta: o mercado de vistoria é grande, obrigatório e caro. O que não existe é alguém
vendendo vistoria DENTRO de um app de gestão do dono. Esse espaço está vazio de verdade.**

**A vistoria é obrigatória, não opcional.** A NMMA — a associação dos fabricantes americanos — diz,
na página oficial do Discover Boating: *"Muitos financiadores não consideram financiar um barco
usado que não passou por vistoria"*, e o mesmo vale para seguradoras [VERIFICADO —
discoverboating.com/resources/marine-surveys-and-surveyors].

**Quanto custa** [VERIFICADO, três fontes independentes]:

| Fonte | Preço |
|---|---|
| **NMMA / Discover Boating** | **US$ 20 a 25 por pé** |
| Maritime Surveyors (tabela pública) | Pré-compra **US$ 28–35/pé** · Seguro **US$ 24–28/pé** · perícia US$ 600 meio dia / US$ 1.200 dia |
| Atlantic Marine Survey (tabela pública) | Vistoria de seguro **US$ 25/pé** · pré-compra **US$ 175/hora** · análise de óleo **US$ 50/amostra** |

Para um barco de 40 a 60 pés — exatamente o seu público — **isso dá US$ 800 a US$ 2.100 por
vistoria.**

**Comparação com o seu Gold** (preços semeados em `supabase/migrations/033_gold.sql`, tabela
`gold_precos`):

| Faixa | Commander Gold |
|---|---|
| Até 30 pés | R$ 1.990 |
| 31–40 pés | R$ 2.490 |
| **41–50 pés** | **R$ 3.490** |
| **51–60 pés** | **R$ 4.490** |
| 61–80 pés | R$ 5.990 |
| 81+ | sob consulta |

**Sua estrutura está certa, e ela é a única do dossiê que está.** Vale registrar um achado que
parece detalhe e não é: **nenhuma empresa de software deste levantamento inteiro precifica por
tamanho de embarcação.** Nem uma. Mas **o mercado de vistoria precifica por pé** — e é justamente o
que o seu Gold faz. Você acertou a régua no único lugar onde ela é usada.

**Quem cobra por vistoria dentro de software hoje:**

- **As ferramentas de vistoria são para o VISTORIADOR, não para o dono.** O Boat Assessor cobra
  **€99/semana ou €199/mês do profissional** e diz explicitamente que **não há caminho para o dono
  contratar uma vistoria pela plataforma** [VERIFICADO — boatassessor.com]. Mesma coisa com Marine
  Wiser, 3D Inspection e Marine Survey .Online.
- **O marketplace de vistoriadores é diretório pago de anúncio**, sem comissão sobre o serviço: o
  marinesurveyor.com vende listagem e site ao vistoriador, e a busca é grátis para o dono
  [VERIFICADO]. Preço da listagem: não encontrado.
- **O único selo que empacota inspeção + histórico + garantia é o MRAA CPO — vendido ao
  REVENDEDOR** (US$ 215 + <US$ 300/barco). Há um segundo nível lançado depois, o **MRAA Verified**,
  para barcos que não alcançam o CPO [ALEGADO — release da NMMA; `cpoboats.com` não abriu].
- A MarineMax vende CPO próprio com inspeção multiponto e **garantia limitada de um ano**, e diz
  que a certificação "sustenta forte valor de revenda no longo prazo" [VERIFICADO — marinemax.com]
  — **afirmação de vendedor, sem número.**
- **O SpeedyDock tem vistoria de verdade** (formulário configurável, foto de dano no retorno,
  trilha de auditoria) — mas para o **operador de clube**, como instrumento de **ganhar disputa de
  dano**, não como selo de valor.

**Veredito honesto: o mercado existe, é obrigatório e o preço é conhecido. Não é invenção sua.**
Mas há duas advertências sérias:

1. **Em todo lugar onde a inspeção certificada virou negócio, quem paga é quem VENDE o barco** —
   revendedor ou estaleiro — porque é ele que captura o ganho. Seu Gold cobra do **dono**, o
   pagador mais difícil dos três. Vale testar cobrar do lado que ganha com a venda.
2. **O MRAA tem uma peça que você não tem: garantia.** O selo deles não diz "o barco foi
   inspecionado", diz "se der problema, tem 55 horas ou 3 meses de cobertura". **É isso que
   transforma um selo em produto.** Sem garantia, um selo é uma opinião cara.

### 6.3 Propriedade compartilhada está crescendo? Quem atende bem?

**Resposta curta: você precisa separar duas coisas que a palavra "cota" junta. Uma é minúscula, a
outra é enorme — e seu Enterprise foi desenhado para a minúscula.**

**O que é pequeno: iate fracionado.** O Regions Bank, em artigo de 05/03/2026, diz que a
propriedade fracionada de iates "permanece um mercado relativamente pequeno nos EUA" e que existem
**"menos de duas dezenas de embarcações fracionadas"** [VERIFICADO — regions.com]. Menos de 24
barcos no país inteiro.

**O que é grande: clube de barco.** O Freedom Boat Club, da Brunswick, abriu a **450ª unidade em
junho de 2026**, em 35 estados americanos além de Canadá, Europa, Austrália, Nova Zelândia e
Emirados; a base é **mais de duas vezes e meia** a de 2019 [VERIFICADO — release Brunswick de
23/06/2026]. Em 2025 os membros registraram **mais de 640.000 saídas**, +5% no ano, terceiro ano
consecutivo acima de 600.000, com **18 unidades passando de 10.000 saídas cada** [VERIFICADO —
release Brunswick de 28/01/2026]. Número de membros e tamanho da frota: **não divulgados**.

**Sobre as projeções de crescimento do mercado fracionado: desconfie.** Os números que circulam
(7,4 bi → 15,8 bi; CAGR de 8,7%, 7,2%, 11,08%, 16,70% — todos diferentes entre si) vêm de fábricas
de relatório que se contradizem. **Não use nenhum.** O único dado com fonte identificável e
responsável é o "menos de duas dezenas" do Regions Bank.

**Quem atende cotas hoje, com preço verificado:**

| Produto | Preço [VERIFICADO] | O que faz | O que NÃO faz |
|---|---|---|---|
| **Nautical Monkey** | Grátis (só você) · **US$ 7,95/barco/mês** ou US$ 49,95/ano · Negócio US$ 49 e US$ 199/mês | cotas com percentual, agenda, **checklist de entrada/saída**, **rateio de despesa**, contrato de sociedade | manutenção preventiva, votação, documentos, pátio |
| **NauticEd myBoat** | **US$ 4,44/usuário/mês** · Enterprise US$ 98–275/mês + US$ 249 setup · contrato US$ 149 | reserva com alocação igualitária, **swap**, waitlist, "grab and go" 48h, anti-monopolização | manutenção, rateio, votação |
| **SpeedyDock** | não publicado (`/pricing` 404) | reservas, frota, manutenção, checklist, **cobrança recorrente**, imposição de certificação | cotas de propriedade, rateio, votação |
| **BoatCloud** | **US$ 1.800 por usuário/ano** [Capterra] | clube/marina, mensalidade, reserva, manutenção | é software de marina, não de dono |

**Veredito honesto — boa e má notícia na mesma frase.**

**Boa:** seu Enterprise é genuinamente mais fundo que qualquer um deles. **Votação de orçamento por
cotistas não existe em nenhum produto que encontrei.** Pátio com check-in/check-out tampouco.
Mecânica com orçamento submetido a voto, idem. **Você não copiou ninguém — foi mais longe.** E
"cota + rateio + manutenção no mesmo produto" não existe no mundo desenvolvido: o YachtWave tem
manutenção forte e cota nenhuma; o Nautical Monkey tem cota e manutenção fraca; os grandes não
tocam em nenhum dos dois.

**Ruim, e é séria:**
1. **O preço de referência do segmento é US$ 4 a 8 por mês.** É um teto de mercado muito baixo
   para carregar cinco faixas de Enterprise.
2. **Seu módulo de cotistas não fala de dinheiro — por decisão de projeto.** O comentário no
   próprio código diz: *"o §13 diz que 'cobrança acontece FORA do Commander' — aqui só existe o
   fato operacional (acesso ativo ou suspenso), nunca valor, vencimento ou situação financeira"*
   (`web/app/(app)/cotistas/page.tsx`). **O concorrente mais barato do segmento tem exatamente o
   que você tirou: rastreio de despesa entre sócios.** Rateio é a briga número um de qualquer
   sociedade de barco. Você entregou a votação do orçamento e deixou de fora quem pagou quanto.
3. **Falta a mecânica de justiça da agenda.** O NauticEd resolve *quem fica com o feriado* com
   swap, waitlist e anti-monopolização por US$ 4,44/mês. É a segunda maior briga de sociedade, e
   sua agenda não tem isso.
4. **O crescimento está no clube, não na cota.** Se a aposta é volume, o pagador com bolso e dor é
   o **operador do clube**, que precisa de reserva, frota, cobrança recorrente e manutenção num
   lugar só — que é o que o SpeedyDock vende.

---

## 7. O QUE COPIAR — e de quem

1. **Plano grátis de verdade — do YachtWave e da Siren.** Os dois dão manutenção completa de graça;
   a Siren dá até o histórico de revenda. Seu free é *"1 embarcação, 2 diários, o resto em
   demonstração"*. **Demonstração não cria hábito; uso cria.** Solte o dossiê completo de 1 barco
   de graça e monetize em cima (segundo barco, tripulação, Enterprise, Gold, parceiro).
2. **Garantia junto com o selo — do MRAA e da MarineMax.** "55 horas ou 3 meses de cobertura" é o
   que separa selo de opinião. **Isso muda o Gold de categoria.**
3. **Vender o selo para quem VENDE o barco — do MRAA.** Eles cobram do revendedor, não do dono,
   porque é o revendedor que captura o ganho. Teste um Gold vendido à marina, ao estaleiro ou ao
   corretor — você já tem o painel de Partner para isso.
4. **Rateio de despesa entre sócios — do Nautical Monkey.** Custa US$ 7,95/mês lá, é a dor número um
   da sociedade de barco, e o seu Enterprise a excluiu de propósito. **Reveja essa decisão.**
5. **Mecânica de justiça da agenda — do NauticEd.** Swap, lista de espera, "grab and go" e
   anti-monopolização. É a segunda maior briga de sociedade e custa US$ 4,44/mês lá.
6. **Manutenção por condição — do Seahub.** Análise de fluido com curva de tendência. Você já tem
   intervalo por horas; falta a leitura que diz *como* o motor está, não só *quando* vence.
7. **"Sea toys" como ativos filhos — do Yacht Manager App.** Jet ski, tender e SUP são o que o dono
   carioca tem parado junto com o barco.
8. **Manutenção não planejada como fluxo próprio — do Seahub — e a snag list da IDEA.** O barco real
   é majoritariamente conserto imprevisto.
9. **O argumento de venda do Vessel Vanguard.** Ancore em custo de parada, não em organização.
10. **A máquina de conteúdo do Wavve Boating.** Eles ranqueiam no Google **para o preço dos
    concorrentes** e interceptam a busca de compra do rival. **É a tática mais barata e mais
    replicável no Brasil de todo este dossiê.**
11. **O "Charge" a 1,5% da GetMyBoat.** Cobrar quase nada para processar a transação que o
    prestador já trouxe sozinho, e com isso capturar o dado. Seu Marketplace hoje não cobra nada e
    também não captura nada — o meio-termo existe e é inteligente.

## 8. O QUE **NÃO** COPIAR — e por quê

1. **Não faça do Marketplace o produto principal.** **Duas empresas morreram exatamente assim
   durante o período desta pesquisa.** O YachtNeeds tinha 26.000 serviços em 900 portos e sumiu das
   lojas em 2022. O Snag-A-Slip tinha app bom, marca, dez anos e capital, e entrou em **Chapter 7
   sem ativos em outubro de 2025** — perdeu porque o valor estava na *operação*, não na *transação*.
   **Quem só intermedeia vira commodity.** Seu Marketplace só sobrevive pendurado no dossiê.
2. **Não copie o hardware do Nauticoncept.** O preço deles **dobrou de €395 para €849** em oito
   anos e o app iOS está **parado desde dezembro de 2021**. Hardware trava capital, suporte e
   velocidade. **Compre telemetria pronta ou integre por NMEA antes de fabricar qualquer coisa.**
3. **Não copie a trava de saída da Boat Fix.** Cancelou, o hardware morre e é preciso comprar outro.
   Isso gera retenção no papel e ódio no mundo real.
4. **Não copie o preço fechado da Seahub, da IDEA e do SpeedyDock.** Preço sob consulta funciona
   quando o comprador é gestora ou operador. Seu comprador é um dono no celular. **Preço escondido
   mata autoatendimento.**
5. **Não copie a promessa de revenda sem número.** A IDEA vende "protege o valor do ativo" há 25
   anos sem provar, e agora a Yamaha diz a mesma coisa de graça. Prometa o que é verificável.
6. **Não persiga o iate fracionado.** Menos de duas dezenas de embarcações nos EUA.
7. **Não repita o "10 a 20% de valorização" em nenhum material.** É conteúdo de SEO sem fonte.
   Repetir número alheio sem base é passivo, não argumento.
8. **Não aposte no diário de bordo como diferencial comercial.** Vinte e tantas empresas mapeadas,
   uma delas com três décadas de mercado, e quase ninguém faz logbook. Ou é oportunidade, **ou
   ninguém paga por isso.** Teste antes de investir mais.

## 9. O QUE A GENTE TEM QUE NINGUÉM TEM

Isto não é lista de features — é o que **não apareceu em nenhum concorrente** desta pesquisa:

1. **Votação de orçamento por cotistas.** Nenhum produto tem. Nem os de cota, nem os de clube, nem
   os de superiate.
2. **Cota + rateio + manutenção no mesmo produto.** YachtWave tem manutenção e cota nenhuma;
   Nautical Monkey tem cota e manutenção fraca; nenhum grande toca em nenhum dos dois.
3. **Marketplace de demanda com proposta e reputação dentro do app de gestão.** Nenhum concorrente
   de gestão tem marketplace. O único que teve não tinha gestão — e morreu.
4. **Painel de parceiro com seis tipos** (marina, posto, loja, prestador, restaurante, pousada),
   quatro deles gratuitos. **Ninguém tem o outro lado do balcão dentro do produto.** Este é seu
   ativo de distribuição, e distribuição é o que decide este mercado.
5. **Vistoria presencial paga, com consultor, protocolo de 8 hubs e preço por faixa de porte,
   dentro do app do dono.** As ferramentas de vistoria lá fora são todas para o vistoriador; os
   selos são todos vendidos ao revendedor; o SpeedyDock faz vistoria mas para o operador ganhar
   disputa de dano. **A combinação "dono pede vistoria pelo app do próprio barco" não existe em
   nenhum lugar que eu tenha encontrado.**
6. **Transferência de propriedade que leva o histórico junto** (`/barco/transferir`: motores, horas,
   manutenções, ocorrências, fotos e documentos continuam com o barco). O Boat History Report **não
   tem** manutenção; a IDEA **não menciona** transferência; a Siren **não tem** passagem de dono.
   **Você é o único que fecha o ciclo dono → dono. Depois do achado da Siren, este é o único pedaço
   da tese de revenda que continua exclusivo — e por isso virou o mais valioso.**
7. **Matriz de permissão de 15 áreas × ver/editar**, com Carteira e Agenda independentes. O Yacht
   Manager App chega perto ("por seção"); ninguém chega nesse nível.
8. **Pátio com check-in/check-out e régua de aprovação**, ligado ao mesmo dossiê.
9. **Precificação por faixa de porte no Gold.** Nenhuma empresa de software do dossiê precifica por
   tamanho de embarcação — mas **o mercado de vistoria precifica por pé**. Você acertou a régua no
   único lugar onde ela existe.

**O que essa lista diz sobre a estratégia:** tudo que é seu sozinho está do lado do **ecossistema**
— parceiro, marketplace, vistoria, cota, transferência. Nada é do lado da **ficha do barco**, onde
o YachtWave e a Siren dão de graça o que você cobra. **Sua vantagem não é o dossiê. É a rede em
volta do dossiê.** O dossiê é o que faz a rede existir — e por isso deveria ser o mais barato
possível.

---

## 10. AS COISAS QUE ELES FAZEM MELHOR — resumo duro

1. **Eles resolvem o problema fora do software, e cobram por isso.** A Boatsetter não vende app,
   vende **apólice P2P com GEICO/BoatUS** — e o take rate sobe de 10% para 35% exatamente na medida
   do seguro. A Siren não vende app, vende **uma caixa parafusada no barco** que sustenta US$
   225/ano com churn quase zero. O Boat Fix vende **um mecânico humano no telefone às 3h da manhã**.
   O Marina Master vende **RFID no portão e CCTV ao vivo**. **Nenhuma dessas vantagens é código — e
   por isso nenhuma é copiável em um ciclo de produto.** Um app puro de gestão compete no terreno
   mais fácil de replicar que existe.
2. **Telemetria: o dado chega sozinho, quando o dono não está olhando.** Um app manual só sabe o
   que o dono digitou, e dono de barco parado não digita nada por seis meses. **A retenção deles
   não depende de disciplina do usuário; a sua depende.** Seu semáforo aceita intervalo por horas,
   mas **as horas são digitadas à mão** — decisão registrada no código, não descuido. É o maior
   buraco técnico do documento.
3. **Dado de sensor é prova; dado digitado é alegação.** Na revenda, na perícia de sinistro e na
   disputa com a marina, o log automático de GPS, as horas lidas do NMEA e o histórico exportável
   valem como evidência de terceiro. A Siren já explorou isso comercialmente ("build resale
   value"); a Boat Fix vendeu isso a seguradora como "Incident Review" para determinar culpa.
4. **Compram distribuição em vez de conquistá-la.** Dockwa comprou o Marinas.com e hoje tem 33.060
   avaliações com 4,86. Click&Boat comprou a Nautal e trouxe a Boats Group como sócia. Boatsetter
   fundiu com a GetMyBoat. Marina Master e Dockwa têm **CAC zero no usuário final**: a marina
   compra, e todos os donos dela recebem o app.
5. **Vendem para quem tem orçamento, obrigação legal e contrato longo.** O dono de barco é cliente
   emocional, sazonal e de ticket baixo. A marina tem folha, obrigação fiscal e contrato que troca
   a cada década. Por isso o DockMaster embute **razão geral e conciliação bancária** — quem
   substitui o sistema que fecha o balanço nunca é trocado.
6. **Preço e plano grátis.** US$ 0 (YachtWave, 3 barcos), US$ 0 (Siren, com histórico de revenda
   incluído) e US$ 4,17/mês (Yacht Manager App, com permissão por seção) contra R$ 49,90/mês.
   **A conta não fecha pela ficha do barco. Só fecha pela rede.**

---

## 11. A PERGUNTA QUE O DOSSIÊ DEIXA NA SUA MESA

O inventário completo da App Store mostra dezenas de apps de "boat maintenance log" e "yacht
management" lançados, **quase todos com zero avaliações**. Os dois únicos que escaparam com tração
real **fugiram do B2C puro**: a **Siren, com hardware e o dinheiro da Yamaha** (1.192 avaliações),
e **Dockwa e Marina Master, vendendo para a marina** (33.060 avaliações).

Existem duas leituras possíveis, e você precisa descobrir qual é a verdadeira antes de escalar:

- **Ou o dono de barco não paga por software de gestão** — e o Commander precisa de uma segunda
  ponta pagante: marina, estaleiro, seguradora ou OEM. Você já construiu o painel de Partner com
  seis tipos e quatro deles gratuitos. **Talvez o plano gratuito errado seja o do parceiro, não o
  do dono.**
- **Ou ninguém tentou direito no idioma, na moeda e na realidade tributária certos** — e o Brasil,
  onde hardware importado de US$ 300 a US$ 5.000 mata a faixa popular inteira, é exatamente onde
  software puro entra e o preço de entrada é zero.

O dossiê não decide isso por você. Mas deixa claro que **a resposta não está na ficha do barco.**

---

*Este documento não alterou nenhum arquivo de aplicação, nenhuma migration e nada no banco. As
referências a `web/lib/domain/planos.ts`, `web/lib/domain/leituras.ts`, `web/lib/domain/gold.ts`,
`web/lib/domain/permissoes.ts`, `web/lib/domain/marketplace.ts`, `web/lib/domain/semaforo.ts`,
`web/app/(app)/cotistas/page.tsx`, `web/app/(app)/barco/transferir/page.tsx` e
`supabase/migrations/033_gold.sql` foram lidas do repositório em 19/08/2026.*
