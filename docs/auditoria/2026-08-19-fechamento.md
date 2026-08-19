# Fechamento das auditorias de 19/08/2026 — o que ainda não está fechado

**Data da reauditoria:** 19/08/2026 (fim do dia)
**Método:** cada achado numerado dos cinco documentos foi reaberto contra o código e o
banco de AGORA. Nenhum arquivo de aplicação foi alterado, nenhuma migration rodada,
nenhuma escrita no banco — só `SELECT` e catálogo (`pg_policies`, `pg_proc`,
`pg_constraint`, `pg_indexes`, advisors) no projeto `khgjtxvmduizyooqaoox`. O único
arquivo escrito é este.
**Regra que governou cada linha:** um achado marcado ABERTO carrega a prova de que
está aberto. Ausência de prova de fechamento não vale como prova de abertura.

> **Aviso de simultaneidade — e ele mudou o resultado.** Três frentes estavam editando o
> repositório enquanto esta reauditoria rodava (identidade, cobrança/banco, pontas soltas do
> produto). **Oito achados fecharam entre a primeira leitura e a última**, e cada um deles foi
> reverificado no fim: os quatro de identidade (P2-10, P2-11, P2-12, P2-13), os dois de
> documentação da cobrança (A-11, A-13), o A18 e o 5.2. Onde um veredito mudou, a linha diz
> "durante esta reauditoria".
>
> **A distinção que mais importa neste documento:** *escrito* não é *aplicado*. Quatro
> migrations existem em `supabase/migrations/` (078, 079, 080, 081) e um arquivo de índices
> (`INDICES-2026-08-19.sql`), e **nenhum deles está no banco** — reverificado no fechamento,
> policy por policy e índice por índice. Os achados que eles consertariam continuam ABERTOS,
> porque o banco vivo é a única fonte de verdade aqui.

---

## VEREDITO

Os cinco documentos de 19/08 somam **112 achados numerados**. Hoje, contra o código e o
banco vivos: **83 FECHADO, 19 ABERTO, 9 DECISÃO DO DONO, 1 NÃO SE APLICA.** Oito desses
fechamentos aconteceram **durante esta reauditoria** — os quatro de identidade (P2-10 a
P2-13), os dois de documentação da cobrança (A-11 e A-13), o A18 e o 5.2 — e estão marcados
linha a linha; foram reverificados no fim, não no começo. Foi um dia
de fechamento de verdade, e boa parte dele por caminhos **diferentes** dos que os
relatórios propuseram — o feedback de toque não virou `active:` espalhado, virou duas
constantes em `lib/ui/acoes.ts`; `/afazeres` não ganhou `.eq()`, ganhou `.or()` com mapa
de nomes; a governança Enterprise não virou preset automático no vínculo, virou botão
explícito na matriz de acesso; e dois achados foram fechados **apagando** o código morto
em vez de dar tela a ele (A8 e B9), com a justificativa escrita no arquivo. O que resta
não é um bloco só: são **quatro grupos com custos muito diferentes**. (1) *Duas frestas de
RLS que precisam cair antes de a chave do Asaas ser ligada* — `assinaturas` não amarra o
`asaas_subscription_id` a quem escreve e `gold_pagamentos` não trava `status`/`valor`;
hoje são inofensivas porque há 0 assinaturas, e deixam de ser no dia em que houver uma.
**As duas já têm migration escrita (078 e 079) e NÃO APLICADA** — o que falta é rodar.
(2) *Cinco pontas do produto*: `bases_operacionais` continua sem uma linha de código,
`afazeres.responsavel_id` continua sem quem o atribua, e três colunas continuam sendo
pedidas à pessoa e nunca mostradas. (3) *Higiene de banco medida e não feita*: 0 de 15
índices de FK (o arquivo `INDICES-2026-08-19.sql` também está escrito e não aplicado), 24
policies reavaliando `auth.uid()` por linha, 18 policies `FOR ALL` redundantes e cinco tipos
fora de `types.ts`. (4) *Sete acabamentos de design*, o maior deles a substituição mecânica
de raio — 317 pontos de valor idêntico — que o próprio relatório pediu para entrar sozinha
e não entrou. Nada do que resta impede alguém de usar o app hoje; o que impede alguém de
**pagar** não é código nenhum: são as credenciais do Asaas e o Site URL do Supabase.

---

## 1. `2026-08-19-auth-e-email.md` — identidade

14 achados.

| achado | veredito | prova |
|---|---|---|
| P0-1 · link vai para `localhost:3000` (Site URL do painel) | **DECISÃO DO DONO** | Campo de painel; o MCP não expõe a config do Auth — **não verificado**. O código deixou de depender só dele: `web/lib/acoes/auth.ts:88` manda `emailRedirectTo` explícito. Continua dependendo de o dono cadastrar a Redirect URL (D-2), senão o GoTrue descarta em silêncio. |
| P0-2 · não existe `/auth/callback` nem `exchangeCodeForSession` | **FECHADO** | `web/app/auth/callback/route.ts:27-61` (troca o código em `:51`); `web/middleware.ts:44` abre `/auth/` para deslogado |
| P0-3 · `signUp` sem `options.emailRedirectTo` | **FECHADO** | `web/lib/acoes/auth.ts:88` |
| P1-4 · mesma frase para senha errada e conta não confirmada | **FECHADO** | `web/lib/acoes/auth.ts:64-70` (ramo `email_not_confirmed`) |
| P1-5 · não existe reenvio de confirmação | **FECHADO** | `web/lib/acoes/auth.ts:124-139` (`reenviarConfirmacao`); formulário em `web/app/(auth)/login/page.tsx:187-189` |
| P1-6 · não existe "esqueci minha senha" | **FECHADO** | `web/lib/acoes/auth.ts:142-152` e `:159-173`; tela `web/app/(auth)/nova-senha/page.tsx`; link em `web/app/(auth)/login/page.tsx:171` |
| P1-7 · conta já existente cai no aviso de confirmação | **FECHADO** pela opção (b) do relatório | `web/lib/acoes/auth.ts:104-111` — resposta uniforme, texto serve aos dois casos e entrega as duas saídas |
| P1-8 · e-mail digitado errado não tem conserto | **FECHADO** | mesma frase de `web/lib/acoes/auth.ts:104-111`, agora com reenvio (`:124`) e recuperação (`:142`) existindo de verdade |
| P1-9 · SMTP embutido do Supabase | **DECISÃO DO DONO** | Painel (Authentication → Emails → SMTP). **Não verificado** — MCP não lê config de Auth |
| P2-10 · `entrar`/`cadastrar` sem rate limit | **FECHADO** (durante esta reauditoria) | `web/lib/acoes/auth.ts:5` importa `checarLimite`/`identificarIp`, aplicados em `entrar` (`:150`), `cadastrar` (`:182`), `reenviarConfirmacao` (`:242`) e `pedirNovaSenha` (`:261`) |
| P2-11 · `?erro=`/`?aviso=` renderizam texto arbitrário da URL | **FECHADO** (durante esta reauditoria) | O que viaja na URL virou código, não frase: `web/lib/acoes/auth.ts:6` importa `CODIGOS_ERRO`/`CODIGOS_AVISO` e usa em `:152,174,185,196,213,244,263,283,288`; a tradução acontece no servidor contra lista fechada (`web/lib/seguranca/mensagens-auth.ts`), consumida em `web/app/(auth)/login/page.tsx:64` e `web/app/(auth)/nova-senha/page.tsx:35`; `web/app/auth/callback/route.ts:42-65` idem |
| P2-12 · força de senha só no cliente | **FECHADO** (durante esta reauditoria) | `web/lib/acoes/auth.ts:194` — `if (senha.length < 8)` agora também em `cadastrar` |
| P2-13 · `caminho.startsWith("/login")` | **FECHADO** (durante esta reauditoria) | A decisão saiu do middleware para um módulo testado: `web/middleware.ts:3,27` chamam `ehRotaPublica` (`web/lib/seguranca/rotas-publicas.ts:51`), e `web/lib/seguranca/rotas-publicas.test.ts:14-16` fixa o comportamento — `/login` verdadeiro, `/login-admin`, `/loginfalso` e `/logins` falsos |
| P2-14 · `.env.example` aponta para domínio que não é o de produção | **DECISÃO DO DONO** | `web/.env.example:18` = `commander.soumardivers.com`; `docs/OPERACAO.md:5,28,45,79` idem; produção roda em `commander-tau.vercel.app`. Só o dono decide qual é o domínio definitivo |

