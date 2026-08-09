# App nativo (Capacitor) — onda 14

Empacota o Commander como app nativo Android/iOS via [Capacitor](https://capacitorjs.com),
pelo motivo concreto que o navegador não resolve: abrir socket **TCP/UDP cru** para ler o
ecobatímetro do barco por um gateway WiFi NMEA 0183. O restante do app (Next.js) não muda —
ele continua sendo o mesmo site publicado, só carregado dentro de um WebView nativo com
plugins extras disponíveis.

**Esta máquina não tem Android SDK, JDK, Gradle nem Xcode.** Tudo neste documento foi escrito
e organizado, mas **não foi compilado nem rodado num device/emulador**. A seção
[O que está verificado e o que não está](#o-que-está-verificado-e-o-que-não-está) no fim
separa isso com clareza — leia antes de assumir que algo funciona.

## Por que `server.url` em vez de exportar estático

O Commander é Next.js 16 com **server components e server actions** (autenticação, gravação
no Supabase, cobrança Asaas, etc.) — `output: "export"` quebraria praticamente tudo. A
[documentação oficial do Capacitor sobre o objeto `server`](https://capacitorjs.com/docs/config)
descreve `server.url` como pensado para live-reload em desenvolvimento e "não recomendado para
produção" — mas na prática, para um app que **precisa** de um backend Next de verdade (SSR,
server actions, rotas de API), é o único caminho: o shell nativo não empacota os assets web,
ele **carrega a URL do app publicado** dentro do WebView, e só os PLUGINS nativos (o socket
NMEA, a geolocalização) são código de verdade rodando no dispositivo.

Isso significa:
- `webDir` (`web/capacitor/www/`) é só uma pasta placeholder — obrigatória para o `cap sync`
  gerar o projeto nativo (copia a ponte JS do Capacitor + serve de fallback offline), mas
  **não é o app de verdade**. O app de verdade é o que estiver publicado em `server.url`.
- `server.cleartext` (HTTP puro, sem TLS) só faz sentido em desenvolvimento, apontando pro
  `next dev` rodando na rede local — produção é sempre HTTPS. Em `web/capacitor.config.ts`
  isso é decidido automaticamente pelo protocolo da URL resolvida (nunca uma flag separada
  que alguém esquece de desligar).
- `server.allowNavigation` — por padrão o WebView do Capacitor abre URLs externas no
  navegador do sistema, não nele mesmo. A lista em `capacitor.config.ts` inclui só o host de
  `server.url` (e seu wildcard de subdomínio); qualquer link que abrir fora disso (WhatsApp,
  checkout do Asaas) cai no navegador/app externo — comportamento certo pra esses casos, não
  precisa mudar.

## Aviso obrigatório: risco de rejeição na App Store

A [Guideline 4.2 da Apple (Minimum Functionality)](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality)
rejeita apps que são essencialmente "um site dentro de um WebView" sem capacidade nativa real.
**Isto se aplica ao Commander tal como ele está hoje** se for submetido só com o shell
carregando `server.url` — a defesa é a capacidade nativa que o navegador não dá:

1. **Socket NMEA (TCP/UDP)** — lê o ecobatímetro direto, dado que nenhum navegador consegue
   acessar. É o item mais forte da defesa; ver [status abaixo](#o-que-está-verificado-e-o-que-não-está).
2. **GPS em segundo plano** — hoje **não implementado de verdade**, só documentado como
   próximo passo (ver [seção GPS](#gps-em-segundo-plano)). Sem isso, a defesa fica mais fraca
   — o app tem uma capacidade nativa real (o socket), mas não duas.
3. **Fila offline de sondagem** — de outro agente, em paralelo (`web/lib/nmea/fila.ts`), fora
   do escopo desta onda.

**Recomendação:** não submeter para review antes do socket NMEA estar testado de verdade
contra um gateway/ecobatímetro real (não só o simulador) — um reviewer da Apple/Google que
não tenha como testar a leitura de profundidade vai enxergar exatamente "site num WebView".

## Scaffolding

```
web/
  capacitor.config.ts          # config — server.url resolvido por env var, nunca fixo
  capacitor/www/index.html     # webDir placeholder (NÃO é o app — ver acima)
  android/                     # projeto nativo Android (gerado por `npx cap add android`)
  ios/                         # projeto nativo iOS (gerado por `npx cap add ios`)
```

`android/` e `ios/` já foram gerados nesta onda (via `npx cap add android` / `npx cap add ios`
— comandos que só copiam templates dos pacotes `@capacitor/android`/`@capacitor/ios`, não
precisam de SDK nenhum instalado) e estão **versionados no git**, junto com o código nativo
customizado do plugin NMEA. Rodar `npx cap add` de novo não é necessário; `npm run cap:sync`
(= `npx cap sync`) é o comando do dia a dia — recopia a config e a lista de plugins depois de
qualquer mudança em `capacitor.config.ts` ou nas dependências.

`npm run build`, `npm test`, `npx tsc --noEmit` e `npx eslint app components lib` continuam
idênticos a antes desta onda — nenhum deles toca em `android/`, `ios/` ou `capacitor/www/`.

## Instalar a toolchain

Só necessário na máquina onde for de fato compilar/rodar o app (não nesta).

### Android
1. [Android Studio](https://developer.android.com/studio) (inclui o Android SDK e um
   emulador). Na primeira abertura, deixe o SDK Manager instalar a API level mais recente.
2. JDK 21 — o próprio Android Studio já traz um embutido (Android Studio → **Settings → Build,
   Execution, Deployment → Build Tools → Gradle → Gradle JDK**); normalmente não precisa
   instalar nada à parte.
3. Confirme `ANDROID_HOME` configurado (o instalador do Android Studio faz isso sozinho na
   maioria dos casos).

### iOS
1. Xcode (App Store, macOS obrigatório — não dá para compilar iOS em Windows/Linux).
2. Abrir o Xcode uma vez para aceitar a licença e instalar os componentes de linha de comando
   (`xcode-select --install`).
3. Conta Apple Developer (gratuita já roda no simulador/device próprio por 7 dias; paga
   necessária pra distribuir/TestFlight).

## Gerar e rodar

```bash
cd web
npm install

# Abrir no Android Studio (compila/roda a partir de lá — emulador ou device via USB):
npm run cap:android

# Abrir no Xcode (só em macOS):
npm run cap:ios
```

Depois de qualquer mudança em `capacitor.config.ts`, `.env.local` (as variáveis abaixo) ou nas
dependências do Capacitor, rode `npm run cap:sync` antes de abrir o Android
Studio/Xcode de novo.

### Apontar pro dev server na rede local

O device/emulador **não alcança `localhost`** — precisa do IP da máquina que roda `next dev`
na mesma rede WiFi.

1. Descubra o IP da sua máquina na LAN (`ipconfig` no Windows, `ifconfig`/`ip a` no
   macOS/Linux — algo como `192.168.x.x`).
2. Em `web/.env.local`:
   ```
   CAPACITOR_SERVER_URL=http://192.168.x.x:3010
   ```
   (porta igual à que `next dev` está usando nesta máquina — ver `docs/OPERACAO.md` se
   houver dúvida sobre qual porta).
3. `npm run cap:sync` e reabra o Android Studio/Xcode.
4. **Android:** cleartext HTTP já é permitido automaticamente em builds de **debug**
   (`android/app/src/debug/AndroidManifest.xml` — não entra no build de release, que
   continua HTTPS-only). Nenhum passo manual aqui.
5. **iOS:** o ATS (App Transport Security) bloqueia HTTP puro por padrão, e — diferente do
   Android — não há aqui um jeito automático de restringir isso só ao build de debug sem
   editar o projeto no Xcode. Durante o desenvolvimento, adicione manualmente em
   `ios/App/App/Info.plist` (tem um comentário no próprio arquivo mostrando o trecho exato) e
   **nunca commite isso ligado**:
   ```xml
   <key>NSAppTransportSecurity</key>
   <dict>
     <key>NSAllowsArbitraryLoads</key>
     <true/>
   </dict>
   ```
6. Sem `CAPACITOR_SERVER_URL` definida, o config cai pra `NEXT_PUBLIC_APP_URL` e depois pro
   domínio de produção fixo (`https://commander.soumardivers.com`) — ver
   `web/capacitor.config.ts`.

### Passo manual obrigatório no Xcode (iOS)

Os arquivos do plugin NMEA (`ios/App/App/NmeaSocket/NmeaSocketPlugin.swift` e
`NmeaSocketWorker.swift`) foram criados fora do Xcode, escrevendo direto no sistema de
arquivos — sem Xcode instalado nesta máquina não há como adicioná-los ao `.xcodeproj`
automaticamente sem risco de corromper o arquivo do projeto (edição manual de `project.pbxproj`
foi deliberadamente evitada). **Antes de compilar no Xcode pela primeira vez:**

1. Abra `ios/App/App.xcodeproj`.
2. Botão direito em "App" (o grupo, não o projeto) → **Add Files to "App"...**
3. Selecione a pasta `NmeaSocket/` inteira.
4. **Copy items if needed:** desmarcado (os arquivos já estão no lugar certo).
5. **Add to target:** confirme "App" marcado.

Sem esse passo o Xcode simplesmente não compila os arquivos — eles não fazem parte do projeto.
O plugin Android não tem equivalente disso: `android/app/build.gradle` já compila tudo dentro
de `src/main/java/**` automaticamente, então o pacote `nmea/` já está incluído.

## Testar o socket NMEA sem barco

`scripts/simular-nmea.mjs` finge ser um gateway WiFi NMEA 0183: manda sentenças `$SDDPT`/`$SDDBT`
com checksum válido, por TCP (como servidor — o app conecta nele) ou UDP (como emissor —
broadcast ou unicast, o app só escuta), na mesma porta/formato que um gateway de verdade.

```bash
# UDP (modo mais comum de gateway — o app só escuta, não precisa saber o IP do simulador):
node scripts/simular-nmea.mjs --modo udp --destino 192.168.x.255   # broadcast de verdade na LAN
# ou, testando na mesma máquina:
node scripts/simular-nmea.mjs --modo udp --destino 127.0.0.1

# TCP (o simulador vira servidor; configure o Commander pra conectar em host = IP desta máquina):
node scripts/simular-nmea.mjs --modo tcp

# Ajuda com todas as opções (porta, intervalo, quantidade, profundidade, seed):
node scripts/simular-nmea.mjs --help
```

Configure o app pra usar o `NmeaSocket` (ver `web/lib/nmea/nativo-capacitor.ts`) com
`porta`/`host`/`modo` batendo com o que o simulador está usando (porta padrão dos dois:
10110, ver [pesquisa de porta/modo](#porta-e-modo-padrão-do-gateway-pesquisa) abaixo).

**Isto foi testado de verdade nesta onda** — não só escrito: `web/lib/nmea/simulador-nmea.test.ts`
faz parte de `npm test` (roda em todo `npm test`/CI, sem precisar de device nenhum) e:
1. Sobe `scripts/simular-nmea.mjs` como processo filho, em TCP e em UDP, numa porta
   efêmera (`--porta 0`, escolhida pelo SO — evita colisão entre execuções em paralelo).
2. Conecta um cliente TCP/UDP puro do Node (não o plugin Capacitor — sem Android/iOS aqui,
   ver seção seguinte) e coleta as sentenças de verdade, transmitidas por um socket real.
3. Roda cada sentença através de `validarChecksum` e `parseSentencaProfundidade`
   (`web/lib/domain/sondagem.ts` — o parser de dominio de verdade, o mesmo que
   `nativo-capacitor.ts` usa) e confirma que decodifica pra uma profundidade plausível.
4. Confirma que uma sentença com checksum corrompido de propósito é rejeitada (prova que o
   teste não passaria por acidente mesmo que o parser fosse permissivo demais).

O que isso **não** cobre: o plugin nativo Java/Kotlin/Swift em si (a ponte Capacitor de
verdade) — só dá pra rodar isso num device/emulador com Android SDK/Xcode. Ver
[status detalhado](#o-que-está-verificado-e-o-que-não-está).

### Porta e modo padrão do gateway (pesquisa)

A IANA registrou `10110/tcp` e `10110/udp` para o serviço `nmea-0183`
([lista oficial](https://www.iana.org/assignments/service-names-port-numbers)) — é a porta
default usada por `PORTA_PADRAO_NMEA` (`web/lib/nmea/nmea-socket-plugin.ts`) e pelos dois
workers nativos. Na prática, gateways WiFi NMEA 0183 recreativos (Yacht Devices, Digital
Yacht, Actisense, Vesper) costumam falar **UDP broadcast** nessa porta por padrão — o app só
precisa escutar, sem saber o IP do gateway — com TCP como alternativa ponto-a-ponto em alguns
modelos. Alguns fabricantes usam portas próprias (2000, 39150, 60001) — por isso a porta nunca
fica hardcoded fora do default, `conectar()` sempre aceita sobrescrever.

## GPS em segundo plano

**Status: preparado, não implementado de verdade nesta onda — dizendo isso claramente em vez
de entregar meia-boca silenciosa.**

O que existe: `@capacitor/geolocation` (plugin oficial) integrado em
`web/lib/nmea/nativo-capacitor.ts` via `watchPosition`, usado pra carimbar cada leitura de
profundidade com posição/velocidade — funciona em **primeiro plano** (app aberto, tela
acesa). Permissões `ACCESS_COARSE_LOCATION`/`ACCESS_FINE_LOCATION` (Android) e
`NSLocationWhenInUseUsageDescription` (iOS) já declaradas.

O que falta pro alarme de âncora e a trilha funcionarem com a **tela apagada** (hoje o PWA
perde a posição nesse cenário — é o motivo de existir este item):

1. `@capacitor/geolocation` **não** entrega atualizações em segundo plano — o próprio plugin
   para de reportar quando o app é suspenso pelo SO. Precisa de um plugin dedicado. Duas
   opções pesquisadas nesta onda:
   - [`@capacitor-community/background-geolocation`](https://github.com/capacitor-community/background-geolocation)
   - [`@capgo/background-geolocation`](https://github.com/Cap-go/capacitor-background-geolocation)
2. **Android:** exige permissão `ACCESS_BACKGROUND_LOCATION` (prompt separado do "durante o
   uso", Android 10+) e um **foreground service com notificação persistente** (Android 8+
   limita trabalho em segundo plano sem isso — a notificação avisa o usuário que o app está
   rastreando posição, requisito de UX/privacidade da própria plataforma, não escolha do
   Commander). As entradas de manifest já ficaram **preparadas e comentadas** em
   `android/app/src/main/AndroidManifest.xml` (procure "GPS em SEGUNDO PLANO").
3. **iOS:** exige `NSLocationAlwaysAndWhenInUseUsageDescription` (permissão "Sempre", não só
   "Ao usar") + `UIBackgroundModes` com `location` no `Info.plist`, e o app precisa lidar com
   o usuário podendo negar "Sempre" e só aceitar "Ao usar" (fallback obrigatório da própria
   Apple).
4. Cada opção acima aumenta o escrutínio de review da loja (rastreamento de posição em
   segundo plano é um dos itens mais escrutinados tanto por Apple quanto Google) — vale casar
   essa integração com a explicação clara, na ficha da loja, de por que o Commander precisa
   disso (alarme de âncora / trilha de navegação).

**Próximo passo concreto** (fora do escopo desta onda): escolher um dos dois plugins acima,
integrar como uma segunda implementação dentro de `nativo-capacitor.ts` (ou um módulo
separado, ex. `web/lib/gps/segundo-plano.ts`) ativada só quando o alarme de âncora ou o
registro de trilha estiver ativo — não precisa rodar o tempo todo, só durante uma saída.

## Ícones e splash screen

`npx cap add` gerou os ícones/splash **placeholder padrão do Capacitor** (não a marca do
Commander) em `android/app/src/main/res/mipmap-*` e `ios/App/App/Assets.xcassets/`. Existe uma
fonte de ícone real do app em `public/icone-512.png` (gerado por `web/scripts/gerar-icones.ps1`)
— antes de submeter pra qualquer loja, gerar os ícones nativos de verdade a partir dela (o
pacote oficial `@capacitor/assets` faz isso automaticamente a partir de um PNG fonte). Não
feito nesta onda — fora do escopo (o pedido era o socket NMEA), mas bloqueia submissão de loja
se ficar esquecido.

## Variáveis de ambiente

Documentadas com comentário em `web/.env.example`, seção "App nativo (Capacitor, onda 14)":

| Variável | Obrigatória | O que faz |
|---|---|---|
| `CAPACITOR_SERVER_URL` | Não | URL que o WebView carrega. Dev: IP da LAN. Ausente: cai pra `NEXT_PUBLIC_APP_URL`, depois pro domínio de produção fixo. |
| `CAPACITOR_ALLOW_NAVIGATION` | Não | Hosts extras (separados por vírgula) que o WebView pode navegar sem sair pro navegador do sistema, além do host de `CAPACITOR_SERVER_URL`. |

Nenhuma tem prefixo `NEXT_PUBLIC_` de propósito — `capacitor.config.ts` roda num processo Node
separado (a CLI do Capacitor), nunca dentro do bundle web, então não passa (nem precisa
passar) pelo pipeline de inline de env do Next.

## O que está verificado e o que não está

**Verificado nesta máquina (roda de verdade):**
- `npx tsc --noEmit` — projeto inteiro, incluindo os arquivos novos.
- `npx eslint app components lib` — limpo.
- `npm test` — 261 testes (258 anteriores + 3 novos em `simulador-nmea.test.ts`), todos verdes.
- `npm run build` — build de produção do Next completo, sem regressão.
- `npx cap add android` / `npx cap add ios` — geraram os projetos nativos de verdade (não são
  templates escritos à mão).
- `npx cap sync` — roda limpo, resolve `server.url`/`cleartext`/`allowNavigation` corretamente
  a partir de `CAPACITOR_SERVER_URL`/`NEXT_PUBLIC_APP_URL` (testado manualmente com os dois
  casos: LAN em HTTP e produção em HTTPS).
- `scripts/simular-nmea.mjs` — roda de verdade, gera sentenças NMEA com checksum correto, por
  TCP e por UDP, testado ponta a ponta em `web/lib/nmea/simulador-nmea.test.ts`.
- `parseSentencaProfundidade`/`validarChecksum` (`web/lib/domain/sondagem.ts`, não modificado
  nesta onda) contra dados reais de socket (não só strings montadas em memória) — via o teste
  acima.

**Escrito com cuidado, NÃO compilado nem rodado (sem Android SDK/Gradle/Xcode nesta máquina):**
- `android/app/src/main/java/br/com/soumardivers/commander/nmea/NmeaSocketPlugin.java`
- `android/app/src/main/java/br/com/soumardivers/commander/nmea/NmeaSocketWorker.java`
- `android/app/src/main/java/br/com/soumardivers/commander/MainActivity.java` (registro do
  plugin — só a linha `registerPlugin`, o resto é template do Capacitor)
- `ios/App/App/NmeaSocket/NmeaSocketPlugin.swift`
- `ios/App/App/NmeaSocket/NmeaSocketWorker.swift`
- Qualquer build Gradle (`android/gradlew assembleDebug` etc.) ou build Xcode
  (`xcodebuild`/rodar no simulador) — nunca executados.
- A ponte JS↔nativo do plugin `NmeaSocket` de ponta a ponta (JS chamando o método nativo de
  verdade, evento voltando pelo `notifyListeners` de verdade) — só revisada por leitura contra
  a API documentada/lida do código-fonte do `@capacitor/android`/`@capacitor/ios` instalado em
  `node_modules` (não inventada de memória), nunca executada.
- O passo manual do Xcode ("Add Files to App...", ver acima) — nem pôde ser testado se o
  arquivo `.xcodeproj` aceita o import do jeito esperado.
- GPS em segundo plano — ver [seção própria](#gps-em-segundo-plano): deliberadamente só
  preparado, não implementado.
- Ícones/splash de marca — placeholder do Capacitor, não trocado.

Antes de qualquer submissão de loja: rodar `android/gradlew assembleDebug` (ou abrir no Android
Studio) e compilar no Xcode pelo menos uma vez cada, testar contra o simulador rodando na
mesma rede do device, e — o mais importante — testar contra um ecobatímetro/gateway de verdade
pelo menos uma vez antes de confiar na leitura de profundidade em produção.
