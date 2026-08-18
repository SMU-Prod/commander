# Mapa da Embarcação — o barco em corte

Spec de design · 16/08/2026 · Onda 61

**Origem:** o dono, mandando as telas do Haulix: *"esse detalhe da página do
caminhão 3d com os detalhes é o que queremos para parte de manutenção, poder
mapear tudo"*. Imagens 4 e 5 do catálogo
[`docs/DESIGN-SYSTEM.md`](../../DESIGN-SYSTEM.md): o caminhão em corte com a
carga fixada no lugar físico, item selecionado com contorno dourado, painel
lateral sincronizado, orientação escrita (Front ↔ Rear).

**A tradução náutica:** o barco de 40–60 pés em **corte lateral**, com cada
equipamento fixado na **zona física** onde mora, o estado (farol) pintado no
pino, e o painel ao lado abrindo o que a zona tem — equipamentos, manutenções
vencendo, ocorrências abertas.

---

## 1. Por que é um subsistema (e não uma tela)

Tudo que o app tem hoje organiza o barco por **categoria** (elétrica,
hidráulica, motores — as 13 áreas da matriz). O dono pediu outra pergunta:
**"ONDE fica?"**. Um gerador é elétrica *e* mora na praça de máquinas; a
bomba de porão é hidráulica *e* mora no casco. A categoria diz quem pode ver;
a **zona** diz onde procurar com a lanterna na mão. São eixos ortogonais — por
isso é dado novo, não re-arranjo de tela.

## 2. O dado novo

### 2.1 As zonas — sete, fixas

| Zona | O que mora lá (típico) |
|---|---|
| `proa` | guincho, âncora, corrente, propulsor de proa |
| `conves` | guarda-corpo, cunhos, escotilhas, balsa |
| `casaria` | salão, cabines, ar-condicionado, painel elétrico interno |
| `flybridge` | comando superior, eletrônica, toldo |
| `praca_de_maquinas` | motores, gerador, baterias, bombas, filtros |
| `popa` | plataforma, escada, flaps, ducha |
| `casco` | obras vivas, hélices, eixos, leme, anodos, passa-cascos |

Sete cobre o barco-alvo sem virar formulário de estaleiro. Enum no banco
(`zona_embarcacao`), coluna **nullable** em `equipamentos`:

```sql
alter table equipamentos add column zona zona_embarcacao;
```

Nullable de propósito: os equipamentos existentes não têm zona e **não se
inventa dado** — eles aparecem no mapa como "**Não mapeados**", um grupo que
convida a classificar (um select, um toque). Migration + RLS: a coluna herda
a RLS da tabela; nada novo a policiar.

### 2.2 De onde vem o estado da zona
Nada novo se calcula: o farol de cada equipamento já existe
(`calcularSemaforo` sobre os itens monitorados dele) e as ocorrências já têm
setor. **A zona pinta o PIOR estado do que mora nela** — mesma régua de
"pior vence" que a Saúde usa. Função pura `estadoDaZona(equipamentos, itens,
ocorrencias)` em `lib/domain/mapa-embarcacao.ts`, com teste.

## 3. A tela — `/barco/mapa`

**Natureza:** ficha (spec de arquitetura §2.3) — "conta tudo sobre este",
sendo "este" o barco físico.