**Medição do banco, hoje:** 6 usuários, 6 com `email_confirmed_at`, **2** com
`last_sign_in_at` (era 1), 0 com `recovery_sent_at`. Último cadastro em 19/08 03:53 —
ou seja, **anterior às correções**. O caminho ponta a ponta ainda não foi exercido por
ninguém.

**Fato colhido de passagem, e ele contradiz a documentação:** `Confirm email` está
**LIGADO**. Medido: 4 usuários têm `confirmation_sent_at` preenchido e os 4 confirmaram
*depois* do envio. `docs/OPERACAO.md:75` afirma que está desligado — a doc está errada.

---

## 2. `2026-08-19-asaas-cobranca.md` — cobrança

15 achados.

| achado | veredito | prova |
|---|---|---|
| A-01 · nenhuma variável do Asaas em produção | **DECISÃO DO DONO** | Sem acesso à Vercel nesta sessão — **não verificado diretamente**. O lote de SQL escrito hoje (`supabase/migrations/RODAR-SEGUNDO-LOTE-2026-08-19.sql:11-13`) afirma que `ASAAS_WEBHOOK_TOKEN` ainda não existe em produção |
| A-02 · `/assinar` não consulta `asaasConfigurado()` | **FECHADO** | `web/app/(assinatura)/assinar/page.tsx:116` (`const cobrancaLigada = asaasConfigurado()`), motivo escrito em `:97` |
| A-03 · webhook 401 enquanto não houver token | **DECISÃO DO DONO** (ordem de ligação) | `web/app/api/asaas/webhook/route.ts:147-150` continua falhando fechado — que é o comportamento certo. O risco é ligar fora de ordem, e isso está roteirizado em `docs/auditoria/2026-08-19-o-que-depende-do-dono.md:91-110` |
| A-04 · Gold trava em `solicitado` (RPC exige Suporte) | **FECHADO** no banco, pelo caminho 1 dos dois propostos | `gold_definir_estado` (banco vivo): ramo `elsif p_novo_estado = 'aguardando_pagamento'` agora aceita `tem_papel_admin('suporte') OR (v_atual='solicitado' AND s.solicitante_id = auth.uid())` |
| A-05 · estorno e chargeback não tratados | **FECHADO** | `web/app/api/asaas/webhook/route.ts:50-57` — `PAYMENT_REFUNDED`, `PAYMENT_REFUND_IN_PROGRESS`, `PAYMENT_CHARGEBACK_REQUESTED`, `PAYMENT_CHARGEBACK_DISPUTE`, `PAYMENT_AWAITING_CHARGEBACK_REVERSAL`, `PAYMENT_DELETED` → `problema_pagamento` |
| A-06 · sem carimbo de ordem | **FECHADO** | `web/app/api/asaas/webhook/route.ts:202-210` — `ultimo_evento_em` no mesmo `update`, com filtro `is.null,lte` |
| A-07 · evento sem correspondência devolve 200 mudo | **FECHADO** | `web/app/api/asaas/webhook/route.ts:229-275` (`diagnosticarAssinatura`, separa `sem_correspondencia`/`fora_de_ordem`/`sem_efeito`) e `:307-324` no Gold |
| A-08 · `catch` do Asaas sem log | **FECHADO** | `web/lib/acoes/assinatura.ts:111` (`console.error("[assinar] falha ao criar cliente/assinatura no Asaas", e)`) |
| A-09 · INSERT de `gold_pagamentos` não restringe `status` nem `valor_centavos` | **ABERTO** | Policy viva `gold_pagamentos: criar` — `WITH CHECK (tem_papel_admin('suporte') OR EXISTS(select 1 from gold_solicitacoes s where s.id = solicitacao_id and (s.solicitante_id = auth.uid() or eh_prop(s.embarcacao_id))))`. Nenhuma menção a `status` ou `valor_centavos`. Os únicos `CHECK` da tabela limitam o **domínio** (`status in ('pendente','pago','falhou','cancelado')`), não o valor gravado no INSERT. Sem trigger (`pg_trigger` = nenhum) |
| A-10 · INSERT de `assinaturas` não valida posse do `asaas_subscription_id` | **ABERTO** | Policy viva `assinatura: criar a propria pendente` — `WITH CHECK ((usuario_id = (select auth.uid())) AND (status = 'pendente'))`. Continua sem amarrar o ID do gateway |
| A-11 · `NEXT_PUBLIC_COBRANCA_ATIVA` documentada como passo obrigatório | **FECHADO** (durante esta reauditoria) | `docs/OPERACAO.md:23` agora diz que a variável "foi retirada deste roteiro"; `web/.env.example:46` declara que ela não existe; o código já estava limpo (`web/app/(app)/layout.tsx:31`) |
| A-12 · webhook salta `aguardando_pagamento → aguardando_agendamento` | **ABERTO** (P2, agora documentado) | `gold_transicao_valida` (banco vivo) segue com `when 'aguardando_pagamento' then p_novo in ('pago','cancelado')`; `web/app/api/asaas/webhook/route.ts:329-331` continua saltando. O que mudou: o desvio agora está explicado em `:277-287`. Duas definições da mesma máquina continuam existindo |
| A-13 · doc afirma que `premium_concessoes` não libera nada | **FECHADO** (durante esta reauditoria) | `docs/OPERACAO.md:190` traz a afirmação antiga riscada e `:195` descreve o comportamento real (`premium_concessoes.plano_concedido` quando não há assinatura), que bate com `plano_do_usuario` no banco vivo |
| A-14 · Boleto provavelmente habilitado na conta Asaas | **DECISÃO DO DONO** | Exige a conta do dono — **não verificado**. Pendência registrada em `docs/OPERACAO.md:83-95` |
| A-15 · não existe registro de eventos do webhook | **FECHADO** | Tabela `public.asaas_eventos` existe no banco vivo (RLS ligada, 0 linhas); gravação em `web/app/api/asaas/webhook/route.ts:105-132`, chamada em `:176` |

**Medição do banco, hoje:** 0 assinaturas, 0 `gold_solicitacoes`, 0 `gold_pagamentos`,
0 eventos em `asaas_eventos`, 1 `premium_concessoes`. Nada disso foi exercido em runtime.

---

## 3. `2026-08-19-banco-e-rls.md` — banco e RLS

12 achados. Tudo abaixo foi lido da definição viva, não das migrations.

