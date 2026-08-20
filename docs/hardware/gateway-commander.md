# Gateway Commander — dossiê de engenharia (v1, 20/08/2026)

Decisão do dono: *"esse aparelho [YDWG-02] nós vamos fazer o nosso e criar o
dispositivo — no Brasil ele não vende e lá fora é 187 dólares"*. Este dossiê
é o caminho completo: o que é, por que é viável, esquema de referência, lista
de peças com custo estimado, firmware, o que a lei exige pra VENDER, e o
roadmap de protótipo a produto.

**A tese em uma frase:** o YDWG-02 é um microcontrolador com rádio Wi-Fi +
um transceptor CAN + firmware. As três peças existem abertas e baratas — o
valor que a Yacht Devices cobra está no firmware e na caixa, e nós já temos
metade do firmware DO OUTRO LADO (o app fala TCP 10110, NMEA 0183, N2K e
Signal K hoje).

---

## 1. O que o aparelho faz

Um barco de 40-60 pés tem uma rede **NMEA 2000** (barramento CAN a 250 kbps,
cabo tronco com conectores M12) onde motor, GPS, ecobatímetro, biruta e
quadro elétrico publicam dados. **SeaTalk NG (Raymarine) É NMEA 2000 com
plug proprietário** — muda o conector, não o protocolo. O gateway:

1. escuta o barramento (só leitura na v1 — ver §7);
2. converte os quadros N2K em algo que um celular entende;
3. serve isso por Wi-Fi — **TCP porta 10110**, que é exatamente a porta que
   o nosso plugin nativo (`web/lib/nmea/nmea-socket-plugin.ts`) já escuta.

Do lado do app, **os parsers já existem e são testados**: `n2k-motor.ts`
(RPM, temperatura, horas), `n2k-quadro.ts` (elétrica), `sondagem.ts`
(profundidade NMEA 0183 com checksum), transporte Signal K com reconexão.
O gateway fecha o único elo que falta da rede do barco até a tela.

## 2. Arquitetura de referência

```
[Rede N2K 12V] ──M12──> [Proteção] ──> [Buck 12→5V] ──> [ESP32]
                            │                              │
                            └──CAN-H/CAN-L──> [SN65HVD230]─┘ (TWAI)
                                                           │
                                              Wi-Fi ──> app Commander
```

- **MCU: ESP32** (módulo WROOM-32E). Tem controlador CAN nativo (TWAI),
  Wi-Fi integrado, e — decisivo pra vender no Brasil — a Espressif mantém
  módulos **com homologação ANATEL** (conferir o número do certificado do
  lote na compra; ver §6).
- **Transceptor CAN: SN65HVD230** (3,3 V, o par do ESP32). O ESP32 fala o
  protocolo CAN; este chip de ~R$ 15 fala a camada elétrica do barramento.
- **Alimentação: o próprio barramento N2K fornece 12 V** (pinos NET-S/NET-C)
  — o aparelho não tem fonte própria, igual ao YDWG. Conversor buck 12→5 V
  (módulo MP1584) + proteções de ambiente embarcado: diodo de polaridade
  reversa, TVS contra transiente de alternador, fusível resetável.
- **Conector: M12 5 pinos macho** (padrão Micro-C/DeviceNet — é o plug
  NMEA 2000). Para SeaTalk NG, cabo adaptador STng→DeviceNet da própria
  Raymarine (conferir código atual do cabo; existe de fábrica porque STng é
  N2K), igual ao que o YDWG exige.
- **Caixa:** ABS IP65 pequena com prensa-cabo; nas unidades de venda,
  envernizamento conformal da placa (umidade salina).

## 3. Lista de peças e custo (estimativas BR a validar em cotação)

| Peça | Protótipo (varejo BR) |
|---|---|
| ESP32 DevKit (WROOM-32E) | ~R$ 35-50 |
| Módulo SN65HVD230 | ~R$ 12-20 |
| Buck MP1584 12→5 V | ~R$ 8-15 |
| Conector M12 5p macho de painel | ~R$ 25-60 |
| Caixa IP65 + prensa-cabo | ~R$ 20-35 |
| TVS + polyfuse + diodo + miudezas | ~R$ 10 |
| **Total protótipo** | **~R$ 110-190** |

Contra **US$ 187 + importação** do YDWG-02. Em pequena série (lote 100, PCB
própria com WROOM soldado, fabricada fora e montada aqui), o custo unitário
estimado cai pra **R$ 60-90** — margem confortável para vender um
**"Kit Commander Connect"** a R$ 400-600 com instalação simples (plugar no
tronco da rede, que já é plug-and-play por padrão N2K).

## 4. Firmware

Base open-source madura (a mesma que a comunidade Signal K/OpenPlotter usa
em produção há anos):

