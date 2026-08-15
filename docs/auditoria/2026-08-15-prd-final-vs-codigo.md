# Auditoria — PRD MASTER UPGRADE 2 **FINAL** (v2.0) contra o código real

Data: 2026-08-15 · Fonte: `docs/prd/upgrade2-master-final.txt` (627 linhas, extraído de
`COMMANDER_PRD_MASTER_UPGRADE_2_FINAL.docx`, recebido em 15/08/2026) contra o código em
`C:\Users\erick\GEST-NAV` no commit `7c6ab96` (onda 41, em produção).

Trabalho só de leitura — nada foi alterado no código. Cada linha abaixo foi conferida
abrindo o arquivo citado, não de memória.

**Contexto importante:** este PRD **não é** o mesmo documento auditado em 14/08. Ele se
declara *"FEATURE FREEZE FUNCIONAL"* e diz explicitamente: *"Decisões anteriores que
conflitem com este PRD devem ser consideradas substituídas."* São 531 linhas que não
existiam na versão anterior. Isso significa que parte do que foi entregue nas ondas 32–41
**foi invalidada por decisão de produto**, não por erro de implementação.

---

## 1. O achado que precisa de decisão hoje

### 🔴 A Saúde da Embarcação mostra porcentagem — e está no ar

O PRD proíbe isso em **três lugares diferentes**:

- §1.1 Princípios de UX: *"Nunca usar porcentagem para 'Saúde da Embarcação'."*
- §27.2 Critérios de aceite: *"Saúde nunca exibe porcentagem."*
- §28 Decisões congeladas: *"Sem porcentagem; Saudável / Atenção / Ação necessária."*

O código faz exatamente o contrário, em produção agora:

| Onde | O que faz |
|---|---|
| `web/components/anel-status.tsx:61` | `<span …>{saude.nota}%</span>` — o número grande no centro do anel |
| `web/components/anel-status.tsx:45` | `aria-label="Status geral: {nota}% — {rotulo}"` — leitor de tela também |
| `web/lib/domain/saude.ts:161-166` | Rótulos são **Ótimo / Bom / Atenção / Crítico** |

O PRD pede os rótulos **SAUDÁVEL / ATENÇÃO / AÇÃO NECESSÁRIA** (§5), com regra declarativa
(nenhum item crítico vencido = Saudável; existe pendência crítica = Ação necessária), não
uma nota numérica com faixas.

**Por que isso é grave e não é só cosmético:** a fórmula de dedução (100 − pesos) foi uma
decisão sua, fechada em 14/08 depois do achado da auditoria anterior, e está documentada
em `lib/domain/saude.ts` como escolha deliberada. O PRD FINAL a substitui por um modelo
completamente diferente — de "quanto está bom" para "qual o pior estado presente". Não dá
pra manter os dois.

**Isso é decisão sua, não minha.** As duas leituras são defensáveis: o número dá noção de
progresso, o rótulo evita que o dono ache que 82% significa "navegável".

---

## 2. Conflitos: implementado ≠ o que o PRD FINAL manda

Estes já estão em produção e o PRD novo pede diferente.

| Tema | Está no código | PRD FINAL manda | Onde |
|---|---|---|---|
| **Preço do plano** | Fundador R$ 69,99/mês e R$ 699,90/ano; âncora R$ 119,90 | Commander **R$ 49,90**; Commander Pro **R$ 69,90** | `lib/domain/planos.ts:18-27` · PRD §2, §28 |
| **Níveis de plano** | Um só nível pago (`fundador_mensal`/`fundador_anual`) | **Sete** planos distintos (Commander, Pro, Captain Free/Pro, 4 tipos de Partner) | `lib/domain/planos.ts:2` · PRD §2 |
| **Limite do Free — Diário** | **20 registros** | **2 Diários completos** | `lib/domain/plano-acesso.ts:76` · PRD §2.3, §28 |
| **Aba Serviços** | Existe `/servicos`, linkada no Menu | *"A aba 'Serviços' foi eliminada"*; é critério de aceite | `app/(app)/menu/page.tsx:94` · PRD §10, §27.2 |
| **Saúde** | Nota 0–100 + Ótimo/Bom/Atenção/Crítico | Sem número; Saudável/Atenção/Ação necessária | ver seção 1 |
| **Admin** | `profiles.is_admin boolean` — um flag só | 4 funções com escopo (CEO, Suporte, Comercial, Gold/Vistoriador); *"não por simples admin=true"* | `migrations/033_gold.sql:17` · PRD §21, §22 |