| achado | veredito | prova (objeto de banco) |
|---|---|---|
| P0-1 · suspender cotista não tira acesso | **FECHADO** | `pg_get_functiondef` de `permissao`, `pode_ver_embarcacao` e `eh_prop` — as **três** agora contêm `suspenso`, e as três passaram a usar `(select auth.uid())` |
| P1-2 · `viagens` com policy `ALL` só por vínculo | **FECHADO** | 4 policies vivas: `viagens: ver pela matriz` (SELECT, `permissao(...,'diario','ver')`), `criar`/`atualizar`/`excluir pela matriz` (`permissao(...,'diario','editar')`) |
| P1-3 · `sondagens` com `USING` sem dono | **FECHADO** | 4 policies vivas: `ve as do barco` (SELECT), `grava a propria` (INSERT), `corrige a propria` (UPDATE, `usuario_id = (select auth.uid())` no USING **e** no WITH CHECK), `apaga a propria` (DELETE) |
| P1-4 · `afazeres` fora da matriz, `responsavel_id` livre | **FECHADO** | INSERT vivo exige `permissao(embarcacao_id,'diario','editar')` **e** que o `responsavel_id` tenha vínculo não suspenso; SELECT vivo inclui `eh_prop(embarcacao_id)` |
| P1-5 · estoque/tanques com FK solto para barco alheio | **FECHADO** na integridade | INSERT vivo de `estoque_movimentos` termina em `(embarcacao_id IS NULL OR pode_ver_embarcacao(embarcacao_id))`; o de `tanque_movimentos` em `(destino_embarcacao_id IS NULL OR pode_ver_embarcacao(destino_embarcacao_id))`. O `CASCADE` de `bases_operacionais_dono_id_fkey` continua (`confdeltype='c'`) — é decisão do dono, ver seção própria |
| P1-6 · link de cotista não tem como ser resgatado | **FECHADO** | Função `aceitar_convite_cotista(text)` existe no banco (SECURITY DEFINER, checa vaga de cota e vínculo prévio, grava matriz de permissões); rota `web/app/convite-cotista/[codigo]/page.tsx` existe e chama `info_convite_cotista` (`:71`) e `aceitar_convite_cotista` (`web/lib/acoes/cotistas.ts:99`). **Resíduo:** `convites_cotista.expira_em` **não** foi criada — o link continua sem prazo |
| P1-7 · auditoria legível por qualquer vinculado | **FECHADO** | Policy viva `auditoria: o dono e quem administra leem` — `USING (eh_prop(embarcacao_id) OR permissao(embarcacao_id,'embarcacao','editar'))` |
| P2-1 · advisors (50 ruído + leaked password) | **DECISÃO DO DONO** | `auth_leaked_password_protection` continua listado como WARN nos advisors de hoje — é um toggle de painel. As `authenticated_security_definer_function_executable` subiram para **52** e continuam sendo ruído deste desenho. Duas ressalvas do achado: (a) `registrar_visualizacao` continua sem qualquer trava (`update parceiros set visualizacoes = visualizacoes + 1`) e `publicidade_registrar_clique` só checa vigência — infláveis em laço; (b) a ressalva do `gold_reivindicar_consultor` **não se aplica**: `Confirm email` está ligado (medido) |
| P2-2 · `auth_rls_initplan` | **ABERTO** (parcial) | Medido agora: **24** policies em `public` com `auth.uid()` sem `select` (eram 32). Ex.: as 4 de `bases_operacionais`/`estoque_itens` e os SELECT de `estoque_movimentos`/`tanque_movimentos` |
| P2-3 · `multiple_permissive_policies` | **ABERTO** | **18** policies `FOR ALL` vivas em `public`, que continuam casando junto com as de SELECT (ex.: `bases: o dono escreve` (ALL) + `bases: o dono le` (SELECT), com predicado idêntico) |
| P2-4 · FK sem índice | **ABERTO** | Medido coluna a coluna: **0 de 15** das FK "quentes" listadas no relatório têm índice (`afazeres.embarcacao_id`, `afazeres.responsavel_id`, `estoque_movimentos.embarcacao_id`, `…servico_id`, `estoque_itens.base_id`, `tanques.base_id`, `tanques.dono_id`, `tanque_movimentos.destino_embarcacao_id`, `movimentos_patio.responsavel_id`, `…ocorrencia_id`, `orcamentos.servico_id`, `servicos_mecanica.ocorrencia_id`, `lancamentos_financeiros.criado_por`, `votos.votante_id`, `envios_cotista.cotista_id`) |
| P2-5 · tipos da onda nova fora de `types.ts` | **ABERTO** (parcial) | `web/lib/db/types.ts` ganhou `ResultadoEventoAsaas` (`:1011`) e `AsaasEvento` (`:1033`), mas continua **sem** `Afazer`, `Tanque`, `EstoqueItem`, `Orcamento` e `Votacao` |

**Linha de base do banco, hoje:** 83 tabelas em `public`, **83 com RLS ligada**, 0 sem
policy, 225 policies (eram 218).

---

## 4. `2026-08-19-paridade-front-back.md` — paridade front × back

36 achados (20 A, 11 B, 5 C).

### Tabela A — o back tem e nenhuma tela mostra

