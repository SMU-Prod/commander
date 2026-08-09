# Síntese da auditoria de CTO — 09/08/2026

Quatro auditorias independentes sobre o mesmo código, com lentes diferentes:
`2026-08-09-cto-arquitetura.md` · `-cto-produto.md` · `-cto-design.md` · `-cto-fluxos.md`

Estado auditado: 8 ondas mergeadas, 164 testes, 37 rotas, **nunca deployado, zero usuários, zero receita**.

---

## Veredito em cinco linhas

A fundação está sólida e isso não é elogio de cortesia: RLS valendo em 17 tabelas sem uma
única policy `using(true)`, domínio puro reusado sem exceção (nenhuma tela discorda de outra
sobre o mesmo dado), server actions e API routes com divisão limpa. O que falta não é
qualidade de engenharia — é **uma trava de dinheiro, um bug de confiança, dois crons que vão
estourar no dia do lançamento, e a promessa central da marca sem entrega**. Nenhum desses é
caro de resolver; todos são caros de descobrir com cliente na frente.

---

## P0 — resolver antes de qualquer real entrar

### 1. Duplo clique em "Assinar" = cobrança dupla real
`web/lib/acoes/assinatura.ts:24-86`. A action confere se já existe assinatura, **chama a API do
Asaas** (latência não controlada) e só então grava. Duas requisições simultâneas passam as duas
pela conferência e criam **duas assinaturas cobráveis**. Não há constraint no banco impedindo:
confirmado em `pg_constraint` — só existe UNIQUE em `asaas_subscription_id` e `fundador_numero`.
É o primeiro item porque cobra o cliente duas vezes no primeiro contato dele com o produto.

### 2. "Horas do motor agora" no diário não atualiza o motor
Registrar um serviço informando 620 h **não muda a leitura oficial** — a Início segue mostrando
610 h. Testado ao vivo. O dono informa o dado, o app aceita, e o número não muda em lugar
nenhum: é exatamente o tipo de coisa que faz alguém parar de confiar no app e voltar para a
planilha.

---

## P1 — quebram no dia do lançamento

### 3. Os dois crons enviam e-mail em série
`app/api/relatorio/mensal/route.ts` e `alertas/disparar/route.ts` percorrem usuário a usuário
com `await` sequencial. A conta dá **~78 s contra o `maxDuration = 60`** declarado no próprio
código — timeout no dia 1º do mês, justamente quando o relatório mensal (a defesa nº 1 contra
churn) deveria sair.

### 4. Registrar no diário não confirma nada
`lib/acoes/eventos.ts:140` redireciona mudo. É a **ação mais frequente do app** e a única
sem toast de sucesso. A pessoa não sabe se salvou.

### 5. Cadastrar o prestador no meio do registro apaga o formulário
No fluxo "troquei o óleo, o mecânico foi o João": se o João não está cadastrado, ir cadastrá-lo
perde tudo que já foi preenchido. Sem volta de estado.

---

## P2 — a promessa e o sistema

### 6. Não existe "o dossiê do seu barco"
A marca inteira se vende com essa frase — está no `<title>`, no hero da landing, no argumento
de revenda. **Não há um botão que gere ou exporte esse dossiê em lugar nenhum.** É a promessa
central sem entrega física.

### 7. O sistema visual é violado pelo próprio código
- `globals.css:94` declara "nada abaixo de 11px" e **10 lugares violam** (nav 9,5px; badge do
  hero 10,5px; rótulo do horímetro 10px; HUD do mapa 10px ×3).
- Dois grids de atalho de função idêntica com raios diferentes: **12px** (`hoje:238`) vs
  **14px** (`barco:216`).
- O H1 tem **4 vozes** (24/20/24-sem-tracking/18px) apesar de existir `.titulo-pagina`, usada
  em 19 telas e ignorada por 11.
- **Dark mode falha AA** em 3 pontos: `text-dim` sobre `bg-panel2` mede **4,16:1** (mínimo
  4,5:1) — `menu/assinatura:104`, `campos-navegacao-evento:112`, `theme-toggle:36`.

### 8. Gordura de produto
`/navegar` são 1.063 linhas + A* em Web Worker + máscara água/terra — engenharia impressionante
que serve **quem pilota (o marinheiro)**, não quem paga. Recomendação da auditoria de produto:
parar de investir aí (cortar a onda de cartas offline), sem apagar o que já roda. Fotos com 4
álbuns + barra de cota é complexidade sem uso. `/rede` é rota morta.

### 9. Vocabulário: "Comandante" nomeia duas coisas
O tripulante convidado (`/menu/tripulacao`: "Comandantes com acesso") e o capitão contratado no
marketplace. Mesma colisão que o glossário já matou para outras palavras.

---

## O que preservar (não mexer)

- O motor de domínio (`lib/domain/semaforo.ts`) como fonte única de verdade — nenhuma tela
  discorda de outra sobre vencimento.
- RLS pela matriz de permissões, com `search_path` fixo nas funções `SECURITY DEFINER`.
- O horímetro/cartucho de instrumento e o card-hero do barco: são as peças que vendem no píer.
- A honestidade conquistada nas ondas 7 e 8: "Falta informação" em vez de falso "tudo em dia",
  horímetro "—" em vez de 0,0 h, mensagem de erro que não diagnostica o que o código não sabe.

## Custo de infra a 100 assinantes
~US$ 45-95/mês — trivial diante de R$ 7 mil de MRR. Ponto de atenção: fotos sem
redimensionamento (nenhum `next/image`, cap de 10 MB só no app) estouram o storage grátis
rápido.