Um detalhe honesto sobre o Free: o limite de 20 foi escolhido na onda 38 **porque o PRD
anterior dizia "ex.: até 2 Diários" com "ex.:"**, o que li como sugestão e não como regra.
O PRD FINAL fecha em 2, sem "ex.". Vinte foi minha interpretação, e ela caiu.

---

## 3. Módulos inteiros que o PRD FINAL pede e não existem

Nenhuma peça destes está no código — verifiquei tabela por tabela nas 42 migrations e
rota por rota em `app/`.

| Módulo | PRD | Situação |
|---|---|---|
| **Agenda** | §8 — aba oficial, eventos, Mês/Semana/Lista, compartilhamento, Agenda Detalhada | Não existe rota `/agenda` nem tabela |
| **Financeiro** | §9.1–9.3 — aba oficial, Visão Geral/Lançamentos/Recorrentes/Relatórios, +Despesa/+Entrada | Não existe. Hoje há só `custo_centavos` solto em `eventos` |
| **Carteira da Tripulação** | §9.4 — repasse, saldo, comprovante, aprovação, devolução | Não existe |
| **Marketplace por demanda** | §11 — 5 tipos, propostas, matching, fechamento bilateral | Existe `oportunidades` com 3 tipos (`vaga`/`diaria`/`peca_servico`); **não há proposta, negociação nem confirmação bilateral** |
| **Avaliações e contestações** | §14 — 1–5★ pós-negócio, resposta padronizada, contestação, análise do Admin | Não existe tabela. Só há `contatos.avaliacao` (nota pessoal do dono, outra coisa) |
| **Captain / carreira profissional** | §12 — Captain Free/Pro, perfil, candidaturas, disponibilidade | Conceito não existe. Há `perfis_comandante` (vitrine), que é parente mas não é isso |
| **Commander Partner por tipo** | §13 — 6 tipos, cada um com menu e perfil próprios | Existe `parceiros` com categoria, sem menu/dashboard por tipo |
| **Publicidade e destaques** | §20 — 3 produtos, carrossel de 5, preço configurável | Só existe `parceiros.plano` (cortesia/basico/destaque), sem entrega de anúncio |
| **Central de Notificações** | §5.2 — sino com contador, filtros Todas/Embarcação/Agenda/Marketplace/Financeiro | Existe `/notificacoes`, **sem filtros** |
| **Verified com prazo** | §15 — "Atualização necessária — 15 dias", suspensão, reativação automática | Não há prazo nem suspensão em `lib/domain/verified.ts` |
| **Gold: preço por porte** | §16 — tabela R$1.990 a R$5.990 + "sob consulta" | Não há tabela de preço por porte no código |
| **Gold: quem paga** | §16 — EU → pagamento; INTERESSADO → link/QR | Não implementado |
| **Assinatura: ciclo completo** | §23 — tolerância configurável, downgrade Pro→Commander sem apagar | Não há estado de tolerância nem downgrade |
| **Ocorrência anulada** | §7 — *"pode ser anulada com registro quando criada por engano"* | Máquina de estados tem 3 estados, sem `anulada` |

---

## 4. O que o PRD FINAL pede e **já está pronto**

Vale registrar, porque é bastante coisa e não precisa ser tocada:

- **Embarcação como entidade própria** (§1) — arquitetura 100% por `embarcacao_id`.
- **Hubs técnicos completos** (§4.2–4.9) — Motores, Casco, Elétrica, Hidráulica, Segurança,
  Equipamentos, Documentação, Fotos e Contatos. Incluindo Óleo/filtros com status próprio
  (§4.2) e contatos com empresa/e-mail/observações (§4.9) — ambos fechados na onda 41.
- **Diário de Bordo** (§6) — campos de abertura com local e passageiros (onda 41), checklist
  dos 5 hubs com "Tudo OK" (`components/checklist-diario.tsx:74`), tempo de passeio
  calculado, e **horímetro só manual com confirmação** — o PRD insiste nisso três vezes e o
  código nunca infere horas pela duração (`lib/acoes/eventos.ts`, `devePropagarLeitura`).
