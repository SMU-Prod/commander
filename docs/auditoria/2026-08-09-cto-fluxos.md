# Auditoria de fluxos ponta a ponta — 09/08/2026

**Método:** navegação real no Chromium apontado para `http://localhost:3050`, logado como `Erick teste` (embarcação `Commander teste`, marina GLORIA). Onde o clique de mouse/toque via automação não respondia de forma confiável (ver nota de método abaixo), usei submissão real de formulário via JS — o mesmo POST que o navegador dispara num clique real — e conferi o resultado na tela seguinte, sempre citando URL e texto literal. Não criei nenhuma conta nova (login/senha) nem enviei mensagem real (WhatsApp/e-mail) ou paguei nada — por política, esses passos foram avaliados por código + pela tela até o ponto de disparo, sem executar o disparo.

**Nota de método:** dois componentes client-side específicos (`SeletorEmbarcacao` no `/hoje` e o seletor "O que aconteceu?" em `/diario/novo`) não respondiam a clique sintético nesta sessão — sem erro de hidratação reportado pelo Next DevTools, sem chunk faltando, mas sem fiber React anexado ao nó. Não achei causa conclusiva (pode ser peculiaridade do ambiente de automação, não do app). Para não perder a auditoria desses fluxos, completei-os por submissão de formulário direta (equivalente ao POST de um clique real) e por leitura do código-fonte, que é bem comentado. Sinalizo isso explicitmente onde se aplica.

---

## Veredito em 5 linhas

O app está **muito melhor do que a síntese de 08/08 registrou** — as ondas 7 e 8, já mergeadas em `master`, corrigiram ao vivo 5 dos 6 itens do Bloco A (alerta clicável, farol honesto, anexo reabre, `/parceiro` alcançável, nomenclatura de Avisos unificada) e o registro no diário virou pergunta-por-pergunta, exatamente como planejado. Sobrou uma dívida nova e real: **o campo "Horas do motor agora" no registro de serviço promete atualizar a leitura do motor e não atualiza** — testei ao vivo, registrei 620 h, e a tela Início continuou mostrando 610,0 h. **"Quanto gastei no ano" não tem resposta em nenhuma tela** — só "Total do mês" e um gráfico de 6 meses. E **"Comandante" nomeia duas coisas diferentes** (tripulação convidada vs. capitão contratado no marketplace), o mesmo tipo de colisão que a auditoria anterior já tinha flagado para outros termos. Os fluxos de conferência diária, convite de tripulação e Selo Ouro estão sólidos e servem de modelo.

---

## Fluxo a fluxo

### 1 — Dono novo: cadastro → onboarding → primeira tela útil

- `http://localhost:3050/login?modo=cadastro` — real, sem submeter (política: não crio contas). Tela: "Crie sua conta" / campos Nome, E-mail, Senha (mín. 8) / botão "Criar conta". **4 toques** (nome, e-mail, senha, Criar conta).
- `http://localhost:3050/onboarding` — mesma tela serve o primeiro barco e barcos extras (só muda o texto). Preenchi só "Nome" (único campo obrigatório) e submeti: **2 toques mínimos** (Nome + "Criar meu painel de bordo"). Preenchendo tudo (motores, vencimentos) chega a ~14 toques, mas nada impede parar em 2.
- Resultado: toast "Embarcação cadastrada", redireciona pra `/hoje`. Tela real:
  > "Segunda Vela Teste · Marina Teste · Estaleiro Teste · Modelo X · 2020 — **Falta informação** — Ainda sem informação suficiente. Nenhum motor tem leitura de horas real nem vencimento com data informada — não dá pra dizer se está tudo em dia. **Completar em Embarcação**" (link pra `/barco`). "Horas de motor: BB — sem leitura / BE — sem leitura."

**Toques:** 4 (cadastro, não executado) + 2 (onboarding mínimo) = 6 até a primeira tela útil.
**Onde quebra:** em lugar nenhum. Isso é exatamente o oposto do achado #2 da síntese de 08/08 ("tudo em dia mente pra quem acabou de chegar") — está **corrigido e testado ao vivo**: farol amarelo "Falta informação" com explicação e CTA, motor mostra "sem leitura" em vez de "0,0 h".
**Correção proposta:** nenhuma — fluxo bom.

### 2 — Dono registra um serviço ("troquei o óleo, R$ 1.850, mecânico João")

