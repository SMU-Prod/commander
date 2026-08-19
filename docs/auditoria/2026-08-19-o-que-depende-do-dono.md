# O que só o dono pode fazer — 19/08/2026

As cinco auditorias de hoje produziram muita correção de código, e ela está no ar.
Este arquivo é o resto: **o que nenhum commit resolve.** São credenciais e campos de
painel que vivem fora do repositório — e é exatamente por isso que os defeitos
abaixo sobreviveram a todas as ondas até agora. Nenhuma varredura de código os
enxerga.

Está em ordem de custo. O primeiro bloco impede que alguém entre no produto; o
segundo impede que alguém pague por ele.

---

## Bloco 1 — Ninguém consegue entrar (30 minutos)

**A prova, do banco de vocês:** das quatro contas reais criadas até hoje, **três**
têm `email_confirmed_at` preenchido e `last_sign_in_at` nulo. Essas pessoas
receberam o e-mail, clicaram no link, confirmaram a conta — e nunca entraram no
app uma única vez. São os três primeiros interessados reais do Commander.

### 1.1 — Site URL

Painel Supabase → projeto → **Authentication** → **URL Configuration** → campo
**Site URL**.

Se estiver `http://localhost:3000`, troque por `https://commander-tau.vercel.app`.

É daqui que sai o destino do link de confirmação quando o app não diz outro. Com
`localhost` ali, o celular de quem clica tenta abrir um endereço da própria
máquina — e não existe nada nele.

**Decida agora, e não depois:** se o produto vai viver em domínio próprio, use o
domínio próprio já. Trocar isso depois quebra os links que estiverem em trânsito
nas caixas de entrada.

### 1.2 — Redirect URLs

Mesma tela, bloco **Redirect URLs** → **Add URL**. Uma por linha:

- `https://commander-tau.vercel.app/auth/callback`
- `https://commander-tau.vercel.app/**`
- `http://localhost:3000/**` — só para desenvolvimento

**Este passo não é opcional e não avisa quando falta.** A onda 83 fez o app dizer
explicitamente para onde o link deve voltar, mas o Supabase **descarta em silêncio**
qualquer destino que não esteja nesta lista e volta para o Site URL. Sem 1.2, a
correção de código não faz efeito nenhum e nada indica o motivo.

### 1.3 — SMTP próprio

Painel Supabase → **Authentication** → **Emails** → **SMTP Settings** → ligar
**Enable Custom SMTP**.

Hoje a entrega funciona porque o volume é de um cadastro a cada dois dias. O
serviço embutido do Supabase é declaradamente para desenvolvimento: remetente
compartilhado (reputação ruim, cai em spam) e teto rígido de poucos e-mails por
hora. **No dia em que dois barcos da mesma marina se cadastrarem na mesma hora, o
segundo não recebe nada** — e vocês não ficam sabendo.

Como já existe conta na Resend (o app usa para os alertas), o caminho curto é ela:
host `smtp.resend.com`, porta `465`, usuário `resend`, senha = a chave de API.

**Exige domínio verificado na Resend.** O remetente tem que ser de um domínio de
vocês. Enquanto isso não existir, o SMTP próprio não sobe.

### 1.4 — Depois de tudo, teste você mesmo

Cadastre um e-mail seu que ainda não tenha conta e **abra o link no celular**, não
no mesmo navegador em que cadastrou.

Esse caso específico falhava duas vezes: no destino e no mecanismo de segurança do
link, que guarda uma parte da chave no navegador que iniciou o cadastro. A onda 83
trata o segundo caso mandando a pessoa para o reenvio. É o único teste que prova
que acabou.

### 1.5 — As três pessoas que ficaram no meio do caminho

Elas **não** precisam de suporte técnico: a conta delas funciona. Basta entrar em
`/login` com a senha que criaram. Depois do 1.4, vale uma mensagem pessoal
dizendo isso.

---

## Bloco 2 — Ninguém consegue pagar

