# Auditoria de vocabulário — Commander

**Data:** 08/08/2026
**Lente:** um dono de lancha de 50 pés, 55 anos, não é pessoa de tecnologia. Ele fala "o barco", "os motores", "o seguro venceu", "a vistoria", "o marinheiro", "levei pra docagem", "o horímetro" — não fala "item monitorado", "entidade", "aba", "registro", "evento", "vínculo", "matriz de permissões".
**Escopo:** todas as strings visíveis ao usuário em `web/app/`, `web/components/`, `web/lib/acoes/`, `web/lib/domain/`.

---

## Resumo executivo

O app tem uma voz náutica genuinamente boa em vários lugares ("Bom vento e mar calmo", "O dossiê do seu barco", "Essa saída durou 3h30"). O problema não é falta de talento de escrita — é que **o vocabulário de software vaza por baixo da porta** em pontos específicos e recorrentes: a palavra "aba" é usada para duas estruturas diferentes da tela, o mesmo botão de "registrar algo no diário" tem três nomes diferentes dependendo de onde você está, e a tela de notificações muda de nome três vezes entre o menu, o título e o conteúdo. É esse tipo de coisa — não falta de "voz de marca" — que faz o dono da lancha sentir que está usando um sistema em vez de cuidar do barco.

---

## Glossário: termo atual → termo proposto

| Termo atual | Onde aparece | Termo proposto | Justificativa |
|---|---|---|---|
| **Item monitorado** | Títulos de página, formulários, listas (`barco/itens/novo`, `barco/itens/[id]/editar`, `barco/equipamento/[id]`) | **"O que acompanhar"** / no contexto: "Novo lembrete de manutenção" ou simplesmente **"Manutenção"** quando ligado a equipamento, **"Vencimento"** quando é documento | "Item monitorado" é jargão de sistema de gestão de ativos — ninguém no barco diria isso. O próprio app já usa "vencimento" e "documentos com vencimento" em outras telas; o conceito unificador é "coisa que precisa de atenção antes de uma data ou de X horas". Ver nota de confirmação com o dono abaixo — o nome ideal pode variar por categoria (óleo é "troca", documento é "vencimento", correia é "revisão"). |
| **Aba** (nas mensagens de erro de permissão e na matriz) | `lib/acoes/equipamentos.ts:87,116`; `lib/acoes/itens.ts:66,96,111,153`; `menu/tripulacao/[id]/page.tsx:64` (coluna "Aba") | **"área"** (ex.: "área de Motores", "essa área do barco") | "Aba" já é usada para as 5 abas de navegação embaixo da tela. Usá-la também para as 9 seções de permissão (Motores, Elétrica, Casco, Documentos, Fotos, Contatos, Gastos, Diário, Embarcação) cria duas hierarquias colidindo sob o mesmo nome. Ver seção de Inconsistências. |
| **Marketplace** | `bottom-nav.tsx:19`, `marketplace/page.tsx:15`, `marketplace/perfil/page.tsx:27` | **"Comandantes"** (o rótulo da aba) — a própria página já descreve certo: "Comandantes disponíveis para contratar direto pelo WhatsApp" | É a única palavra em inglês solta na navegação principal de um app em português para um público de 55+. O conteúdo real (contratar comandante/marinheiro) já tem nome em português mais claro do que "marketplace". |
| **Vitrine do marketplace** | `marketplace/perfil/page.tsx:66` ("Aparecer na vitrine do marketplace") | **"Aparecer na lista de comandantes"** | Mistura duas metáforas (vitrine + marketplace) na mesma frase para a mesma coisa. |
| **Matriz de permissões** | `menu/tripulacao/page.tsx:105` ("Você ajusta o acesso em detalhe depois, na matriz de permissões.") | **"na tela de acessos, área por área"** | "Matriz" é vocabulário de planilha/RH. A própria tela que ela referencia já usa a frase boa: "Defina, aba por aba [trocar para "área por área"], o que este comandante vê e edita." |
| **Cota de nuvem** | `barco/fotos/page.tsx:51` | **"Espaço de fotos"** | "Cota de nuvem" presume que o leitor sabe o que é armazenamento em nuvem e como cotas funcionam. "Espaço de fotos: 340 MB de 2 GB" comunica o mesmo sem o conceito técnico. |
| **Acervo do barco** | `barco/page.tsx:211` (título de seção que agrupa Fotos, Diário, Documentos, Contatos, Gastos) | **"Fotos e histórico"** ou **"Tudo sobre o barco"** | "Acervo" (coleção/arquivo) é uma palavra elegante mas rara no vocabulário falado — ninguém "guarda no acervo", guarda "os documentos" ou "as fotos". |
| **Evento** (como rótulo de botão/página, não como conceito de banco) | `diario/page.tsx:65,87` ("+ Evento", "Nenhum evento"), `diario/novo/page.tsx:42` ("Novo evento") | **"+ Registro"** ou **"+ Anotação"** (ver Inconsistências — precisa casar com o resto do fluxo) | "Evento" é neutro/administrativo. O próprio app já usa "Registrar" e "Lançamento" para a mesma ação em outras telas — a inconsistência é o problema real, mas nenhum dos três nomes atuais é claramente o vencedor; "Registro" é o mais próximo da fala natural ("registrei a saída"). |
| **Avisos / Notificações / Alertas** | Ver Inconsistências | **"Avisos"** (fixar um só nome em todo lugar) | Três nomes para a mesma tela. "Avisos" é o mais simples e já é o rótulo da navegação principal — as outras telas deveriam seguir ele, não o contrário. |
| **Selo Ouro** | `barco/selo/page.tsx`, `barco/page.tsx:191` | Manter — já é bem explicado na própria tela ("O selo reconhece documentação e histórico completos no app...") | Não é jargão de software, é uma metáfora física (selo de qualidade) que funciona. Só cuidado com a colisão de nome com "Selo Fundador" (ver Inconsistências). |
| **Fundador** / **Selo Fundador** | `menu/assinatura/page.tsx:105`, `app/page.tsx:38` | Manter "Fundador"; ajustar a página inicial pra não chamar de "Selo Fundador" já que dentro do app ele nunca é chamado de "selo" | Ver Inconsistências — mesmo texto, dois nomes. |
| **Farol / Semáforo** (nomes de variável e comentário, não aparecem na tela) | `components/farol.tsx`, `lib/domain/semaforo.ts` | Não precisa mudar nada visível — não vazam pro usuário. A UI mostra "Tudo em dia" / "Precisa de atenção" / "Item vencido", que já são claros. | — |
| **Horímetro** | `components/horimetro.tsx`, rótulos de campo | Manter — é o nome real do instrumento que o dono do barco já usa. | Confirma vocabulário náutico correto. |
| **Tripulação / vínculo / CMDT / PROP** | Ver seção dedicada abaixo | Manter "Tripulação" e "Comandante" (que já é o nome visível); "vínculo", "CMDT", "PROP" são só nomes internos de código/banco — não aparecem na tela. | Não é um problema de UX porque o usuário nunca vê essas siglas — mas ver nota de risco abaixo. |
| **Dê um nome ao item / item nessa aba** | `lib/acoes/itens.ts:41,66` | "Dê um nome a essa manutenção" / "criar isso nessa área" | Consequência direta de "item" + "aba" — ver acima. |