| achado | veredito | prova |
|---|---|---|
| A1 · `motor_componentes` sem consumidor | **FECHADO** | `web/lib/consultas-catalogo.ts:128` (`.from("motor_componentes")`) alimenta `web/app/(app)/mecanica/page.tsx:129` e `:349` (`planoSugerido`). Banco vivo: 144 linhas na tabela |
| A2 · `bases_operacionais` sem consumidor | **ABERTO** | Zero ocorrências de `bases_operacionais`/`base_id` em todo `web/`; a tabela existe e tem **0 linhas** no banco vivo |
| A3 · `auditoria` write-only e incompleta | **FECHADO** | Lida em `web/app/(app)/cotistas/page.tsx:51`, renderizada em `:273`; `alvo/antes/depois/motivo` preenchidos em `web/lib/acoes/cotistas.ts:171-174` e `web/lib/acoes/enterprise.ts:307` |
| A4 · `estoque_movimentos` nunca lida | **FECHADO** | `web/app/(app)/estoque/page.tsx:45-46` (render `:253-267`) e `web/app/(app)/mecanica/page.tsx:149`; `servico_id` gravado em `web/lib/acoes/enterprise.ts:509` |
| A5 · `abastecimentos` nunca lida | **FECHADO** | `web/app/(app)/combustivel/page.tsx:56`. **Resíduo:** o insert (`web/lib/acoes/enterprise.ts:620-626`) continua sem `horas`, `posto` e `comprovante_path` |
| A6 · fotos e aprovação do pátio | **ABERTO** | `web/lib/db/types.ts:505,511,516-518` declaram as 5 colunas; os dois únicos writes (`web/lib/acoes/patio.ts:47-53` e `:101-110`) não escrevem nenhuma e `web/app/(app)/patio/page.tsx` não tem campo de foto |
| A7 · governança Enterprise nunca aplicada | **FECHADO**, por caminho diferente do proposto | Não virou aplicação automática no vínculo — virou controle explícito: `PRESET_ENTERPRISE` em `web/app/(app)/tripulacao/[id]/matriz-acesso.tsx:89`; `exigeAprovacao` via `podePublicarParaCotistas` (`web/lib/domain/enterprise.ts:273`) em `web/app/(app)/mecanica/page.tsx:118`; `exigeMotivoDeAjuste` em `web/lib/acoes/enterprise.ts:476` |
| A8 · plano pago do cotista sem tela | **FECHADO** por apagamento | `web/lib/domain/cotista-plano.ts:14-44` e `:130-136` — o bloco de venda foi removido com a justificativa escrita ("não existe como cobrar"); sobrou `RESSALVA_ACESSO_BASICO` (`:57`), que tem tela |
| A9 · importação de frota por planilha | **FECHADO** | `web/app/(app)/frota/importar/page.tsx` + `importar-frota-cliente.tsx:35,37,70,81`; action `web/lib/acoes/importar-frota.ts:72`; portas em `web/app/(app)/frota/page.tsx:180,234` |
| A10 · preço por litro e consumo por hora | **FECHADO** | `web/app/(app)/combustivel/page.tsx:269` e `:297-299`; `totalCentavosPorLitro` em `web/lib/acoes/enterprise.ts:581` |
| A11 · armadilha da duplicidade | **FECHADO** | `avisoDeDuplicidade` em `web/app/(app)/mecanica/page.tsx:506`; `valorAlancar` em `web/lib/acoes/enterprise.ts:250` |
| A12 · fluxo de entrada do cotista | **FECHADO** | `podeEntrarComLink`, `mensagemDeRecusa`, `MENSAGEM_SUSPENSO` em `web/app/convite-cotista/[codigo]/page.tsx:81,116,119`; `estaSuspenso` em `web/app/(app)/cotistas/page.tsx:197`. **Resíduo:** `faltaNoCadastro` (`web/lib/domain/cotistas.ts:197`) segue só com teste |
| A13 · propulsão Jet | **FECHADO** | `COMPONENTES_JET` renderizado em `web/app/(app)/patio/page.tsx:346` |
| A14 · `votacoes.encerrada_em` nunca escrita | **FECHADO** | `encerrarVotacao` em `web/lib/acoes/enterprise.ts:390`; botão em `web/app/(app)/mecanica/page.tsx:316` |
| A15 · colunas coletadas e nunca exibidas | **ABERTO** (parcial) | Fechou só `estoque_itens.custo_unitario_centavos` (`web/app/(app)/mecanica/page.tsx:51-52,150`). Continuam coletados e nunca exibidos: `tanque_movimentos.fornecedor` (coleta `combustivel/page.tsx:207`, grava `enterprise.ts:603`, zero render), `servicos_mecanica.entrada_em` (`mecanica/page.tsx:232` → `enterprise.ts:172`), `envios_cotista.tipo` (`atualizacoes/page.tsx:125` → `enterprise.ts:664`). `envios_cotista.foto_path`, `orcamentos.anexo_path` e `servicos_mecanica.anexo_path` não são nem pedidos |
| A16 · `afazeres.responsavel_id` nunca atribuído | **ABERTO** | Os dois inserts (`web/lib/acoes/enterprise.ts:707-715` e `:754-762`) não passam `responsavel_id`; o único update (`:735-737`) mexe só em `estado`/`concluido_em`. Metade da policy (que agora valida o responsável) segue letra morta |
| A17 · `oportunidades` e `respostas_oportunidade` mortas | **NÃO SE APLICA** | As tabelas **não existem** no banco vivo (`to_regclass` = null nas duas); foram dropadas em `supabase/migrations/046_marketplace_demandas.sql:733-734` |
| A18 · `connect_interesses` e `sondagens` write-only | **FECHADO** (durante esta reauditoria) | Duas telas de admin passaram a ler as tabelas: `web/app/(admin)/admin/connect/page.tsx` e `web/app/(admin)/admin/sondagens/page.tsx`, com porta em `web/app/(admin)/admin/page.tsx:116`. **Resíduo:** a policy viva de `connect_interesses` é `ver pela matriz` (`permissao(embarcacao_id,'embarcacao','ver')`) — a leitura pelo papel Comercial depende da migration `081`, escrita e **não aplicada** |
| A19 · 7 RPCs criadas e nunca chamadas | **FECHADO** (e o achado estava parcialmente errado) | As 5 `admin_metricas_*` **são** chamadas hoje: `web/lib/consultas-admin.ts:89-92,98`. `vagas_fundador_restantes` **não existe** no banco vivo. **Resíduo:** `sondagens_por_celula` existe no banco e não é chamada — com o motivo escrito em `web/app/api/corredores/route.ts:21-25` |
| A20 · regras de planos/promoção/gold só testadas | **ABERTO** | Grep dos 19 identificadores em `web/` fora de `*.test.ts` devolve **só a linha de definição**: `planos.ts:316,339,460,498,514`, `gold.ts:110,121`, `marketplace.ts:369`, `partner.ts:280`, `admin-papeis.ts:118,129`, `carteira.ts:59,112`, `assinatura-ciclo.ts:163`, `captain.ts:74`, `avaliacoes.ts:252,278,385` |

### Tabela B — a tela promete e o back não sustenta

| achado | veredito | prova |
|---|---|---|
| B1 · `/frota` mente sobre a origem do custo | **FECHADO** | `origem`/`origem_id` agora são gravados: `web/lib/acoes/enterprise.ts:141-142` (`lancarCustoComOrigem`), chamado com `"mecanica"` (`:256`), `"estoque"` (`:524`) e `"combustivel"` (`:636`). A tela parou de fingir: `web/app/(app)/frota/page.tsx:79` passa `origem` como `null` (sem `?? "manual"`), com estado vazio em `:120-135` |
| B2 · `/afazeres` rotula tarefa com a unidade errada | **FECHADO**, por caminho diferente | Não virou `.eq()`: virou `.or()` mais mapa de nomes — `web/app/(app)/afazeres/page.tsx:53` e `:62,:90-91` (o nome vem do `embarcacao_id` da própria tarefa) |
| B3 · link de cotista cai em 404 | **FECHADO** | `web/app/convite-cotista/[codigo]/page.tsx` existe (169 linhas), com `info_convite_cotista` em `:71` e o resgate em `:154` |
| B4 · destino da saída de combustível some | **FECHADO** | `web/app/(app)/combustivel/page.tsx:241-244` renderiza o nome da unidade antes de cair em `destino_livre` |
| B5 · `/estoque` não pergunta a unidade | **FECHADO** | Seletor em `web/app/(app)/estoque/page.tsx:120-131` (lido em `web/lib/acoes/enterprise.ts:490-491`) e histórico em `:249-267` |
| B6 · votação nunca fecha; trava do §7 no JSX | **FECHADO** | `encerrarVotacao` (`web/lib/acoes/enterprise.ts:390`) com botão em `web/app/(app)/mecanica/page.tsx:316`; a trava saiu do JSX para `podePublicarParaCotistas` (`web/app/(app)/mecanica/page.tsx:118`) |
| B7 · `/patio` confunde falha de leitura com "não há saída aberta" | **FECHADO** | `web/lib/consultas-patio.ts:32` cria `falhouLeitura`, setado em `:51`; a tela mostra o terceiro estado em `web/app/(app)/patio/page.tsx:144-148` |
| B8 · `saida_estado`/`retorno_estado` não renderizados | **FECHADO** | `web/app/(app)/patio/page.tsx:321-327`. **Resíduo:** o comentário de `:113` continua prometendo "horímetro atual" que o cartão (`:116-130`) não mostra |
| B9 · aviso ao cotista fixo no JSX | **FECHADO** por apagamento | `web/lib/domain/cotista-plano.ts:96-108` — a função foi removida com justificativa ("o retorno era o literal `false`; o teste media a si mesmo") |
| B10 · tela reimplementa regra do domínio | **FECHADO** | `estaSuspenso` + `MENSAGEM_SUSPENSO` em `web/app/(app)/cotistas/page.tsx:197,228`; `estaAberto` em `web/lib/consultas-patio.ts:58-59`; `servicoAberto` em `web/app/(app)/mecanica/page.tsx:171,530,590` |
| B11 · `<Link>` da unidade leva a `/financeiro` genérico | **FECHADO**, por caminho diferente | O `<Link>` virou `<div>` com o motivo escrito (`web/app/(app)/frota/page.tsx:185-196`) e o valor absoluto por unidade passou a aparecer em texto (`:202-204`) |

