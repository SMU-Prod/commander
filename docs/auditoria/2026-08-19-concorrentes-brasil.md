# Concorrência brasileira — Commander

Levantamento de 19/08/2026. Feito com navegador real, leitura das telas publicadas, inspeção do
bundle JavaScript dos produtos e consulta às lojas de aplicativo.

## Como ler este documento

Cada afirmação vem marcada:

- **[V] VERIFICADO** — eu vi na tela, na ficha da loja ou no código publicado. Tem URL.
- **[A] ALEGADO** — é o que o concorrente diz de si mesmo em material de marketing. Não confirmei.
- **[?] NÃO VERIFICADO** — tentei e não consegui. O motivo está escrito.

Marketing não é funcionalidade. "Revoluciona a gestão" não entra. Só entra o que dá para apontar
o dedo.

### O que eu não consegui verificar em nenhum concorrente, e por quê

Lacuna declarada vale mais que suposição. Estas são as minhas, sem maquiagem:

- **Área logada de qualquer produto.** Verificar exigiria criar conta em serviço de terceiro, o que
  eu não faço. Tudo que está atrás de `/login` está marcado como não verificado, mesmo quando a
  rota existe e o nome do módulo é conhecido. **Isto é a maior lacuna do documento**: eu mapeei o
  que os concorrentes *têm*, não o quanto aquilo funciona bem.
- **Nenhum app foi instalado e usado.** Toda avaliação de qualidade aqui vem de prints de loja,
  telas publicadas em landing page e inspeção de código. Vale especialmente para o **Booat**, cuja
  promessa de navegação é a mais importante de checar e a que menos consegui checar.
- **Instagram.** Perfis como "restricted profile", exigem login. Seguidores e data do último post:
  não verificados para ninguém.
- **LinkedIn — tamanho de time: não encontrado para nenhuma empresa.** A consulta exige
  autenticação.
- **Reclame Aqui: nenhum dado obtido para nenhuma empresa.** O site retorna **403**.
- **Bombarco e DK MAR: sites retornam 403 por inteiro.** Tudo que consta deles é alegação de
  terceiros, não confirmada na fonte.
- **Faixas de download no Google Play** foram obtidas quando a página carregou; onde a loja
  truncou, está escrito "não encontrado".
- **Descoberta por buscador ficou incompleta**: o orçamento de busca da sessão (200 consultas)
  esgotou no meio do trabalho. O restante foi feito por acesso direto aos sites, pela API pública
  da App Store e por leitura das fichas do Google Play. **Pode haver concorrente sem app de loja
  que escapou desta varredura.**

Onde não há dado, está escrito "não encontrado". **Nenhum número neste documento foi estimado.**

---

# 1. Onsailing — o concorrente real

**É o único concorrente que disputa exatamente o mesmo cliente, na mesma praça, com o mesmo
discurso e na mesma faixa de preço.** Todo o resto do mercado, como se verá, vende para a marina,
não para o dono.

## Identidade

| Campo | Dado | Fonte |
|---|---|---|
| Razão social | ONSAILING BRASIL LTDA | **[V]** Termos de Uso embutidos no bundle de `onsailing.app` |
| CNPJ | 62.105.516/0001-58 | **[V]** idem |
| Sede | Saquarema – RJ | **[V]** idem |
| Produto (app) | `https://onsailing.app` | **[V]** |
| API | `https://api.onsailing.app/api/v1/` | **[V]** referenciada no bundle |
| Site institucional | `https://onsailing.com.br` | **[V]** |
| Contatos | contato@onsailing.app · suporte@onsailing.com.br · WhatsApp +55 21 99401-0188 | **[V]** bundle e site |
| Redes | Instagram @onsailing.app. **Nenhum link de LinkedIn no site.** | **[V]** ausência verificada no HTML |

CNPJ na faixa 62.x indica registro recente. Sede em Saquarema, Região dos Lagos — a uma hora de
Búzios. **Não é um concorrente distante: é vizinho de praça.**

## O que ele faz, módulo a módulo

### Menu principal do app — **[V]** lido nas telas publicadas na landing (`/assets/celular-1.png`)

Doze módulos, nesta ordem, na tela inicial:

`Embarcações` · `Prestadores de Serviços` · `Manutenção` · `Abastecimento` · `Checklist` ·
`Cotista` · `Cuidador` · `Agenda pública` · `Financeiro` · `Registrar despesa` ·
`SOS Socorro` · `Cursos`

Acima do menu, um cabeçalho meteorológico com cidade, temperatura, vento (km/h), umidade, direção
(SW 233°) e **altura de onda (2,0 metros)**, mais uma frase interpretada:
"Tempo nublado, mas ainda seguro para navegar." Abaixo, uma caixa de Alertas com notificação de
chat e de manutenção nova.

### Mapa de rotas completo — **[V]** extraído do bundle JavaScript

O produto é uma SPA em TanStack Router. O bundle expõe a árvore de rotas inteira, o que dá o
inventário funcional sem precisar de login:

**Dono da embarcação:** `/vessels`, `/vessels/search`, e por embarcação: `details`, `edit`,
`checklist` (+ `configure`, `navigation/$type`, `$checklistId`), `logbook`, `guests`, `caretakers`,
`quotas`, `maintenance/new`, `maintenance/register` (fluxo de 3 passos), `maintenance-history`,
`refueling/new`.

**Transversais:** `/financeiro` (+ `new/income`, `new/expense`, `$recordId`), `/agenda` (+ `new`,
`$eventId`, `public/$shareToken`, `invite/$shareToken`), `/map`, `/alerts`, `/chat`, **`/ai-chat`**,
`/emergency-contacts`, `/monitor`, `/permissions-config`, `/edit-profile`, `/minhas-faturas`,
`/subscription` (+ `success`, `cancel`), **`/solicitar-descida`**.

**Marketplace e serviços:** `/marketplace` (+ `anunciar`, `meus-anuncios`, `$adId`, `$adId/editar`),
`/catalogo` (+ `$providerId`), `/providers` (+ `$providerId`, `$providerId/agenda`),
`/service-provider`, `/services-page` (+ `confirm-payment`), `/schedule-request`, `/appointments`
(+ `payment-page`, `cancel-appointment`), `/rating`.

**Painel da marina** (`/marina`): `vessels`, `sailors`, `requests`, `monitors`, `messages`, `map`,
`financial`, **`convenience`**, `clients`, `config`.

**Painel administrativo** (`/admin`): `dashboard`, `vessels`, `quotas`, `plans`, `pilot`,
`monitoring`, `marketplace`, `marketing`, `marinas`, `maintenance`, `filters`, `documents`, `config`.

São **quatro personas**: dono, prestador, marina e admin. Mesma arquitetura de papéis do Commander.

### Telas que eu li em resolução nativa — **[V]**

- **Prestadores de serviços** — busca por cidade e por tipo de serviço; cards com foto, nome,
  nota em estrelas e etiquetas de especialidade ("Limpeza de casco (com mergulho)", "Motor 2T",
  "Motor 4T", "Checklist"), botão "Ver".
- **Financeiro** — filtro por embarcação e por mês, saldo consolidado, receitas e despesas
  separadas, abas Todos/Receitas/Despesas, lançamentos nomeados por pessoa e embarcação.
- **Cotas** — valor da embarcação, número de sócios cotistas, cotas em uso e livres com percentual,
  lista de sócios com status "Vinculado", percentual e **dias/mês** de cada um, e agenda de reservas
  dia a dia com status Livre/reservado.
- **Mapa** — mapa **de rua** (OpenStreetMap) de Armação dos Búzios, com filtros
  Todos/Mecânicos/Eletricistas/Pintores, cartão de clima, ícones de veleiro espalhados, e botões
  laterais de adicionar, foto, desenho, **SOS** e homem ao mar.

### Infraestrutura, e o que ela entrega de fato — **[V]** identificado no bundle

| Tecnologia encontrada | O que prova |
|---|---|
| `socket.io` | Chat e alertas em tempo real são reais, não maquete |
| Stripe + **Stripe Connect** (`/stripe-connect/success`) | Marketplace com repasse a terceiros — eles pretendem intermediar o pagamento do prestador |
| Firebase (login Google) | Autenticação social |
| **Leaflet + OpenStreetMap + Nominatim** | O mapa é cartografia **de rua**, não carta náutica |
| IBGE (estados) e ViaCEP | Cadastro de endereço |
| jsPDF / pdfkit | Exportação de relatório em PDF |
| i18n PT / EN / ES | Três idiomas — o Commander é só PT |
| Google Tag Manager `GTM-NPHWDXC2` | Medem aquisição |