---

## As 15 piores strings do app

1. **`web/app/(app)/menu/tripulacao/page.tsx:105`**
   Atual: `"Você ajusta o acesso em detalhe depois, na matriz de permissões."`
   Proposto: `"Você ajusta o acesso em detalhe depois, área por área."`
   Por quê: "matriz de permissões" é a única frase do app que soa como um manual de sistema corporativo. É a primeira coisa que o proprietário lê ao convidar um comandante — pior lugar possível pra isso acontecer.

2. **`web/lib/acoes/equipamentos.ts:87` e `:116`**
   Atual: `"Não foi possível criar — confira seu acesso a esta aba."` / `"Não foi possível salvar — confira seu acesso a esta aba."`
   Proposto: `"Não deu para salvar. Peça ao proprietário para liberar seu acesso a Motores/Elétrica."`
   Por quê: "aba" não diz qual aba; a pessoa não sabe se precisa recarregar, pedir permissão ou tentar de novo. Nomear a área específica resolve a ambiguidade.

3. **`web/app/(app)/diario/page.tsx:65` vs `web/app/(app)/barco/gastos/page.tsx:44` vs `web/components/registro-rapido.tsx:38`**
   Atual: "+ Evento" / "+ Lançamento" / "+ Registrar"
   Proposto: usar **"+ Registro"** nos três lugares (ou "+ Novo registro")
   Por quê: é o mesmo formulário (`criarEvento`) acessado de três entradas com três nomes. Ver Inconsistências.

