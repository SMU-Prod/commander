# Onda 6 — O Barco Vivo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar os deltas da espec v3 que faltam na ficha e ligar a retenção: Livro de Bordo de verdade (com a sinergia que resolve o horímetro), Selo Ouro como meta visível, assinatura com faturas, e os avisos que fazem o app valer a mensalidade entre um alerta e outro.

**Architecture:** Tudo incremento sobre o que já existe. O Livro de Bordo estende a tabela `eventos` (o diário já é único) em vez de criar tabela nova. O Selo Ouro é derivado — nada gravado, calculado por função pura sobre o painel, igual ao semáforo. Os avisos novos entram no cron de alertas que já roda.

**Tech Stack:** Next.js 16 App Router, Supabase (migrations via MCP), Vitest para domínio puro, Open-Meteo (já integrado), API Asaas (já integrada).

## Global Constraints

- Toda escrita Supabase usa `.select()` + checagem de linhas — sem isso, linha barrada pela RLS volta `error: null` e a tela mente "salvo".
- Migrations aplicadas via MCP no projeto `khgjtxvmduizyooqaoox` (conector `mcp__6dcbebfb-...`, NUNCA plugin_supabase) **E** versionadas com o mesmo SQL.
- Nada de recurso que dependa de chave ausente quebrar a tela: falta de chave degrada com aviso, nunca derruba.
- Selo Ouro é **checklist de completude**, não promessa de qualidade: o texto nunca pode sugerir vistoria feita. Avaliação presencial é operação humana, o app só dispara o pedido.
- Tipografia sem cor (`text-dim`), `sombra-1/2`, alvos ≥44px, PT-BR náutico, ícones via `<Icone>` (só os 28 nomes reais).
- Commits PT-BR sem acento no assunto; hook de pré-commit nunca pulado.

---

### Task 1: Migration 022 — Livro de Bordo nos eventos

**Files:**
- Create: `supabase/migrations/022_livro_de_bordo.sql`
- Modify: `web/lib/db/types.ts`

**Interfaces:**
- Produces: colunas novas em `eventos` e os campos correspondentes na interface `Evento`.

- [ ] **Step 1: Migration** — aplicar via MCP e versionar idêntica:

```sql
-- 022: Livro de Bordo (espec v3 §10) — a saida vira registro formal de operacao.
-- Estende `eventos` em vez de criar tabela nova: o diario ja e unico no produto,
-- e uma saida ja e um evento tipo 'navegacao'.

alter table public.eventos
  add column hora_saida time,
  add column hora_retorno time,
  add column destino text,
  add column tripulacao uuid[] not null default '{}',
  add column mar_onda_m numeric,
  add column mar_vento_kt numeric;

comment on column public.eventos.tripulacao is
  'usuarios a bordo na saida — vale como comprovacao de quem estava no barco';
comment on column public.eventos.mar_onda_m is
  'condicao do mar NO MOMENTO do registro (Open-Meteo), congelada: o passado nao muda';
```

- [ ] **Step 2: Tipos** — em `Evento`: `hora_saida: string | null`, `hora_retorno: string | null`, `destino: string | null`, `tripulacao: string[]`, `mar_onda_m: number | null`, `mar_vento_kt: number | null`.
- [ ] **Step 3:** `get_advisors(security)` sem novidade; `npm test` 128; commit: `feat: migration do livro de bordo`

---

### Task 2: Domínio do Livro de Bordo (TDD)

**Files:**
- Create: `web/lib/domain/bordo.ts` + `web/lib/domain/bordo.test.ts`

**Interfaces:**
- Produces: `duracaoHoras(saida, retorno)`, `horasSugeridas(duracaoH)`, `textoDuracao(h)`.

- [ ] **Step 1: Testes primeiro:**

