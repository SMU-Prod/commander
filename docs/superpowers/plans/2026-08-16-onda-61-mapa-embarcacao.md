# Onda 61 — Mapa da Embarcação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Tarefa a tarefa, revisão entre elas.

**Goal:** o barco em corte por zonas — spec
`docs/superpowers/specs/2026-08-16-mapa-embarcacao-design.md` (imagens 4/5 do
catálogo). Última onda do ciclo de design.

**Architecture:** coluna `zona` (enum, nullable) em `equipamentos`; domínio
puro `lib/domain/mapa-embarcacao.ts`; SVG próprio em
`components/mapa-embarcacao/`; tela RSC `/barco/mapa` com seleção na URL.

## Global Constraints

- As de sempre (escala 11+, base 8, raio/cor por token com catraca por
  arquivo, mono+tabular, ≥44px, cor E palavra, safe-area, português,
  tsc+test+lint por tarefa, build na última).
- Dourado de conteúdo da tela do mapa: **1** — o contorno da zona
  selecionada. Pino cinza sem dado; NUNCA verde por omissão.
- **Banco é produção** (projeto khgjtxvmduizyooqaoox): migration ADITIVA
  apenas (enum + coluna nullable), aplicada via MCP e versionada em
  `supabase/migrations/`. Nada de update em massa, nada de default.
- Prova visual por tarefa de tela: PNGs 390 + 1440 olhados antes do
  relatório.

## Fatos do código

- `Equipamento` (`lib/db/types.ts:52`): `tipo: "motor"|"gerador"|"bateria"|"painel"|"outro"`, `posicao`, sem zona.
- `abaDoEquipamento` (`lib/domain/diario.ts:50`) mapeia tipo→área; espelha `aba_do_equipamento` no banco.
- Farol por equipamento: `calcularSemaforo` sobre os itens dele (padrão da ficha).
- Ocorrências têm `setor` (as 13 áreas), estados aberta/em_acompanhamento/resolvida.
- Padrões prontos: `Selo`, `LinhaLista`, `Cartao`, `Abas`, seleção-na-URL (Avisos), captura visual via spec temporário + global-setup.
- Deriva banco×arquivos: correções remotas já divergem dos .sql — a migration nova É nova (numere após a última local E confira `list_migrations` remoto antes).

---

## Tarefa 1 — O dado: enum, coluna, tipos, rótulos

**Files:** Create `supabase/migrations/<N>_zona_embarcacao.sql` · Modify `web/lib/db/types.ts` · Create `web/lib/domain/mapa-embarcacao.ts` (constantes) + teste

- [ ] Conferir a numeração real (`ls supabase/migrations/` + `list_migrations` via MCP do Supabase — use o conector, projeto khgjtxvmduizyooqaoox).
- [ ] Migration: `create type zona_embarcacao as enum ('proa','conves','casaria','flybridge','praca_de_maquinas','popa','casco');` + `alter table equipamentos add column zona zona_embarcacao;` — **aplicar via MCP `apply_migration`** e gravar o arquivo com o MESMO conteúdo. Nada mais (RLS herda).
- [ ] `types.ts`: `zona: ZonaEmbarcacao | null` no `Equipamento`.
- [ ] `mapa-embarcacao.ts`: `ZONAS` (as 7, na ordem proa→popa+casco), `ROTULO_ZONA` (palavras do spec §2.1), `sugestaoDeZona(tipo)` (motor/gerador/bateria→`praca_de_maquinas`; painel→`casaria`; outro→null) com teste — é SUGESTÃO de select, nunca gravada sem o save do formulário.
- [ ] Commit: `feat(mapa-embarcacao): a zona fisica nasce no banco e no dominio`.

## Tarefa 2 — `estadoDaZona` + o select no formulário

**Files:** Modify `web/lib/domain/mapa-embarcacao.ts` (+teste) · form de equipamento (novo/editar) · `lib/acoes/equipamentos.ts`