4. **`web/app/(app)/barco/fotos/page.tsx:51`**
   Atual: `"Cota de nuvem"`
   Proposto: `"Espaço de fotos"`
   Por quê: aparece toda vez que a pessoa vai adicionar uma foto — é onde ela mais precisa entender rápido o que está vendo (uma barra de progresso sem explicação nenhuma do que "cota" significa).

5. **`web/lib/acoes/itens.ts:66`**
   Atual: `"Seu acesso não permite criar item nessa aba."`
   Proposto: `"Peça ao proprietário para liberar seu acesso a essa área do barco."`
   Por quê: "item" + "aba" empilhados na mesma frase — dois jargões de uma vez, e de novo sem dizer qual aba nem o que fazer.

6. **`web/lib/acoes/onboarding.ts:35`**
   Atual: `"Não foi possível criar a embarcação"`
   Proposto: `"Não deu para cadastrar o barco agora. Confira sua conexão e tente de novo."`
   Por quê: é o erro que pode acontecer no primeiro contato do usuário com o app (onboarding) — não diz nada sobre o que fazer.

7. **`web/lib/acoes/embarcacao.ts:56`**
   Atual: `"Não foi possível salvar. Confira seu acesso e tente de novo."`
   Proposto: (já está razoável, mas) `"Não deu para salvar os dados do barco. Se você for comandante, pode ser que o proprietário não liberou edição aqui — senão, tente de novo em instantes."`
   Por quê: "confira seu acesso" pressupõe que a pessoa sabe o que é "acesso" no sistema de permissões — ela só quer salvar o comprimento do casco.

8. **`web/app/(app)/marketplace/perfil/page.tsx:66`**
   Atual: `"Aparecer na vitrine do marketplace"`
   Proposto: `"Aparecer na lista de comandantes disponíveis"`
   Por quê: checkbox que decide se o comandante aparece publicamente — precisa ser inequívoco, e mistura dois termos (vitrine/marketplace) pra mesma coisa.

9. **`web/lib/acoes/documentos.ts:32`**
   Atual: `"Não foi possível criar o vencimento do documento."`
   Proposto: `"Não deu para salvar a data de vencimento. Tente de novo."`
   Por quê: "criar o vencimento" é uma frase que só faz sentido para quem pensa em termos de registros de banco de dados — vencimento não é algo que se "cria".

10. **`web/lib/acoes/vinculos.ts:18` e `:47`**
    Atual: `"Não foi possível salvar — confira seu acesso."` / `"Não foi possível remover."`
    Proposto: `"Não deu para salvar as permissões. Recarregue a página e tente de novo."` / `"Não deu para remover o comandante da tripulação. Tente de novo."`
    Por quê: erro genérico demais na própria tela que gerencia acesso — dobra a confusão.

11. **`web/lib/acoes/local.ts:21`**
    Atual: `"Coordenadas fora do intervalo (lat -90..90, lon -180..180)."`
    Proposto: `"Essas coordenadas não existem no mapa. Confira se copiou certo do GPS ou do Google Maps."`
    Por quê: notação de programação (`-90..90`) pura, exposta na tela. Ninguém que não seja dev lê isso.

12. **`web/app/api/asaas/webhook/route.ts:29`** (visível em log/retorno de API, mas registra o padrão do resto do app)
    Atual: `"sem evento"`
    Proposto: não é tela do usuário — ignorar, citado só para registrar que "evento" também é o nome técnico interno do webhook de pagamento, reforçando por que reaproveitar essa palavra na tela do Diário é arriscado.

13. **`web/lib/acoes/parceiro.ts:107,115,116`**
    Atual: `"Não foi possível salvar. Confira seu acesso e tente de novo."` (repetida 3x, idêntica a outras 6 mensagens no app)
    Proposto: variar por causa real: `"Não deu para salvar seu perfil de parceiro. Tente de novo em instantes."`
    Por quê: "confira seu acesso" é copiado e colado em telas onde não há noção de permissão nenhuma (parceiro é o próprio dono do cadastro) — a frase não faz sentido ali.