### Tabela C — rota órfã / caminho sem porta

| achado | veredito | prova |
|---|---|---|
| C1 · `/consultor` órfã | **FECHADO** | Porta em `web/app/(app)/menu/page.tsx:335` (`href="/consultor"`), visível por papel via `meuConsultor` (`:61`) |
| C2 · `/convite-cotista/[codigo]` não existe | **FECHADO** | Mesma prova de B3 |
| C3 · aliases de compatibilidade sem link | **DECISÃO DO DONO** | Registrados com motivo em `web/lib/ui/menu-destinos.test.ts:144-150` (`SEM_PORTA_POR_DECISAO`), com teste que reprova se algum ganhar link (`:387-396`) |
| C4 · `/diario/[id]/horas` só por redirect | **DECISÃO DO DONO** | Declarado como passo de fluxo em `web/lib/ui/menu-destinos.test.ts:172`, coberto por `:372-385` |
| C5 · o teste de órfãs roda na direção contrária | **FECHADO** | `web/lib/ui/menu-destinos.test.ts` agora varre `app/`, `components/` e `lib/` (`:128`), extrai portas e redirects (`:194-209`) e calcula `rotas − alcançáveis` em `:353-364` e `:372-385`, com duas travas anti-apodrecimento em `:387-406` |

---

## 5. `2026-08-19-design-refino.md` — design

35 achados. Todas as contagens abaixo foram **remedidas** na árvore de agora, não
herdadas do relatório.

| achado | veredito | prova (arquivo:linha ou contagem medida agora) |
|---|---|---|
| 1.1 · cartão do Diário gasta 120px | **FECHADO**, por caminho diferente | `web/app/(app)/diario/page.tsx:215-218` (ícone `size-5` no lugar da pastilha de 30px), `:239`/`:261` (`mt-1` no lugar dos dois `mt-2.5`), `:241-257` (`ChipDado`). Conta refeita no próprio arquivo (`:300-317`): **120,5 → 99,15px**. Não foi aos 76px propostos — a alternativa foi medida e descartada em `:319-338` |
| 1.2 · `LinhaLista` sem slot de chip | **FECHADO** | `web/components/ui/linha-lista.tsx:31` e `:45-51` (`chips?: ReactNode`), render em `:85` |
| 1.3 · `/barco` gasta 457px de cabeçalho | **FECHADO** | `SecaoPagina` ganhou `denso`; `web/app/(app)/barco/page.tsx:242,269,315,352,389,426,455,507` usam `denso`, com a conta em `:180-213`; `Abas` importado em `:11` |
| 2.1 · sem `subtitulo` em `Cartao`/`CabecalhoCartao` | **FECHADO** | `web/components/ui/cartao.tsx:24,77` e `web/components/ui/cabecalho-cartao.tsx:37,53`, os dois em `.rotulo-dado` |
| 2.2 · a anatomia da referência existe em 1 tela | **FECHADO** | Recontagem de importadores: `MigalhaPao` **5**, `FaixaKpi` **5**, `BotaoFicha` **5**, `GradeRotuloValor` **2**, `ProgressoRota` **1** (era 0), `Abas` **5** — **5 telas**, não 1. Continuam em 0: `GraficoArea`, `AlternadorVisao`, `ColunaQuadro` |
| 2.3 · `--raio-painel`/`.painel-lustro` sem consumidor | **FECHADO** | `web/components/ui/cartao.tsx:43` (`nivel?: "painel" \| "aninhado"`) e `:53-55`; consumidores em `cartao.tsx:54`, `esqueleto.tsx:72`, `app/page.tsx:172,182,193`; teste em `cartao.test.ts:52-66` |
| 2.4 · três paddings para o mesmo gesto | **FECHADO** | `cartao.tsx:61`, `linha-lista.tsx:106` e `estado-vazio.tsx:62` todos em `p-3`. **Resíduo:** `web/app/(app)/barco/mapa/page.tsx:174,185,217,272` continua com `p-3`/`px-4`/`p-4` na mesma coluna |
| 3.1 · feedback de toque: zero | **FECHADO**, por caminho diferente | `active:` continua **0 em `.tsx`** porque o conserto foi centralizado em `.ts`: `web/lib/ui/acoes.ts:62-63` (`TOQUE`) e `:70-71` (`TOQUE_AMPLO`), com `motion-reduce:`. As duas constantes medem **62 ocorrências em 22 arquivos**, incluindo `bottom-nav.tsx:96` |
| 3.2 · 1 esqueleto para 92 telas | **FECHADO** | **11 `loading.tsx`** (era 1) e `web/components/ui/esqueleto.tsx` com três formas `lista`/`ficha`/`painel` (era 0 componente reutilizável). **Resíduo medido:** rotas fora de `app/(app)` continuam com 0 |
| 3.3 · enviar formulário não muda nada | **FECHADO** | `web/components/ui/botao-enviar.tsx` (`useFormStatus`), com **43 importadores** — incluindo `login/page.tsx:4`, `barco/editar/page.tsx:5`, `financeiro/novo/page.tsx:4` |
| 3.4 · o ponteiro do medidor teleporta | **ABERTO** | `web/components/ui/medidor.tsx:238-246` — a `<line>` do ponteiro segue sem `transition`; grep por `transition\|transform\|rotate` no arquivo devolve **0 linhas** |
| 3.5 · reduced-motion vê bloco parado | **FECHADO**, por caminho diferente | `esqueleto.tsx:121` usa `motion-safe:animate-pulse`, `:99-100` `role="status"`+`aria-busy` e `:136-138` mostra "Carregando…" via `motion-reduce:block` — texto em vez de variação de opacidade, com a alternativa descartada em `:101-116` |
| 4.1 · duas cores de marca na mesma tela | **FECHADO** | `web/lib/mapa/cores-tema.ts` lê `--acao`/`--acao-texto`/`--meter`/`--ok`/`--crit` do documento; `COR_DOURADO` e `#D4AF37`/`#d4af37` em `components/mapa/`: **0 ocorrências** |
| 4.2 · controles do Mapbox a 32px | **FECHADO** pelo caminho A | `web/components/mapa/mapa-nautico.tsx:90-93` força `44px` no botão mantendo o sprite em 32; o fechar do painel de camadas virou `size-11` (`:762`) |
| 4.3 · escala do velocímetro a 9,5px | **FECHADO** pelo caminho B (o que o próprio relatório preferia) | `web/components/mapa/navegar-mapa.tsx:1825` — `max-w-[240px]`: 9,5 × 1,2 = **11,4px** |
| 4.4 · `ProgressoRota` sem ligação | **FECHADO** | `web/components/mapa/navegar-mapa.tsx:14` (import) e `:2061` (uso); a grade 2×2 caiu para dois campos (`:2027`) |
| 4.5 · sair da marina sem destino não limpa a tela | **FECHADO** | `web/components/mapa/navegar-mapa.tsx:1323-1328` — `modoSoNavegacao` entra por marcha sustentada sem exigir destino; `modoNavegando` (`:1286-1291`) continua exigindo |
| 4.6 · números avulsos na moldura do mapa | **ABERTO** (metade) | `web/lib/ui/superficies.ts:279` ainda usa `shadow-lg shadow-accent/30` em vez de `sombra-2`. A outra metade fechou: o `top-44` saiu (`mapa-nautico.tsx:737`) |
| 5.1 · `ACAO_CARTAO` na Início | **FECHADO** | `ACAO_CARTAO` não existe mais em `web/`; `web/app/(app)/hoje/page.tsx:147-152` define `AcaoCartao` sobre `ALVO_ACAO` + `PILULA_ACAO` |
| 5.2 · sete vestidos para "ação secundária" | **FECHADO** (durante esta reauditoria), por caminho oposto ao proposto | `PILULA_ACAO_LARGA` foi **apagada** em vez de ganhar consumidores, com a medição e a régua escritas em `web/lib/ui/acoes.ts:157-185`: as cinco ações que a motivaram são submits e viraram `BotaoEnviar variante="contorno" larguraCheia`, que dá o que a pílula não dava (aviso de envio e bloqueio de duplo toque). **Resíduo:** `diario/page.tsx:292` continua com alvo de 24px (`min-h-6`) |
| 5.3 · `.valor` com zero usos | **FECHADO** | `.valor`/`.valor-forte`/`.valor-instrumento` em `globals.css:428-437`; **40 usos em className, em 22 arquivos** (era 0); `text-sm` caiu de 222 para **168**. **Resíduo:** `text-[22px]` em `card-embarcacao.tsx:133` |
| 5.4 · cinco alturas de gráfico | **FECHADO** | `grafico-barras.tsx:33` = `h-[140px] sm:h-[200px]`, idêntico a `grafico-area.tsx:58`; 72px e 110px ficaram declarados como contexto compacto (`grafico-barras.tsx:56`) |
| 5.5 · gráfico nasce com a cor errada | **FECHADO** | `grafico-barras.tsx:30` e `grafico-area.tsx:57` = `var(--dado)` |
| 5.6 · rótulo do eixo X a 10px | **FECHADO** | `grafico-barras.tsx:129` = `text-[11px]`, registro em `:118-119` |
| 5.7 · contagem escrita de três jeitos | **ABERTO** | As três formas continuam: chip, `rótulo: valor` (`faixa-kpi.tsx:51-57`) e número mono solto (`notificacoes/page.tsx:132`, `barco/mapa/page.tsx:280` — este com comentário em `:276-279` dizendo por escrito que a correção "é outra onda") |
| 5.8 · divergências de documentação | **ABERTO** | As três seguem vivas — `globals.css:3-4` × `app/layout.tsx:92`; `lib/ui/largura.ts:15` ainda cita IBM Plex Sans; `navegar-mapa.tsx:315-316` ainda afirma que `text-accent` não troca entre temas — e nasceu uma quarta: `globals.css:569-572` diz 32px onde `mapa-nautico.tsx:91` já põe 44 |
| 5.9 · raio: 86% escrito à mão | **ABERTO** (melhorou, não fechou) | **878** usos de `rounded-*`; **464 (52,8%) via token** (era 13,8%). As três trocas mecânicas não foram feitas: `rounded-[14px]` **115**, `rounded-full` **116**, `rounded-lg` **86**; `rounded-xl` (12px, token nenhum) **56**; `rounded-[10px]` **20**. Raios distintos em uso: **12** |
| 5.10 · nove alturas de alvo, sem token | **FECHADO** | `globals.css:71-72` — `--altura-controle: 44px` e `--altura-campo: 48px`; `lib/ui/form.ts:38` usa `min-h-[var(--altura-campo)]` (conta em `:8-36`); os dois tokens medem **71 ocorrências em 32 arquivos**. **Resíduo:** `diario/page.tsx:292` segue `min-h-6` |
| 5.11 · `mt-5` × 61 | **ABERTO** | **46 usos em 39 arquivos** hoje. 20px continua fora da escala de `docs/DESIGN.md:98` e não há decisão registrada que o adote |
| 5.12 · `tracking-[…]` com 11 valores | **ABERTO** | **31 usos** (era 47) e **ainda 11 valores distintos**, incluindo o `.28em` de `components/logo.tsx` |
| 5.13 · teto de cor com buraco de `rgb()` | **FECHADO** | `web/lib/ui/tokens.test.ts:139` — o regex agora é `/#[0-9a-fA-F]{3,8}\b\|rgba?\(/g`; `TETO_POR_ARQUIVO` (`:48-82`) tem 12 entradas somando **57** (era 24 somando 91) |
| 6.1 · oito rótulos para "abrir a seção" | **FECHADO** | Sobraram **4** rótulos em slot de ação: "Ver tudo" (padrão, 8 usos), "Gerenciar", "Completar" e "Completar em Embarcação", com as exceções declaradas em `hoje/page.tsx:142-145` |
| 6.2 · "Completar" é um `<span>` que não se toca | **FECHADO** pela segunda via do relatório | `web/app/(app)/barco/documentos/page.tsx:224` — virou `<Selo estado="neutro">Incompleto</Selo>`; o gêmeo em `barco/equipamento/[id]/page.tsx:444` traz o mesmo registro |
| 6.3 · o estado vazio é o acerto do app | **FECHADO** | `EstadoVazio`: **172 ocorrências em 70 arquivos** (era 81 em 57). A varredura de copy dos textos continua **não medida** — nem lá nem aqui |
| 6.4 · os primeiros 5 segundos | **FECHADO** | A foto de 176px só existe em `forma="painel"` (`esqueleto.tsx:270-273`), usada apenas em `hoje/loading.tsx:13` e `barco/loading.tsx:25`; as outras 9 rotas usam `lista` ou `ficha` |