Caminho testado: `/barco/equipamento/{id-do-motor-BB}` → link "Registrar serviço" → `http://localhost:3050/diario/novo?alvo=eq:{id}`. Chegando por aí, o tipo já vem em "Manutenção" (pula a pergunta "O que aconteceu?").

Tela real (com `alvo` pré-setado): "Data" (pré-preenchida) · "Onde no barco?" (select, já em "Motor BB") · "O que foi feito?" · "Isso renova alguma manutenção? (opcional)" — select listando **"Troca de óleo e filtros — Motor BB"**, **"Revisão geral — Motor BB"** etc., corretamente separadas por motor · "Custo (R$) — opcional" + "Horas do motor agora — opcional" lado a lado · "Mais detalhes" (accordion) → "Prestador (opcional)" (select) + Anexo · botão "Registrar no diário".

Preenchi: descrição "Troca de óleo e filtros", item "Troca de óleo — Motor BB", custo "1.850,00", horas "620". Submeti. Resultado real em `/diario`: **"09ago · Manutenção — Motor BB · Troca de óleo e filtros · 620 h · R$ 1.850,00"**. Em `/barco/equipamento/{id}`: o item "Troca de óleo" foi de "em 0 h" (vencido) pra **"em 260 h"** — o ciclo realmente renovou.

**Toques (chegando direto do equipamento, tipo já resolvido):** Onde (2, já vem certo, 0 se não mexer) + O que foi feito (1) + renova manutenção (2: abrir+escolher) + Custo (1) + Horas (1) + Mais detalhes (1) + Prestador (2) + Registrar (1) ≈ **9 toques** pro caminho completo, **5** se pular Prestador/anexo.

**Onde quebra (2 achados novos, confirmados ao vivo):**

1. **"O mecânico foi o João" não tem onde entrar se João não está cadastrado.** O select "Prestador" só lista contatos já existentes — não há campo de texto livre nem "+ novo" inline. A única saída é o link "Cadastrar" (`/barco/contatos`), que **é uma navegação de página inteira e não devolve o formulário preenchido** — descrição, item, custo e horas se perdem. Conferi o código de `/barco/contatos`: não existe parâmetro `volta` nem qualquer mecanismo de retorno, ao contrário de outras telas do app que carregam estado por query string (o próprio `/diario/novo?alvo=...&item=...&custo=...` já suporta isso, só não é usado aqui).
   **Correção mais barata:** o botão "Registrar no diário" já teria que aceitar POST com um contato ainda-não-criado seria mais trabalho; a correção de menor custo é fazer o link "Cadastrar" virar `/barco/contatos?volta=/diario/novo` e a página de contatos, ao salvar, redirecionar de volta preservando os campos já digitados via querystring (mesmo padrão de `alvo`/`item`/`custo` que `diario/novo` já lê).

2. **"Horas do motor agora" não atualiza a leitura do motor.** Testei ao vivo: registrei 620 h nesse campo. Depois, em `/hoje`, "Horas de motor" continuou mostrando **"BB 610,0 h"** (a leitura antiga). No código (`lib/acoes/eventos.ts`), o valor de `horas` só é usado para recalcular o ciclo do item específico escolhido em "Isso renova alguma manutenção?" — nunca grava em `equipamentos.horas_atuais`. Existe uma ação separada (`lib/acoes/registro.ts`) dedicada a atualizar a leitura oficial do motor, mas ela não é oferecida nesse formulário. Resultado prático: se o dono tem 2 manutenções pendentes no mesmo motor e só renova uma pelo diário, a outra continua contando a partir da hora **velha** — e o próprio painel "Horas de motor" da Início, que é o número mais visível do app, mente por omissão logo depois que o dono acabou de informar a hora certa.
   **Correção mais barata:** ao salvar um evento com "horas" preenchido, também fazer `update equipamentos set horas_atuais = horas where id = equipamento_id` (mesma validação de "não regride" que `registro.ts` já tem) — ou, mais simples ainda, trocar o rótulo do campo pra deixar claro que ele só afeta o item escolhido.

### 3 — Dono confere se está tudo em dia ("posso sair amanhã?")

`http://localhost:3050/` redireciona sozinho pra `/hoje` (confirmei via `location.href`). **0 toques** — é a primeira coisa que a pessoa vê ao abrir o app.