14. **`web/lib/acoes/itens.ts:81,139,159` e equivalentes em `equipamentos.ts`, `embarcacao.ts`**
    Atual: `"Não foi possível criar o item. Confira seu acesso e tente de novo."` / `"Não foi possível salvar — confira seu acesso."` / `"Não foi possível excluir — confira seu acesso."`
    Proposto: `"Não deu para salvar. Se for comandante, pode ser falta de permissão — senão, tente de novo."`
    Por quê: é o padrão mais repetido do app (aparece ~10 vezes) — sempre a mesma fórmula "confira seu acesso" quando na prática pode ser erro de rede, RLS, ou validação. Vale um texto único e mais claro, centralizado.

15. **`web/lib/acoes/registro.ts:26,66`**
    Atual: `"Informe um número de horas válido."` / `"Parte do registro não pôde ser salva. Confira e tente de novo."`
    Proposto: `"Digite as horas do motor (só números, ex.: 1250,5)."` / `"Salvamos as horas, mas o combustível ou a observação não foram. Confira e tente de novo."`
    Por quê: a primeira não dá exemplo do formato esperado; a segunda é vaga sobre qual "parte" falhou — importa porque é o fluxo "Registro Rápido", usado toda vez que a pessoa volta ao mar (alta frequência).

---

## Mensagens de erro — as que não dizem o que fazer

Padrão dominante no app: **"Não foi possível X — confira seu acesso"** ou **"...e tente de novo"**, sem dizer o que causou o problema nem o que fazer diferente. Ocorrências (não exaustivo, mas mapeia o padrão):

- `web/lib/acoes/equipamentos.ts:87,116,142`
- `web/lib/acoes/itens.ts:81,139,159`
- `web/lib/acoes/embarcacao.ts:56`
- `web/lib/acoes/vinculos.ts:18,47`
- `web/lib/acoes/contatos.ts:22,35,46`
- `web/lib/acoes/documentos.ts:53,83,92,113`
- `web/lib/acoes/fotos.ts:57,79`
- `web/lib/acoes/perfil.ts:37`
- `web/lib/acoes/perfil-comandante.ts:29`
- `web/lib/acoes/parceiro.ts:107,115,116,143,152,178`
- `web/lib/acoes/convites.ts:45,55`

"Confira seu acesso" é ambíguo porque pode significar três coisas bem diferentes (sem permissão de comandante / sessão expirada / erro de rede) e a pessoa não sabe qual delas resolver. Quando é mesmo problema de permissão, o app já sabe disso no código (`podeEditar(...)` retornou falso) — vale a pena diferenciar a mensagem: **"Você não tem permissão para editar isso — peça ao proprietário"** quando é permissão, e **"Não deu para salvar agora, tente de novo em instantes"** quando é qualquer outra falha.

**Contraexemplos bons** (o app sabe fazer isso quando quer):
- `web/lib/acoes/fotos.ts:41`: `"Cota de nuvem cheia. Apague fotos antigas para liberar espaço."` — diz a causa e a ação (só precisa perder "cota de nuvem").
- `web/lib/acoes/parceiro.ts:22-23`: `"O preço só pode ser atualizado uma vez por dia."` — regra clara, sem jargão.
- `web/lib/acoes/eventos.ts:40`: `"Informe um custo válido (ex.: 1.850,00)."` — dá exemplo do formato esperado.
- `web/app/error.tsx:13-14`: `"Não foi possível carregar seus dados. Verifique a conexão e tente de novo."` — diz uma causa plausível (conexão) e a ação.

---

## Inconsistências (mesmo conceito, nomes diferentes)

### 1. A tela de avisos muda de nome três vezes
- Ícone da navegação (`bottom-nav.tsx:24`): **"Avisos"**
- Título da própria página (`notificacoes/page.tsx:35`): **"Notificações"**
- Seção dentro do Menu que leva pra lá (`menu/page.tsx:70,72-74`): **"Alertas"** / "Configurar alertas"
- Dentro da própria página: seções **"Alertas ativos"** e **"Avisos enviados"**

Quatro nomes (Avisos, Notificações, Alertas, mais a distinção interna "alertas ativos vs. avisos enviados") pra uma coisa só. É a inconsistência mais visível do app porque bate o usuário toda vez que ele navega. Recomendação: fixar em **"Avisos"** em todo lugar (já é o nome da navegação, que é o ponto de entrada mais frequente); dentro da página, "O que está vencendo" e "Histórico de avisos" no lugar de "Alertas ativos"/"Avisos enviados" — mantém "aviso" como a palavra única.

