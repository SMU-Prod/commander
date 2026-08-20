# Signal K — análise e estratégia de integração (20/08/2026)

Pedido do dono: entender a org, a comunidade e como usar o Signal K para
implementar, utilizar e **ter acesso aos dados das embarcações dos nossos
usuários**. Fontes lidas hoje: signalk.org, o repositório do servidor, a doc
oficial de plugins e o anúncio do Signal K MCP Server (links no fim).

---

## 1. O que é, em três camadas

1. **Padrão de dados aberto** — um modelo universal de dados de barco
   (paths como `navigation.position`, `propulsion.*.revolutions`,
   `environment.depth.belowKeel`), em JSON sobre tecnologias web (REST +
   WebSocket), unidades SI, timestamps UTC.
2. **Servidor local (hub)** — aplicação Node.js que roda NUM aparelho a
   bordo (Raspberry Pi, Docker, Windows) e **vem pré-instalada em hardware
   comercial: Victron Cerbo GX, Hat Labs HALPI2, Airmar SmartBoat**. Ele
   decodifica NMEA 0183 e NMEA 2000 e serve tudo pelas APIs.
3. **Ecossistema** — centenas de plugins e webapps distribuídos via npm com
   uma **App Store dentro do próprio servidor**.

## 2. Saúde do projeto e licença (o que importa pra decidir construir em cima)

- **Licença Apache 2.0** no servidor → uso comercial livre, sem pegadinha.
- **Projeto vivo**: release 2.31.1 publicada esta semana; 426 stars / 204
  forks; comunidade em Discord + GitHub Discussions; financiamento por
  doações via Open Collective (dá pra virar patrocinador — selo bom de
  marketing técnico: "Commander apoia o Signal K").
- Governança informal ("The Signal K Project"), sem empresa dona — risco de
  captura comercial baixo; risco de ritmo voluntário existe, mitigado pela
  adoção por fabricantes (Victron embarcar é o sinal forte).

## 3. Como já nos conectamos hoje (nada a construir)

Nosso `web/lib/nmea/signalk.ts` já fala WebSocket com o servidor (reconexão
com backoff, mDNS `signalk.local`, `belowKeel` com fallback). O que a
auditoria já apontou como tarde de trabalho: **token de autenticação** — o
servidor tem login/permissões, e nosso transporte ainda conecta só em
servidor aberto.

## 4. A JOGADA — plugin "Commander Connector" (é assim que se tem acesso aos dados)

A doc oficial de plugins mostra o caminho exato, e ele é curto:

- Um plugin é um pacote **npm** com keyword `signalk-node-server-plugin`,
  exportando `start(settings)/stop()/schema()`. Aparece **na App Store de
  todo servidor Signal K do mundo** ao ser publicado no npm — distribuição
  de graça, sem loja nossa, sem aprovação de ninguém.
- O nosso plugin: `signalk-commander-connector`. Na configuração (a tela o
  próprio Signal K gera a partir do `schema()`), o usuário cola um **token
  da conta Commander** (gerado em /menu/ajustes) e escolhe O QUE compartilha
  (posição, motor, profundidade, elétrica — opt-in por categoria, consent
  igual ao da sondagem que já temos).
- O plugin assina os paths escolhidos no `streambundle` e faz **upstream
  resiliente pro nosso backend** (lotes + backoff + fila local — a mesma
  lógica da nossa `lib/nmea/fila.ts`, agora do lado do barco). Precedente
  público de que o padrão funciona: o plugin `signalk-cloud` (sbender9) faz
  exatamente isso pra um servidor genérico.
- Com isso o Commander ganha, sem hardware nosso instalado: **horímetro
  automático** (PGN de motor → `lib/acoes/horimetro.ts`), posição/trilha
  mesmo com o celular do dono em casa (monitoramento remoto de verdade),
  profundidade alimentando a sondagem colaborativa, e alarmes do barco
  virando push do Commander.

## 5. O MCP Server (o anúncio que você mandou) — o que significa pra nós

O `signalk-mcp-server` (Tony Bentley, open-source) conecta assistentes de IA
ao servidor do barco, **somente leitura**: estado do barco, alvos AIS,
alarmes, descoberta de paths, histórico via InfluxDB.

Leitura estratégica:
1. **Valida a tese "IA + dados do barco"** — a própria org está empurrando.
2. Curto prazo: um usuário avançado já pode plugar o Claude no barco dele
   hoje — bom material de conteúdo/comunidade.
3. Para o produto: o assistente do Commander **não deve depender** do MCP
   deles (exige servidor acessível pelo cliente de IA). O caminho certo é o
   nosso: dados sobem pelo Connector → nosso backend → o assistente do
   Commander responde "como está meu barco?" de qualquer lugar, com
   histórico, no nosso app. O MCP deles é inspiração de ferramenta
   (`get_vessel_state`, `get_active_alarms`), não dependência.

## 6. Como isso conversa com o Gateway Commander (docs/hardware/)

São **complementares, dois caminhos pro mesmo destino**:

| Barco | Caminho | Custo pro cliente |
|---|---|---|
| Já tem Signal K (Cerbo GX, Pi a bordo) | instala o plugin Commander na App Store | R$ 0 |
| Só tem a rede N2K | nosso Gateway Commander (TCP 10110 → app) | o kit |
| Gateway + quer nuvem | o gateway também pode falar COM um Signal K local, ou ganhar upstream próprio na v2 | — |

O plugin é o atalho de mercado: chega ANTES do hardware, custa zero de
logística e já prova a demanda de monitoramento remoto.

## 7. Plano de implementação proposto

- **F1 (uma tarde)** — token de auth no `signalk.ts` + tela de diagnóstico
  de conexão (itens da auditoria).
- **F2 (1-2 semanas)** — `signalk-commander-connector` v1: repo próprio no
  monorepo (`connector/`), TypeScript, token por conta, opt-in por
  categoria, upstream em lote pra rota nova autenticada no app
  (`/api/connect/ingest`, Bearer por token de dispositivo), fila local.
  Publicar no npm → aparece na App Store de todo Signal K.
- **F3** — telemetria ao vivo na tela (/navegar e hub Motores "ao vivo") +
  horímetro automático + alarme do barco virando push.
- **F4** — assistente Commander sobre o histórico (a resposta nossa ao MCP).

## Fontes

- Anúncio MCP: https://signalk.org/2025/introducing-signalk-mcp-server-ai-powered-marine-data-access/
- Servidor: https://github.com/SignalK/signalk-server (Apache 2.0)
- Doc de plugins: https://github.com/SignalK/signalk-server/blob/master/docs/develop/plugins/README.md
- Site/spec: https://signalk.org/ · https://signalk.org/specification/latest/
- Precedente de cloud sync: https://github.com/sbender9/signalk-cloud
- MCP server: https://github.com/tonybentley/signalk-mcp-server