Tela real (embarcação com dados reais, capturada no início da sessão): "GLORIA · marina · TSS · 2025" / farol "Precisa de atenção" com Seguro "em 4 dias" e TIE "em 19 dias" (cada um **é link** pro item, `/barco/itens/{id}/editar` — corrigido em relação ao achado #1 da síntese anterior) / "Mar agora": 2,4 m onda · 6 kt vento · 23 °C água · "Mar pesado" / "Horas de motor: BB 10,0 h · BE — sem leitura".

**Toques até a resposta:** 0 — status geral + vencimentos + mar + motor, tudo na mesma dobra.
**Onde quebra:** não quebra. É o fluxo mais forte do app.
**Correção proposta:** nenhuma.

### 4 — Dono contrata comandante (Início → WhatsApp)

`/hoje` → nav "Comandantes" (1 toque) → `http://localhost:3050/marketplace`. Tela real:
> "Comandantes / Comandantes disponíveis para contratar direto pelo WhatsApp. / **Ainda não há comandantes cadastrados na sua região. Assim que houver, eles aparecem aqui.** / O selo 'Verificado' será emitido quando a validação documental entrar em operação... / É comandante? Toque aqui para criar seu perfil."

Não há nenhum comandante cadastrado nesta base — o fluxo para aí por falta de dado, não por bug. Pelo código (`marketplace/page.tsx`), quando existe um perfil visível, o card mostra nome/categoria/cidade/disponibilidade e um botão "WhatsApp" que abre `https://wa.me/55{telefone}` em nova aba — **2 toques** (Comandantes + WhatsApp) até abrir a conversa. Não cliquei o link real (não disparo mensagens).

**Toques:** 1 até constatar que está vazio; 2 no caminho feliz quando houver oferta.
**Onde quebra:** conteúdo, não código — marketplace vazio pré-lançamento. A mensagem de vazio é honesta e não finge oferta.
**Correção proposta:** não é um conserto de fluxo — é povoar a base antes do lançamento (ou, no dev, semear 1-2 perfis fake pra nunca testar o marketplace vazio sem querer).

### 5 — Dono convida marinheiro (+ o que ele vê a menos)

`/menu` → "Tripulação" (link em "Menu", 2 toques) → `http://localhost:3050/menu/tripulacao`. Tela real:
> "Tripulação / **Comandantes com acesso** / Ninguém além de você ainda. Crie um convite abaixo. / Convites pendentes / Nenhum convite aguardando. / Novo convite / Acesso inicial: 'Operacional — registra horas e serviços, sem custos e documentos' ou 'Completo — vê e edita tudo' / Você ajusta o acesso em detalhe depois, área por área — o que ele pode ver e editar."

Criei um convite real (nível padrão "Operacional"). Resultado: **"Convite criado / http://localhost:3010/convite/143c5c2c20 / Compartilhar no WhatsApp"**, e o convite passou a listar em "Convites pendentes" com "Operacional · expira 16/08/2026" e botão "Revogar".

**Toques:** Menu (1) + Tripulação (1) + Criar convite (1, nível padrão já serve) = **3 toques** até ter um link pronto pra mandar.

**Nota de config:** o link veio com porta `3010` (`NEXT_PUBLIC_APP_URL` do `.env.local`), enquanto o servidor real desta sessão roda em `3050` — descompasso do ambiente local, não do código; sinalizo porque, se acontecer em produção/preview, o convite chega quebrado.

**O lado do marinheiro (via código, `lib/domain/permissoes.ts` + guards de página):** com acesso "Operacional" (padrão), ele **vê e edita** Motores, Elétrica, Fotos e Diário; **vê sem editar** Embarcação (geral) e Casco; **não vê nada** de Documentos, Contatos e Gastos — nem o link aparece (`/hoje` e `/barco` filtram os atalhos com `podeVer`), nem a URL direta funciona: entrar em `/barco/contatos` sem permissão redireciona pra `/hoje?erro=Seu%20acesso%20não%20inclui%20os%20contatos` (testei o texto da mensagem no código de `barco/contatos/page.tsx`, `documentos/page.tsx` e `gastos/page.tsx` — as três nomeiam a área certa, sem o "confira seu acesso a esta aba" genérico do achado #7 antigo).

**Onde quebra:** vocabulário. A seção de convite/gestão da tripulação chama os convidados de **"Comandantes com acesso"** — a mesma palavra "Comandante" que nomeia, na aba do marketplace (fluxo 4), o **profissional contratado por fora**. São conceitos diferentes (tripulação de confiança vs. prestador de serviço avulso) usando o mesmo nome, na mesma navegação principal ("Comandantes" no rodapé). Isso é exatamente a classe de problema que a síntese de 08/08 já tinha marcado pra "Aba" e pra "Avisos" — só que esse par específico não entrou na lista.
**Correção proposta:** trocar o rótulo da seção pra "Tripulação com acesso" (a página já se chama "Tripulação" no `<h1>`) e reservar "Comandante" só pro marketplace.

### 6 — Dono planeja uma saída (mapa, rota, parceiros, âncora)

`/hoje` → "Iniciar navegação — gravar trilha" (1 toque) → `http://localhost:3050/navegar`. Tela real capturada: **"Navegar / 3 nm / Trilha / Fundeei / MOB"** — mapa Mapbox GL (canvas) com controles de gravação de trilha sempre visíveis.

**Não consegui clicar no mapa nesta sessão** (canvas WebGL + limitação de automação já registrada na nota de método) — descrevo o resto por leitura de `components/mapa/navegar-mapa.tsx` (1063 linhas, li os trechos relevantes, não o arquivo inteiro):
- "Definir destino" alterna um modo em que tocar no mapa cria o destino (`setDestino`), traça a linha de rumo e calcula distância/rumo/ETA (`lib/domain/navegacao.ts`) a partir da posição atual.
- Parceiros (marinas, postos, pousadas, restaurantes) aparecem como pinos sempre visíveis no mesmo mapa, com um card ao tocar (`CardParceiro`) que também pode virar destino — não achei, na parte que li, uma lista específica de "parceiros no caminho da rota traçada": são pinos gerais, filtráveis por categoria no painel "Camadas do mapa", não um recorte automático por proximidade da rota. (Observação, não achado confirmado — não li o arquivo inteiro.)
- Alarme de âncora: ao "Fundeear", um círculo de raio geofence é desenhado; se a posição sair do círculo (`garrando`), dispara `Notification` do navegador — "Commander — alarme de âncora".

**Toques até começar a navegar:** 1 (Início → Navegar). O resto depende de interação com o mapa que não pude cronometrar com honestidade nesta sessão.
**Onde quebra:** não sei dizer com confiança — precisa de um passe visual real (o próprio `CONTRIBUTING.md` já exige isso: "quem vê a linha torta na tela é o olho").
**Correção proposta:** repetir este fluxo especificamente com um operador humano ou com uma sessão de browser que responda a clique — é o único fluxo desta lista que a auditoria não conseguiu validar de ponta a ponta.

### 7 — Dono quer saber quanto gastou no ano

`/barco` → "Gastos" (2 toques) → `http://localhost:3050/barco/gastos`. Tela real (já com meu lançamento de R$ 1.850,00 do fluxo 2 refletido corretamente):
> "Gastos / Registrar / **Total do mês** R$ 1.850,00 / Motores R$ 1.850,00 / **Últimos 6 meses** [gráfico mar-abr-mai-jun-jul-ago] / Lançamentos recentes: Troca de óleo e filtros · 09/08/2026 · R$ 1.850,00"

**Onde quebra:** não existe, em lugar nenhum do app, um "total do ano". Só "Total do mês" (mês corrente) e um gráfico rolante de 6 meses — que nem cobre um ano fiscal completo. Pra responder "quanto gastei em 2026", o dono teria que somar de cabeça as 6 barras (e ainda faltaria jan-fev) ou rolar a lista de lançamentos recentes (limitada a 20) e somar na calculadora.
**Correção mais barata:** um card "Total do ano" ao lado de "Total do mês" — o código já busca eventos desde `{ano-1}-01-01` (`inicioJanela` em `gastos/page.tsx`), é só somar por ano civil corrente e mostrar.

### 8 — Dono vai vender o barco (dossiê / Selo Ouro)

`/barco` → "Selo Ouro" (link no fim da ficha, 2 toques) → `http://localhost:3050/barco/selo`. Tela real:
> "Selo Ouro / O selo reconhece documentação e histórico completos no app. Quem qualifica o selo de fato é a avaliação presencial da equipe Commander — este checklist só prepara o pedido. / **Completude 2 de 7** / Dados gerais completos — Resolver (`/barco/editar`) / Motor com horas registradas ✓ / 3 ou mais documentos com validade em dia — Resolver (`/barco/documentos`) / Nada vencido ✓ / Ao menos 1 foto no acervo — Resolver (`/barco/fotos`) / 6 ou mais eventos no diário — Resolver (`/diario`) / Contato cadastrado — Resolver (`/barco/contatos`) / **Solicitar avaliação presencial**"

Cada "Resolver" leva pro lugar certo — conferi todos os `href` no DOM, batem exatamente com o item. Não cliquei "Solicitar avaliação presencial" (dispara e-mail real pra equipe, `lib/acoes/selo.ts`), mas o código mostra trava contra clique duplo (30 dias), grava a intenção mesmo sem `RESEND_API_KEY`, e nunca finge que enviou se falhar.

**Toques:** 2 até o checklist; cada "Resolver" é 1 toque pro lugar certo.
**Onde quebra:** não quebra.
**Correção proposta:** nenhuma — fluxo modelo.

### 9 — Parceiro comercial se cadastra e aparece no mapa

Descoberta: `/menu` → seção **"Para estabelecimentos"** → "É marina, posto, pousada ou restaurante? / Publique seu perfil e apareça no mapa de quem navega perto." — **corrige o achado #6 da síntese anterior** ("painel do parceiro inalcançável pra quem está logado"): agora tem link direto no Menu.

Testei o cadastro real (mesma conta logada — o código não distingue papel de usuário, então qualquer conta pode publicar um perfil de parceiro): `http://localhost:3050/parceiro`, preenchi Nome "Marina Teste Auditoria", Diária "150,00", Horário, Telefone, mantive o ponto padrão do mapa (Baía de Guanabara, -22.83/-43.15 — o formulário já vem com esse fallback em input oculto, mesmo com o mapa carregado) e submeti. Resultado real: **"Perfil salvo" / "0 proprietários viram seu perfil"**, botão virou "Salvar alterações", apareceu seção "Fotos (0/3)".

Conferi em `app/(app)/navegar/page.tsx`: a query busca `parceiros` com `visivel = true`, e meu perfil nasce com `visivel` marcado por padrão — deve aparecer como pino no mapa (não pude confirmar visualmente por ser canvas, ver nota de método).

**Toques:** Menu (1) + link Para estabelecimentos (1) + Nome (1) + Diária (1) + Publicar perfil (1) = **5 toques** no mínimo (categoria e ponto no mapa já vêm com padrão razoável).
**Onde quebra:** não quebra — bom exemplo de fallback (mapa sem interação ainda garante um valor válido).
**Correção proposta:** nenhuma.

### 10 — Dono cancela a assinatura

`/menu` → "Assinatura" (2 toques) → `http://localhost:3050/menu/assinatura`. Nesta conta de teste, real: **"Você ainda não é assinante / A promo de fundador trava o preço enquanto a assinatura durar. / Ver planos"** — não há assinatura ativa pra cancelar (não criei uma: exigiria pagamento real via Asaas, fora do escopo permitido).

Via código (`lib/acoes/assinatura.ts` + `app/(app)/menu/assinatura/page.tsx`):
- Botão "Cancelar assinatura" usa confirmação inline em 2 passos (mesmo componente `<Confirmar>` do resto do app — sem modal separado): "Cancelar a assinatura? **O dossiê do barco fica congelado.**" → Confirmar/Cancelar.
- `cancelarAssinatura()` cancela no Asaas e marca `status = "cancelada"" no banco. **Não apaga nada** — barco, motores, diário, documentos, fotos continuam intactos.
- **Achado:** a promessa "fica congelado" não corresponde ao mecanismo real. O gate de cobrança (`app/(app)/layout.tsx`) só existe atrás da flag `NEXT_PUBLIC_COBRANCA_ATIVA` — que **não está definida em `.env.local` nesta base** (confirmei por grep), ou seja, hoje cancelar não muda nada de acesso na prática. Quando a flag for ligada, o mecanismo não é "congelar" (deixar visível e travado pra edição) — é um **redirect duro pra `/assinar`** em toda página de `(app)`, ou seja, o dono simplesmente não entra mais, não vê um dossiê congelado. E o próprio código comenta explicitamente: **"CMDT/tripulação nunca vê paywall"** — um marinheiro convidado continua com acesso total mesmo depois do dono cancelar.
**Correção mais barata:** trocar "O dossiê do barco fica congelado" por algo fiel ao mecanismo real (ex.: "Você perde o acesso até assinar de novo — os dados continuam guardados") antes de ligar a flag; e decidir explicitamente (não por omissão) se tripulação deve mesmo continuar acessando após o dono cancelar.

---

## Becos sem saída encontrados

1. **Prestador sem cadastro, no meio do registro de serviço** (`/diario/novo`) — ir cadastrar o contato apaga tipo, descrição, custo, horas e item selecionados. Único beco sem saída de "perde o que preencheu" confirmado nesta rodada.
2. **Marketplace de Comandantes vazio** (`/marketplace`) — não é beco de navegação (a tela explica e devolve um link pra criar perfil de comandante), mas é beco de conteúdo: hoje não dá pra completar o fluxo 4 até o fim.
3. Já **não são** becos sem saída (corrigidos desde 08/08, confirmado ao vivo): cards de alerta da Início (agora são `<Link>`), anexo do diário (reabre via URL assinada em `/barco/gastos`), `/parceiro` (agora tem link no Menu).

---

## Os 3 fluxos mais quebrados (o que fazer primeiro)

1. **Fluxo 2 — Registrar serviço.** É o fluxo de maior frequência de uso (o dono faz isso toda vez que mexe no barco) e tem os dois achados mais sérios da auditoria: perda de formulário ao cadastrar prestador, e a leitura de horas do motor que não se propaga — o número mais visível do app (Início) fica desatualizado logo depois que o dono acabou de informar o certo. Corrigir primeiro: (a) preservar estado ao voltar de "Cadastrar contato", (b) atualizar `equipamentos.horas_atuais` quando "horas" é preenchido no registro.
2. **Fluxo 7 — Quanto gastei no ano.** Pergunta direta do dono, sem resposta direta na tela — só "mês" e "6 meses". Correção é pequena (a query já busca desde o ano passado) e o impacto é alto porque é exatamente a pergunta que a auditoria pediu pra testar.
3. **Fluxo 10 — Cancelar assinatura.** Baixo risco hoje (billing nem está ligado), mas a mensagem de confirmação promete um comportamento ("congelado") que o código não implementa — se isso for ao ar sem revisão, o primeiro cancelamento real vira um mal-entendido de suporte. Resolver antes de ligar `NEXT_PUBLIC_COBRANCA_ATIVA`.

*(Fluxo 6 — mapa/navegação — não entra no ranking porque não consegui testá-lo de ponta a ponta nesta sessão; é a maior lacuna de cobertura desta auditoria, não necessariamente o fluxo mais quebrado.)*

---

## Os fluxos que já estão bons (e por quê)

- **Fluxo 3 — Conferir se está tudo em dia.** Zero toques: abrir o app já responde "posso sair amanhã?" com farol + vencimentos + mar + motor na mesma tela, e agora distingue honestamente "tudo em dia" de "falta informação" (testado ao vivo nos dois estados). É o modelo de "responder antes de perguntar".
- **Fluxo 5 — Convidar tripulação.** 3 toques até um link pronto pra mandar, texto de permissão em linguagem de dono ("o que ele pode ver e editar", não "matriz de permissões"), e a restrição do lado do marinheiro é reforçada duas vezes — escondida na UI e bloqueada na página, com mensagem que nomeia a área certa. Só perde ponto no nome da seção ("Comandantes" vs. "Tripulação").
- **Fluxo 8 — Selo Ouro / vender o barco.** Checklist com link certeiro por item, "Completude X de 7" sempre visível, e a única ação irreversível (pedir avaliação) é honesta sobre o que é automático (nada) e o que é humano (tudo). Modelo de como comunicar um processo que depende de gente de verdade sem prometer mágica.
- **Fluxo 9 — Parceiro se cadastra.** Formulário longo mas com padrão sensato em tudo que pode ter padrão (ponto no mapa nasce em Guanabara mesmo sem arrastar o pino), confirmação imediata e visível ("Perfil salvo" + contador de visualizações desde o primeiro acesso).
- **Fluxo 1 — Onboarding.** Só um campo obrigatório (nome do barco) pra sair da tela; tudo que a pessoa não sabe de cabeça (horas do motor, vencimentos) fica genuinamente opcional e o app não finge saber o que não sabe.
