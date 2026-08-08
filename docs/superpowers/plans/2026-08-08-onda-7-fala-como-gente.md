# Onda 7 — Fala como gente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O dono do produto travou no próprio app e marcou os quatro pontos (Início, cadastrar barco, ficha, nomes). Esta onda corrige o que trava, reordena a ficha por frequência de uso, unifica o vocabulário e cria o gate de processo que faltava.

**Fonte:** `docs/auditoria/2026-08-08-sintese-ux.md` e os 4 relatórios de lente (`ux-primeira-vez`, `ux-ficha`, `ux-vocabulario`, `ux-orfas`).

**Architecture:** Nenhuma mudança de banco. É tudo apresentação: links que faltam, ordem de seções, textos. O motor de domínio (`semaforo.ts`) não muda — ele já está certo; muda como o resultado dele é mostrado.

## Global Constraints

- **Glossário decidido (aplicar sem exceção):**
  | Termo morto | Termo vivo |
  |---|---|
  | "item monitorado" | **manutenção** (motor/elétrica/casco) · **documento** (categoria documento) |
  | "Notificações" / "Alertas" (como nome de tela) | **Avisos** (um nome só, em todo lugar) |
  | "+ Evento" / "+ Lançamento" / "Salvar no diário" | **+ Registrar** (e "Registrar no diário") |
  | "Marketplace" (aba) | **Comandantes** |
  | "matriz de permissões" | **o que ele pode ver e editar** |
  | "cota de nuvem" | **espaço de fotos** |
  | "aba" em mensagem de erro | **o nome da área** ("editar Motores") |
- **Mensagem de erro diz o que fazer.** Nunca "confira seu acesso" solto: ou nomeia a área, ou diz a próxima ação.
- Textos em PT-BR náutico, na voz que o app já acerta: *"Bom vento e mar calmo"*, *"Agora não"*.
- Tipografia sem cor (`text-dim`), alvos ≥44px, `<Icone>` só com os 28 nomes reais.
- Nada de mudança de comportamento de domínio: 164 testes continuam verdes.
- Commits PT-BR sem acento no assunto; hook de pré-commit nunca pulado.

---

### Task 1 (Bloco A): O que trava

**Files:** `web/app/(app)/hoje/page.tsx`, `web/components/horimetro.tsx`, `web/app/(app)/diario/page.tsx`, `web/app/(app)/barco/gastos/page.tsx`, `web/app/(app)/barco/itens/novo/page.tsx`, `web/app/(app)/menu/page.tsx`

- [ ] **Step 1: O card de alerta vira link.** `hoje/page.tsx:124-141` é um `<div>`. Vira `<Link>` para a tela que resolve o item (mesmo destino que `barco/page.tsx:140-144` usa). É o achado nº 1 da auditoria: o dono vê o alerta vermelho, toca e nada acontece.
- [ ] **Step 2: "Tudo em dia" para de mentir.** O onboarding cria 4 manutenções com a data de hoje sem o dono informar nada, e a Início mostra o mesmo verde de um barco revisado. Distinga os dois estados: quando não há leitura real de horas nem vencimento informado, o texto diz que **falta informação**, não que está tudo em dia — e oferece o caminho para completar. Reuse o vocabulário de estado vazio bom que já existe em `barco/eletrica/page.tsx:66-74`.
- [ ] **Step 3: Horímetro sem leitura mostra "—".** `horimetro.tsx:15,21-22` mostra "0,0 h" quando `horas` é null/zero sem leitura. Um motor com 600 h marcando zero destrói a confiança na primeira tela. Mostre "—" e, se couber, "sem leitura".
- [ ] **Step 4: Anexo do diário reabre.** `Evento.anexo_path` é gravado mas nunca exibido com link. Aplique o padrão que já existe para documentos avulsos (URL assinada + "Abrir") na lista do diário, em `/barco/gastos` e na ficha do equipamento — onde o evento aparecer, o anexo abre.
- [ ] **Step 5: `/parceiro` alcançável para quem está logado.** Hoje só tem link no rodapé da landing, e `/` redireciona logado para `/hoje`. Acrescente entrada no Menu (seção própria, texto que explique que é para marina/pousada/restaurante/posto).
- [ ] **Step 6: `itens/novo` volta de onde veio.** `itens/novo/page.tsx:22` sempre volta para `/barco`. O código certo já existe em `itens/[id]/editar/page.tsx:36-40` — reuse.
- [ ] **Step 7: Rótulo errado na Início.** `hoje/page.tsx:188` chama de "Motores" um link que leva à ficha inteira. Renomeie para o que ele é.
- [ ] **Step 8:** verificar (`npm test` 164, tsc, eslint, build) e comitar: `fix: o que travava — alerta clicavel, horimetro honesto, anexo que abre`