- [ ] TDD `estadoDaZona(equipamentosDaZona, itensPorEquipamento, ocorrenciasDoSetor)` → `"ok"|"atencao"|"critico"|null`: pior vence (mesma régua da Saúde); `null` = zona com equipamento mas sem NENHUM dado (pino cinza); ocorrência aberta/em_acompanhamento pesa pelo mapa gravidade→estado já usado na Saúde — **reuse as funções de `saude.ts`/`semaforo.ts`, não segunda fórmula**.
- [ ] Form novo/editar: select "Onde fica no barco" com as 7 + "Ainda não sei" (null), pré-preenchido por `sugestaoDeZona` SÓ no criar. Action grava. Zero mudança nas validações existentes.
- [ ] Commit: `feat(mapa-embarcacao): estado da zona e o select de onde-fica`.

## Tarefa 3 — O corte SVG com pinos

**Files:** Create `web/components/mapa-embarcacao/casco.tsx` + teste

- [ ] SVG próprio (motor yacht flybridge, corte lateral, traço `--linha`, sem
  cor literal — tokens via `currentColor`/classes). Sete regiões; pino =
  `<Link href="?zona=X">` círculo ≥44px de alvo com contagem mono e cor do
  estado (`--ok`/`--warn`/`--crit`/cinza), rótulo da zona em ≤11px+ apenas
  no pino? NÃO — rótulo aparece no painel; o pino leva contagem e
  `aria-label` completo ("Praça de máquinas, 4 equipamentos, atenção").
- [ ] Zona selecionada: contorno `--acao` (o dourado da tela). PROA ← → POPA
  escritos nas pontas.
- [ ] Teste (`renderToStaticMarkup`): pino só em zona com equipamento;
  aria-label com palavra de estado; selecionada tem a classe do contorno;
  zero pino verde quando estado é null.
- [ ] Commit: `feat(mapa-embarcacao): o corte do barco, pinos com estado`.

## Tarefa 4 — A tela `/barco/mapa` + entradas

**Files:** Create `web/app/(app)/barco/mapa/page.tsx` · Modify `/barco` hub (cartão), `menu/page.tsx` (linha em "O barco"), ficha de equipamento (chip da zona)

- [ ] RSC: consulta equipamentos+itens+ocorrências da embarcação (reuse as
  consultas da Saúde se servirem), agrupa por zona, `?zona=` seleciona
  (inválido = nenhuma). Desktop: desenho à esquerda, painel à direita
  (grade); celular: desenho em cima, painel embaixo, pino rola até ele
  (anchor `#painel-zona`).
- [ ] Painel: título+`Selo` do estado; `LinhaLista` por equipamento (farol +
  próximo vencimento via `textoRestante`) → ficha; ocorrências abertas do
  setor; grupo "Não mapeados" no fim com ação "Definir zona" (→ editar).
- [ ] Entradas: cartão no `/barco` ("X zonas pedem atenção" ou convite),
  linha no Menu, chip da zona na ficha de equipamento (→ `/barco/mapa?zona=`).
- [ ] Prova visual nos 3 estados do spec §5 (semear: tudo em dia / uma zona
  crítica / tudo sem mapear), 390+1440, PNGs olhados.
- [ ] Commit: `feat(mapa-embarcacao): a tela — o barco em corte com painel sincronizado`.

## Tarefa 5 — Verificação

- [ ] `/barco/mapa` nas ROTAS da varredura; rodar 390+1440 + sem-saida +
  build; alvos dos pinos ≥44px confirmados pela régua.
- [ ] Catálogo: imagens 4/5 → ✅ com nota (corte SVG; 3D é evolução; silhueta
  por tipo de barco é evolução).
- [ ] Commit: `test(onda-61): o mapa entra na regua e o catalogo fecha o ciclo`.

## O que este plano NÃO faz
Drag-and-drop de pino; zonas customizadas; silhueta por modelo; foto real de
fundo; manutenção-por-zona como entidade. Tudo listado como evolução no spec.