```ts
import { describe, expect, it } from "vitest"
import { duracaoHoras, horasSugeridas, textoDuracao } from "./bordo"

describe("duracaoHoras", () => {
  it("calcula a duracao entre saida e retorno", () => {
    expect(duracaoHoras("08:00", "12:30")).toBeCloseTo(4.5, 2)
    expect(duracaoHoras("09:15", "10:00")).toBeCloseTo(0.75, 2)
  })
  it("retorno depois da meia-noite conta como no dia seguinte", () => {
    expect(duracaoHoras("22:00", "01:30")).toBeCloseTo(3.5, 2)
  })
  it("sem uma das pontas, sem duracao", () => {
    expect(duracaoHoras(null, "12:00")).toBeNull()
    expect(duracaoHoras("08:00", null)).toBeNull()
    expect(duracaoHoras("08:00", "08:00")).toBeNull()
  })
})

describe("horasSugeridas", () => {
  it("arredonda para o decimo de hora — e o que se lanca no horimetro", () => {
    expect(horasSugeridas(4.47)).toBe(4.5)
    expect(horasSugeridas(0.75)).toBe(0.8)
  })
  it("saida curta demais nao sugere nada", () => {
    expect(horasSugeridas(0.2)).toBeNull()
    expect(horasSugeridas(null)).toBeNull()
  })
})

describe("textoDuracao", () => {
  it("fala como gente", () => {
    expect(textoDuracao(4.5)).toBe("4 h 30 min")
    expect(textoDuracao(2)).toBe("2 h")
    expect(textoDuracao(0.5)).toBe("30 min")
  })
})
```

- [ ] **Step 2: RED.** **Step 3: implementar** (`duracaoHoras` soma 24 h quando o retorno é menor que a saída; `horasSugeridas` arredonda a 0,1 e devolve `null` abaixo de 0,3 h; `textoDuracao` compõe horas e minutos). **Step 4: GREEN** (128 → ~136). Commit: `feat: dominio do livro de bordo (TDD)`

---

### Task 3: A saída no Diário — formulário e sinergia do horímetro

**Files:**
- Modify: `web/app/(app)/diario/novo/page.tsx`, `web/lib/acoes/eventos.ts` (ou o arquivo real da action de criar evento — confira), `web/lib/acoes/trilha.ts`
- Create: `web/app/(app)/diario/[id]/horas/page.tsx`

- [ ] **Step 1: Formulário** — quando o tipo for `navegacao`, o form mostra: hora de saída, hora de retorno (a duração aparece calculada ao vivo, client-side), destino (texto livre), e a tripulação a bordo como caixas de seleção vindas dos vínculos da embarcação (leia como `menu/tripulacao` lista). Os demais tipos seguem exatamente como hoje.
- [ ] **Step 2: Condição do mar congelada** — ao salvar uma `navegacao`, a action busca o boletim do Open-Meteo para a posição da marina (mesma chamada que a Home já faz — reuse a função existente, não duplique) e grava `mar_onda_m`/`mar_vento_kt`. Falha na API não impede o salvamento: grava null e segue.
- [ ] **Step 3: A sinergia (o item que resolve o horímetro)** — depois de salvar uma saída com duração ≥ 0,3 h, redirecionar para `/diario/<id>/horas`, uma tela curta: "Essa saída durou 4 h 30 min. Atualizar as horas dos motores?" com um campo por motor já pré-preenchido com `horas_atuais + horasSugeridas`, botão "Atualizar" e "Agora não". Ao confirmar, grava `leitura_horas` por motor e atualiza `equipamentos.horas_atuais` (reuse a action do Registro Rápido — leia `lib/acoes/registro.ts` e NÃO duplique a lógica).
- [ ] **Step 4: Trilha também sugere** — `salvarTrilha` já cria um evento `navegacao`; passe a gravar `hora_saida`/`hora_retorno` a partir do primeiro e do último ponto da trilha e redirecione para a mesma tela de horas. É a mesma sinergia, pelo caminho do GPS.
- [ ] **Step 5: Exibição** — a ficha do evento no diário mostra duração, destino, quem estava a bordo (nomes dos perfis) e a condição do mar registrada.
- [ ] **Step 6:** verificar e comitar: `feat: livro de bordo com sugestao de horas do motor`

---

### Task 4: Selo Ouro — completude visível

**Files:**
- Create: `web/lib/domain/selo.ts` + `web/lib/domain/selo.test.ts`, `web/app/(app)/barco/selo/page.tsx`, `web/lib/acoes/selo.ts`
- Modify: `web/app/(app)/barco/page.tsx` (entrada para o selo)

**Interfaces:**
- Produces: `avaliarSelo(painel): { itens: {chave, rotulo, ok, dica}[], completos: number, total: number, percentual: number }`

