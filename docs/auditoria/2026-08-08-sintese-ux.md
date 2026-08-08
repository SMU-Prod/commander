# Síntese da auditoria de usabilidade — 08/08/2026

**Gatilho:** o dono do produto tentou usar o app e disse: *"estou achando o app completamente difícil de usar e entender, não consigo cadastrar uma embarcação nova, fiquei totalmente confuso"*. Perguntado onde travou, marcou **os quatro pontos**: tela Início, cadastrar embarcação, aba Embarcação e os nomes das coisas.

Quatro auditorias independentes rodaram sobre o código, cada uma com uma lente. Relatórios completos:
`2026-08-08-ux-primeira-vez.md` · `2026-08-08-ux-ficha.md` · `2026-08-08-ux-vocabulario.md` · `2026-08-08-ux-orfas.md`

---

## O diagnóstico em uma frase

O app **sabe** muita coisa e **conta** muito pouco: a informação existe, o cálculo está certo (o motor de domínio é sólido e reusado em todas as telas), mas a interface não sinaliza o que fazer, não é clicável onde parece ser, e fala como banco de dados em vez de falar como píer.

## A causa raiz, sem rodeio

Seis ondas de desenvolvimento passaram por revisão adversarial rigorosa — de código. Os gates perguntavam *"o código faz o que o plano mandou?"*, *"a RLS barra?"*, *"a rota contorna a ilha?"*. **Nenhum gate perguntou "uma pessoa consegue descobrir isso sozinha?"**. É a mesma classe de falha que a auditoria 360 já tinha diagnosticado para o visual — e que eu corrigi só para o visual, com o passe visual no `CONTRIBUTING.md`. Faltou o equivalente para fluxo e linguagem.

---

## Os achados que explicam o "travei"

### 1. O card de alerta da Início não é clicável — provável causa literal
`hoje/page.tsx:124-141` é um `<div>` sem link. O mesmo tipo de item em `barco/page.tsx:140-144` **é** um `<Link>`. O dono vê "vencido há X dias" em vermelho, toca para resolver, e nada acontece. Não há nada mais frustrante do que um alerta que não leva a lugar nenhum.

### 2. "Tudo em dia" mente para quem acabou de chegar
O onboarding cria 4 itens de manutenção por baixo dos panos (`onboarding.ts:9-12,62-77`) usando **a data de hoje** como linha de base, sem o dono ter informado nada. A Início então mostra o mesmo verde tranquilo de um barco realmente revisado: *"Nenhum vencimento na margem. Bom vento e mar calmo."* (`hoje/page.tsx:120`). Não distingue **"está tudo em dia"** de **"não há dado nenhum"**. Os horímetros ainda mostram "0,0 h" (`horimetro.tsx:15,21-22`), o que contradiz de cara a experiência de quem tem um motor com 600 horas.

### 3. Cadastrar a segunda embarcação era impossível — **já corrigido** (`2f8a05e`)
`/onboarding` só era alcançável por redirect de quem não tinha barco, e a própria tela expulsava quem já tinha. O seletor do topo — única pista de multi-barco — sumia quando havia só um. Agora há caminho pelo Menu e pelo seletor.

### 4. A ficha está ordenada ao contrário da frequência de uso
"Dados gerais" (comprimento, boca, calado, TIE — consulta ~1×/ano) aparece **acima** de Documentos, Contatos e Gastos (uso mensal) e do Selo Ouro. O que se olha toda semana devia estar no topo.

### 5. Anexo que entra e nunca mais sai
`Evento.anexo_path`: nota fiscal e foto anexadas ao registrar um serviço **nunca podem ser reabertas** — nem no diário, nem em Gastos, nem na ficha do equipamento. Aparece a palavra "anexo", sem link. O app já tem o padrão certo (URL assinada + "Abrir") implementado para documentos avulsos — só não foi aplicado aqui.

### 6. O painel do parceiro é inalcançável para quem está logado
`/parceiro` só tem link no rodapé da landing pública, e `/` redireciona logado para `/hoje`. O parceiro que assinar não acha o próprio painel.

### 7. O vocabulário fala software
- **"Aba"** nomeia duas coisas diferentes: as 5 abas da navegação **e** as 9 áreas de permissão. E aparece cru em erro: *"confira seu acesso a esta aba"* — sem dizer qual.
- **A tela de avisos muda de nome 4 vezes**: "Avisos" (navegação) → "Notificações" (título) → "Alertas" (menu) → "Alertas ativos"/"Avisos enviados" (dentro).
- **A mesma ação tem 4 nomes**: "+ Evento", "+ Lançamento", "+ Registrar", "Salvar no diário" — todos chamam `criarEvento`.
- **Jargão puro**: "item monitorado", "matriz de permissões", "cota de nuvem", "acervo".
- **~15 mensagens de erro** repetem *"Não foi possível X — confira seu acesso"*: ambíguo entre permissão negada, sessão expirada e falha de rede, e nunca diz o que fazer.
- **"Marketplace"** é a única palavra em inglês da navegação principal.

---

## O que já está bom (e serve de referência)

- O motor de domínio (`semaforo.ts`) é fonte única de verdade reusada em todas as telas — a arquitetura de dados é sólida; o problema é de apresentação.
- Estados vazios de **Elétrica** (`barco/eletrica/page.tsx:66-74`) e **Diário** (`diario/page.tsx:85-90`) são referência: ícone + explicação + benefício.
- Trechos de voz náutica genuinamente boa: *"Bom vento e mar calmo"*, *"O dossiê do seu barco"*, *"Essa saída durou 3 h 30 — atualizar as horas dos motores?"*, e o **"Agora não"** em vez de "Cancelar".

---

## Plano de correção — Onda 7: "Fala como gente"

**Bloco A — o que trava (fazer primeiro, sem depender de decisão):**
1. Card de alerta da Início vira link para o item
2. "Tudo em dia" distingue barco em dia de barco sem dado; horímetro sem leitura mostra "—", não "0,0 h"
3. Anexo do diário reabre (padrão de URL assinada que já existe)
4. `/parceiro` alcançável para quem está logado
5. `itens/novo` volta para de onde veio
6. Rótulo "Motores" que aponta para a ficha inteira (`hoje:188`) vira o nome certo

**Bloco B — hierarquia da ficha:** reordenar por frequência de uso; separar "Documentos" de "Embarcação (geral)"; mostrar data de calendário do próximo vencimento, não só "em 40 h".

**Bloco C — vocabulário:** um nome por conceito, glossário aplicado em todo o app, mensagens de erro que dizem o que fazer. **Depende de 7 decisões do dono** (ver `2026-08-08-ux-vocabulario.md`, seção "Perguntas para o dono") — principalmente: como se chama, na boca dele, um "item monitorado".

**Bloco D — processo (para não repetir):** acrescentar ao `CONTRIBUTING.md` um gate de descoberta ao fim de cada onda: *toda funcionalidade nova precisa de um caminho a partir de `/hoje` em no máximo 3 toques, e um estranho tem que achar sem ajuda*. Foi a ausência desse gate que produziu esta lista.