### 2. O botão de registrar algo no diário tem três nomes
- Na tela do Diário (`diario/page.tsx:65,87`): botão **"+ Evento"**, texto vazio "Toque em '+ Evento'"
- Título do formulário que abre (`diario/novo/page.tsx:42`): **"Novo evento"**
- Na tela de Gastos, o mesmo formulário é aberto por (`barco/gastos/page.tsx:44-47`): botão **"+ Lançamento"**
- No atalho de registro rápido (`registro-rapido.tsx:38,46,72`): botão **"+ Registrar"**, título do modal "Registrar volta ao mar", botão de enviar "Salvar no diário"

É literalmente a mesma ação de banco de dados (`criarEvento`/`eventos`) com quatro rótulos diferentes dependendo de por onde a pessoa entrou. Ninguém aprende "ah, evento = lançamento = registro" — cada tela ensina de novo.

### 3. "Aba" nomeia duas coisas diferentes
- As 5 abas da navegação: Início, Embarcação, Marketplace, Avisos, Menu (`bottom-nav.tsx`)
- As 9 "abas" de permissão da tripulação: Embarcação, Motores, Elétrica, Casco, Documentos, Fotos, Contatos, Gastos, Diário (`lib/domain/permissoes.ts:1-4`, coluna "Aba" em `menu/tripulacao/[id]/page.tsx:64`)

São estruturas completamente diferentes (uma é navegação de app, a outra é uma lista de seções do barco) usando a mesma palavra. Quando o erro diz "confira seu acesso a esta aba", o usuário não tem como saber se é uma das 5 ou uma das 9.

### 4. "Selo Fundador" (marketing) vira só "Fundador" (produto)
- Página inicial (`app/page.tsx:38`): "Selo Fundador #N gravado no seu perfil, para sempre."
- Dentro do app (`menu/assinatura/page.tsx:105`): "Fundador #{numero}" — sem a palavra "selo"

Pequeno, mas confuso porque o app já tem outro "selo" de verdade (Selo Ouro) num contexto totalmente diferente (qualidade/documentação do barco vs. assinatura). Chamar o número de fundador de "selo" também arrisca o usuário achar que tem alguma relação com o Selo Ouro. Sugestão: nunca chamar de "selo" fora da página de marketing, ou trocar por "Emblema de fundador" só na landing.

### 5. "Diário de Bordo" é o nome público — "Livro de Bordo" só existe em comentários de código
Não é um problema pro usuário (ele nunca vê "Livro de Bordo"), mas vale registrar para quem for mexer no código: `registro-rapido.tsx:18`, `diario/page.tsx:51,105`, `diario/[id]/horas/page.tsx:18` e `lib/acoes/eventos.ts:67` chamam o recurso de "Livro de Bordo" nos comentários, enquanto toda a UI usa "Diário de Bordo". Não precisa virar tarefa de copy, mas é um sinal de que o próprio time interno hesita entre os dois nomes — bom fixar "Diário de Bordo" também nos comentários pra não vazar pra UI por acidente no futuro.

### 6. "Registro rápido" — o nome do componente nunca aparece na tela
O arquivo se chama `registro-rapido.tsx` e o botão flutuante diz apenas **"+ Registrar"**. Isso é ok — só registro para explicar por que ele não apareceu na lista de "nomes visíveis" acima apesar de estar nos termos a auditar.

---

## O que já está bom (a voz que devemos copiar)

