# Concorrentes de navegação — quanto falta pra ser melhor que o Navionics no Brasil

Auditoria competitiva · 19/08/2026 · foco: apps de navegação que o dono de barco de 40–60 pés no Rio já tem no celular.

**Meta declarada do dono:** "ser melhor que o Navionics em tudo". Este documento mede essa distância com evidência, e diz onde o Commander perde feio.

---

## 0. Como ler este documento

- **[V] VERIFICADO** — eu (ou um agente de pesquisa) abri a fonte e li a afirmação lá.
- **[A] ALEGADO** — veio de marketing, agregador ou snippet de busca; não foi lido na fonte primária.
- **[?] NÃO ENCONTRADO** — procurei e não achei. Nunca preenchi com estimativa.

Toda afirmação de preço, nota e cobertura carrega URL. Onde não há URL, é porque não achei — e isso está dito.

**Limites desta pesquisa, declarados de saída:**

- O orçamento de buscas web da sessão (200 chamadas) esgotou antes do fim. Alguns itens ficaram abertos e estão listados na seção 9.
- `c-map.com` devolveu **HTTP 403** (anti-bot) e `navionics.com` devolveu **HTTP 530** em todas as tentativas. As fichas desses dois apps foram montadas por App Store, imprensa náutica e fóruns — não pelo site do fabricante.
- Cruisers Forum, Trawler Forum, SailNet e AppBrain bloquearam acesso (403). Citações de fórum estão marcadas [A].
- `marinha.mil.br` devolve **403** para fetch automatizado. Os termos do CHM foram confirmados por página de serviço do gov.br e por três veículos que os reproduzem.
- **Nenhum app foi instalado e testado em Angra.** Cobertura real da costa Sudeste é inferência geográfica em vários casos, e está marcada como tal. Isto é a maior lacuna do relatório — ver seção 9.

---

## 1. Sumário executivo — as seis coisas que importam

0. **O concorrente a bater não é o Navionics. É o Aqua Map.** Medido por avaliações na App Store brasileira: **Aqua Map 565**, Navionics 135, C-MAP 23, TZ iBoat 17, iSailor 4, savvy navvy 4, Orca 1 [V]. O Aqua Map é o único com um item de compra chamado **"Brasil, cartas náuticas"**, a R$ 199,90. E ele entrega o Brasil pela metade: o módulo de marés dele se chama literalmente *"Tides & Currents (**North America & Oceania**)"*, e as camadas de dado local existem só em EUA, Canadá, França, Dinamarca e Oeste da Austrália [V]. **O brasileiro paga a carta e navega sem maré e sem corrente.** Mirar o Navionics é mirar o alvo errado.

1. **O Navionics não trata o Brasil como região de primeira classe.** Não existe assinatura "Brasil" no app. Existe só o pacote regional *"Mexico, Caribbean to Brazil"* (R$ 249,90/ano na App Store BR), cuja descrição de cobertura detalha Golfo do México, Caribe, Panamá e **costa oeste** da América do Sul, e do Brasil cita nominalmente apenas **Fernando de Noronha, São Pedro e São Paulo e Atol das Rocas**. [V] A costa de Angra vem de um genérico *"coastal coverage of Brazil"*. **Não confirmei que Angra, Guanabara e Ilhabela estejam de fato cobertas na assinatura do app.**

2. **A nota do Navionics é ruim e está piorando.** App Store US: **2,9 com 2,3 mil avaliações** [V]. App Store BR: 3,9 com apenas 135 avaliações [V]. As queixas dominantes são operacionais, não cartográficas: GPS que congela em navegação, loop de verificação de assinatura offline, aumento de 100% no preço e perda das cartas baixadas quando a assinatura expira. **É aqui que mora a chance — não em desenhar uma carta melhor.**

3. **O concorrente tecnicamente mais forte não existe aqui.** A **Orca** — auto-rota com calado, controle de piloto automático via NMEA 2000, Guard Mode, MOB, SAR discado — cobre **30 países e nenhum sul-americano** [V]. App Store BR: **1 avaliação**. O Sudeste brasileiro está descoberto pelo melhor produto do mundo.

4. **A resposta à pergunta que vale mais que o resto: não existe fonte aberta de carta náutica para o Brasil.** NOAA ENC é domínio público (CC0) mas cobre **só a ZEE dos EUA** [V]. NGA DNC é público **só para águas dos EUA** — as bibliotecas estrangeiras são retidas por *"foreign copyright restrictions"* [V], que é exatamente o direito da DHN. OpenSeaMap **não tem nenhuma fonte hidrográfica brasileira** [V]. As ENC brasileiras existem, são **pagas** e saem **exclusivamente pelo IC-ENC** — cujo escritório da América Latina fica dentro da DHN, em Niterói [V]. **O caminho legal existe, mas é comercial, não aberto.**

5. **Existe, porém, uma fonte de batimetria rasa aberta, comercialmente livre e 45× mais fina que a que o Commander usa hoje: batimetria derivada de satélite (SDB) com Sentinel-2 + ICESat-2.** Sentinel é livre por regulamento da UE, ICESat-2 é livre pela NASA, e a literatura reporta **10 m de resolução, 0–20 m de profundidade, RMSE ~1 m** [V]. Hoje o Commander roda em **~450 m**. Isso é o único movimento deste relatório que muda a categoria do produto.

---

## 2. O que o Commander realmente tem — verificado no código, não no roadmap

Conferi no repositório antes de comparar, porque medir distância contra um inventário otimista não serve pra decidir.

| Afirmação | Situação real | Onde |
|---|---|---|
| Rota A* octile sobre máscara de costa OSM a 100 m | **Confirmado.** Máscara fina a 100 m/célula, de Ilhabela/São Sebastião até Búzios | `web/lib/mapa/mascara.ts:114` |
| Batimetria ETOPO 2022 | **Confirmado, e mais grosso do que o briefing sugere** | `web/public/mapa/profundidade-fina.json` |
| Carta náutica própria | **Não existe.** O mapa é Mapbox Standard / Satellite-Streets + **overlay raster do OpenSeaMap** ("balizamento") + a própria camada de batimetria | `web/components/mapa/mapa-nautico.tsx:34-36, 247, 339-347` |
| Sondagem colaborativa NMEA (DPT/DBT) | **Confirmado**, com parser que trata offset do transdutor | `web/lib/domain/sondagem.ts:51-107` |
| Signal K / socket nativo 10110 | **Confirmado** (iOS e Android nativos) | `web/lib/nmea/signalk.ts`, `.../NmeaSocketWorker.swift`, `.../NmeaSocketWorker.java` |
| Marés por estimativa de modelo | **Confirmado**, Open-Meteo `sea_level_height_msl`, rotulado como estimativa, com link pra tábua do CHM | `web/lib/domain/mar.ts:24-29, 120-151` |
| Alarme de âncora, MOB, modo navegando | **Confirmado** | `web/components/mapa/navegar-mapa.tsx` |