---

## O QUE AINDA ESTÁ ABERTO

Os 19 achados abertos, em ordem de custo para o produto, cada um com o conserto concreto.
Dois avisos de contagem, para a lista bater com as tabelas: o **item 8 não é um dos 19** —
é um erro de documentação que apareceu durante a verificação do P2-1 e mora na mesma seção
da doc, por isso está aqui; e o **item 19 junta dois achados** de uma linha cada.

**Quatro dos itens abaixo já têm o conserto ESCRITO no repositório e NÃO APLICADO.** As
migrations `078_gold_pagamentos_insert_travado.sql`, `079_assinaturas_posse_do_id_asaas.sql`,
`081_connect_interesses_comercial_le.sql` e o arquivo `INDICES-2026-08-19.sql` existem em
`supabase/migrations/` e o banco vivo não os tem — reverificado ao fim desta reauditoria: as
duas policies seguem palavra por palavra como estavam, e 0 dos 15 índices existe. Aqui o que
falta não é decidir nem escrever: é rodar.

### Grupo 1 — cai antes de a chave do Asaas ser ligada (2)

**1. A-10 · qualquer um pode reivindicar o `asaas_subscription_id` de outro — e isso
precisa cair ANTES de a chave do Asaas ser ligada.**
Policy viva `assinatura: criar a propria pendente` = `usuario_id = auth.uid() AND status='pendente'`,
sem nenhuma amarra ao ID do gateway. Com a chave ligada, `/menu/assinatura` (`page.tsx:186-189`)
repassa esse ID para `listarCobrancas`/`proximaCobrancaAsaas` e desenha valores, datas e
`invoiceUrl` de assinatura alheia. Hoje é inofensivo porque há 0 assinaturas; depois de
ligar, é vazamento de fatura de cliente.
*Conserto:* trocar o `WITH CHECK` para exigir `asaas_subscription_id IS NULL` no INSERT
(o ID passa a ser escrito só pelo service role, que é quem o conhece), ou mover a criação
inteira da linha para a action com `SUPABASE_SERVICE_ROLE_KEY`.