- **Stack N2K:** bibliotecas `NMEA2000` + `NMEA2000_esp32` de Timo
  Lappalainen (licença MIT — uso comercial livre, manter o aviso de
  copyright). Cuidam de address claiming, fast-packet, decodificação de PGN.
- **Saídas (as três, selecionáveis na página de config):**
  1. **RAW TCP 10110** — quadro N2K bruto por Wi-Fi. Casa direto com nosso
     plugin nativo e os parsers `n2k-*.ts` do app.
  2. **Conversão N2K→NMEA 0183** (biblioteca `NMEA0183` do mesmo autor):
     PGN 128267→DPT (profundidade), 129029/129025→sentenças de posição,
     130306→MWV (vento), motor via XDR. Compatibilidade com qualquer app
     náutico do mercado — argumento de venda.
  3. **Formato para Signal K Server** (barcos com Raspberry a bordo) — nosso
     transporte `signalk.ts` já consome.
- **Configuração:** primeiro boot abre AP próprio "Commander-Gateway" com
  página web mínima (rede do barco, senha, modo de saída). Depois vira
  cliente da rede escolhida.
- **OTA:** atualização de firmware por Wi-Fi desde a v1 — aparelho vendido
  sem OTA é chumbo.
- **O diferencial que só nós podemos fazer:** o gateway anuncia
  **mDNS `_commander._tcp`** — o app DESCOBRE o aparelho sozinho, zero
  configuração. Abrir o app a bordo e o motor já estar na tela é a demo que
  vende o kit na marina.

## 5. Bancada de desenvolvimento (sem barco)

Já temos os simuladores (`npm run simular-nmea`, `simular-n2k`). Para a
bancada física: **um segundo ESP32+SN65HVD230 emissor**, rodando a mesma
stack no sentido contrário, publica PGNs de motor falsos no fio — rede N2K
de mesa por ~R$ 60. Critério de pronto da bancada: RPM falso aparecendo no
app via Wi-Fi de ponta a ponta.

Recomendação paralela (não é contradição): **importar UM YDWG-02 como
referência de bancada** ainda vale — é o padrão-ouro pra comparar
comportamento (address claiming, carga de barramento) antes de plugar o
nosso num barco de cliente.

## 6. O que a lei exige pra VENDER (não para protótipo)

- **ANATEL** — produto com rádio Wi-Fi comercializado no Brasil precisa de
  homologação. Usar módulo ESP32 já certificado pela Espressif simplifica o
  processo (aproveitamento de ensaios de RF), mas o PRODUTO FINAL ainda passa
  por OCD: estimar **R$ 5-15 mil + semanas**. Protótipo e teste em barco
  próprio: livre.
- **Marca "NMEA 2000®"** — é marca registrada da NMEA; usar o LOGO exige
  certificação paga (milhares de dólares + anuidade). O caminho de metade do
  mercado: vender como **"compatível com redes NMEA 2000"**, sem logo. Idem
  **"SeaTalk NG"** (marca Raymarine): "compatível via cabo adaptador".
- **Responsabilidade** — v1 **somente leitura** (TX desabilitado no
  firmware): o aparelho não comanda nada no barco, o que reduz o risco
  jurídico e técnico a quase zero. Piloto automático e comandos ficam
  explicitamente fora até decisão em contrário.

## 7. Roadmap

| Fase | Entrega | Custo | Prazo |
|---|---|---|---|
| **S1 — bancada** | Protótipo em protoboard + emissor de teste; RPM falso no app de ponta a ponta | ~R$ 250 em peças | 1-2 semanas de bancada |
| **S2 — barco real** | Instalar no tronco N2K de um barco no Rio; homologar parsers com dado de verdade (a "manhã na marina" da auditoria, agora com hardware nosso) | R$ 0 além do S1 | 1 dia a bordo |
| **S3 — piloto** | PCB v1 + caixa + 10 unidades para clientes fundadores; OTA funcionando | ~R$ 1,5-2,5 mil o lote | 3-4 semanas |
| **S4 — produto** | Homologação ANATEL + série 100 + "Kit Commander Connect" à venda no app | R$ 10-20 mil | 2-3 meses |

**Primeiro passo concreto (pode ser hoje):** comprar 2× ESP32 DevKit, 2×
SN65HVD230, 1× buck MP1584 (Eletrogate/RoboCore/ML — chega em dias) e eu
escrevo o firmware da bancada na sequência: o repositório do firmware nasce
como `gateway/` neste monorepo, com CI própria.

## Riscos honestos

Ambiente marinho come eletrônica desprotegida (potting/verniz obrigatórios
na venda); suporte de campo de hardware é um negócio diferente de software;
ANATEL tem custo e prazo reais; e o firmware de barramento tem uma classe de
bug (carga/colisão no CAN) que só aparece com rede cheia — por isso a
bancada com emissor e a referência YDWG antes de barco de cliente.