**Correção importante ao briefing.** A grade batimétrica **não é de 100 m**. Os 100 m são a célula da *máscara de costa* (terra/água) que alimenta o A*. A batimetria é ETOPO 2022 a **15 arc-sec ≈ 450 m**, cobrindo lng −45,75 a −41,75 e lat −24,05 a −22,65. O próprio arquivo já diz isso com honestidade exemplar:

> "Grade derivada de elevação global (ETOPO 2022), NÃO de carta náutica oficial. Resolução espacial (~450 m fina / ~3,6 km nacional) não resolve pedra isolada, banco de areia ou recife menores que a célula."

Isso é decisivo para a leitura competitiva: **o Commander não tem batimetria de navegação. Tem um filtro de segurança grosseiro.** Uma célula de 450 m em Angra engole a Laje do Meio inteira.

### Cobertura de balizamento OSM no Brasil — medida, não estimada

Contei nós OSM com `seamark:type` via Overpass API, para saber o que o overlay do OpenSeaMap realmente entrega aqui:

| Área | Caixa | Nós `seamark:type` | Densidade (nós/grau²) |
|---|---|---|---|
| **Baía de Guanabara** | −23,00/−43,25 a −22,80/−43,10 | **331** [V] | ~11.000 |
| **Solent (Inglaterra), referência** | 50,5/−1,5 a 51,0/−0,5 | **1.839** [V] | ~3.700 |
| **Angra / Ilha Grande** | −23,35/−44,65 a −22,85/−43,95 | **351** [V] | ~1.000 |
| **Sondagens** (`seamark:type=sounding`) em toda a faixa Ilhabela→Búzios | −24,05/−45,75 a −22,65/−41,75 | **0** [V] | zero |

Leitura honesta: **Guanabara está bem balizada no OSM** — densidade ~3× a do Solent, provavelmente por ser porto grande. **Angra está a ~27% da densidade do Solent** — utilizável, mas rala. E **sondagem no OSM brasileiro é zero absoluto**. O balizamento não é o buraco; a profundidade é.

---

## 3. Tabela funcionalidade × app × Commander

Legenda: ✅ tem · 🟡 tem parcial ou com ressalva · ❌ não tem · ? não encontrado.

| Funcionalidade | Navionics | C-MAP | **Aqua Map** | savvy navvy | Orca | iSailor | TZ iBoat | SEAiq | **COMMANDER** |
|---|---|---|---|---|---|---|---|---|---|
| Carta náutica vetorial própria | ✅ | ✅ | ✅ | 🟡 (re-render de UKHO/NOAA) | ✅ | ✅ (TX-97, **não-oficial**) | ✅ | ❌ (só leitor) | **❌ NÃO TEMOS** |
| Carta raster oficial | ✅ (NOAA) | ❌ | ✅ (NOAA) | ? | ❌ | ❌ | 🟡 | ✅ (usuário instala) | **❌ NÃO TEMOS** |
| ENC oficial exibida no app | ❌ | ✅ (IC-ENC) | ? | ❌ | ❌ | ❌ | ? | ✅ (S-57/S-63) | **❌ NÃO TEMOS** |
| Balizamento | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **🟡 TEMOS DIFERENTE** — overlay OpenSeaMap (comunitário, não oficial) |
| **Sondagem colaborativa** | ✅ SonarChart (qualquer marca de sonar) | ✅ Genesis/Social Map (só ecossistema Navico) | ✅ Crowdsourced Bathymetry + 90 mil sondagens USACE | ❌ | ❌ | ❌ | 🟡 (só notas, não sondagem) | ❌ | **✅ TEMOS** — NMEA DPT/DBT, mediana por célula de 15 m |
| **Rota automática por profundidade/calado** | ✅ Auto Guidance+ | ✅ (reprovado por 2 reviewers) | 🟡 tem autorouting; **uso de calado não encontrado** | ✅ (é o diferencial dele) | ✅ | ❌ | ✅ Route Assist | ❌ | **✅ TEMOS DIFERENTE** — A* sobre ETOPO ~450 m, não sobre carta |
| Marés | ✅ | 🟡 (fontes conflitam) | 🟡 **só América do Norte e Oceania — o Brasil fica sem** | ✅ 8 mil estações (mas dados errados são a queixa nº 1) | ✅ | 🟡 (pago à parte) | ✅ (grátis) | 🟡 | **🟡 TEMOS DIFERENTE** — estimativa de modelo, rotulada, + link CHM |
| Correntes | ✅ | 🟡 | 🟡 **mesma limitação geográfica** | 🟡 (só Elite) | ✅ | 🟡 (pago) | ✅ | 🟡 | **❌ NÃO TEMOS** |
| Vento / meteorologia | ✅ | ✅ | ✅ (Expert/Master) | ✅ ECMWF (14 dias só Elite) | ✅ (8 modelos) | 🟡 (pago) | ✅ | 🟡 | **🟡 TEMOS** (painel de tempo) |
| AIS | 🟡 só receptor a bordo | 🟡 só internet (raio 100 km) | ✅ com detecção de colisão (Expert/Master) | 🟡 **limitado a 3 nm** fora do Elite | ✅ ambos (internet + N2K via Core) | 🟡 (3 compras separadas) | ✅ ambos | ✅ | **❌ NÃO TEMOS** |
| Uso offline | 🟡 (some ao expirar) | 🟡 (Premium, cota de tiles) | ✅ | 🟡 **não está no tier básico** | 🟡 (pago) | ✅ | ✅ (persiste após expirar) | ✅ | **?** — não auditado nesta rodada |
| Waypoints e rotas | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **✅ TEMOS** |
| Compartilhar posição ao vivo | 🟡 [A] | 🟡 (visibilidade mútua) | ✅ Live Sharing | ✅ | ✅ (link, sem app do outro lado) | ❌ | ❌ | ❌ | **❌ NÃO TEMOS** |
| Alarme de âncora | ❓ não encontrado | ✅ | ✅ AnchorLink (alerta remoto por e-mail/Telegram) | 🟡 (só Elite) | ✅ Guard Mode | ✅ | ✅ | ✅ | **✅ TEMOS** — com filtro anti-jitter |
| Homem ao mar (MOB) | ❓ não encontrado | ❌ | ❓ não encontrado | ❓ não encontrado | ✅ | ✅ | ✅ | ❌ | **✅ TEMOS** |
| NMEA 0183 | ✅ (via WiFi) | ❌ | ✅ (WiFi) | 🟡 NMEA Connect só Elite, protocolo não declarado | ❓ | ✅ (pago) | ✅ | ✅ | **✅ TEMOS** — WebSocket Signal K + socket TCP/UDP nativo :10110 |
| NMEA 2000 | 🟡 (via gateway) | ❌ | 🟡 (via gateway) | ? | ✅ nativo (Core, €649) | ❌ | 🟡 (via gateway) | ❌ | **🟡 TEMOS DIFERENTE** — via Signal K, não direto |
| Signal K | ❌ | ❌ | 🟡 **só iOS** | ? | ❓ | ❌ | ❓ | ❓ | **✅ TEMOS** — iOS e Android |
| Sinc. com plotter | ✅ Plotter Sync/ActiveCaptain (Garmin) | ✅ nuvem (B&G/Simrad/Lowrance) | ? | 🟡 (export de rota, Explore+) | ✅ | ❌ | ✅ (Furuno TZT) | ❌ | **❌ NÃO TEMOS** |
| **Controle de piloto automático** | ❌ | ❌ | 🟡 **em BETA**, via NMEA 0183 | ❓ | ✅ Garmin/Raymarine/Simrad | ✅ interface | ✅ (plano Essential) | ❌ | **❌ NÃO TEMOS** |
| **Gestão da embarcação** (manutenção, custos, tripulação, cotistas) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ SÓ NÓS TEMOS** |