O código da cobrança está inteiro e testado: cliente, assinatura, checkout
hospedado, webhook, cancelamento, upgrade de mensal para anual, cobrança avulsa do
Gold. O que não existe são as credenciais. Medido no banco: **0 assinaturas, 0
pagamentos, 0 concessões.** O Commander nunca faturou.

### 2.1 — A ORDEM IMPORTA, e ligar fora de ordem é pior que não ligar

O webhook é quem transforma "pagou" em "tem acesso". Se a chave de API entrar
antes do segredo do webhook, o cliente **paga e não recebe acesso** — a assinatura
fica pendente para sempre e o dinheiro já saiu do cartão dele.

Ordem correta, em produção na Vercel (Settings → Environment Variables):

1. `ASAAS_WEBHOOK_TOKEN` — um segredo longo e aleatório que você inventa. **Este
   primeiro.**
2. Cadastre o webhook no painel do Asaas apontando para
   `https://commander-tau.vercel.app/api/asaas/webhook`, mandando esse mesmo
   segredo no cabeçalho `asaas-access-token`.
3. `ASAAS_AMBIENTE` — `sandbox` para testar, `producao` quando for pra valer.
4. `ASAAS_API_KEY` — a chave da conta. **Esta por último.**

Enquanto a chave de API não existir, `/assinar` mostra "a contratação abre em
breve" (onda 83) em vez do checkout que falhava. Ligar a chave acende a tela de
assinatura e o botão do Commander Gold ao mesmo tempo — não há um segundo
interruptor a lembrar.

### 2.2 — Teste em sandbox antes

Com `ASAAS_AMBIENTE=sandbox`, assine você mesmo, pague a cobrança de teste e
confirme que o acesso liberou sozinho. Se liberou, o webhook está chegando. Só
então troque para `producao`.

### 2.3 — Desabilitar Boleto na conta Asaas

Painel Asaas → Minha conta → Configurações do sistema.

O app pede "todos os meios habilitados na conta" porque a API do Asaas não aceita
uma lista parcial. Se o Boleto ficar ligado lá, ele aparece para o assinante — e a
espec pede cartão e Pix.

### 2.4 — O Commander Gold continua invendável, e não é por causa do Asaas

Achado separado: o pedido de avaliação Gold de um cliente comum trava porque a
operação que avança o estado exige papel de Suporte. **Mesmo ligando tudo acima, o
Gold não vende.** É conserto de banco, não de configuração — está na fila.

---

## Bloco 3 — Os e-mails do app não saem

`RESEND_API_KEY` não está em produção. Isso **não** afeta a confirmação de conta
(esse e-mail sai pelo Supabase), mas mata os avisos de vencimento e o relatório
mensal — a rota do relatório se recusa a rodar sem a chave, de propósito, porque
relatório sem e-mail não existe.

E enquanto o domínio não estiver verificado na Resend, o remetente é o de
teste dela, que **só entrega para o e-mail do dono da conta**. O 1.3 conserta os
dois de uma vez.

---

## Bloco 4 — Decisões que não são técnicas

Ficam registradas aqui porque bloqueiam trabalho já pronto:

- **Proteção contra senha vazada** está desligada no Supabase (Authentication →
  Passwords). É um clique e não tem contraindicação.
- **Vercel Pro e Supabase Pro** antes de operar frota de terceiros — hoje o plano
  gratuito é o teto de tudo.
- **Cliente-piloto do Enterprise.** Os preços do plano continuam marcados como "em
  breve" até existir um, e essa é a decisão certa: preço publicado sem cliente é
  chute.
- **O modelo 3D do motor** (arquivo GLB) continua sendo a única peça que falta
  para as ondas de motor em 3D.

---

## Como saber que acabou

- Um e-mail seu, cadastrado do zero, com o link aberto no celular, entra no app.
- Uma assinatura de sandbox, paga, libera o acesso sozinha.
- Um alerta de vencimento chega na sua caixa de entrada.

Nada disso depende de mais uma linha de código.
