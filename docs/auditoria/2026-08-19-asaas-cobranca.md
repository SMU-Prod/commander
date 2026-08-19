# Auditoria da cadeia de cobrança (Asaas) — 19/08/2026

Escopo: `/assinar`, `lib/acoes/assinatura.ts`, `lib/asaas.ts`, `app/api/asaas/webhook/route.ts`,
o fluxo pago do Commander Gold, a máquina de estados da assinatura e as policies REAIS do banco
remoto (`khgjtxvmduizyooqaoox`, lidas via MCP — não pelos arquivos de migration).

Auditoria só-leitura. Nenhum arquivo de aplicação alterado, nenhuma migration rodada, nada tocado
na conta Asaas, nenhuma variável de ambiente mexida.

---

## Veredito

**Não. Hoje é impossível alguém pagar pelo Commander, e a tela não admite isso.** O projeto
`smu-prods-projects/commander` não tem nenhuma das três variáveis que a cobrança exige
(`ASAAS_API_KEY`, `ASAAS_AMBIENTE`, `ASAAS_WEBHOOK_TOKEN`), então `lib/asaas.ts:15-16` estoura
antes de qualquer chamada de rede e o webhook devolve 401 em 100% dos eventos
(`app/api/asaas/webhook/route.ts:36-39`). Isso, sozinho, já seria só um "ainda não ligamos" —
o problema é que `/assinar` **não sabe disso**: ela desenha o botão "Continuar para o pagamento",
pede nome e CPF, e devolve *"Não foi possível falar com o sistema de pagamento. Tente de novo em
instantes."* (`lib/acoes/assinatura.ts:104`) — uma frase que promete que a próxima tentativa pode
dar certo, quando nenhuma vai. O fluxo do Commander Gold, que tem o gate honesto ("a contratação
abre em breve", `lib/acoes/gold.ts:169-183`), **também está morto, e por um motivo que não tem
nada a ver com o Asaas**: `criarSolicitacaoGold` chama a RPC `gold_definir_estado` com a sessão do
usuário, e a RPC no banco exige `tem_papel_admin('suporte')` para o estado `aguardando_pagamento`
— ou seja, todo pedido de Gold de cliente comum trava em `solicitado` e nunca chega à tela de
pagamento. Medido no banco: **0 assinaturas, 0 pagamentos Gold, 0 concessões, 6 usuários** — o
Commander nunca faturou um centavo, e nada na cadeia atual permitiria que faturasse. A notícia boa
é que o lado da *segurança* está fechado: um usuário comum **não consegue** se dar acesso pago
escrevendo no próprio registro (ver achado A-09), e o webhook falha fechado.

---

## Achados

| # | Sev | O que é | Arquivo:linha | Efeito real |
|---|-----|---------|---------------|-------------|
| A-01 | **P0** | Nenhuma variável do Asaas existe em produção. `asaas()` lança `AsaasError` antes de qualquer fetch. | `web/lib/asaas.ts:15-16` | Dinheiro não entra. Toda ação de cobrança (assinar, trocar plano, cancelar no gateway, Gold) falha na primeira linha. |
| A-02 | **P0** | `/assinar` não consulta `asaasConfigurado()`. O botão de pagamento aparece sempre que existe plano cobrável no catálogo. | `web/app/(assinatura)/assinar/page.tsx:264-281` (`primeiroContratavel`) | A pessoa preenche nome + CPF, clica, e cai no erro genérico de `assinatura.ts:104` renderizado em `page.tsx:149`. Loop infinito de "tente de novo". É o oposto do gate honesto que o Gold já tem em `lib/acoes/gold.ts:169-183`. |
| A-03 | **P0** | Webhook responde 401 a todo evento enquanto `ASAAS_WEBHOOK_TOKEN` não existir. | `web/app/api/asaas/webhook/route.ts:36-39` | Mesmo que só a `ASAAS_API_KEY` fosse ligada, o cliente pagaria e a assinatura ficaria eternamente em `pendente` → `acessoPago: false` (`assinatura-ciclo.ts:102-107`). **Dinheiro entra e acesso não sai.** Ligar as chaves fora de ordem é pior que não ligar nada. |
| A-04 | **P0** | `criarSolicitacaoGold` chama `gold_definir_estado(..., 'aguardando_pagamento')` com a sessão do usuário; a RPC no banco cai no `else` e exige `tem_papel_admin('suporte')`. | `web/lib/acoes/gold.ts:89-92` e `124-127`; RPC `gold_definir_estado` (banco remoto) | Todo pedido de Gold de cliente comum grava a linha e para em `estado='solicitado'`, com a mensagem "Pedido registrado, mas não foi possível avançar pro pagamento. Recarregue e tente de novo." Recarregar nunca resolve — é muro de permissão, não erro transitório. Depois disso `iniciarPagamentoGold` barra em `gold.ts:149-151`. **Independe do Asaas: mesmo com a chave ligada, o Gold continua invendável.** |
| A-05 | **P1** | `STATUS_POR_EVENTO` não trata estorno nem chargeback. Só `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE` e `SUBSCRIPTION_DELETED`. | `web/app/api/asaas/webhook/route.ts:24-28` e `73-75` | `PAYMENT_REFUNDED`, `PAYMENT_CHARGEBACK_REQUESTED` e `PAYMENT_DELETED` caem no `ignorado` (200, sem efeito). Cliente paga, ganha acesso, pede estorno/contestação — e **continua com acesso pago** até um `OVERDUE` de ciclo futuro. A tela de faturas já traduz esses status (`menu/assinatura/page.tsx:44-53`), então o app *mostra* o chargeback e *não age* sobre ele. |
| A-06 | **P1** | Webhook não tem carimbo de ordem nem de idempotência por evento — aplica o último que chegar. | `web/app/api/asaas/webhook/route.ts:78-83` | O Asaas reenvia eventos. Um `PAYMENT_OVERDUE` reentregue depois de um `PAYMENT_CONFIRMED` derruba a assinatura para `problema_pagamento`, e a tela passa a gritar "Houve um problema com o pagamento" para quem está em dia. Não bloqueia (tolerância mantém `acessoPago: true`), mas é o estado local divergindo do Asaas na cara do cliente. Atenuante real: duplicata do MESMO evento é inofensiva — o trigger `assinaturas_touch` só carimba `problema_desde` na TRANSIÇÃO para `problema_pagamento`, então reentrega não reinicia o relógio da tolerância. |
| A-07 | **P1** | Pagamento confirmado para assinatura que o banco não conhece devolve `200 {atualizadas: 0}`. | `web/app/api/asaas/webhook/route.ts:84-87` | O Asaas considera entregue e nunca retenta. Se a gravação em `assinaturas` falhou mas o rollback best-effort (`assinatura.ts:120`, `.catch(() => {})`) não conseguiu cancelar lá fora, o cliente é cobrado e ninguém fica sabendo. Não há tabela de eventos do webhook no banco (conferido) — não existe trilha para reconstruir o que se perdeu. |
| A-08 | **P1** | O `catch` que engole a falha do Asaas não registra nada: sem `console.error`, sem Sentry. | `web/lib/acoes/assinatura.ts:101-105` | O dono não tem como saber que gente tentou assinar e apanhou. Hoje isso significa que a evidência do A-02 é invisível: cada tentativa frustrada some sem deixar rastro. |
| A-09 | **P1** | Policy de INSERT de `gold_pagamentos` não restringe `status` nem `valor_centavos`. | Policy `gold_pagamentos: criar` (banco remoto) | O próprio solicitante consegue inserir uma linha de pagamento sua com `status='pago'` e valor arbitrário. **Não libera nada** (o avanço de estado passa pela RPC, que exige Suporte — ver A-04), mas polui o financeiro e a tela do admin com pagamentos que nunca existiram. Comparar com `assinaturas`, que faz certo: o INSERT é travado em `status='pendente'`. |
| A-10 | **P1** | Policy de INSERT de `assinaturas` não valida que `asaas_subscription_id` pertence a quem escreve. | Policy `assinatura: criar a propria pendente` (banco remoto) | O usuário pode gravar um ID de assinatura do Asaas que não é dele; `/menu/assinatura` então repassa esse ID para `listarCobrancas`/`proximaCobrancaAsaas` (`page.tsx:186-189`) usando a chave da conta e exibe valores, datas e `invoiceUrl` de uma assinatura alheia. Mitigado por `assinaturas_asaas_subscription_id_key` (UNIQUE): IDs de assinantes reais já estão na tabela e não podem ser reivindicados. Sobra a janela de assinaturas existentes no Asaas e ausentes no banco. Só passa a valer quando a chave for ligada. |
| A-11 | **P2** | `NEXT_PUBLIC_COBRANCA_ATIVA` é código morto — o gate global saiu na onda 47 — mas continua documentada como passo obrigatório. | `web/app/(app)/layout.tsx:13-31` (morta) vs. `docs/OPERACAO.md:22-23,68-72` e `web/.env.example:46-49` | O roteiro de deploy manda ligar uma flag que não faz nada. Quem seguir a doc vai achar que ligou a cobrança. |
| A-12 | **P2** | O webhook do Gold salta `aguardando_pagamento → aguardando_agendamento`, transição que a própria `gold_transicao_valida` considera inválida. | `web/app/api/asaas/webhook/route.ts:112-117` vs. RPC `gold_transicao_valida` (banco) | Funciona (service role passa por cima da RPC de propósito, e o comentário assume o salto), mas existem duas definições diferentes da mesma máquina de estados. A próxima pessoa a mexer vai acreditar na errada. |
| A-13 | **P2** | Doc afirma que `premium_concessoes` não libera nada; o banco já lê a tabela. | `docs/OPERACAO.md:183-185` vs. função `plano_do_usuario` (banco) | `plano_do_usuario` faz fallback para `premium_concessoes.plano_concedido` (default `'commander'`), e `carregarAssinatura` idem (`lib/consultas.ts:258-284`). A aprovação do Gold **já concede Commander** pela validade do selo. A doc está atrasada em relação ao banco. |
| A-14 | **P2** | Boleto provavelmente segue habilitado na conta Asaas. | `docs/OPERACAO.md:83-99` | `billingType: "UNDEFINED"` oferece tudo que estiver ligado na conta. Se o Boleto não for desligado no painel, ele aparece para o assinante mesmo com a espec pedindo só cartão + Pix. **Não verificado** — exige acesso à conta do dono. |
| A-15 | **P2** | Não existe registro de eventos do webhook no banco. | conferido: nenhuma tabela `*webhook*`/`*asaas*` em `public` | Sem histórico de eventos, qualquer divergência futura entre Asaas e Commander vira investigação manual no painel do gateway. |

**Contagem: 4 P0 · 6 P1 · 5 P2.**

---

## O que acontece hoje, passo a passo, quando alguém clica em "assinar"

1. `/assinar` carrega normalmente. Logado, a aba certa é deduzida (`carregarTrilha`), os planos
   aparecem com preço real vindo de `PLANOS` — Commander R$ 49,90, Commander Pro R$ 69,90.
   Nenhuma promoção vigente (0 linhas em `assinatura_promocoes`).
2. Como existe plano cobrável, `primeiroContratavel` é verdade e a tela renderiza os campos de
   nome/CPF e o botão **"Continuar para o pagamento"**, mais o texto *"Cartão ou Pix, direto na
   página segura do Asaas"* (`page.tsx:264-284`). Nada nesta tela consulta `asaasConfigurado()`.
3. A pessoa preenche e envia. A action `assinar` valida plano, nome e CPF, confirma que não há
   assinatura viva (não há: 0 linhas), calcula R$ 49,90 e chama `criarClienteAsaas`.
4. `asaas()` lê `process.env.ASAAS_API_KEY`, não encontra, e lança `AsaasError` **antes de abrir
   qualquer conexão** (`lib/asaas.ts:15-16`) — falha instantânea, sem timeout.
5. O `catch` de `assinatura.ts:101-105` vê que não é `AsaasRecusa` e chama
   `erroAssinar("Não foi possível falar com o sistema de pagamento. Tente de novo em instantes.")`,
   que redireciona para `/assinar?erro=…`.
6. A tela repinta com a tarja vermelha (`page.tsx:149`). Nada foi gravado, nada foi logado,
   e o texto convida explicitamente a tentar de novo.

**Resumo:** não é uma tela honesta de "em breve" nem um botão inerte — é um erro que mente sobre a
própria natureza. E como o Gold, que tem o texto honesto pronto, está bloqueado por outro motivo
(A-04), hoje **nenhum dos dois caminhos pagos do produto funciona**.

---

## O webhook

**Autenticidade: correta e falha fechada.** `route.ts:36-39` compara o header `asaas-access-token`
com `ASAAS_WEBHOOK_TOKEN` e — o detalhe que importa — recusa também quando o segredo **não está
configurado** (`!segredo`). Um atacante que descubra
`https://commander-tau.vercel.app/api/asaas/webhook` leva 401 e **não consegue ativar assinatura de
graça**. Não há caminho alternativo: a rota só aceita POST, o cliente admin só é construído depois
do gate, e o corpo só é lido depois. A comparação é `!==` simples (não é time-safe), mas com um
segredo longo e aleatório isso não é explorável na prática pela rede.

**Idempotência: parcial, por sorte da modelagem mais que por desenho.**
- Evento repetido: `UPDATE ... SET status='ativa'` aplicado duas vezes dá no mesmo. `problema_desde`
  não é reiniciado por duplicata, porque `assinaturas_touch` só carimba na transição de entrada.
  O Gold é explicitamente protegido com `.neq("status", "pago")` (`route.ts:106`).
- Evento desconhecido: devolve `200 {ok, ignorado}` — certo, senão o Asaas retentaria para sempre.
- Evento **fora de ordem**: sem proteção (A-06). Não existe comparação de data/sequência.
- Evento para assinatura inexistente: `200 {atualizadas: 0}` e silêncio (A-07).
- `cancelada` é terminal (`.neq("status","cancelada")`, `route.ts:82`) — um `PAYMENT_CONFIRMED`
  atrasado não ressuscita assinatura cancelada. Correto e bem pensado.

---

## Máquina de estados e onde o local diverge do Asaas

`avaliarCiclo` (`lib/domain/assinatura-ciclo.ts:99-146`) é regra pura e está bem construída:
`pendente` → aguardando; `ativa` → liberado; `problema_pagamento` → tolerância (configurável em
`assinatura_parametros`, com fallback 7 dias) e só depois bloqueio; `cancelada` → volta ao Free
sem apagar nada. Na dúvida (`problema_desde` nulo) o erro é a favor de quem paga.

Os pontos de divergência real com o gateway:

- **Estorno e chargeback** (A-05): o Asaas sabe que o dinheiro voltou; o Commander continua
  mostrando "Ativa".
- **Reentrega fora de ordem** (A-06): o Commander mostra "Problema de pagamento" para quem está
  em dia.
- **`trocarPlano`** (`lib/acoes/assinatura.ts:200-249`): atualiza o Asaas primeiro e o banco
  depois, via chave de serviço. Se a segunda escrita falhar, a tela **diz a verdade** ("A cobrança
  foi atualizada, mas o app não conseguiu registrar o plano novo") em vez de esconder — decisão
  certa. `SUPABASE_SERVICE_ROLE_KEY` existe em produção, então o caminho degradado
  (`servico` nulo) não está ativo hoje.
- **Upgrade mensal→anual não existe mais**: `proximoUpgrade` (`planos.ts:369-380`) é upgrade de
  VALOR (Free → Commander → Commander Pro), e todos os planos cobráveis são `MONTHLY`. Não há
  plano anual no catálogo — a tela de assinatura tem o ramo `YEARLY` (`page.tsx:288`) como código
  morto defensivo.
- **Downgrade Pro → Commander**: não apaga barco; `dividirEmbarcacoesPorPlano` bloqueia o
  excedente e pede escolha da ativa. Consistente com o §23.
- **Gold avulso**: pagamento único, sem status de inadimplência para espelhar. Hoje inalcançável
  (A-04).

Quando diverge, a tela é razoavelmente honesta: sem chave configurada, `/menu/assinatura:296-302`
avisa que "o ambiente de pagamento não está configurado agora" — mas esse aviso só aparece para
quem **já tem assinatura viva**, e não há nenhuma assinatura no banco. Na prática, ninguém nunca
viu essa mensagem.

---

## Banco e RLS (lidos do banco remoto, não das migrations)

RLS está **ligada** nas sete tabelas do escopo (`assinaturas`, `assinatura_promocoes`,
`assinatura_parametros`, `gold_solicitacoes`, `gold_pagamentos`, `gold_precos`,
`premium_concessoes`).

**Um usuário comum consegue se dar acesso pago escrevendo na própria assinatura? Não.** O
fechamento vem de três peças que se reforçam, e vale registrar porque está certo:

1. INSERT em `assinaturas` é travado em `status = 'pendente'` (`WITH CHECK`).
2. UPDATE em `assinaturas` só aceita resultado com `status = 'cancelada'` — o dono da linha pode
   cancelar, e só.
3. `plano_do_usuario()` (SECURITY DEFINER, usada pela RLS de limites) só honra
   `status in ('ativa','problema_pagamento')` — exatamente os dois estados que **nenhuma** das
   duas policies acima permite alcançar.

Ou seja: o usuário pode escolher `plano` e `valor_centavos` à vontade, mas só em linhas
`pendente` ou `cancelada`, que a função de plano ignora. Só o webhook (service role, atrás do
token) alcança `ativa`. Sem policy de DELETE, ninguém apaga histórico de cobrança.

Restam as duas frestas já listadas: `gold_pagamentos` aceita `status='pago'` do próprio
solicitante (A-09) e `assinaturas` não valida a posse do `asaas_subscription_id` (A-10).

**Medições (19/08/2026):** 0 assinaturas (0 ativas, 0 pendentes), 0 `gold_pagamentos`,
0 `gold_solicitacoes`, 0 `premium_concessoes`, 0 `assinatura_promocoes`, 6 usuários.

---

## Checklist de ligação

Na ordem. Cada passo depende do anterior — ligar fora de ordem produz o pior caso do A-03
(cliente paga, acesso não abre).

### 1. Consertar o código antes de tocar em qualquer variável

Ligar a chave com os P0 abertos transforma um "ainda não vendemos" num "vendemos errado".

1. **A-04 primeiro** — sem isso o Gold não vende nem com tudo ligado. Decidir de que lado fica a
   autoridade: ou `gold_definir_estado` passa a aceitar o próprio solicitante para
   `solicitado → aguardando_pagamento`, ou `criarSolicitacaoGold` deixa de tentar a transição e
   a solicitação já nasce em `aguardando_pagamento`.
2. **A-02** — `/assinar` precisa checar `asaasConfigurado()` e mostrar o texto honesto de "em
   breve", exatamente como `lib/acoes/gold.ts:169-183` já faz.
3. **A-05** — tratar `PAYMENT_REFUNDED`, `PAYMENT_CHARGEBACK_REQUESTED` e `PAYMENT_DELETED` antes
   do primeiro real recebido. Depois do primeiro estorno já é tarde.
4. **A-07/A-08** — logar evento sem correspondência local e falha de gateway.

### 2. Variáveis na Vercel (projeto `smu-prods-projects/commander`, ambiente Production)

| Nome exato | Valor / onde obter |
|---|---|
| `ASAAS_API_KEY` | Painel Asaas → **Integrações → Chave de API**. Gerar no ambiente que casa com `ASAAS_AMBIENTE`: a chave de sandbox **não** funciona em produção e vice-versa. |
| `ASAAS_AMBIENTE` | `sandbox` para os testes; trocar para `producao` só no passo 5. Qualquer outro valor cai em sandbox (`lib/asaas.ts:4-6`). |
| `ASAAS_WEBHOOK_TOKEN` | Valor que **o dono inventa** (ex.: `openssl rand -hex 24`). O mesmo texto vai colado no painel do Asaas no passo 3. Não é fornecido pelo Asaas. |

Já presentes e necessárias, nada a fazer: `SUPABASE_SERVICE_ROLE_KEY` (o webhook usa),
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_APP_URL` (monta a URL de retorno pós-pagamento).

**Não** cadastrar `NEXT_PUBLIC_COBRANCA_ATIVA` — é código morto desde a onda 47 (A-11).
`RESEND_API_KEY` não faz parte da cobrança, mas o relatório mensal (defesa nº 1 contra churn)
não roda sem ela.

Depois de salvar: **redeploy**. Variáveis de servidor valem no próximo boot da function.

### 3. Webhook no painel Asaas

- **Integrações → Webhooks → novo webhook**
- **URL:** `<NEXT_PUBLIC_APP_URL>/api/asaas/webhook`. Atenção: `docs/OPERACAO.md:45` assume
  `https://commander.soumardivers.com`, mas o app está publicado em
  `https://commander-tau.vercel.app`. **Não verifiquei** qual dos dois é o valor real de
  `NEXT_PUBLIC_APP_URL` em produção — confirmar antes de cadastrar, porque um webhook apontando
  para o domínio errado é indistinguível de webhook não cadastrado.
- **Token de autenticação:** exatamente o mesmo valor de `ASAAS_WEBHOOK_TOKEN`.
- **Eventos:** `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `SUBSCRIPTION_DELETED`.
  Acrescentar `PAYMENT_REFUNDED` e `PAYMENT_CHARGEBACK_REQUESTED` **assim que o A-05 estiver
  corrigido** — antes disso eles só gerariam ruído ignorado.

### 4. Desabilitar na conta Asaas

- **Boleto Bancário**: painel → menu do usuário → **Minha conta → Configurações → Configurações do
  sistema**. Desligar Boleto, manter "Disponibilizar recebimento por Pix" **ligado**. Sem isso o
  Boleto aparece para o assinante mesmo com a espec pedindo só cartão + Pix — a API não aceita
  lista de meios, então o código não resolve isso sozinho (`lib/asaas.ts:53-57`).

### 5. Testar em sandbox antes de produção

Com `ASAAS_AMBIENTE=sandbox` e a chave de sandbox:

1. Criar conta de teste no app, ir em `/assinar`, escolher Commander, pagar com cartão de teste do
   sandbox do Asaas.
2. Conferir no banco: linha em `assinaturas` com `status='ativa'` (não `pendente`). Se ficar em
   `pendente`, o webhook não chegou — checar o log de entregas no painel do Asaas; 401 ali
   significa token divergente.
3. Conferir `/menu/assinatura`: valor, próxima cobrança, forma de pagamento e a fatura na lista.
4. Forçar `PAYMENT_OVERDUE` pelo painel e conferir que a tela mostra a tolerância com a contagem
   de dias, sem bloquear na hora.
5. Regularizar e conferir que volta para "Ativa" e `problema_desde` zera.
6. Testar o cancelamento pela tela e conferir que some do Asaas e vira `cancelada` no banco.
7. Repetir o ciclo inteiro pelo Commander Gold, depois que o A-04 estiver resolvido.
8. Só então: trocar `ASAAS_AMBIENTE` para `producao`, trocar a chave para a de produção, cadastrar
   um segundo webhook (a conta de produção é outra), redeploy, e fazer **uma** compra real de
   R$ 49,90 com o cartão do próprio dono antes de divulgar.

---

## O que depende do dono

Nada abaixo pode ser feito de dentro do repositório — tudo exige a conta Asaas dele.

1. **Conta Asaas de produção aprovada**, com dados bancários validados para repasse. Não verifiquei
   se a conta existe ou em que estágio de aprovação está.
2. **Gerar as chaves de API** (sandbox e produção são chaves diferentes, em painéis diferentes) e
   colar cada uma no ambiente correspondente da Vercel.
3. **Definir o `ASAAS_WEBHOOK_TOKEN`** e cadastrar o mesmo valor nos dois lados (Vercel e painel).
4. **Cadastrar o webhook** nas duas contas (sandbox e produção) com a URL correta — depois de
   confirmar qual domínio `NEXT_PUBLIC_APP_URL` aponta hoje.
5. **Desligar o Boleto** e confirmar que o Pix está ligado (pendência já registrada em
   `docs/OPERACAO.md:83-99` e ainda aberta).
6. **Rodar o pagamento de teste em sandbox** — é a única forma de provar a ponta a ponta antes de
   cobrar de alguém de verdade.
7. **Decidir a régua de aprovação do Protocolo Commander** (`docs/OPERACAO.md:180-182`) antes de
   vender Gold: hoje a aprovação é decisão humana sem critério fechado, e ela concede Commander
   grátis pela validade do selo via `premium_concessoes` — ou seja, já tem efeito financeiro real.
8. **Confirmar o `Confirm email` do Supabase** (`docs/OPERACAO.md:74-77`) antes de abrir vendas:
   cobrar de conta com e-mail não verificado é problema de estorno esperando acontecer.

---

*Auditoria só-leitura, 19/08/2026. Policies e funções lidas do banco remoto via MCP
(`khgjtxvmduizyooqaoox`), não dos arquivos de migration. Não verificado: estado da conta Asaas,
configuração de Boleto/Pix, valor real de `NEXT_PUBLIC_APP_URL` em produção, e o toggle
`Confirm email` no painel do Supabase — todos exigem acesso a consoles fora do escopo de leitura
de código e banco.*