## O que ele NÃO faz — e isto é o coração da nossa defesa

Busquei no bundle inteiro (4,64 MB) os termos que denunciariam capacidade de navegação. Resultado:

| Termo buscado | Ocorrências |
|---|---|
| `profundidade` | **0** |
| `batimetria` / `batimétr` | **0** |
| `calado` | **0** |
| `waypoint` | **0** |
| `sonda` / `sondagem` | **0** |
| `rota` / `rotas` (palavra isolada) | **0** |
| `trilha` | **0** |
| `NMEA` | **0 reais** (4 falsos positivos dentro de blocos base64) |
| `vistoria` | **0** |
| `seguradora` | **0** |

**[V] Conclusão: o Onsailing não tem navegação.** O "mapa náutico" da descrição da loja é, no
código e na tela, um mapa de rua do OpenStreetMap com pinos sociais e de prestadores. Não há
traçado de rota, não há profundidade, não há calado, não há waypoint, não há sondagem, não há
NMEA. Também não há vistoria nem relação com seguradora.

Igualmente ausente: qualquer selo de verificação ou de qualidade do prestador.

## Preço e modelo — **[V]** publicado, e o site se contradiz

Eles **publicam preço**, escolha estratégica deliberada. Cobrança **por conta com limite de
embarcações**, não por embarcação. O checkout é **link de pagamento do Stripe**
(`buy.stripe.com/...`) — não têm cobrança própria.

**Atenção: há duas tabelas de preço diferentes no mesmo site.** Tomo como válida a da página
`/app`, que é a página do produto, tem cinco degraus e é mais recente:

| Plano | Cheio | Praticado | O que dá |
|---|---|---|---|
| **Gratuito** | — | **R$ 0,00** | 1 embarcação, 1 gestor, 8 checklists/mês, 4 manutenções/mês, 8 abastecimentos/mês, agenda limitada, **mapa com S.O.S**, alertas limitados, **IA limitada** |
| **Plus** | R$ 79,90 | **R$ 49,90** | 2 embarcações, 2 gestores, checklists/manutenção/abastecimento/agenda/alertas ilimitados, financeiro |
| **Pro** | R$ 149,90 | **R$ 99,90** | 5 embarcações, 10 gestores, **IA ilimitada**, upload de documentos, suporte prioritário |
| **Captain** | R$ 199,00 | **R$ 149,90** | 10 embarcações, 15 gestores — "para embarcações compartilhadas, operações com marinheiros e gestão multiusuário" |
| **Enterprise** | — | **a partir de R$ 499,00** | marinas, frotas, múltiplas equipes, gestão de prestadores, relatórios |

**[V] A home do mesmo site anuncia outros valores** para os mesmos planos: Plus "de R$ 49,90 por
**R$ 29,90**", Pro "de R$ 99,00 por **R$ 59,90**", Enterprise "de R$ 799,90 por R$ 499,00" — e sem
o plano Captain. Registro como está: **o concorrente não tem uma tabela de preço única**, e um
cliente pode ver R$ 29,90 ou R$ 49,90 dependendo da página em que cair.

**O que isto significa para nós.** Nossa faixa é R$ 49,90–69,90. O Plus deles, no preço da página
de produto, é **exatamente R$ 49,90** — encosta no nosso piso; na home, **R$ 29,90**, bem abaixo.
Mas o ponto mais duro não é o plano pago: é o **degrau gratuito permanente** (não achei nenhuma
linguagem de teste ou prazo no card). Um dono com uma lancha só, que quer checklist, manutenção e
abastecimento em volume pequeno, **fica no Onsailing sem pagar nada** — e ainda leva mapa com SOS
e IA limitada.

### Onsailing Care — a aposta de hardware, ainda não vendida

**[V]** Página `onsailing.com.br/care`: sensores IoT de bateria, temperatura, GPS, detecção de água
no porão, combustível, motor e detector de movimento; alertas em tempo real, relatórios mensais e
manutenção preditiva. Preço declarado: **R$ 249,90 a R$ 999,90/mês, mais instalação de R$ 3.490 a
R$ 14.999**.

**[V] Mas todos os botões dos planos são "Lista de espera"**, e a home diz textualmente que
"um novo jeito de viver sua navegação **está chegando**". **O Care não está à venda hoje.** É
validação de demanda para um produto que ainda não existe.

## Como monetiza de verdade

1. **Assinatura do dono** — é a receita principal declarada, com degrau gratuito para captar.
2. **Intermediação do serviço do prestador** — o Stripe Connect e as rotas
   `services-page/confirm-payment`, `appointments/payment-page` e "gerar link de pagamento avulso"
   (novidade da última versão) mostram intenção de ficar no meio do pagamento. **[?] O percentual de
   comissão não é publicado em lugar nenhum.** A página "Seja um Prestador" promete cadastro
   gratuito e não menciona taxa, comissão ou assinatura — ou seja, hoje eles **subsidiam a oferta**
   para montar a rede.
3. **Care (IoT)** — ticket alto, ainda em lista de espera.
4. **Marinas e frotas** — "solução corporativa sob medida", com "fale com um consultor". Sem preço.

## Sinais de tração — aqui a história muda

### O que é forte

- **[V] 341 prestadores cadastrados no catálogo público** (`onsailing.app/catalogo`). É dado real,
  aberto, sem login. Não é maquete.
- **[V] Cobertura na nossa praça:** busca por "Angra dos Reis" retorna **23 prestadores**; por
  "Rio de Janeiro", **30**. Um deles, "Atlas Soluções Náuticas", cobre sozinho Rio, Niterói, Maricá,
  São Pedro da Aldeia, Arraial do Cabo, **Búzios**, Macaé e Angra.
- **[V] Ritmo de entrega alto.** Última atualização no Google Play em **11/08/2026** — oito dias
  atrás. As novidades da versão são: **"Diário de bordo", "Gerar link de pagamento avulso" e
  "Marketplace náutico"**. Ou seja, eles lançaram três módulos que competem diretamente com os
  nossos, neste mês.

### O que é fraco, e é muito fraco

- **[V] Google Play: "5+ downloads".** Cinco. É a menor faixa que a loja exibe. Sem nota média —
  não há avaliações suficientes para gerar uma.
- **[V] Não existe app para iPhone.** O botão "Baixar na Apple Store" em `onsailing.com.br` **não
  tem link** — inspecionei o HTML: nenhum elemento âncora, e **zero** ocorrências de `apps.apple.com`
  na página. Dentro do próprio app, a constante de iOS aponta para
  `apps.apple.com/br/charts/iphone`, que é a página genérica de rankings da loja. A chamada
  "DISPONÍVEL EM TODAS AS PLATAFORMAS" é falsa hoje.
- **[V] O marketplace tem 1 anúncio.** Um. "Lancha 28 pés, R$ 60.000,00, Rio de Janeiro",
  de 06/08/2026.
- **[V] Nenhum prestador tem avaliação.** Nas amostras que abri, 20 de 20 cards exibem
  "Ainda sem avaliações". A chamada da página diz "especialistas náuticos avaliados pela comunidade"
  — não há uma única avaliação. As notas 5/5 que aparecem no print de marketing da landing são
  **dados de demonstração**.
- **[V] O manifesto PWA está intocado**: `"short_name": "TanStack App"`,
  `"name": "Create TanStack App Sample"`. Instalado na tela inicial, o app se chama "TanStack App".
  A meta description do site continua "Web site created using create-tsrouter-app". O rodapé do site
  institucional ainda diz "© 2025".
- **[V] Declaração de privacidade inconsistente na loja:** o app declara "Nenhum dado foi coletado"
  enquanto a própria ficha carimba o aviso "Compartilha Localização".

### O contraste que define a empresa

**[A]** O site institucional alega **"1000+ embarcações"** e **"500+ marinas"**.
**[V]** A loja mostra **5+ downloads**, o marketplace tem **1 anúncio** e o catálogo tem
**0 avaliações**.

Os números de marketing não se sustentam contra o que é publicamente verificável. Registro isso
como alegação não confirmada — e como sinal de que o discurso deles corre bem à frente do produto.

### Não verificado, e por quê

- **[?]** Tudo atrás de login: diário de bordo, chat, `/ai-chat`, agenda, matriz de permissões,
  painel da marina e admin. As rotas existem; a qualidade e o grau de acabamento, não sei.