- [ ] **Step 1: Testes do domínio** — checklist derivado do que já existe no painel: dados gerais completos (nome, estaleiro, modelo, ano, comprimento), ≥1 motor com horas, ≥3 documentos com validade futura, nenhum item vencido, ≥1 foto, ≥6 eventos no diário, contatos cadastrados. Teste: barco vazio dá 0; barco completo dá 100%; cada item vira `ok` isoladamente.
- [ ] **Step 2: Implementar** o domínio puro. **Step 3:** GREEN.
- [ ] **Step 4: Tela `/barco/selo`** — barra de progresso (ex.: "7 de 10"), lista dos itens com marca de feito/pendente e a dica do que falta (cada pendência com link para a tela que resolve), e o botão **"Solicitar avaliação presencial"**. Texto honesto: o selo reconhece **documentação e histórico completos**; a avaliação física é feita pela equipe e é o que qualifica o selo de fato.
- [ ] **Step 5: A solicitação** — `solicitarAvaliacao` grava a intenção e dispara e-mail para a equipe (reuse o Resend do relatório; sem chave, mostra o WhatsApp/e-mail de contato como alternativa e não finge que enviou).
- [ ] **Step 6:** entrada na ficha do barco (card com o percentual) + commit: `feat: selo ouro com checklist de completude`

---

### Task 5: Assinatura completa e boleto fora

**Files:**
- Modify: `web/lib/asaas.ts`, `web/app/(app)/menu/assinatura/page.tsx`, `web/lib/acoes/assinatura.ts`

- [ ] **Step 1: Faturas** — nova função `listarCobrancas(subscriptionId)` em `asaas.ts` (`GET /payments?subscription=...`), devolvendo data, valor, status e `invoiceUrl`. Erro da API → lista vazia, nunca exceção na tela.
- [ ] **Step 2: Tela** — a página de assinatura passa a mostrar **data da próxima cobrança** e o **histórico de faturas** (valor, data, status, link para o comprovante). É pedido da espec §9.4 e serve para contabilidade do dono.
- [ ] **Step 3: Boleto fora** — em `criarAssinaturaAsaas`, trocar `billingType: "UNDEFINED"` por `"CREDIT_CARD"`... **atenção**: isso tiraria o Pix, que a espec exige. Investigue a API do Asaas e escolha o caminho que mantém **cartão + Pix e exclui boleto**; se a API só permitir tudo-ou-um, mantenha `UNDEFINED` e registre em `docs/OPERACAO.md` que boleto tem que ser desabilitado na configuração da conta Asaas (pendência do dono). Documente o que descobriu.
- [ ] **Step 4:** verificar e comitar: `feat: faturas e proxima cobranca na assinatura`

---

### Task 6: Avisos que seguram assinatura

**Files:**
- Modify: `web/app/api/alertas/disparar/route.ts`, `web/lib/domain/alertas.ts` (+ testes)

- [ ] **Step 1: Alerta de mau tempo (TDD)** — função pura `alertaDeMar(seloMar, hoje)` que decide se vale avisar (só quando a condição vira ruim, no máximo 1× por dia por embarcação — reuse a tabela `alertas_enviados` com uma `janela` própria para não duplicar). Push: "Mar ruim na sua marina hoje — onda 2,5 m e vento 25 kt."
- [ ] **Step 2: Lembrete de boa prática (TDD)** — `lembreteMotorParado(ultimaLeitura, hoje)`: se o motor não tem leitura há mais de 30 dias, sugerir aquecer. Texto sem inventar fato: é recomendação, não diagnóstico.
- [ ] **Step 3: Ligar no cron** — os dois entram na rota de disparo que já roda, com o mesmo cuidado de dedupe e `Promise.allSettled` que os alertas de vencimento já têm.
- [ ] **Step 4:** verificar e comitar: `feat: avisos de mar ruim e de motor parado`

---

### Task 7: Costuras e dívidas menores

**Files:** vários (cada item é pequeno e independente)

- [ ] **Step 1: Editar item monitorado** — hoje só dá para criar. Criar `/barco/itens/[id]/editar` com os mesmos campos do criar (incluindo `especificacao` e `quantidade`), guard por aba, `.select()` na escrita, e excluir com `<Confirmar>`.
- [ ] **Step 2: Suporte e peças na Elétrica (§4.4)** — na aba Elétrica, listar os contatos com especialidade elétrica e permitir vincular um contato à aba.
- [ ] **Step 3: Menu limpo** — a seção "Em breve" do menu some ou passa a listar só o que realmente falta.
- [ ] **Step 4: Preço dourado no card fundador** — a landing destaca o preço de fundador na cor de ação (achado da auditoria de CMO).
- [ ] **Step 5: Unificar secrets** — `relatorio.yml` passa a usar `COMMANDER_URL` como o `alertas.yml`; `APP_URL` sai; `docs/OPERACAO.md` atualizado (some a armadilha dos dois nomes).
- [ ] **Step 6:** verificar e comitar: `chore: dividas menores da onda 6`