### 3.1 O desenho
**Corte lateral em SVG próprio** — motor yacht genérica de flybridge, traço
fino sobre o fundo escuro (o desenho é chrome, os PINOS são o dado — regra
Navionics, DESIGN.md §2). Sete regiões clicáveis; rótulo de orientação
escrito nas pontas: **PROA ←  → POPA** (a lição do "Front (Cab) ↔ Rear
(Doors)" da imagem 5).

**O 3D É O DESTINO — decidido pelo dono em 16/08** (*"o 3d dos barcos temos
que ter... um modelo padrão de 3d mas baseado na escolha do barco"*). O
desenho segue a estratégia do próprio Haulix: **um modelo genérico por TIPO
de barco** (flybridge · open/express · trawler; veleiro depois), nunca o 3D
de cada casco — o dono escolhe o tipo, os DADOS (pinos, estados) são do
barco dele. Onda 62: viewer three.js/react-three-fiber, zonas ancoradas no
modelo, mesmo estado-na-URL e mesmo painel desta onda. **Bloqueio externo:**
o asset — modelo low-poly royalty-free (compra ~US$20–80, decisão e
pagamento do dono; shortlist com licença conferida é nossa) ou CC-BY com
atribuição (CC-NC é veneno comercial, descartado na triagem).

**O corte SVG desta onda é o palco versão 1**, não um desvio: a camada de
dado (zona), o estado por zona e o painel são IDÊNTICOS nos dois palcos —
na 62, troca-se o SVG pelo canvas e nada mais. Ele vive em
`components/mapa-embarcacao/casco.tsx`, sem asset externo.

### 3.2 O pino
Um por zona **com equipamento**: círculo com a contagem
(`font-mono-instr`) e a cor do pior estado — verde/âmbar/vermelho, **cinza
quando não há dado** (nunca verde por omissão — a régua do `seloDoFarol`).
Zona selecionada ganha **contorno dourado** (o uso de seleção da imagem 5;
é o dourado de conteúdo da tela, único).

### 3.3 O painel
- **Desktop (≥lg):** painel à direita do desenho (o "Packages" da imagem 2):
  título da zona + selo do estado; lista de equipamentos (`LinhaLista`, farol
  + nome + próximo vencimento) linkando pra ficha de cada um; embaixo,
  ocorrências abertas do setor correspondente.
- **Celular:** o desenho em cima, o painel embaixo (mesma página, sem
  modal); tocar num pino rola até o painel.
- **Estado na URL** (`?zona=praca_de_maquinas`) — RSC, sem useState de
  seleção; voltar do navegador funciona; link compartilhável.
- **"Não mapeados"**: grupo no fim do painel com os equipamentos sem zona e
  a ação "Definir zona" (leva à edição do equipamento, que ganha o select).

### 3.4 Como se chega
- `/barco` (hub) ganha o cartão **"Mapa da embarcação"** com o resumo
  (ex.: "2 zonas pedem atenção");
- Menu → seção "O barco";
- a ficha de equipamento mostra a zona como chip (linka pro mapa filtrado).

## 4. O que muda fora da tela nova

| Onde | O quê |
|---|---|
| `equipamentos` (banco) | coluna `zona` (enum, nullable) |
| Form de equipamento (novo/editar) | select "Onde fica no barco" com as 7 zonas + "ainda não sei" |
| `lib/db/types.ts` | `zona` no tipo `Equipamento` |
| Varredura | `/barco/mapa` nas rotas |

**Fora, de propósito:** arrastar-e-soltar pinos (classificação é por select,
V1); zonas customizadas por barco (7 fixas até doer); foto/planta real do
barco do dono como fundo (evolução óbvia — o SVG genérico é o dia 1);
manutenção "por zona" como entidade (a zona é VISÃO, itens continuam morando
em equipamentos).

## 5. Como se verifica

- `estadoDaZona` com teste de domínio (pior vence; sem dado = cinza; zona
  vazia não gera pino).
- Varredura nas duas larguras cobre a rota nova (alvos ≥44px nos pinos,
  sem estouro).
- Prova visual obrigatória: PNGs 390/1440 com barco semeado em 3 estados
  (tudo em dia · uma zona crítica · tudo sem mapear), olhados antes de
  reportar.
- O que máquina não mede: se o corte "parece o barco" — julgamento do dono
  com o print na mão.

## 6. Riscos assumidos

**O SVG genérico não é o barco do dono.** Um Azimut 55 e um Fishing 46 têm
silhuetas diferentes; o corte é esquemático de propósito (como o caminhão do
Haulix, que também é genérico). Se o dono estranhar, a evolução é silhueta
por tipo de barco — o dado (zona) não muda.

**Equipamentos nascem todos "não mapeados".** O mapa do dia 1 é um convite,
não um dashboard — igual à foto de capa. A alternativa (chutar zona por
tipo: motor → praça de máquinas) é tentadora e PARCIALMENTE segura; fica
como sugestão pré-preenchida no select, nunca gravada sem confirmação.