**2. A-09 · o solicitante do Gold consegue gravar o próprio pagamento como `pago`.**
Policy viva `gold_pagamentos: criar` não menciona `status` nem `valor_centavos`; não há
trigger na tabela e os únicos `CHECK` limitam o domínio do enum, não o valor do INSERT.
Não libera acesso (o avanço passa pela RPC), mas polui o financeiro e a tela do admin com
pagamentos que nunca existiram.
*Conserto:* acrescentar `AND status = 'pendente' AND valor_centavos = (select preco from gold_precos …)`
ao `WITH CHECK`, exatamente como `assinaturas` já faz com `status='pendente'`.

### Grupo 2 — pontas do produto (5)

**3. A2 · `bases_operacionais` continua sem uma única linha de código.**
Zero ocorrências de `bases_operacionais`/`base_id` em todo `web/`; a tabela existe e tem 0
linhas. Uma administradora com marina e garagem náutica joga estoque e tanque no mesmo pote.
*Conserto:* seletor de base em `/estoque` e `/combustivel` gravando `estoque_itens.base_id`
e `tanques.base_id`, e o "Precisa repor" agrupado por base.

**4. A16 · `afazeres.responsavel_id` nunca é atribuído.**
Os dois inserts (`web/lib/acoes/enterprise.ts:707-715` e `:754-762`) não passam o campo, e o
único update (`:735-737`) mexe só em `estado`/`concluido_em`. A policy de INSERT agora
**valida** o responsável (vínculo não suspenso) — validação de um campo que ninguém envia.
*Conserto:* um seletor "de quem é" no formulário de `/afazeres` e o campo nos dois inserts.

**5. A15 · três colunas continuam sendo pedidas à pessoa e nunca mostradas.**
`tanque_movimentos.fornecedor` (coleta `combustivel/page.tsx:207` → grava `enterprise.ts:603`
→ zero render), `servicos_mecanica.entrada_em` (`mecanica/page.tsx:232` → `enterprise.ts:172`),
`envios_cotista.tipo` (`atualizacoes/page.tsx:125` → `enterprise.ts:664`). E
`envios_cotista.foto_path`, `orcamentos.anexo_path` e `servicos_mecanica.anexo_path` não são
nem pedidos.
*Conserto:* renderizar as três nos históricos correspondentes — ou parar de pedi-las.

**6. A6 · o pátio não tira as fotos que o §6 pede.**
`web/lib/db/types.ts:505,511,516-518` declaram `saida_foto_path`, `retorno_foto_path`,
`aprovado`, `aprovado_por`, `aprovado_em`; os dois writes (`web/lib/acoes/patio.ts:47-53`
e `:101-110`) não escrevem nenhuma.
*Conserto:* campo de foto no check-out e no check-in de `web/app/(app)/patio/page.tsx`,
no mesmo padrão de upload de `barco/equipamento/[id]/page.tsx:107`.

**7. A20 · o desconto guardado no banco nunca vira preço na tela.**
Grep dos 19 identificadores fora de `*.test.ts` devolve só a linha de definição
(`planos.ts:316,339,460,498,514`, `gold.ts:110,121`, e os demais).
`assinatura_promocoes` **é** consultada (`web/lib/consultas.ts:260`), mas `escolherPromocao`,
`precoGoldComDesconto` e `validadeDaPromocao` nunca rodam.
*Conserto:* chamar as três no ponto em que a promoção já é lida; para o resto da lista,
decidir entre dar consumidor ou apagar — como foi feito em A8 e B9.

### Grupo 3 — banco, e uma linha de documentação (6)

**8. `docs/OPERACAO.md:82` afirma que `Confirm email` está desligado. Está ligado.**
Medido: 4 usuários têm `confirmation_sent_at` e os 4 confirmaram *depois* do envio. Não é um
dos 112 achados — apareceu na verificação do P2-1 e vale corrigir junto, porque é a última
linha errada daquela seção: A-11 e A-13, vizinhas dela, foram corrigidas hoje.

**9. A-12 · duas definições da máquina de estados do Gold.**
`gold_transicao_valida` (banco) não permite `aguardando_pagamento → aguardando_agendamento`;
`web/app/api/asaas/webhook/route.ts:329-331` continua saltando. O desvio agora está
documentado em `:277-287`, o que baixa o risco mas não elimina a divergência.
*Conserto:* ou a RPC passa a aceitar o salto, ou o webhook passa por `pago` antes.

**10. P2-4 · 0 de 15 FK "quentes" têm índice.** Verificado coluna a coluna, duas vezes.
*Conserto:* rodar `supabase/migrations/INDICES-2026-08-19.sql`, que já está escrito —
`create index concurrently` não roda dentro de transação.

**11. P2-2 · 24 policies ainda reavaliam `auth.uid()` por linha** (eram 32).
*Conserto:* trocar `auth.uid()` por `(select auth.uid())` nas restantes — as de
`bases_operacionais`, `estoque_itens` e os SELECT de `estoque_movimentos`/`tanque_movimentos`.

**12. P2-3 · 18 policies `FOR ALL` continuam casando junto com as de SELECT.**
*Conserto:* trocar cada `FOR ALL` por `INSERT`/`UPDATE`/`DELETE` explícitos e deixar o
`SELECT` sozinho.

**13. P2-5 · `Afazer`, `Tanque`, `EstoqueItem`, `Orcamento` e `Votacao` continuam fora de
`web/lib/db/types.ts`** (só `AsaasEvento` e `ResultadoEventoAsaas` entraram, `:1011,1033`) —
reverificado ao fim, com `types.ts` já modificado pela frente de produto.
*Conserto:* mover as declarações inline das páginas para `types.ts`.

### Grupo 4 — design (7)

**14. Design 5.9 · o commit mecânico de raio não entrou.** 878 usos, 52,8% via token (era
13,8%). Faltam as três substituições de valor idêntico: `rounded-[14px]` (115),
`rounded-full` (116), `rounded-lg` (86). *Conserto:* o commit que não muda um pixel,
sozinho, como o relatório pediu — e depois decidir `rounded-xl` (56) e `rounded-[10px]` (20)
entre controle (8) e cartão (14).

**15. Design 5.11 · 46 `mt-5`** (eram 61) fora da escala de `docs/DESIGN.md:98`.
*Conserto:* `mt-6`, ou declarar 20px como degrau. Hoje não é nenhum dos dois.

**16. Design 5.12 · 31 `tracking-[…]` com 11 valores distintos** (eram 47 com 11).
*Conserto:* virar `.rotulo`/`.rotulo-dado`, começando pelo `.28em` de `components/logo.tsx`.

**17. Design 5.8 · quatro comentários que descrevem um app que não existe mais.**
`globals.css:3-4` (diz que o claro é o padrão; `app/layout.tsx:92` põe escuro),
`lib/ui/largura.ts:15` (cita IBM Plex Sans; a fonte é Inter),
`navegar-mapa.tsx:315-316` (diz que `text-accent` não troca entre temas; troca), e a nova
`globals.css:569-572` (diz 32px onde `mapa-nautico.tsx:91` já põe 44).

**18. Design 5.7 · a contagem ainda tem três formas.** Os dois números mono soltos
(`notificacoes/page.tsx:132`, `barco/mapa/page.tsx:280`) viram `Chip contagem`.

**19. Design 3.4 e 4.6 · dois acabamentos de uma linha cada.** O ponteiro de
`medidor.tsx:238-246` sem `transition`, e `superficies.ts:279` com `shadow-lg shadow-accent/30`
no lugar de `sombra-2`.

### Resíduos de achados FECHADOS