---

### Task 2 (Bloco B): Hierarquia da ficha

**Files:** `web/app/(app)/barco/page.tsx`, `web/lib/domain/semaforo.ts` (só se precisar de função nova para data), `web/app/(app)/barco/equipamento/[id]/page.tsx`

- [ ] **Step 1: Reordenar por frequência de uso.** Ordem atual põe "Dados gerais" (consulta ~1×/ano) acima de Documentos, Contatos e Gastos (uso mensal). Nova ordem proposta pela auditoria (`ux-ficha.md`): card do barco → Motores → o que vence primeiro → Elétrica → Casco → Documentos → Fotos → Gastos → Contatos → Selo Ouro → Dados gerais → Posição da marina. Leia a justificativa no relatório e ajuste se discordar — mas justifique no commit.
- [ ] **Step 2: Separar o que está misturado.** "Documentos e embarcação" (`page.tsx:127-155`) junta itens de categoria documento com itens sem categoria. Separe em duas seções com nomes que expliquem a diferença.
- [ ] **Step 3: Data de calendário no vencimento.** Hoje a resposta é sempre relativa ("em 40 h", "em 12 dias"). Um dono quer saber **quando**. Onde houver data (`vencimentoPorData` já existe em `semaforo.ts`), mostre-a junto do relativo: "12 dias · 20/08". Onde só houver horas, mantenha só as horas (não invente data).
- [ ] **Step 4: O item "Embarcação (geral)"** existe no formulário de criar (`itens/novo/page.tsx:48`) mas nenhum link leva lá sem `?alvo=`. Dê caminho a partir da seção nova do Step 2.
- [ ] **Step 5:** verificar e comitar: `refactor: ficha ordenada por frequencia de uso, com data no vencimento`

---

### Task 3 (Bloco C): Vocabulário — um nome por conceito

**Files:** varredura em `web/app`, `web/components`, `web/lib/acoes`, `web/lib/domain` (rótulos)

- [ ] **Step 1: Aplicar o glossário** dos Global Constraints em TODAS as strings visíveis. O relatório `ux-vocabulario.md` traz as 15 piores com arquivo:linha e a substituição sugerida — use como ponto de partida, mas varra tudo.
- [ ] **Step 2: A tela de avisos tem um nome só.** Hoje: "Avisos" (navegação), "Notificações" (título), "Alertas" (menu), "Alertas ativos"/"Avisos enviados" (dentro). Tudo vira **Avisos**.
- [ ] **Step 3: A ação de registrar tem um nome só** — "+ Registrar" / "Registrar no diário".
- [ ] **Step 4: Mensagens de erro nomeiam a área e dizem o que fazer.** As ~15 ocorrências de "confira seu acesso" viram mensagens que citam a área ("Seu acesso não permite editar Motores") ou a próxima ação. Onde o erro for de rede/sessão, diga isso.
- [ ] **Step 5: Aba "Marketplace" → "Comandantes"** na navegação (`bottom-nav.tsx`) e nos textos que a referenciam.
- [ ] **Step 6:** verificar e comitar: `refactor: um nome por conceito em todo o app`

---

### Task 4 (Bloco D): O gate que faltava

**Files:** `docs/CONTRIBUTING.md`

- [ ] **Step 1:** acrescentar ao checklist de fim de onda um **gate de descoberta**, com estas regras: (a) toda funcionalidade nova precisa de caminho a partir de `/hoje` em no máximo 3 toques; (b) nenhuma rota pode existir sem link que leve a ela (exceto webhook/convite externo, que devem estar listados como exceção); (c) todo dado que a interface grava tem que ser exibível em algum lugar; (d) o vocabulário do glossário é obrigatório — um conceito, um nome.
- [ ] **Step 2:** registrar no `CONTRIBUTING.md` o **glossário** dos Global Constraints, para as próximas ondas não reintroduzirem os termos mortos.
- [ ] **Step 3:** comitar: `docs: gate de descoberta e glossario no contributing`