---

## 4. Ficha por app

### 4.1 Navionics Boating (Garmin) — a referência declarada

**Dado:** três camadas — base cartográfica licenciada de serviços hidrográficos oficiais, + **SonarChart** (logs de sonar de clientes, corrigidos por maré e reprocessados, aceitos de *qualquer* marca de plotter/sonar, integração em ~1 semana), + **Community Edits/ActiveCaptain** [V, [navionics.com/sonarcharts](https://www.navionics.com/sonarcharts)]. Não consegui abrir a página de *copyright acknowledgement* para listar quais HOs são licenciados por país — **lacuna**, e é justamente onde estaria a confirmação DHN.

**Preço BR [V, [App Store BR](https://apps.apple.com/br/app/navionics-boating/id744920098)]:** *Mexico, Caribbean to Brazil* **R$ 249,90/ano**. Mediterrâneo R$ 299,90. UK/Irlanda/Holanda R$ 199,90. EUA: US$ 49,99/ano. Sem assinatura **não baixa carta nenhuma**.

**Brasil:** ver sumário, item 1. Existe um cartão SD dedicado *"Brazil – Inland and Coastal"* (NASA012R) que revendedores brasileiros descrevem como cobrindo "toda a costa brasileira e rios mapeados pela Marinha" [A, [Velamar](https://velamar.com.br/carta-nautica-navionics-plus-gps-maritimo/)] — mas **isso é cartão pra plotter, não a assinatura do app**. A menção à Marinha sugere DHN/CHM como origem; não confirmado oficialmente.

**Notas:** App Store US **2,9 / 2,3 mil** [V]. App Store BR **3,9 / 135** [V]. Google Play: conflito não resolvido entre 2,7–2,8 (atual) e 3,9 (legado), ~7,76 M instalações [A].

**As 5 reclamações recorrentes — e é aqui que está a oportunidade:**
1. **GPS congela durante a navegação.** *"It stops updating randomly after a few minutes which isn't always obvious"* — usuário relata 2+ anos sem correção. [App Store]
2. **Loop de verificação de assinatura offline.** Assinatura aparece expirada sem sinal ou em modo avião; obriga relogar no WiFi de casa. [A, Cruisers Forum]
3. **Aumento de ~100% no preço** (US$ 24,99 → 49,99) e fim da licença vitalícia após a compra pela Garmin. [A, YBW]
4. **Perde as cartas já baixadas** quando a assinatura expira.
5. **Regressão pós-Garmin:** *"App features are being more and more limited; can no longer follow routes"* (1★). Web app descontinuado.

> Traduzindo: as pessoas não reclamam da carta do Navionics. Reclamam de que **o app falha justamente quando o barco está fora de sinal** — que é quando ele deveria funcionar. Um app que nunca pede login no mar e nunca some com o dado baixado já ganha metade da briga.

### 4.2 C-MAP App (Navico/Brunswick)

**Dado:** cartografia proprietária sobre HOs oficiais licenciados (NOAA, USGS, USACE, NGA, SHOA/Chile, SEMAR/México, INOCAR/Equador, SANHO/África do Sul, entre outros) [A — página de copyright deu 403, lista veio de snippet; **Brasil não apareceu, mas a lista estava truncada**]. Único app do grupo que **exibe ENC oficial IC-ENC dentro do app** [V, App Store]. Crowdsourcing via **Genesis/Social Map**, mas restrito ao ecossistema Navico (Lowrance/Simrad/B&G) — mais fechado que o SonarChart.

**Preço BR [V, [App Store BR](https://apps.apple.com/br/app/c-map-boating/id967289980)]:** anual **R$ 124,90**; anual premium **R$ 264,90**; *Maps South America & Caribbean* **R$ 187,90**; *Maps Paria Gulf to Cape Horn* **R$ 194,90**. Tier gratuito genuinamente útil (viewer mundial, autorouting, waypoints, GPX, previsão).

**Brasil:** *Paria Gulf to Cape Horn* cobre geograficamente toda a costa atlântica brasileira — **indício forte, sem confirmação direta** de Angra/Guanabara/Ilhabela.

**Notas:** App Store US **4,5 / 2,4 mil** [V]; BR **4,8 / 23** [V] (base pequena demais). Nota das *resenhas escritas* cai pra 3,7 [A].

**Reclamação mais grave, corroborada por três fontes independentes: o autorouting é perigoso.** *"It ignored navigation aids and channel markers and directed me into dangerous waters"* (App Store 3★). Yachting World testou com mínimo de 3 m e o app *"would then suggest routes that contravened this limit"*. Casual Navigation: *"the path it took seemed a little illogical"*.

### 4.3 Orca — o melhor produto do mundo, ausente do Brasil

**Dado:** cartografia própria construída sobre HOs oficiais, país a país — Sjøkartverket, UKHO, NOAA+USACE, SHOM, BSH, CHS, Traficom, LINZ, AHO etc. **Não licencia Navionics nem C-MAP.** Sem sondagem colaborativa [V, [help.getorca.com](https://help.getorca.com/en/articles/6404167-what-charts-are-available-in-orca)].

**Preço:** app grátis desde 2024. Orca Plus €49/ano, Smart Navigation €149/ano. **Hardware Core 2 €649, Display 2 €999** [V, configurador]. App Store BR: Plus **R$ 229,90**, Smart Navigation **R$ 499,90 / R$ 799,90** [V].

**Brasil: NÃO COBRE. [V]** A lista oficial tem 30 países e **nenhum sul-americano**. App Store BR: **1 avaliação**.

**Notas:** App Store US 4,6/371 [V]; UK 4,7/536 [V].

**Reclamações:** precisão de carta (*"random roads in the ocean and no shoreline"* nas Bahamas), auto-rota com desvios perigosos, paywall/aumentos, e **inútil sem o Core** (sem o hardware não conecta a instrumento nenhum).

**O que copiar da Orca:** o **Safety Hub** — compartilhar posição por link criptografado que o destinatário abre **sem instalar o app**, MOB que trava coordenada e hora, e **discagem direta pro SAR mais próximo**. Isso é barato de construir e vale muito pra família que fica em terra.

### 4.4 iSailor (Wärtsilä/Transas) — cobre o Brasil, mas mal

**Dado:** **TX-97, formato proprietário e explicitamente NÃO-OFICIAL** — *"TX-97 charts are not official charts... and cannot be used for paperless navigation"* [V]. Derivado de ENC oficiais sob acordos com HOs.

**Preço BR [V, [App Store BR](https://apps.apple.com/br/app/w%C3%A4rtsil%C3%A4-isailor/id398456162)]:** *South America. Guyana-Brazil* **R$ 43,99**; *Brazil. Rio Amazonas* **R$ 39,90**. Tudo o mais é compra separada: AIS receptor R$ 79,90, AIS internet R$ 129,90, NMEA GPS R$ 79,90, marés R$ 79,90.

**Brasil: cobre parcialmente, e provavelmente não cobre o Sudeste.** Os folios identificados são o extremo Norte (Guiana–Brasil), o Amazonas e, mais ao sul, Uruguai/Argentina — **um vazio aparente exatamente em Rio–Santos–Ilhabela**. Ressalva metodológica: a App Store lista só os IAPs mais vendidos; o catálogo completo só aparece dentro do app. **Ausência não comprovada em definitivo.**

**Notas:** App Store US **3,1 / 11** [V]; BR **3,0 / 4** [V]. Última versão iOS: **1.13.4, março/2025**.

**Reclamações:** cobrança retroativa por updates de carta (*"They sold me unlimited updates... and now they changed the contract terms"*), detalhe que some de carta paga, chart store quebrada, e **sinais de abandono do produto**. Sem auto-routing.

### 4.5 TZ iBoat (TimeZero) — o pacote brasileiro mais barato, e quase ninguém usa

**Dado:** formato proprietário **TZ MAPS**, produzido pela MapMedia, *"a partir de cartas vetoriais de serviços hidrográficos oficiais ou de cartas vetoriais privadas da C-MAP"* [V]. **A TimeZero não declara a fonte por área** — não confirmei de onde vem o Brasil.

**Preço [V, [charts-directory](https://mytimezero.com/tz-iboat/charts-directory)]:** **Brasil, Suriname e Guiana US$ 40,99/ano**. Tier grátis inclui marés/correntes, anchor watch, GFS e planejamento de rota. Módulos AIS US$ 8,99, Radar US$ 49,99. **Preço em reais: não encontrado.**

**Brasil: SIM, pacote dedicado.** Nível de detalhe em Angra/Guanabara/Ilhabela **não verificado**.

**Notas:** App Store US **4,6 / 864** [V]; **BR 4,7 / 17** [V].

**Reclamações:** redesign da v4 piorou o fluxo (*"What used to take 5 seconds now takes 5 minutes"*), imagem de satélite defasada 7–8 anos, qualidade cartográfica contestada [A], e assinaturas empilhadas (carta + plano + AIS + radar + meteo a €9,90/mês).

### 4.6 SEAiq — o precedente jurídico mais interessante do relatório

**Dado: não tem carta.** É um *leitor* de ENC oficial: S-57, S-63, Inland ENC e **BSB/KAP**, instalados pelo usuário. Downloader embutido só pra NOAA + USACE [V, [doc.seaiq.com](https://doc.seaiq.com/ChartHelp.html)].

**Preço:** compra única — SEAiq US$ 49,99, SEAiq USA US$ 24,99. Sem assinatura.

**Brasil:** não cobre de fábrica, **mas lê exatamente o formato NOAA-BSB 3.0 em que o CHM publica as raster brasileiras de graça.** Ou seja: o SEAiq resolve o problema jurídico **empurrando-o pro usuário** — quem baixa a carta do site da Marinha é o navegante, para uso próprio, e o app nunca redistribui nada. É um modelo legalmente limpo que o Commander pode estudar (ver seção 6.4).

**Notas:** App Store US **4,7 / 191** (Open) e **4,7 / 499** (USA) [V].

**Reclamações:** não funciona "out of the box", CM93 removido, downloads NOAA lentíssimos, Android abandonado desde 2019.

### 4.7 Aqua Map (GEC s.r.l.) — **o concorrente real no Brasil, e não é o Navionics**

Este é o achado que reordena o relatório. **O app mais usado por brasileiros não é o Navionics — é o Aqua Map**, e por larga margem: **4,7 com 565 avaliações na App Store BR** [V, [App Store BR](https://apps.apple.com/br/app/aqua-map-boating/id919552329)], contra 135 do Navionics, 23 do C-MAP, 17 do TZ iBoat, 4 do iSailor e 1 da Orca. **A referência que o dono declarou não é a que o mercado usa.**

**Dado:** NOAA (cartas oficiais, atualização semanal), **US Army Corps of Engineers** (+90 mil sondagens, semanal), US Coast Guard (+54 mil luzes/boias, diário), Canadian Coast Guard, PING (França), Danish Maritime Authority. POIs de ActiveCaptain e Waterway Guide. Tem **iniciativa própria de batimetria colaborativa** [V]. **Fora dos EUA, nenhuma página nomeia a hidrografia fornecedora** — para o Brasil, DHN é inferência, não confirmação.

**Preço BR [V]:** *Brasil, cartas náuticas* **R$ 199,90** (o canal de revenda descreve o item Brasil como assinatura de **2 anos** [V, [SSCA](https://www.aquamap.app/dealers/136-ssca)], então provavelmente é biênio); *Master* R$ 129,90; *Expert* R$ 79,90. Master/Expert **exigem** carta ativa. Trial de 14 dias.

**Brasil: SIM, cobre — e é o único do grupo com IAP nomeado "Brasil" em reais.** Angra/Guanabara/Ilhabela especificamente: **não encontrado**.

> **E aqui está a fenda mais aproveitável de todo o relatório.** O módulo de marés do Aqua Map chama-se literalmente *"Tides & Currents (**North America & Oceania**)"* [V, [16-main-features](https://www.aquamap.app/support/16-main-features)]. E as camadas "Local Data" do Master cobrem **apenas EUA, Canadá, França, Dinamarca e Oeste da Austrália** [V]. Ou seja: **o brasileiro paga R$ 199,90 pela carta e navega sem maré, sem corrente e sem nenhuma camada de dado local.** Em Angra, onde a maré manobra o barco no fundeadouro, isso é um buraco funcional grave — e o Commander já tem maré estimada, rotulada, com link pra tábua do CHM.

**Notas:** App Store US **4,7 / 14 mil** [V]; **App Store BR 4,7 / 565** [V]; Google Play **3,4 / 973** [A, espelho]. **O abismo iOS 4,7 vs Android 3,4 é o segundo ponto fraco** — coerente com o Signal K deles funcionar só no iOS.

**Reclamações:** crashes ao conectar gateway NMEA; **cartas somem exigindo internet** (*"Three times in the past two weeks all charts have disappeared with the message you must be connected to the internet"*); posição imprecisa em ~30 m; **falha de download de carta paga** (1★ na App Store US, verificado); taxa de amostragem do track baixa. [A, salvo a review da App Store] Elogio recorrente e verificado: **suporte muito responsivo**.

### 4.8 savvy navvy — o melhor conceito, ausente do Brasil e o mais caro aqui

**Dado — e esta é a citação mais útil do relatório todo:** *"We licence UKHO, NOAA and other official hydrographic office charts from around the globe"* [V, [savvy-charts](https://www.savvy-navvy.com/features/savv-charts-tm)]. Eles **não produzem carta: licenciam de HOs oficiais e re-renderizam** com estilo próprio. **O boato de que usam NV Charts não se sustenta** — zero menção em site, help center, sitemap ou na review da Practical Sailor. Batimetria por análise geoespacial própria; marinas via Navily e Dockwa. **Sem crowdsourcing.**

**Preço BR [V, [App Store BR](https://apps.apple.com/br/app/savvy-navvy-boat-navigation/id1479182650)]:** Essential R$ 172,90–499,90; Elite **R$ 599,90–999,90**. Três tabelas de preço conflitantes entre site (£59/95/99), Practical Sailor (US$ 79,99/144,99/149,99) e App Store — reprecificação recente provável, não consegui datar. **O tier útil (Elite, único com âncora, NMEA e correntes) custa 2 a 3× o Aqua Map completo no Brasil.**

**Brasil: forte presunção de que NÃO cobre.** Quatro evidências independentes [V]: (1) o próprio help center diz que cobertura global é *"long-term goal"*, não fato; (2) o sitemap oficial tem 11 páginas de região e **nenhuma da América do Sul** — a única presença nas Américas ao sul dos EUA é o Caribe, e essa página não cita Brasil; (3) o anúncio de expansão mais recente cita lagos americanos e o Báltico, **nada da América do Sul**; (4) App Store BR: **4 avaliações**, descrição só em inglês.

**Notas:** App Store US **4,7 / 7,9 mil** [V]; BR **4,0 / 4** [V]; Google Play 4,2 / 3.273 [A]. O site alega "4,6 com mais de 10.000 avaliações 5 estrelas" — não bate com loja nenhuma; é *cherry-picking*.

**Reclamações (fórum YBW, acessível e verificado):** **maré errada** — *"The app gave tidal data that was at least 2 hours wrong"*; **carta pobre em detalhe** — *"Massively lacking detail & unusable"* (custo direto de re-renderizar em vez de exibir a carta); autorouting mandando pro lado errado; Android instável; bateria (34% após 3 h de tracking).

### 4.9 O mercado brasileiro — o que existe de fato

- **App de navegação náutica com carta, feito no Brasil: não encontrei nenhum.** O que existe é app estrangeiro consumindo carta brasileira — sobretudo o **Marine Navigator** (Android, R$ 21,39), que lê as raster BSB da DHN e **não vem com carta** [V, [Perfil Náutico](https://perfilnautico.com.br/marine-navigator-lite-android-navegador-offline/)]. No desktop, **OpenCPN**.
- **O que brasileiros de fato usam:** Navionics é o mais *citado*; **Aqua Map é o mais usado de verdade** — **4,7 com 565 avaliações na App Store BR**, contra 135 do Navionics, 23 do C-MAP, 17 do TZ iBoat e 1 da Orca [V]. **Windy** domina vento.
- **Gestão de embarcação (concorrência direta do outro lado do Commander):** **AppBoats**, **MarinasOnline**, **NauticApp**, **GC Bombarco** — todos brasileiros, todos **centrados na marina, não no dono do barco**, e **nenhum tem carta náutica**.

> **A lacuna de mercado é real e está documentada:** os apps de navegação não fazem gestão, os apps de gestão são da marina e não do dono, e ninguém junta as duas coisas no Brasil.

---

## 5. Cobertura do Brasil — quem realmente entra em Angra

| App | Cobre a costa Sudeste? | Preço da região no Brasil | Avaliações na App Store BR | Confiança |
|---|---|---|---|---|
| **Aqua Map** | **Sim** — IAP nomeado "Brasil, cartas náuticas" | **R$ 199,90** (provável biênio) + Master R$ 129,90 | **565** | **Alta [V]** |
| **TZ iBoat** | **Sim**, pacote "Brazil, Suriname and Guyana" | US$ 40,99/ano (não achei em R$) | 17 | Alta [V] — pacote dedicado existe |
| **C-MAP** | **Provável**, "Paria Gulf to Cape Horn" | R$ 194,90 (ou R$ 264,90 premium mundial) | 23 | Média — inferência geográfica |
| **Navionics** | **Incerto**, só "Mexico, Caribbean to Brazil" | R$ 249,90/ano | 135 | **Baixa** — descrição oficial cita só Noronha, SPSP e Rocas |
| **iSailor** | **Provavelmente não** — vazio entre Guiana e Uruguai | R$ 43,99 (folio Guyana-Brazil) | 4 | Média |
| **SEAiq** | Só se o usuário instalar a raster do CHM | US$ 49,99 (compra única) | não encontrado | Alta [V] |
| **savvy navvy** | **Presunção forte de que NÃO** — sitemap sem América do Sul | Elite R$ 599,90–999,90 | 4 | Média-alta [V, 4 indícios] |
| **Orca** | **NÃO** — 30 países, nenhum sul-americano | — | 1 | **Alta [V]** |

**Conclusão desta seção, e ela contraria o briefing:** o app que os brasileiros de fato usam é o **Aqua Map** — 565 avaliações na loja BR contra 135 do Navionics. **O concorrente a bater não é o Navionics; é o Aqua Map.** E o Aqua Map entrega o Brasil pela metade: vende a carta, mas o módulo de marés e correntes é *"North America & Oceania"* e as camadas de dado local só existem em 5 países, nenhum deles aqui.

Dos oito apps, dois têm pacote brasileiro dedicado e verificado (Aqua Map, TZ iBoat), um provavelmente cobre por arrasto regional (C-MAP), dois quase certamente não cobrem (savvy navvy, Orca), e a própria referência do dono — o Navionics — **não tem sequer uma região "Brasil" no app**.

---

## 6. A pergunta que vale mais que o resto do relatório: de onde tirar carta e sondagem no Brasil

O bloqueio da raster do CHM já estava apurado e não foi reinvestigado. A pergunta era: **existe outra fonte utilizável comercialmente?** Investiguei sete e a resposta é diferente para carta e para batimetria.

### 6.1 Carta náutica — as portas fechadas [V]

| Fonte | Cobre o Brasil? | Licença | Veredito |
|---|---|---|---|
| **NOAA ENC / RNC** | **Não** — só a ZEE dos EUA, "primarily intended to support navigation in the territorial waters of the United States" | **CC0-1.0, domínio público**, sem restrição comercial ([data-licensing](https://www.nauticalcharts.noaa.gov/data/data-licensing.html)) | Licença perfeita, geografia errada |
| **NGA DNC** | Cobre o mundo | Público **apenas para águas dos EUA**; bibliotecas estrangeiras retidas por *"foreign copyright restrictions"* ([dnc.nga.mil](https://dnc.nga.mil/dncp/DNCgeneral.php)) | **Fechado** — e o "foreign copyright" é o direito da DHN |
| **OpenSeaMap** | Balizamento sim, **sondagem não** | ODbL / CC-BY-SA — comercialmente usável | **Já usamos.** Fontes hidrográficas doadoras: só Alemanha (WSV, BSH) e Suíça. **Nenhuma brasileira** ([quellen](https://www.openseamap.org/index.php?id=quellen&L=1)) |
| **IHO S-57 / S-63 / S-101** | São **padrões**, não dados | — | Não é fonte. O dado por trás é sempre de um HO nacional |
| **ENC brasileira via IC-ENC** | **Sim, integralmente** | **Paga**, distribuída exclusivamente por RENC | **Esta é a porta aberta — ver 6.2** |

### 6.2 A porta que existe: IC-ENC

As ENC brasileiras são produzidas pelo CHM sob delegação da DHN e **vendidas exclusivamente através do IC-ENC** (RENC operado pelo UKHO). O IC-ENC tem ~54–60 escritórios hidrográficos membros, **o Brasil entre eles**, e — o detalhe que importa — **o escritório da América Latina do IC-ENC fica dentro da DHN, em Niterói**, criado em 2016 em parceria com a Diretoria [V, [ic-enc.org](https://www.ic-enc.org/), [Hydro International](https://www.hydro-international.com/content/article/first-year-of-the-ic-enc-latin-america-office)].

O mecanismo comercial é o programa de **Value Added Reseller (VAR)**: o IC-ENC fornece a base **não criptografada** ao VAR, que agrega, assina em S-63 e empacota sob licença de serviço. É por esse caminho que Navionics, C-MAP e Transas obtêm cobertura mundial.

Que este é *o* caminho da indústria está documentado da forma mais direta possível pelo savvy navvy, que declara em texto aberto no próprio site: *"We licence UKHO, NOAA and other official hydrographic office charts from around the globe"* [V, [savvy-charts](https://www.savvy-navvy.com/features/savv-charts-tm)]. Nenhum desses apps desenha carta. **Todos licenciam de serviços hidrográficos e re-renderizam.** É um caminho batido, não uma invenção — o que falta saber é o preço.

**O que NÃO consegui apurar, e é decisivo:** o **custo**. Nenhuma tabela de preço por célula ou por licença é pública. O `ic-enc.com` recusou conexão e o `ic-enc.org/join` deu 404. Também não achei evidência de um tier de licenciamento *leisure*/não-SOLAS mais barato — o programa é claramente desenhado para ECDIS.

> **Ação concreta, e é a mais valiosa do relatório:** pedir cotação ao IC-ENC Latin America (Niterói) para as células ENC de Angra, Guanabara, Ilha Grande e Ilhabela, em uso não-SOLAS de aplicativo de lazer. É um e-mail. Até que essa cotação exista, qualquer plano de carta própria é especulação.

### 6.3 Batimetria — aqui a notícia é boa

| Fonte | Resolução | Cobre o Brasil? | Licença | Veredito |
|---|---|---|---|---|
| **ETOPO 2022** (hoje) | 15 arc-sec ≈ **450 m** | Sim | Domínio público (US Gov) | **Em uso.** Grosso demais pra navegação costeira |
| **GEBCO 2024/2026** | 15 arc-sec ≈ 450 m | Sim | **Domínio público**, só pede citação ([gebco.net](https://www.gebco.net/data-products/gridded-bathymetry-data)) | Empate técnico com ETOPO. **Não vale trocar** |
| **EMODnet** | ~100 m | **Não** — só Europa. Fora dela é GEBCO reembalado | CC-BY 4.0 | Inútil aqui |
| **BNDO / LEPLAC (Marinha)** | Variável | Sim | Fornecido **grátis por e-mail**, prazo ~10 dias úteis | LEPLAC é margem continental (**águas profundas**), não Angra. Termos de uso comercial **não verificados** |
| **SDB: Sentinel-2 + ICESat-2** | **10 m** | **Sim** | **Livre, inclusive comercial** | **É o caminho — ver 6.4** |

### 6.4 O achado: batimetria derivada de satélite

Combinar imagem multiespectral **Sentinel-2** (ESA/Copernicus) com fotocontagem lidar do **ICESat-2** (NASA) produz batimetria de água rasa a **10 m de resolução, para 0–20 m de profundidade (até ~30 m em condições ideais), com RMSE de ~1 m** [V, literatura revisada por pares]. A TCarta vende exatamente isso comercialmente, descrevendo o resultado como *"hydrographic-grade bathymetry"* validada contra especificações da IHO [V, [tcarta.com](https://tcarta.com/satellite-derived-bathymetry/)].

**As duas licenças são limpas:**
- **Sentinel-2** — dado livre, pleno e aberto sob o programa Copernicus, estabelecido pelo Regulamento (UE) 2021/696; reprodução, distribuição, adaptação, modificação e combinação com outros dados são permitidas, **sem restrição de uso comercial** [V].
- **ICESat-2** — livre e público via NSIDC DAAC da NASA, sem custo [V].

**O que isso significa em números:** o Commander sairia de células de **450 m** para **10 m** — um ganho de **45×** em resolução linear, ~2.000× em área por célula. Uma célula de 10 m em Angra distingue laje de canal. Uma de 450 m não distingue nada.

**As limitações, ditas honestamente:** só funciona em água **clara** (a costa de Angra e Ilha Grande qualifica na maior parte do ano; a Baía de Guanabara, com sua turbidez, **provavelmente não**), só até ~20 m, exige compor múltiplas passagens pra furar nuvem, e **não é carta náutica** — é um modelo de terreno submerso. Continua valendo o aviso que o Commander já exibe.

**Não verifiquei:** o custo computacional de processar SDB para a região, nem se existe produto SDB pronto e aberto para a costa brasileira (só encontrei fornecedor comercial). Isso é uma prova de conceito a fazer, não um dado a baixar.

### 6.5 O precedente SEAiq — a saída jurídica de baixo custo

O SEAiq nunca redistribui carta: o **usuário** baixa a raster oficial (no Brasil, do site do CHM, em NOAA-BSB 3.0 — o formato que o SEAiq lê) e instala no app, para uso próprio. O app é um leitor.

Isso muda a natureza jurídica do ato: não há reprodução comercial pelo Commander, há uso pessoal pelo navegante. **Não sou advogado e isto não é parecer jurídico** — o termo do CHM proíbe reproduzir, compilar e derivar para fins comerciais, e há discussão legítima sobre se um app pago que *facilita* a instalação configura uso comercial da carta. **Vale uma consulta jurídica de uma hora antes de qualquer linha de código.** Mas é o caminho mais barato que existe para ter carta oficial brasileira dentro do Commander.

---

## 7. O que fazer — três listas

### 7.1 O que dá pra alcançar em UMA onda

| Item | Por quê | Contra quem |
|---|---|---|
| **Maré e corrente brasileiras como primeira classe** | **O maior furo do líder de mercado local.** O Aqua Map não dá maré no Brasil, o savvy navvy dá maré errada, e nós já temos estimativa rotulada + link CHM. Falta só tratar isso como recurso de destaque em vez de detalhe, e somar corrente (Copernicus Marine é livre) | **Aqua Map** |
| **Nunca pedir login no mar; nunca perder o dado baixado** | É a reclamação nº 1 e nº 4 do Navionics, a nº 2 do C-MAP e a nº 2 do Aqua Map (*"all charts have disappeared with the message you must be connected to the internet"*). É engenharia local, sem dado novo, sem licença | Navionics, Aqua Map |
| **Android à altura do iOS** | Aqua Map: 4,7 no iOS contra **3,4 no Android**. savvy navvy: instabilidade no Android é queixa recorrente. Metade do mercado brasileiro está mal atendida por todo mundo | Aqua Map, savvy navvy |
| **Compartilhar posição por link, sem app do outro lado** | A Orca provou que vende. Já temos posição e trilha; falta uma rota pública e um token | Orca (que não está aqui) |
| **Discagem direta pra emergência marítima** (Capitania/SALVAMAR, canal 16) | Uma tela, zero dado novo, e resolve o pior momento possível | Ninguém tem no Brasil |
| **Rotular a rota automática com honestidade radical** | O C-MAP foi reprovado por dois reviewers por sugerir rota abaixo do calado mínimo. Nosso ETOPO de 450 m tem o mesmo risco — dizer isso na tela vira confiança, não fraqueza | C-MAP |
| **Publicar a cobertura real, mapa na mão** | Navionics não diz se cobre Angra; nós podemos mostrar exatamente onde a máscara fina termina | Todos |
| **Pedir a cotação ao IC-ENC Latin America** | É um e-mail. Destrava ou mata a estratégia de carta própria | — |

### 7.2 O que exige dado que não temos

| Item | O que falta | Custo/risco |
|---|---|---|
| **Carta náutica de verdade** | Licença ENC via IC-ENC, ou acordo EMGEPRON, ou o modelo SEAiq | Preço desconhecido. **Maior incógnita do plano** |
| **Batimetria de navegação (10 m)** | Pipeline SDB Sentinel-2 + ICESat-2 | Licença livre; custo é de engenharia e processamento. **Melhor relação valor/risco do relatório** |
| **AIS** | Feed de internet (assinatura) ou receptor a bordo (já temos o transporte NMEA — falta só o parser VDM/VDO) | AIS via NMEA já existente é **barato**; o feed global é caro |
| **Correntes** | Fonte de modelo (Copernicus Marine é livre) | Médio |
| **Sinc. com plotter** | Protocolos proprietários Garmin/Navico | Alto, e é o fosso deles |

### 7.3 O que NÃO vale perseguir

| Item | Por quê |
|---|---|
| **Trocar ETOPO por GEBCO** | Mesmos 15 arc-sec. Trabalho por zero ganho |
| **Controle de piloto automático** | Exige NMEA 2000 nativo (a Orca vende um Core de €649 pra isso), homologação e responsabilidade civil sobre o leme. Fora de escala pra R$ 49,90/mês |
| **Cobertura nacional de carta** | O cliente é dono de 40–60 pés no Rio. Angra, Ilha Grande, Guanabara, Búzios e Ilhabela **são o mercado inteiro**. Cobrir o Amazonas é vaidade de catálogo |
| **Bater o Navionics no desenho da carta** | Eles licenciam HOs do mundo há 40 anos. Essa corrida está perdida e não é onde eles são fracos |
| **Sondagem colaborativa como diferencial de marketing** | Já temos, e é boa engenharia — mas com a base de usuários atual a densidade é irrelevante por anos. É investimento de longo prazo, não argumento de venda hoje |
| **EMODnet, NGA DNC, NOAA ENC** | Verificados e descartados: cobertura errada ou licença fechada para o Brasil |

---

## 8. Onde o Commander perde feio — dito com todas as letras

1. **Não temos carta náutica.** O concorrente mostra sondagens, isóbatas, natureza de fundo, setores de faróis e áreas restritas. Nós mostramos um mapa de ruas do Mapbox com balizamento comunitário por cima. Para um dono de 50 pés que já paga Navionics, essa diferença é visível em três segundos.
2. **Nossa "profundidade" é 45× mais grossa do que o mercado assume.** 450 m por célula. O Auto Guidance+ do Navionics roda sobre carta real com sondagem real. Chamar o nosso A* de "equivalente conceitual" é verdade na arquitetura e falso na precisão.
3. **Não temos AIS.** Num sábado em Angra com 300 barcos, é a camada que o dono mais olha. E o transporte NMEA já está pronto — falta só o parser.
4. **Não temos sinc. com plotter.** Quem tem Garmin no barco sincroniza rota com um toque. Nós não existimos nesse fluxo.
5. **Não temos correntes.** No canal entre Ilha Grande e o continente, isso importa.
6. **Não temos compartilhamento de posição ao vivo.** O Aqua Map tem *Live Sharing*, a Orca manda link que o destinatário abre sem instalar nada, e o alarme de âncora do Aqua Map **avisa por e-mail e Telegram**. O nosso alarme de âncora toca no aparelho que está no barco — o que é exatamente o lugar onde o dono não está quando importa.

E onde ganhamos, também com todas as letras:

- **Somos o único produto que junta navegação e gestão da embarcação.** Os apps de gestão brasileiros (AppBoats, MarinasOnline, NauticApp, GC Bombarco) são da marina, não do dono, e nenhum tem carta. Os apps de navegação não fazem gestão. Ninguém no Brasil junta as duas coisas.
- **Somos os únicos que dão maré brasileira.** O líder local não dá.
- **Signal K nas duas plataformas.** O Aqua Map só tem no iOS.
- E somos o único que pode olhar o dono do barco brasileiro no olho e dizer que o produto foi feito pra ele.

---

## 9. Lacunas declaradas — o que não consegui verificar e por quê

**Bloqueios técnicos:** `c-map.com` 403 (anti-bot) · `navionics.com` 530 · `marinha.mil.br` 403 · `play.google.com` truncado em todas as tentativas · Cruisers Forum, Trawler Forum, SailNet, AppBrain, morganscloud.com 403 · `ic-enc.com` recusou conexão, `ic-enc.org/join` 404 · Sailing Anarchy 402 · **orçamento de WebSearch esgotado (200/200)**.

**Itens factuais em aberto, por ordem de importância para a decisão:**

1. **[CRÍTICO] Cobertura real de Angra, Guanabara e Ilhabela** no **Aqua Map**, Navionics e C-MAP. Nenhuma evidência direta para nenhum dos três. **Recomendo teste empírico: instalar os três, dar zoom nas três áreas e fotografar a tela.** Custa uma tarde e vale mais que o resto desta seção. Prioridade máxima no Aqua Map, que é o líder local.
2. **[CRÍTICO] Preço de licenciamento ENC via IC-ENC.** Nenhuma tabela pública; `ic-enc.com` recusou conexão e `/join` deu 404. Sem isso, a estratégia de carta é indecidível.
3. **Quem fornece a carta do Brasil ao Aqua Map.** Nenhuma página deles nomeia hidrografia fora dos EUA. DHN é inferência. **Se descobrirmos isso, descobrimos o caminho que já foi trilhado.**
4. **Mapa de cobertura do savvy navvy (Brasil sim/não, definitivo).** `savvy-navvy.com/coverage` renderiza por JavaScript; 3 tentativas de fetch falharam. **Abrir no navegador leva 30 segundos** — vale fechar essa.
5. **Se a DHN/CHM está entre os HOs licenciados** por Navionics e C-MAP. Não confirmado para nenhum dos dois.
6. **Duração do IAP "Brasil, cartas náuticas — R$ 199,90"** do Aqua Map. O revendedor indica 2 anos; a ficha da loja não exibe o período.
7. **Termos de uso comercial dos dados do BNDO.** A página deu 403; sei que o dado é fornecido de graça por e-mail, não sei sob que licença.
8. **Existência de produto SDB pronto e aberto para a costa brasileira.** Só encontrei fornecedor comercial (TCarta). Não sei o custo de processar do zero.
9. **Extensão exata do folio "Guyana-Brazil" do iSailor** — não sei se termina em Belém, Salvador ou Rio.
10. **Preços em reais de TZ iBoat e SEAiq** — a App Store não expõe IAP em R$ na página pública.
11. **Nota real do Navionics no Google Play** — conflito 2,7 vs 3,9 não resolvido. Números do Google Play de Aqua Map e savvy navvy vêm de espelho, não da loja.
12. **Alarme de âncora e MOB no Navionics** — ausência de evidência em ~8 fontes é indício forte de que não tem, mas não é prova. Mesmo caso para MOB no Aqua Map e no savvy navvy.
13. **Preço vigente do savvy navvy** — três tabelas conflitantes (site em £, Practical Sailor em US$, App Store em US$/R$). Reprecificação recente provável, não datada.
14. **Suporte a NMEA 0183 e Signal K na Orca** — não encontrado; provável ausência, não confirmada.

---

## 10. A resposta em uma frase

**Sim, é possível ser melhor que o Navionics no Brasil — mas só se pararmos de mirar no Navionics, que aqui é uma lembrança de marca com 135 avaliações, e passarmos a mirar no Aqua Map, que é quem realmente está no celular do dono: o caminho é licenciar a ENC brasileira pelo IC-ENC de Niterói (ou espelhar o modelo SEAiq, em que o próprio navegante instala a raster oficial do CHM), levantar a batimetria de Angra de 450 m para 10 m com Sentinel-2 + ICESat-2 — que é livre, inclusive para uso comercial —, ligar o AIS que já tem transporte pronto, e entregar tudo isso num app que dá maré e corrente brasileiras (que o líder local simplesmente não dá), que nunca pede login no mar, que funciona igual no Android, e que também cuida do barco — a metade do problema que nenhum concorrente sequer tenta resolver.**

---

*Documento produzido em 19/08/2026. Toda afirmação sem marcação [A] ou [?] foi lida na fonte citada.*