Não contam como achados abertos — são sobras nomeadas de itens que fecharam:

- **P1-6** — `convites_cotista.expira_em` não foi criada: o link de cotista não expira.
- **A18** — as duas telas de admin existem, mas a policy viva de `connect_interesses` é
  `ver pela matriz`; a leitura pelo papel Comercial depende da migration `081`, escrita e
  não aplicada.
- **5.2** — `diario/page.tsx:292` continua com alvo de toque de 24px (`min-h-6`), abaixo da
  régua de 44 — é o mesmo ponto do resíduo de 5.10.
- **A5** — o insert de `abastecimentos` (`enterprise.ts:620-626`) segue sem `horas`, `posto`
  e `comprovante_path`.
- **A12** — `faltaNoCadastro` (`lib/domain/cotistas.ts:197`) ainda só tem consumidor de teste.
- **A19** — `sondagens_por_celula` existe no banco e não é chamada (motivo escrito em
  `app/api/corredores/route.ts:21-25`).
- **B8** — o comentário de `patio/page.tsx:113` promete "horímetro atual" que o cartão não mostra.
- **2.4** — `barco/mapa/page.tsx:174,185,217,272` ainda tem três paddings na mesma coluna.
- **3.2** — as rotas fora de `app/(app)` continuam com 0 `loading.tsx`.
- **5.3** — `text-[22px]` em `card-embarcacao.tsx:133`.
- **5.10** — `min-h-6` em `diario/page.tsx:292` (o mesmo ponto do item 25).

---

## DECISÕES DO DONO

Nada aqui é bug, e nada aqui se resolve por commit. Está em ordem de bloqueio.

**1. Site URL e Redirect URLs do Supabase** (achado P0-1 de identidade).
Painel → Authentication → URL Configuration. O código já manda `emailRedirectTo` explícito
(`web/lib/acoes/auth.ts:88`), mas **o GoTrue descarta em silêncio** qualquer destino que não
esteja na allowlist e volta para o Site URL. Sem este passo, a correção de código não faz
efeito e nada indica o motivo. Roteiro pronto em
`docs/auditoria/2026-08-19-o-que-depende-do-dono.md:21-47`. **Não verificado** — o MCP não
lê a configuração de Auth.

**2. Qual é o domínio definitivo** (achado P2-14).
`web/.env.example:18` e `docs/OPERACAO.md:5,28,45,79` prometem `commander.soumardivers.com`;
a produção roda em `commander-tau.vercel.app`. Enquanto os dois convivem, o Site URL, o
webhook do Asaas e o `.env` vão continuar divergindo. Decidir **antes** do item 1, porque
trocar depois quebra os links que estiverem em caixas de entrada.

**3. As três variáveis do Asaas, na ordem** (achados A-01 e A-03).
`ASAAS_WEBHOOK_TOKEN` primeiro, webhook cadastrado no painel, depois `ASAAS_AMBIENTE`, e
`ASAAS_API_KEY` por último. Ligar fora de ordem produz o pior caso: cliente paga e não
recebe acesso. **Não verificado diretamente** (sem acesso à Vercel nesta sessão); o lote de
SQL escrito hoje afirma que o token ainda não existe em produção. Antes de ligar, fechar os
itens 3 e 4 da lista de abertos (`assinaturas` e `gold_pagamentos`).

**4. Desligar o Boleto na conta Asaas** (achado A-14). A API não aceita lista parcial de
meios; só o painel resolve. Pendência registrada em `docs/OPERACAO.md:83-95`.

**5. SMTP próprio** (achado P1-9). O serviço embutido do Supabase é declaradamente de
desenvolvimento. Hoje entrega porque o volume é de um cadastro a cada dois dias.

**6. Proteção contra senha vazada** (parte do achado P2-1 de banco). Continua listada como
WARN nos advisors de hoje. É um toggle, sem contraindicação.

**7. Migration 072 — PROP nunca fica suspenso.** O arquivo existe
(`supabase/migrations/072_decisao_vinculos_prop_nao_suspende.sql`) e **não foi aplicada** —
a constraint não existe no banco. Não é omissão: o próprio cabeçalho diz "PRECISA DE DECISÃO
DO DONO". E a violação é hoje inalcançável: a única policy de UPDATE de `vinculos`
(`vinculos: prop atualiza quem nao e dono`) carrega `papel <> 'PROP'` no `USING` e no
`WITH CHECK`, então nem um PROP suspende a si mesmo. É cinto sobre suspensório.

**8. Migration 073 — apagar um perfil deixar de apagar a base operacional.** Mesmo caso:
arquivo escrito, não aplicado, cabeçalho pedindo decisão. A FK
`bases_operacionais_dono_id_fkey` continua `ON DELETE CASCADE` (verificado). Depende de
decidir o fluxo de exclusão de conta.

**9. Definir a cota das embarcações.** Nenhuma das 9 embarcações tem `cotas_total > 0`
(medido). O link de cotista agora existe e funciona, e vai responder "sem vaga" — **corretamente** —
até o ADM definir a cota em `/cotistas`. Não é bug; é um passo de operação que ninguém deu.

**10. Contadores de publicidade e visualização** (ressalva do achado P2-1).
`registrar_visualizacao` é `update parceiros set visualizacoes = visualizacoes + 1`, sem
nenhuma trava; `publicidade_registrar_clique` só checa vigência. Qualquer logado infla em
laço. Só vira problema **se** esses números virarem base de cobrança — e essa é a decisão.
A migration `080_publicidade_contadores_por_janela.sql` já está escrita para o caso de a
resposta ser "sim"; **não foi aplicada**, e não deve ser antes da decisão.

**11. Aliases de compatibilidade e `/diario/[id]/horas`** (achados C3 e C4). Ficam sem porta
de propósito, e agora com o motivo declarado e protegido por teste
(`web/lib/ui/menu-destinos.test.ts:144-150,172`).

---

## O QUE NÃO FOI VERIFICADO

Registrado para não virar conclusão por omissão:

- **Configuração do painel do Supabase Auth** (Site URL, Redirect URLs, SMTP, tetos de
  e-mail) — o MCP não a expõe. Vale para P0-1 e P1-9.
- **Variáveis de ambiente da Vercel** — sem acesso ao projeto nesta sessão. Vale para A-01 e
  A-03; a única evidência é o que o lote de SQL de hoje afirma.
- **Conta Asaas** (existência, aprovação, Boleto/Pix) — fora do escopo de leitura de código
  e banco. Vale para A-14.
- **Runtime.** Nenhum servidor foi levantado, nenhuma tela foi aberta em navegador. Todas as
  medidas de design são literais de código ou contagem de varredura, como no relatório
  original. Os fluxos de cobrança e de cotista nunca rodaram com dado real: 0 assinaturas,
  0 eventos em `asaas_eventos`, 0 cotistas, e nenhum cadastro novo desde 03:53 de hoje —
  ou seja, **antes** das correções.
- **A varredura de copy dos 172 `EstadoVazio`** (achado 6.3, segunda metade) — não medida no
  relatório original nem aqui.

---

*Reauditoria só-leitura, 19/08/2026. Nenhum arquivo de aplicação alterado, nenhuma migration
rodada, nenhuma escrita no banco. Policies, funções, constraints e índices lidos da definição
viva de `khgjtxvmduizyooqaoox`, não dos arquivos de migration — que continuam divergindo do
remoto (a tabela `supabase_migrations.schema_migrations` para em `cotista_envios_e_afazeres`,
enquanto o banco já tem os objetos das migrations 067 a 077, aplicadas por SQL direto).*