- **`web/app/(app)/hoje/page.tsx:120`** e **`web/app/(app)/notificacoes/page.tsx:46`**: `"Nenhum vencimento na margem. Bom vento e mar calmo."` / `"Nada vencido nem na margem. Bom vento e mar calmo."` — tom náutico genuíno, comunica "tudo certo" sem soar clínico.
- **`web/app/(assinatura)/assinar/page.tsx`**: "Seja fundador", "Preço travado enquanto a assinatura durar", "Cartão ou Pix, direto na página segura do Asaas. Nada de cartão aqui no app." — direto, sem jargão de pagamento, e ainda tranquiliza sobre segurança.
- **`web/app/(app)/diario/[id]/horas/page.tsx:53,55,96`**: `"Essa saída durou 3h30."` / `"Atualizar as horas dos motores?"` / botão de recusa **"Agora não"** em vez de "Cancelar" — humaniza um fluxo que poderia ser um formulário chato, e "Agora não" é gentil sem fechar a porta.
- **`web/app/(app)/barco/fotos/page.tsx:46,84`**: `"O álbum do barco — e o dossiê que vale na hora de vender."` / `"Fotos boas valorizam o barco e contam a história dele."` — vende o valor da ação, não só descreve a tela.
- **`web/app/(app)/barco/selo/page.tsx:27-29`**: explica com clareza o que o Selo Ouro é e não é — "Quem qualifica o selo de fato é a avaliação presencial da equipe Commander — este checklist só prepara o pedido." Modelo de como desambiguar um recurso que poderia confundir.
- **`web/app/onboarding/page.tsx:39,89`**: "3 passos rápidos. O resto você completa depois, aos poucos." / botão final "Criar meu painel de bordo" — reduz a ansiedade de formulário longo e fecha com um nome bonito em vez de "Enviar" ou "Salvar".
- **`web/lib/acoes/fotos.ts:41`**: `"Cota de nuvem cheia. Apague fotos antigas para liberar espaço."` — mesmo usando "cota de nuvem" (que recomendamos trocar), é um dos poucos erros do app que diz causa + ação certa.
- **`web/app/(app)/menu/assinatura/page.tsx:18-40`** (`ROTULO_COBRANCA`): tradução cuidadosa de todos os status de cobrança do Asaas para português, incluindo os de disputa/estorno — com um comentário no próprio código explicando a intenção ("deixar vazar o código cru em inglês seria o pior momento possível"). Esse é o padrão a replicar em todo o app: nunca mostrar um status técnico cru.
- **`web/app/(app)/barco/local/page.tsx:30`**: `"Vá até o barco e toque em 'Usar minha posição atual'"` — instrução operacional concreta, fala como se estivesse ao lado da pessoa.

---

## Perguntas para o dono (termos náuticos que preciso confirmar)

1. **"Item monitorado"** — qual seria o nome natural pra isso na boca de um comandante? "Manutenção programada"? Depende do tipo (óleo = "troca", casco = "revisão", documento = "vencimento")? Vale considerar nomes diferentes por categoria em vez de um termo genérico único.
2. **"Docagem"** (tipo de evento em `campos-navegacao-evento.tsx:11`) — é assim que se fala mesmo, ou o termo comum no Rio é outro ("carreira", "marinha seca")?
3. **"Casco"** como categoria de manutenção (pintura, antifouling, etc.) — o dono separaria isso de "convés" ou de "obra viva/obra morta"? O app trata tudo como "Casco" — pode estar simplificando demais ou pode estar correto, preciso confirmar.
4. **"Zera o ciclo"** (`diario/novo/page.tsx:63`: "Este serviço zera o ciclo de… (opcional)") — essa é uma expressão que faz sentido pra quem lida com manutenção preventiva? Ou soa estranha fora do contexto de motor?
5. **"Concierge de bordo"** (`app/page.tsx` benefícios do plano fundador) — termo de hotelaria aplicado ao barco; não tenho certeza se comunica bem pro público-alvo ou se soa desconectado do resto do vocabulário náutico do app.
6. **"Boletim do mar"** (`hoje/page.tsx:145`, com dados de onda/vento/água) — nome bom e claro, mas vale confirmar se é como os comandantes locais chamam essa previsão, ou se há um termo mais usado no Rio (ex.: "condições do mar", "previsão marítima").
7. **Bombordo/Boreste (BB/BE)** já usados corretamente em `equipamento/novo` — só confirmar que a abreviação BB/BE ao lado do nome completo é suficiente ou se vale sempre escrever por extenso na primeira aparição de cada tela.

---

## Notas finais

- O app usa "aba" repetidas vezes em mensagens de erro sem nunca dizer QUAL aba — mesmo trocando a palavra por algo mais simples, toda mensagem de "seu acesso não permite" deveria citar o nome da área específica (ex.: "não permite editar Motores", não "não permite editar este item").
- Praticamente toda mensagem de sucesso do app usa o padrão de toast (`toast.tsx`) que só mostra o texto — vale conferir se todas as `redirect(...?ok=...)` no código descrevem o que de fato aconteceu (a maioria descreve bem: "Assinatura criada — o link de pagamento chega por e-mail", "Embarcação cadastrada" — esses são bons exemplos).
- Nenhuma das 39 telas revisadas usa a palavra "entidade", "registro" (como substantivo genérico) ou "campo obrigatório" — esses jargões específicos citados no briefing não aparecem no app. O problema real está concentrado em "aba", "item monitorado", "matriz de permissões", "acervo"/"cota" e nas mensagens de erro genéricas "confira seu acesso".