- **Ocorrências com ciclo de vida** (§7) — Aberta → Em acompanhamento → Resolvida, com
  referência ao Diário de origem.
- **Alertas de documentação 30/15/5/vencido** (§4.8).
- **Transferência de propriedade** (§17) — inclusive a regra de não levar dados pessoais,
  fechada na onda 41.
- **Resumos Mensal/Semestral/Anual** (§18).
- **Permissões por Hub: Sem acesso / Visualizar / Editar** (§19), aplicadas **na interface e
  na RLS do banco** — o PRD exige os dois (§27.2) e isso está feito.
- **Remoção de acesso não apaga histórico** (§7, §19) — autoria preservada.
- **"Commander Review" não existe no código** (§16, §27.2) — confirmado de novo.
- **Segurança: vermelho + "!" reservado a crítico** (§4.6).

---

## 5. Contagem honesta

Contei **~120 requisitos distintos** nas 28 seções.

- **PRONTO**: ~46
- **AUSENTE**: ~52
- **CONFLITA com o que está no ar**: ~6 (seção 2)
- **PARCIAL**: ~16

O trabalho que falta é **maior que tudo que foi feito das ondas 32 à 41 somadas**. Agenda,
Financeiro + Carteira, Marketplace com propostas, Avaliações, Captain e Partner por tipo
são seis módulos de porte, cada um com tabela, RLS, telas e regra própria.

---

## 6. Recomendação de ordem

O PRD traz sua própria ordem (§27.1), mas ela pressupõe um app começando do zero. Como o
Commander já existe, a ordem que respeita o que está pronto e ataca risco primeiro:

1. **Decidir a Saúde** (seção 1) — é o único item que está *errado no ar* segundo uma
   decisão congelada. Barato de corrigir, e não dá pra deixar divergente.
2. **Fechar preços e planos** (§2) — antes de cobrar de qualquer pessoa. Mexer em preço
   depois de ter assinante é muito pior do que agora, que ainda não há cobrança real.
3. **Tirar a aba Serviços** (§10) — pequeno, é critério de aceite, e o conteúdo dela já
   vive em Explorar/Comandantes.
4. **Financeiro + Carteira** (§9) — é o módulo de maior valor percebido que falta, e não
   depende de nenhum outro.
5. **Agenda** (§8).
6. **Marketplace com propostas e fechamento bilateral** (§11) — pré-requisito de Avaliações.
7. **Avaliações e contestações** (§14).
8. **Captain Pro e Partner por tipo** (§12, §13) — os dois mexem em plano, então vêm depois
   de (2).
9. **Admin com papéis** (§21) — hoje é `is_admin` binário; vira crítico quando houver
   Suporte e Vistoriador de verdade mexendo em conta de cliente.
10. **Publicidade** (§20) — último, porque só faz sentido com Partners em volume.

---

## 7. Decisões que só o dono toma (não são engenharia)

1. **Saúde: nota ou rótulo?** (seção 1) — bloqueia o item 1 da ordem acima.
2. **O plano fundador continua existindo?** O PRD FINAL não o menciona em lugar nenhum.
   Se continua, é um oitavo plano; se não, quem já assinou precisa de tratamento.
3. **Free com 2 Diários é agressivo demais?** Vinte era generoso; dois é uma demonstração.
   O PRD assume isso conscientemente (*"Free deve funcionar como demonstração interativa"*),
   mas é decisão comercial.
4. **Migração de dados**: quem já tem mais de 2 registros no Diário quando o limite cair
   pra 2 — o que acontece? O PRD diz *"preservando dados e histórico; recursos pagos ficam
   bloqueados, não apagados"* (§23), o que sugere manter e bloquear criação nova. Confirmar.
5. **Cartas náuticas da Marinha** (fora deste PRD, veio pelo WhatsApp): a própria Marinha
   declara que os GeoTIFF são *para fins acadêmicos e não devem ser usados como auxílio à
   navegação*. Embutir carta oficial em app comercial pago precisa de parecer jurídico.
6. **Base regulatória (NORMAM/UE/IMO)**: além de ser um módulo grande, cria exposição
   jurídica — se o app afirmar conformidade e errar, a responsabilidade é de vocês.