- **[?]** Instagram: perfil restrito, exige login. Seguidores e data do último post não verificados.
- **[?]** LinkedIn: não há link no site; tamanho de time **não encontrado**.
- **[?]** Reclame Aqui: **não encontrado**.
- **[?]** Número de assinantes pagantes e faturamento: **não encontrado**.

## Qualidade percebida

Honestidade primeiro: **o desenho é bom.** Marca azul-marinho consistente, tipografia limpa e atual,
cards bem espaçados, hierarquia clara, iconografia coerente. Não é trabalho amador e não devemos
nos consolar com isso.

Os pontos fracos de execução que consegui ver são de **acabamento e de substância**, não de estética:
o manifesto PWA padrão, a meta description de template, o botão de App Store que não leva a lugar
nenhum, o rodapé com ano errado, o bundle de 4,64 MB em arquivo único sem divisão de código (carga
inicial pesada no 4G de bordo, que é exatamente onde o app vai ser usado), e telas de marketing
povoadas com avaliações que não existem no produto real.

O mapa é o ponto mais revelador. Ver Búzios renderizada como **mapa de ruas**, com nomes de
avenidas e quarteirões, num app que se vende como "mapa náutico", diz tudo sobre a distância entre
o que eles chamam de náutico e o que navegação de verdade exige.

---

# 2. Booat — o único que ataca a navegação

**Se existe uma ameaça ao nosso fosso técnico, é esta.** Nenhum outro produto brasileiro chega
perto do que o Booat descreve.

| Campo | Dado | Fonte |
|---|---|---|
| Empresa | BOOAT TECNOLOGIA EIRELI | **[V]** vendedor na App Store |
| Site | `booat.app` | **[V]** — o domínio `booat.io` citado na política de privacidade da loja **não resolve DNS**; `booat.com.br` também não serve site |
| App | `apps.apple.com/br/app/booat/id1626843960` | **[V]** |
| Copyright | "© 2016 - 2025 Booat Tecnologia" | **[V]** rodapé do site |

## O que ele faz — **[V]** lido na App Store e no site

Seis módulos nomeados: **Discover, Navigate, Forecast, Safeguard, Collaborate, Booat AI**.

Funcionalidades declaradas:

- **Cartas náuticas digitais**, com download para uso off-line ("Download routes and nautical
  charts before departure, so you're ready even when signal isn't")
- **Rotas e navegação assistida**
- **"Real-Time Route Risk Assessment"** — e aqui está a frase que importa: avalia continuamente
  *"wind, waves, **depth**, hazards, currents, tides, and **vessel draft** along your route"*.
  **Profundidade e calado, os dois.**
- **"Smart Route Recalculation"** — recalcula a rota se você sair dela
- **"AI Route Briefing"**
- **Âncora eletrônica com alerta de movimento**
- **SOS 24/7**
- Condições do mar
- POIs em português: Manutenção, Loja, Posto de combustível, Marinas, Restaurantes, Salvatagem,
  Elétrica Naval, Mercado, Entretenimento, Artigos em inox, **Poitas**

O vocabulário de POI ("poitas", "salvatagem", "elétrica naval") é inequivocamente brasileiro.
É empresa nossa, ainda que o site esteja todo em inglês.

## O que ele NÃO faz — **[V]** ausência confirmada na descrição da loja e no site

**Nenhuma gestão de embarcação.** Não há ficha do barco, manutenção, alertas de revisão, diário de
bordo, financeiro, tripulação, permissões, cotas nem marketplace de pedidos e propostas. O Booat é
um app de **navegação e descoberta**, ponto.

Também não encontrei menção a sondagem colaborativa, NMEA ou integração com instrumentos de bordo.

## Preço

**[?] Não encontrado.** O site tem um item de FAQ chamado literalmente "Is Booat free?", mas
**o acordeão não abre** — tentei expandir por interação e por script e a resposta não é renderizada.
Na App Store o app aparece como **"Grátis", e — diferentemente do Barco em Dia — sem a menção
"Compras dentro do app"**. Ou seja: **[V] não há compra dentro do app.** Não há modelo de receita
visível hoje.

## Sinais de tração — e uma contradição grave

- **[V] App Store Brasil: nota 4,6 com 10 avaliações.** Versão 1.5.7, atualizada em **17/06/2026**.
  As avaliações são de 2024 (três) e uma de 18/06/2026.
- **[V] Somente para iPhone.** Busquei "booat" no Google Play Brasil: **nenhum app correspondente**
  (a loja inclusive corrige a busca para "boost"). **Não existe versão Android** — num país onde o
  Android é a esmagadora maioria dos aparelhos. É uma limitação de alcance enorme.
- **[V] O site estampa o selo "10.8K Reviews", duas vezes.** A App Store brasileira mostra
  **10 avaliações**. Registro a discrepância como o que ela é: **alegação não confirmada**, e das
  mais desconfortáveis deste documento.
- **[V]** Copyright do site parado em 2025; domínio da própria política de privacidade morto.
- **[?]** LinkedIn, Reclame Aqui, tamanho de time: **não encontrado**.

## Qualidade percebida

A promessa é a mais sofisticada do mercado brasileiro e a linguagem de produto é boa. Mas o
conjunto — site inteiro em inglês para um produto de POIs em português, domínio da política de
privacidade fora do ar, acordeão de FAQ quebrado, selo de "10.8K reviews" contra 10 avaliações
reais, ausência de Android e nenhuma monetização visível — descreve um produto **anunciado à
frente do que entrega**.

**Leitura honesta para nós:** eu não consegui verificar o Booat rodando. A promessa de avaliar
profundidade e calado ao longo da rota é exatamente o nosso território, e é a única no país. Se
for real e bem-feita, é a ameaça técnica mais séria da lista. Se for a mesma distância entre
discurso e produto que o resto do material sugere, não é. **Não dá para decidir sem instalar e
usar — e isso exigiria conta, que eu não crio.** Fica registrado como a lacuna mais importante
desta pesquisa.

---

# 3. Barco em Dia — o clone comercial

Lançado agora, mira exatamente o nosso cliente, com exatamente a nossa proposta, **abaixo do
nosso preço**.

| Campo | Dado | Fonte |
|---|---|---|
| Razão social | BARCO EM DIA LICENCIAMENTO DE SOFTWARE NAUTICO E PUBLICIDADE DIGITAL LTDA | **[V]** App Store |
| Site | `barcoemdia.com.br` | **[V]** |
| Feito por | "Desenvolvido por DF Informática" | **[V]** rodapé do site |

## O que faz — **[V]** site e descrição da loja

- **Diário de bordo digital** — viagens, ocorrências, **fotos, áudio** e observações, com histórico
- **Manutenções e alertas** — prazos, preventivas e responsáveis
- **Checklists operacionais** — antes, durante e depois da navegação
- **Gestão de tripulação** — equipe, documentos e prestadores
- **Controle de estoque** — peças, equipamentos e consumíveis com alerta de nível mínimo
- **Calendário e tarefas**, Dashboard, Projetos, Vencimentos, Financeiro, Histórico
- **Assistente Normam** — IA para consulta às normas da Marinha: "NORMAM-211/DPC e NORMAM-212/DPC
  (navegação); habilitação — NORMAM-03/DPC vigente"
- **Módulo Charter** — disponibilidade, reservas, contratos e financeiro

**Público declarado [V]:** "Proprietários, comandantes, marinheiros e gestores de embarcações" e
"Barco de lazer, Charter e gestores de embarcação". **É B2C, direto ao dono.**

## O que NÃO faz — **[V]**

Sem navegação de qualquer tipo: nenhuma carta, rota, profundidade, calado ou rastro GPS. Sem
marketplace de prestadores (a tripulação inclui "prestadores", mas é cadastro, não mercado). Sem
cotas. Sem painel de parceiro. Sem vistoria ou selo.

## Preço — **[V]** publicado, e é o problema

| Plano | Preço | Tripulantes |
|---|---|---|
| **Gratuito** | **R$ 0** — "DIÁRIO DE BORDO 100% grátis", "LOTE INAUGURAL LIBERADO! DIÁRIO DE BORDO GRÁTIS PARA SEMPRE!" | até 5 |
| **Arrais** | **R$ 35/mês** | até 5 |
| **Mestre** | **R$ 48/mês** | até 7 |
| **Capitão** | **R$ 68/mês** | até 10 |

Há alternância mensal/anual na página (desconto anual não detalhado).

**Compare com a nossa faixa de R$ 49,90–69,90.** O plano Mestre deles, com manutenção, alertas,
checklist, projetos e agenda, custa **R$ 48** — abaixo do nosso piso. E o **diário de bordo é
gratuito para sempre**, o que ataca de graça um dos módulos que usamos para justificar assinatura.

## Sinais de tração — mínimos

- **[V] Google Play:** pacote `app.barcoemdia.com`, editora "DF Informática - Desenvolvimento de
  Aplicativos", **50+ downloads**, sem nota exibida. Curiosidade: classificação etária **18 anos**
  com aviso "Temas Sensíveis" — configuração errada da ficha para um app de produtividade náutica.
- **[V] App Store:** **1 avaliação, nota 5,0**, versão **1.0.2** de **15/07/2026**, categoria
  Produtividade, **com compras dentro do app**. Versão 1.0.2 significa produto recém-nascido.
- **[V]** Declara "Dados não coletados" na App Store.
- **[V]** O site anuncia "Disponível para iOS e Android" num ponto e "disponível para Android" em
  outro — texto inconsistente.
- **[?]** LinkedIn, Reclame Aqui, praça geográfica: **não encontrado**. O site não declara cidade
  nem CNPJ.

## Qualidade percebida — o site é bom, o app não

Site comercial competente, planos claros com nomes náuticos bem escolhidos (Arrais, Mestre,
Capitão), proposta enxuta e legível. O **Assistente Normam é um diferencial real que nós não
temos** — consulta às normas da Marinha resolve uma dor concreta e recorrente do dono brasileiro.

**O app, porém, é fraco, e de um jeito revelador — [V] pelos próprios prints publicados nas lojas:**

- **É webview embrulhada, não app nativo:** a barra superior traz hambúrguer, **ícone de globo**,
  câmera e microfone — cromo de navegador espremido em tela de celular.
- **Publicaram a loja com dados de teste.** Um card diz *"Análise completa de teste 02"*; a tela
  de Charter mostra um charter chamado **"dwqdqw"**, com local **"dwqdqw"** — tecla amassada. Isso
  está no ar, hoje, na App Store e no Google Play.
- **Dashboards com 0 em quase todos os indicadores** — vitrine de produto vazio.
- Texto truncado em toda parte ("Manuten...", "Deslocam...", "Checklis..."), mistura de serifada e
  sem-serifa sem sistema tipográfico.
- A tela de Radar denuncia a escala real da rede: **"32 pontos no mapa (27 contatos)"**.
- Reaproveitaram os PNGs do Google Play na App Store — os arquivos se chamam
  `playstore_style_1..7.png`.

**[V]** Lançado no iOS em **09/07/2026**; Android atualizado em **06/08/2026**. Produto de seis
semanas de vida.

**Leitura:** é ameaça de **posicionamento e de preço**, não de profundidade de produto. Quem
instalar hoje vai encontrar um app cru. Mas o discurso comercial e a tabela de preços estão
melhores que o produto — e é o discurso que chega ao cliente antes do produto.

---

# 4. NetunoApp — escopo largo, dono solitário

Correção importante de uma informação que circulou nesta pesquisa: **o NetunoApp NÃO está
abandonado.** Verifiquei na fonte.

| Campo | Dado | Fonte |
|---|---|---|
| Desenvolvedor | **Marilan Ricardo Tagliari** — pessoa física | **[V]** App Store |
| Copyright | "© 2020 NetunoApp by Skat4" | **[V]** |
| Site | `site.netunoapp.com.br` — **DNS não resolve** | **[V]** |

## O que faz — **[V]** descrição da App Store

"Para você que tem embarcação, uma sociedade em barco, gerencia frota, presta serviços ou tem
lojas de produtos e embarcações": programação de **manutenções**, **checklist de embarque**,
**telemetria própria e integrada**, **controle de marinheiro e equipe**, **financeiro integrado e
on-line com o banco**, relatórios, **gestão de embarcação compartilhada (cotas)**, operação de
**charter com check-in/check-out**, **CRM de clientes**, **múltiplos perfis com níveis de acesso
customizáveis**, e — na versão mais recente — "gestão de demanda, análise e orçamento auxiliados
por **IA**" para empresas de serviço náutico.

É, no papel, o escopo funcional mais próximo do Commander depois do Onsailing — inclusive com
telemetria e matriz de acesso.

## O que NÃO faz — **[V]**

Sem carta náutica, rota, profundidade, calado ou rastro GPS, apesar de estar categorizado como
"Navegação". Sem marketplace aberto de prestadores.

## Tração — **[V]** e aqui está a correção

- **Nota 4,4 com 7 avaliações.** Sete, acumuladas desde 2021.
- **Versão 3.0.9, atualizada em 04/08/2026** — quinze dias atrás. Li o atributo `datetime` do
  elemento de data: `2026-08-04`. **Não é um app parado.** Há inclusive uma avaliação de
  **01/08/2026**.
- **[V] O site institucional está fora do ar** (DNS morto), o que é bizarro para um produto em
  desenvolvimento ativo.
- **[V]** App gratuito, **sem compras no app**. Idioma listado: apenas inglês.
- **[?]** Como monetiza: **não encontrado**. Downloads no Android, LinkedIn, Reclame Aqui:
  **não encontrado**.

## Leitura

Um desenvolvedor pessoa física, entregando há cinco anos um produto de escopo enorme, com sete
avaliações, sem site no ar e sem receita aparente. **É a prova de que a tese existe e de que
executá-la sozinho não basta.** Não é ameaça comercial. É um aviso sobre o que acontece quando o
produto é largo e a distribuição é zero.

---

# 4b. O resto do lado B2C — pequenos, e um cemitério

## NautLog (`nautlog.com.br`) — caro, sem app, anônimo

**[V] O que faz:** Checklist Inteligente ("checklists tipo aeronave, 7 seções, fotos por item");
**agenda de manutenção por data OU por horas de motor** com alertas; Logbook Digital com histórico
de serviços, custos e prestadores; documentos com alerta de vencimento em **30/15/7 dias**;
relatórios; diretório regional de prestadores com avaliações.

**[V] Preço publicado:** Gratuito (1 barco) · **Básico R$ 97/mês** (1 barco) · **Pro R$ 197/mês**
(até 3) · **Premium R$ 397/mês** (ilimitado). Teste de 14 dias sem cartão. Detalhe competitivo
bom: **tripulantes acessam sem custo adicional** dentro do plano do dono.

**[V] Não tem app** — nenhum resultado em nenhuma das duas lojas. É web em PHP, apenas.

**[V] E é anônimo:** a home tem 8.813 bytes de HTML e **não há CNPJ, endereço, telefone, e-mail,
nome de fundador ou rede social em lugar algum do site**. Zero depoimento, zero cliente citado.
Existem `/login.php` e `/cadastro.php`, então é produto real — mas cobra **2x a 8x o preço do
Onsailing sem ter app e sem ter identidade**. Provável projeto solo.

## i61 — três apps de um desenvolvedor solo de Brasília

**[V]** Filipe Barbosa de Almeida, `i61.com.br`. O app **"Marinheiro"** faz agenda, manutenções,
**livro de bordo**, compartilhamento com número pré-definido de **cotistas**, calendário de
reservas e **chat entre cotistas, marina e marinheiros** — mesmo território que o nosso.

| App | Downloads | Avaliações | Atualizado |
|---|---|---|---|
| Marinheiro | **50+** | 0 | 17/07/2026 |
| Marina | 5+ | 0 | **20/10/2022** (abandonado) |
| Porto Marina ADM | 10+ | 0 | 08/05/2026 |

**[V]** Os nomes de pacote estão trocados em relação aos títulos, e o site lista como
"funcionalidades" do produto náutico coisas como *"Easy Layout, Fast Messaging, Battery Saver,
Image Crop"* — texto de template não personalizado. **Concorrente fraco**, registrado por
completude.

## BoatM3 — parado, mas com a melhor ideia da lista

**[V]** Alexandre Auler, brasileiro. Última atualização **20/06/2024** — dois anos parado, sem
avaliações. **[A]** A tese: cadastrar marca, modelo e equipamentos e receber **os planos de
manutenção recomendados pelo fabricante** — "o que, como e quando" — mais diário de bordo, horas
de navegação e marketplace.

**Vale roubar a ideia, não o cliente.** Plano de manutenção pré-carregado por modelo é o conceito
mais defensável que apareceu nesta pesquisa, e **ninguém ativo está executando** — só o
estrangeiro Boat Maintenance Planner.

## ZARPPI — morto, e dá para datar o óbito

**[V]** Fazia rastreamento GPS e **diário de bordo gratuito** com fotos de notas fiscais.
Evidências colhidas hoje: a página do Google Play retorna **404** (app removido); nenhum resultado
na App Store BR; **`zarppi.com.br` não resolve** — o DNS público do Google retorna `SERVFAIL` e os
quatro nameservers da AWS respondem "ns query refused"; o RDAP do registro.br mostra domínio ativo
até 2027 mas com **última delegação correta em 08/06/2026**.

**A operação foi desligada entre junho e agosto de 2026.** O registrante é a **XR Comercio e
Serviço Automotivo Ltda** (CNPJ 41.239.024/0001-85) — era projeto paralelo de uma empresa de
**rastreamento automotivo**, não de gente do mar. Isso explica o abandono, e é um alerta sobre
quem entra neste mercado vindo de fora.

## Apps de marina única e de nicho (fracos, listados por completude)

**[V]** **Marina das Flores** (10+ downloads no Android; iOS 4,5 com 2 avaliações, parado desde
03/04/2024) — pedir barco na água, abastecimento, **Aviso de Saída conforme normas da Marinha**,
autorizar manutenção de terceiros. **Nauticapp** (10+ downloads, 0 avaliações) — passeios com
**QR code para convidados**, vagas, marketplace. **Capital Náutica Share** (cotas, 1 avaliação).
**Maré Segura** (v1.0 nunca atualizada desde 13/11/2025). **Gestão Finanças Náuticas** (v1.0 parada
desde 25/03/2026, 0 avaliações). **Marine / DoTelematics** (só rastreamento). **MarinaClub**
(iOS 5,0 com 3 avaliações, ativo desde 2020, tem módulo **Share** de cotistas; preço não
encontrado).

**Gestão Náutica** (`gestaonautica.com.br`) — **[V] publica R$ 399 / R$ 699 / R$ 1.299+ por mês**,
se autodeclara "Plataforma nº1 de Gestão de Marinas do Brasil" mas exibe o contador de uptime em
**"0%"** e os contadores de marinas ativas e embarcações gerenciadas **em branco**; app "em breve".
**Landing page à frente do produto.**

---

# 5. O bloco B2B de marina — seis empresas que não disputam o nosso cliente

Este é o grosso do mercado de software náutico brasileiro, e a conclusão é limpa: **todas vendem
para a marina, nenhuma vende para o dono.** O app do proprietário existe em várias, mas é
acessório de um contrato que **a marina** assinou. Se a marina do sujeito não é cliente, ele não
entra. A AppBoats diz isso com todas as letras na própria loja:

> "Certifique-se de que sua Marina está cadastrada em nossa lista de clientes. Se ela não estiver,
> indique-a o AppBoats." — **[V]** descrição na App Store

| | EasyMarine | AppBoats | Docka | AquaHub | MarinasOnline | MeuBarco |
|---|---|---|---|---|---|---|
| **Quem compra** | Marina | Marina | Marina | Marina | Marina | Gestora de cotas / marina |
| **App do dono — Android** | **5 mil+ downloads · 4,67 / 15 av.** | **5 mil+ downloads · 4,44 / 16 av.** | Sim | **não localizado** | **Não** | White-label do cliente |
| **App do dono — iOS** | 4,28 / 18 av. | **1,0 / 2 av.** | 5,0 / 2 av. | **não localizado** | **Não** | White-label |
| **iOS desde** | 04/01/2019 | 29/10/2016 | 14/05/2026 | — | — | — |
| **Publica preço** | Não | Não | **Sim** | **Sim** | Não | **Sim** |
| **Diário de bordo** | Não | **Sim** | Não | Não | Não | Não |
| **Cotas** | Não | **Sim** | Não | Não | Não | **Sim (é o núcleo)** |
| **Chat interno** | Não (WhatsApp) | **Sim** | Sim (com a marina) | Sim | Não | Não |
| **Carta / rota / profundidade / rastro** | **Não** | **Não** | **Não** | **Não** | **Não** | **Não** |
| **Marketplace de prestadores** | **Não** | **Não** | **Não** | **Não** | **Não** | **Não** |

**Zero de seis** têm carta náutica, profundidade, rota, rastro GPS ou marketplace de prestadores.
O mais longe que chegam é bússola e tábua de marés (AppBoats) e alerta de clima (Docka, EasyMarine).

### Notas por empresa

**EasyMarine** (`easymarine.com.br`) — **o líder real do setor, e o único com tração de loja
verificável.** Quatro apps separados por papel: Cliente, Operador, Marinheiro e Totem.
**[V] App Cliente: 5 mil+ downloads e 4,67 com 15 avaliações no Google Play; 4,28 com 18 na App
Store.** No ar desde 04/01/2019, atualizado em 17–18/07/2026, cadência mensal. **[V]** Não publica
preço; o app do dono é gratuito — quem paga é a marina. **[A]** Alega 140 marinas, 28 mil usuários,
15 mil embarcações e expansão para Portugal (note: 5 mil+ downloads não sustentam 28 mil usuários
ativos; o número alegado deve incluir web). O app do dono faz plano de navegação, pedido de
descida, abastecimento, faturas, previsão do tempo e **alerta de habilitação e TIE vencidos**.

**AppBoats** (`appboats.com.br`, CNPJ 57.731.499/0001-24) — **o app do dono é o mais rico do
bloco**: pedido de embarcação, **diário de bordo**, conveniência, abastecimento, controle
financeiro, **chat**, e ferramentas náuticas (**bússola, previsão do tempo, tábua de marés**).
Tem **cotas** com calendário, rateio e prestação de contas.

**Correção importante sobre a saúde deles:** o produto está **saudável no Android e péssimo no
iOS**. **[V] Google Play: 5 mil+ downloads, 4,44 com 16 avaliações, atualizado em 21/07/2026.**
**[V] App Store: nota 1,0 com 2 avaliações**, 101,5 MB, idioma declarado apenas inglês, categoria
"Estilo de vida". Quem olhasse só o iOS concluiria que o produto morreu — não morreu.
**[V] Bandeira amarela societária:** três entidades para o mesmo produto — o site assina *AppBoats
Tecnologia Náutica Ltda*, o Google Play mostra *Incipit*, e a App Store mostra *Escola Direta
Servicos Digitais Ltda - EPP*. **[A]** Alega 250+ marinas e 20 mil usuários.

**Docka** (`usedocka.com`) — a melhor execução comercial, e a mais nova. **[V] Publica tabela:
R$ 897/mês (até 40 embarcações), R$ 1.497 (80), R$ 2.197 (120), R$ 2.997 (160)** — cerca de
**R$ 18–22 por embarcação/mês**, a melhor âncora de preço B2B pública do mercado. **[V]** iOS
lançado em **14/05/2026**, 5,0 com 2 avaliações. Cobranças por **PIX e boleto**, torre de controle,
vagas, documentos, chat com a marina. **[V]** Vendedor na loja é "Locomotive llc"; o site não
publica CNPJ.

**AquaHub** (`aquahub.app`) — **[V] R$ 129,90 por R$ 99,90/mês** com 20 módulos e tudo ilimitado.
**[V]** Rodapé: "CNPJ 20.947.349/0001-42 • Desenvolvido por Ticket Digital" — é produto de software
house. **[V] Nenhum app localizado em nenhuma das duas lojas**, apesar de vender "App Mobile" no
plano; nenhum link de rede social, nenhum cliente citado. Preço 9x menor que a Docka pelo escopo
equivalente. **Não considero ameaça.**

**MarinasOnline** (`marinasonline.com.br`) — texto de produto tecnicamente sofisticado ("snapshots
mensais imutáveis", "permissões granulares por usuário e por marina", "grupos econômicos com
isolamento operacional total"), com ordens de serviço, NF-e/NFS-e e cobrança por porte de
embarcação. **[V] Sem app, sem preço, sem CNPJ, sem redes sociais, sem prova social** — o único
canal é um `mailto:`. O dashboard do site é maquete. Estágio pré-comercial.

**MeuBarco** (`mbarco.com.br`) — o mais completo em **cotas**: cotistas, créditos de reserva,
contingência, suplência, rodízio com sorteio, **bloqueio automático de cota por inadimplência**,
rateio, kanban de manutenção, checklist, e módulo de marina com descida/subida e vistoria.
**[V] Publica preço: Pro R$ 390/mês e Premium R$ 690/mês**, com app white-label sob a marca do
cliente no Premium. **[A]** Alega 520 empresas náuticas e 2 milhões de reservas. Como o app é
white-label, **não há ficha de loja auditável** — nota e downloads são inverificáveis por
construção.

---

# 6. Cotas de lancha — dinheiro grande, software pequeno

Vendem participação em embarcação, não software. O sistema é custo de operação e retenção.
Interessam a nós por dois motivos: **disputam o mesmo bolso** e **precisam exatamente do que
sabemos fazer**.

- **Armazém Boat Share** (`armazemboatshare.com.br`) — **a mais relevante para o Rio.**
  **[V] Opera em Marina da Glória, Niterói, Cabo Frio e Angra dos Reis** — nossa praça inteira.
  **[V] Publica preço de cota:** NX270 Challenger R$ 175.000; NX280 Xtreme a partir de R$ 205.000;
  ZATH 328 HT R$ 296.381; NX50 Invictus FLY a partir de R$ 1.890.000. **[V] Mensalidades não
  divulgadas.** Inclui marinheiro, marina, manutenção, seguro, agenda online. Frota de 12+.
  **[V] Nenhum app nas lojas.** Usam plataforma web.
- **Boatlux** (`boatlux.com.br`) — a maior alegada, desde 2012, com domínios regionais em SC, PR,
  Litoral Norte de SP, Vitória e **Rio de Janeiro**. **[A]** 420 barcos, ~3.000 cotistas, 80+
  marinas, mensalidade exemplo de R$ 1.213,33. **Ressalva de honestidade: o fetch da própria página
  não confirmou nenhum desses números** — a página exibe "Área do Cotista" e calculadora de
  rentabilidade. Reclame Aqui retornou **403**.
- **Iate Marine** (`iatemarine.com`) — Balneário Camboriú/SC. **[V] Cota de R$ 250.000 a R$ 300.000
  para barco de 40 pés em grupo de 8, com ~R$ 40.000/ano de manutenção por cotista.**
  **[V] App com a melhor tração de todo o setor: 4,9 / 52 avaliações** — mas atualizado pela última
  vez em **09/08/2024**, publicado por "Vieitez Servicos Administrativos Eireli" e categorizado
  como **Redes Sociais**. Faz reservas, avisos, regulamento e **boletos**.
- **Nosso Barco** (`nossobarco.com.br`) — Manaus/AM e João Pessoa/PB, fora do nosso eixo.
  **[V]** Grupos de 4 (até 7 dias/mês) e de 8 (uso ilimitado por rodízio); cota ~15% do valor da
  embarcação; **mensalidade não publicada**; regra explícita de manutenção corretiva:
  **"quem quebra, paga"**. **[V] Reserva por web, sem app.**
- **Flip Boat Club** — **[A]** clube com cotas e app de reserva para cotistas. Preço, praça e
  tração: **não encontrado**.
- **[?] Sea Club, Blue Boats, Nautic Share, Yatch Share, Cota Nautica** — procurados, **sem página
  própria identificável**. Não confirmo que existam sob esses nomes.

**Achado que vale ouro comercial:** o app da Iate Marine é publicado por uma administradora e há
registro de empresas de cota usando **Winker**, plataforma de **condomínio residencial**, como
sistema de reserva (`iatemarine@winker.com.br`). **Gente com R$ 300 mil em cota está agendando
barco em software de prédio.** Isso é uma porta aberta para o nosso módulo Enterprise.

---

# 7. Aluguel e charter — demanda grande, software nenhum

- **Navegue Temporada** (`naveguetemporada.com`) — a maior nacional. **[V] Cobre Angra, Rio,
  Búzios, Cabo Frio e Paraty**, além de Miami e Algarve. **[A]** 700+ barcos. **[V]** Locações de
  R$ 2.250 a R$ 85.000+; anúncio grátis para o proprietário. **[V] Comissão não divulgada.**
  **[V] Sem app** — opera por site e WhatsApp.
- **GetMyBoat** — estrangeira, e já densa na nossa praça. **[V] 117 barcos na Glória, 131 em
  Botafogo, 144 em Niterói**, a partir de US$ 90/h. **[V]** Comissão não divulgada.
- **Odisea** — **[V]** App Store 4,0 com 8 avaliações, versão 1.1.40 de 12/04/2025, por Odisea
  Ltda. Aluguel, compra e venda, e **Clube de Benefícios com descontos em marinas, combustível e
  serviços**.
- **Voguer** — app de aluguel de barcos e yachts na App Store BR. **[?]** Não aprofundado.
- **Navegue Now** — **[V] MORTO.** `naveguenow.com.br` não resolve DNS. Era app de aluguel focado
  no Rio, lançado em 2018 com 100+ barcos. **Precedente relevante: app puro de aluguel no Rio já
  foi tentado e morreu.**
- Charters do Rio e Angra (Maré Alta, GM Boats, Fantasma Boat, Léo Locações, Bem Vindos a Bordo,
  Rio 40º, Aluguel Marina da Glória) — **[V] todos operam por WhatsApp e site próprio. Nenhum tem
  app.**

---

# 8. Marketplace de prestadores — a categoria está VAGA

**tudoPrabarco** (`tudoprabarco.com`) é o único que tenta, e está vazio.

- **[V]** Propõe conectar proprietários e capitães a profissionais e empresas do setor, com
  portfólio, avaliações, certificação de empresas e painel para o prestador.
- **[V] A página `/explorar` ficou presa em "Buscando empresas…" e não renderizou uma única
  empresa.** Sem contagem, sem métrica.
- **[V] Não publica preço.** Fala em "planos de assinatura" sem valor; `/planos` e `/para-empresas`
  retornam **404**.
- **[V]** Programa "Fundador 2026" limitado a 50 empresas — confirma estágio de arranque.

**Conclusão da categoria:** marketplace de serviço náutico no Brasil **não tem dono**. O Onsailing
tem a maior oferta cadastrada (341 prestadores) e **zero transação evidente**. O tudoPrabarco tem
o discurso e nenhuma empresa listada. Está em aberto.

---

# 9. Telemetria — NAVALCARE / SAFEBOAT

**[V]** `navalcare.com.br` **não resolve DNS**; tudo abaixo vem de matéria da Economia SC
(11/04/2025), portanto **[A]**.

Fundada em 2017 por Marcelo Reis, engenheiro naval, sediada no Iate Clube de Santa Catarina.
O **SAFEBOAT**, lançado em março de 2025, é sistema **embarcado** que monitora os sistemas de bordo,
identifica falhas críticas, envia alertas instantâneos, compartilha ancoradouros em tempo real e
integra dados meteorológicos. Cobra por **assinatura** — valores não encontrados.

**[A]** Saiu de 3 clientes recorrentes para 50+ embarcações mensalistas e 300+ atendidas
pontualmente. Metas: 1.000 barcos até 2026, 10.000 até 2027, 1 milhão até 2030.

É o mesmo movimento do Onsailing Care, e está três anos à frente dele. Praça: Florianópolis.
**Não é do Rio.**

---

# 10. Classificados — mercado adjacente, não concorrente

Não disputam gestão. Ficam aqui porque são o canal onde o dono de barco já está e porque alguns
monetizam melhor que qualquer app desta lista.

- **Compre Náutica** — **[V] R$ 359/mês (até 10 embarcações) e R$ 599/mês (até 30)**, mais
  R$ 89/mês de destaque no guia de serviços. Tem "Catálogo Náutico" (diretório de empresas), cursos
  e blog. **[V] Sem app.**
- **Bombarco** — **[V] o site inteiro retorna 403 para mim; nada verificado na fonte.**
  **[A]** Líder do setor, 24 milhões de visualizações em 2024, pacotes de 6 a 60 embarcações, e —
  o que mais importa — **financiamento náutico (entrada de 30%, até 60x, taxas a partir de 1,34%)
  e consórcio**. O braço financeiro provavelmente vale mais que o classificado.
- **Mercado de Barcos** — **[V] cobra 6% de comissão sobre a venda.** É o único percentual de
  comissão que consegui verificar em todo o setor. E-mail comercial em `@primeshare.com.br`.
- **eBoat** — **[V]** "sem intermediários nem comissões", anúncio grátis; preços de planos pagos
  não divulgados.
- **Portal Náutico** — **[V]** no ar desde 2008, anúncios gratuitos e ilimitados, planos de
  destaque sem valor publicado, sem métrica de audiência.
- **[V] Mercado Barcos** (`mercadobarcos.com.br`) — **certificado SSL quebrado.** Abandonado.
- **OLX** — categoria "Barcos e aeronaves" ativa em Angra e região. **É o classificado genérico
  que absorve boa parte do volume real.**

---

# 11. Estrangeiros que o brasileiro usa — leia esta seção

O usuário pediu para não aprofundar, mas um nome aqui é mais perigoso que a maioria dos brasileiros.

**Orca — `com.theorca.slate`, Orca Technologies AS (Noruega)** — **[V] Google Play Brasil, em
português: nota 4,3, 3,11 mil avaliações, 100 mil+ downloads.** Compare: é **mais de 300 vezes** a
base de avaliação de todos os apps náuticos brasileiros somados.

O que ele entrega, **[V]** pela própria descrição em português:

- Cartas náuticas on-line e off-line, e **cartas híbridas de satélite** para aproximação de porto
- **"Rotas personalizadas para veleiros e lanchas"**
- **"O Orca aprende com você e outros velejadores, para que você possa navegar como um morador
  local"** — isto é, na essência, **o nosso conceito de corredores**
- Feed **AIS**, previsão marinha global com marés e correntes
- **Orca Core 2**: hardware de integração com instrumentos de bordo, piloto automático e radar —
  o equivalente ao nosso NMEA

**Não faz:** gestão de embarcação, manutenção, financeiro, tripulação, marketplace, cotas — nada de
B2C brasileiro, nenhum suporte em português, nenhuma rede de prestador local.

**Boat Maintenance Planner / Vesselscan** — **[V] 10 mil+ downloads no Brasil, localizado em
português**, manutenção por data ou por **horas de motor**, catálogo de peças e upload de manual em
PDF. Atualizado em 26/07/2026. **É o app de manutenção com mais downloads no Brasil — e é
estrangeiro.** Nenhum brasileiro da categoria chegou perto disso.

Outros: **Navionics** (cartografia, padrão de fato), **Windy.com** (**[V]** 4,89 com **12.970
avaliações** na App Store BR), **MarineTraffic**, **Savvy Navvy**, **iNavX**, **Navily**,
**Skipper**, **YachtLog** e **Dockwa** (EUA, sem operação local). Citados, não aprofundados —
quase todos com **zero avaliações no Brasil**.

## O tamanho real do bolso, para calibrar expectativa

**[V]** Dois números que colocam tudo em perspectiva:

- **Nautide** (marés, vento, ondas — espanhol): **1 milhão+ de downloads e 15.073 avaliações**.
- **Escala Marítimo** (escala de embarque para marítimos, feito por **um desenvolvedor solo
  brasileiro**): **50 mil+ downloads e 4,65 com 1.250 avaliações**, atualizado em 12/08/2026.

O brasileiro **baixa app náutico**, e um dev solo já provou que dá para chegar a 50 mil downloads
neste país. **O problema do setor não é demanda: é que ninguém fez um produto que valha a pena
para o dono do barco.** Todos os apps brasileiros de gestão de embarcação somados não chegam a
**200 downloads** no Google Play.

**Apps oficiais brasileiros gratuitos** que cobrem parte do que vendemos como conveniência —
todos na App Store BR, **[V]** vistos na vitrine da categoria Navegação: **PAM** (Previsão
Ambiental Marinha), **SISCORAR** (previsão de correntes de maré), **NAVSEG** e **NAVISAFE**.
Meteorologia e maré **não são diferencial defensável**: o Estado dá de graça.

---

# 12. Tabela cruzada — todos contra o Commander

Legenda: ● tem · ◐ tem parcial · ○ não tem · ? não verificado

| Capacidade | **Commander** | Onsailing | Booat | Barco em Dia | NetunoApp | AppBoats | EasyMarine | Docka | MeuBarco | Orca |
|---|---|---|---|---|---|---|---|---|---|---|
| Ficha da embarcação por hubs | ● | ◐ | ○ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ○ |
| Manutenção com semáforo e alertas | ● | ● | ○ | ● | ● | ◐ | ○ | ○ | ● | ○ |
| Checklist | ● | ● | ○ | ● | ● | ○ | ○ | ○ | ● | ○ |
| Diário de bordo | ● | ● | ○ | ● | ? | ● | ○ | ○ | ○ | ○ |
| **Trilha GPS no diário** | **●** | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ● |
| Fotos com álbuns | ● | ◐ | ○ | ◐ | ? | ○ | ○ | ○ | ○ | ○ |
| Financeiro | ● | ● | ○ | ● | ● | ● | ● | ● | ● | ○ |
| Carteira de tripulação | ● | ● | ○ | ● | ● | ○ | ○ | ○ | ● | ○ |
| Permissões por aba | ● | ● | ○ | ? | ● | ○ | ○ | ○ | ◐ | ○ |
| **Marketplace de pedidos e propostas** | **●** | ◐ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| Catálogo de prestadores | ● | ● | ◐ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| **Selo Verified / Gold com vistoria paga** | **●** | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| Chat entre as partes | ● | ● | ○ | ○ | ? | ● | ○ | ● | ○ | ○ |
| Aviso ao prestador por pedido compatível | ● | ? | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| Painel do parceiro (marina/posto/loja) | ● | ● | ○ | ○ | ◐ | ● | ● | ● | ● | ○ |
| Cotas / pátio / votação de orçamento | ● | ● | ○ | ○ | ◐ | ● | ○ | ○ | ● | ○ |
| **Rota traçada pela ÁGUA** | **●** | ○ | ◐ ? | ○ | ○ | ○ | ○ | ○ | ○ | ● |
| **Profundidade e calado** | **●** | ○ | ◐ ? | ○ | ○ | ○ | ○ | ○ | ○ | ◐ |
| **Modo navegando** | **●** | ○ | ◐ ? | ○ | ○ | ○ | ○ | ○ | ○ | ● |
| **Corredores (rota real vira sugestão)** | **●** | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ● |
| **Sondagem colaborativa NMEA** | **●** | ○ | ○ | ○ | ◐ | ○ | ○ | ○ | ○ | ◐ |
| SOS / emergência | ? | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| Assistente de IA | ? | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ○ |
| Consulta às normas da Marinha | ○ | ○ | ○ | **●** | ○ | ○ | ○ | ○ | ○ | ○ |
| Telemetria IoT embarcada | ○ | ○ (lista de espera) | ○ | ○ | ● | ○ | ○ | ○ | ○ | ● (Core 2) |
| Publica preço | ● | ● | ○ | ● | — | ○ | ○ | ● | ● | ● |
| App iOS | ? | **○** | ● | ● | ● | ● | ● | ● | ◐ | ● |
| App Android | ? | ● | **○** | ● | ? | ● | ● | ● | ◐ | ● |

## O que eles têm e nós não

1. **Assistente de normas da Marinha** (Barco em Dia) — NORMAM-211, 212 e 03 consultáveis por IA.
   Dor real, barata de resolver, e nos falta.
2. **Telemetria embarcada de verdade** (NetunoApp hoje; NAVALCARE/SAFEBOAT; Orca Core 2;
   Onsailing Care na fila) — sensor que avisa antes de quebrar.
3. **Escala de avaliação e distribuição internacional** (Orca: 100 mil+ downloads, 3,11 mil
   avaliações) — não é funcionalidade, é prova social, e nenhum brasileiro tem.
4. **Três idiomas** (Onsailing: PT/EN/ES). Somos só PT.
5. **SOS e âncora eletrônica** (Onsailing, Booat) — segurança percebida, barata de implementar.
6. **Integração operacional com o pátio da marina** (Docka, EasyMarine, AppBoats): fila virtual,
   vaga, descida agendada, boleto. O Onsailing já tem `/solicitar-descida`. Nós não temos essa
   ponte com a operação física.
7. **Preço mais baixo e degrau gratuito** (Onsailing R$ 0 e R$ 29,90; Barco em Dia R$ 0 e R$ 35).

## O que temos e eles não

1. **Rota traçada pela água.** A* sobre máscara de costa a 100 m. **Nenhum concorrente brasileiro
   tem.** Só o Orca, norueguês, faz roteamento comparável.
2. **Profundidade e calado com grade batimétrica.** O Booat *promete* avaliar profundidade e calado
   na rota — é a única promessa concorrente, e eu **não consegui verificá-la funcionando**.
3. **Corredores.** Rota real dos barcos virando sugestão para os próximos. Só o Orca tem algo
   equivalente, e não no Brasil.
4. **Sondagem colaborativa por NMEA.** Ninguém no Brasil.
5. **Modo navegando.** Ninguém no Brasil.
6. **Marketplace de pedidos e propostas com avaliação**, ligado à ficha do barco. O Onsailing tem
   catálogo e o marketplace dele é de **classificados** — um anúncio.
7. **Selo Verified e selo Gold com vistoria paga.** Ninguém tem. `vistoria` aparece **zero vezes**
   no código do Onsailing. É receita e é confiança, e o campo está livre.
8. **Aviso ao prestador por pedido compatível + conversa entre as partes** — entregue hoje.
9. **O ativo pertence ao dono, não à marina.** Histórico que sobrevive à troca de marina. Todo o
   bloco B2B falha nisso por construção.

## Onde a briga é de igual

- **Manutenção, checklist, financeiro, agenda, tripulação e cotas.** Onsailing, Barco em Dia,
  NetunoApp e MeuBarco fazem tudo isso. **Não há fosso aqui** — a disputa é de acabamento, de
  preço e de quem chega primeiro ao dono.
- **Diário de bordo.** Onsailing lançou este mês; Barco em Dia dá **de graça para sempre**;
  AppBoats tem há anos. **Nosso diferencial não é o diário: é a trilha GPS dentro dele.**
- **Catálogo de prestadores.** O Onsailing tem 341 cadastrados e 23 em Angra. Em oferta bruta,
  eles estão na frente. Em liquidez, ninguém saiu do zero.
- **Assistente de IA.** Quase todos anunciam. Ninguém demonstrou.
- **Painel de parceiro e Enterprise.** Onsailing, AppBoats e MeuBarco jogam esse jogo.

---

# 13. A janela — e ela está aberta agora

Um padrão que só apareceu quando juntei as datas de todos os concorrentes:

**Praticamente todo o mercado B2C entrou em 2026.** Barco em Dia lançou em **julho**; Onsailing
publicou no Android e está entregando módulo por módulo **neste mês**; Docka lançou em **maio**;
NautLog é de 2026. No mesmo período, **ZARPPI morreu (junho a agosto de 2026)** e o BoatM3
congelou.

Ninguém firmou posição. **Nenhum app brasileiro de gestão de embarcação passou de 50 downloads no
Google Play** — Barco em Dia 50+, i61/Marinheiro 50+, Nauticapp 10+, Onsailing 5+. Os únicos com
5 mil+ são apps **de marina** (EasyMarine e AppBoats), e o dono só os tem porque a marina dele
mandou.

E há uma abertura de execução: **ninguém é nativo.** Onsailing e Barco em Dia são webviews com
bugs visíveis nos próprios prints de loja. Qualidade de app é, hoje, um diferencial disponível.

**Isso corta dos dois lados.** A janela está aberta — e está aberta para todos ao mesmo tempo. A
vantagem não vai para quem tem mais módulos: vai para quem chegar primeiro ao dono de barco de
Angra e da Marina da Glória com um produto que não pareça um site espremido no celular.

---

# 14. Quatro oportunidades que a pesquisa entregou de brinde

1. **Selo e vistoria não existem no mercado.** `vistoria` aparece zero vezes no código do
   Onsailing; nenhum concorrente tem selo de verificação. Nosso Verified e Gold são território
   virgem, com receita direta.
2. **Cotistas de alto valor estão em software errado.** Há empresa de cota agendando barco em
   **plataforma de condomínio residencial** (Winker), e o app da Iate Marine — o de melhor nota do
   setor, 4,9 — está sem atualização desde agosto de 2024, publicado por uma administradora e
   categorizado como "Redes Sociais". São grupos com cotas de R$ 175 mil a R$ 300 mil na Marina da
   Glória, em Angra e em Cabo Frio, mal servidos. **É o alvo mais qualificado que este levantamento
   encontrou para o Enterprise**, e o Armazém Boat Share é o nome para começar.
3. **Conformidade com a Marinha é dor real e quase ninguém cobre.** Só o Barco em Dia (Assistente
   NORMAM) e a Marina das Flores (Aviso de Saída) tocam nisso. Some-se o **NAVSEG**, iniciativa
   ligada à autoridade marítima que registra viagem e envia posição à **Capitania dos Portos a
   cada 15 minutos** para busca e salvamento: é requisito regulatório, e nós já temos a trilha GPS
   e o modo navegando que tornariam isso trivial. **Aviso de Saída automático a partir do nosso
   diário de bordo** é uma funcionalidade barata, difícil de contestar e muito vendável.
4. **Plano de manutenção por fabricante e modelo.** A ideia é do BoatM3, que está morto há dois
   anos; no Brasil, ninguém ativo executa. O único que faz isso bem tem 10 mil+ downloads aqui e é
   estrangeiro (Boat Maintenance Planner). Pré-carregar o plano do fabricante por modelo de motor
   transformaria o nosso semáforo de manutenção de "o que você lembrar de cadastrar" em "o que o
   fabricante manda" — e encaixa direto no selo Gold.

---

# 15. As três ameaças mais concretas

Ameaça é o que tira cliente nosso. Não é o que é bonito, nem o que é grande.

Pelo critério, ficam **de fora** os nomes que mais impressionam: EasyMarine e AppBoats têm 5 mil+
downloads cada, mas o dono só os usa porque a marina dele assinou — não disputam a nossa venda.
Orca é tecnicamente superior a quase tudo, mas não fala português, não tem prestador em Angra e
não gerencia embarcação. MeuBarco e Docka vendem para empresa. Nenhum deles senta na frente do
nosso cliente e oferece a mesma coisa mais barato. Estes três, sim:

## 1ª — Onsailing: o preço, a praça e a velocidade

Não é o produto deles que ameaça: é a **estrutura comercial**. Um **plano gratuito permanente**
com mapa, SOS e IA limitada, e um Plus que custa **R$ 49,90 na página do produto e R$ 29,90 na
home** — encostando ou furando o nosso piso, conforme a página em que o cliente cair. Sede em
**Saquarema**, a uma hora de Búzios. **23 prestadores em Angra e 30 no Rio** já cadastrados. E, no
dia 11 deste mês, lançaram **diário de bordo, marketplace e link de pagamento** de uma vez.

O cliente que o Pedro for visitar em Angra pode já ter ouvido esse nome, e vai ouvir um preço
menor. Eles não vão ganhar por navegação — não têm nenhuma. Vão tentar ganhar por **preço, por
proximidade e por barulho**.

**O que desarma:** manter a conversa no terreno onde eles têm zero — água, profundidade, calado,
corredores — e nunca deixar a comparação virar lista de módulos, porque na lista de módulos nós
empatamos e perdemos no preço. E, se for preciso responder ao degrau gratuito, que a nossa
gratuidade seja do que eles não têm, não do que eles já dão.

## 2ª — Barco em Dia: a commoditização do nosso miolo

R$ 35 / R$ 48 / R$ 68, com **diário de bordo grátis para sempre**. Ataca frontalmente a faixa de
R$ 49,90–69,90 e transforma em brinde exatamente um dos módulos que sustentam a nossa assinatura.
Ainda é versão 1.0.2 com 50+ downloads e prints de loja com dados de teste — mas o posicionamento
é cirúrgico e o **Assistente Normam** mostra que entendem a dor brasileira melhor do que o tamanho
deles sugere.

**O que desarma:** parar de vender "gestão da embarcação" como se fosse escassa — não é mais — e
vender o que só nós entregamos. Se o dono comparar planilha de módulos, ele escolhe R$ 48.

## 3ª — Booat, e o risco de perdermos a narrativa de navegação

É a única empresa brasileira que diz avaliar **profundidade, perigos, correntes, marés e calado**
ao longo da rota, com carta off-line e recálculo automático. Se isso for real e ganhar Android,
o nosso argumento mais forte deixa de ser exclusivo — e nós **descobriríamos tarde**, porque hoje
eles são invisíveis no Android e mudos em português.

Coloco em terceiro, e não em primeiro, por três razões verificadas: **não têm Android**, **não têm
monetização visível** e o selo de **"10.8K Reviews" não bate com as 10 avaliações reais** da loja
brasileira. Mas é a ameaça de maior *variância* da lista: as outras duas roubam cliente por preço;
esta pode roubar a nossa história.

**O que desarma:** instalar, medir e publicar a comparação — é a lacuna número um deste documento
e a primeira coisa a fechar. E acelerar o que o Booat não tem e custa caro copiar: **sondagem
colaborativa e corredores**, que melhoram sozinhos com uso e viram vantagem cumulativa.
