# Auditoria de usabilidade — primeira vez no Commander

Pesquisador de usabilidade · 08/08/2026 · Lente: dono de lancha de 50 pés, 55 anos, não é pessoa de tecnologia, no píer, sol na tela, marinheiro do lado esperando. Se não entender em 10 segundos, fecha o app.

Base: código-fonte em `C:\Users\erick\GEST-NAV\web` — sem login, a experiência foi reconstruída lendo JSX, textos e a lógica de domínio (`lib/domain/semaforo.ts`, `lib/consultas.ts`, `lib/acoes/onboarding.ts`) que decide o que aparece na tela.

**Veredito em uma frase:** o app não trava porque falta funcionalidade — trava porque a Início mostra dado falso como se fosse real (badge "Tudo em dia" com zero dado real por trás) e porque o único card que grita "resolva isso" na tela não faz nada quando tocado. O dono que reclamou de travar no Início muito provavelmente tentou tocar no alerta vencido e não aconteceu nada.

---

## O primeiro minuto (narrativa passo a passo)

### (a) Dono que acabou de cadastrar o barco — quase nada preenchido

Ele terminou o onboarding preenchendo só o nome do barco (único campo obrigatório) e deixou o resto no padrão: 2 motores pré-selecionados, sem marca, sem horas, sem data de seguro. Chega na Início (`web/app/(app)/hoje/page.tsx`).

1. **Primeira coisa que os olhos batem:** o card escuro grande no topo (`CardEmbarcacao`, `web/components/card-embarcacao.tsx:30-88`) — sem foto (ele nunca subiu uma), mostra um ícone de câmera cinza e, se ele pode editar, o texto "Adicionar foto da embarcação" (`card-embarcacao.tsx:43`). No canto superior direito, um badge **verde** "Tudo em dia" (`card-embarcacao.tsx:6-9, 80-85`). Cor + posição fazem esse badge vencer a atenção de qualquer outro elemento da tela.
2. Abaixo do card, uma fileira de 3 bolinhas coloridas com números — 0, 0, 4 (`hoje/page.tsx:104-108`) — sem nenhuma palavra ao lado explicando o que são.
3. Label "Tudo em dia" de novo (`hoje/page.tsx:116`) e a caixa: **"Nenhum vencimento na margem. Bom vento e mar calmo."** (`hoje/page.tsx:120`).
4. **O que ele não sabe:** por trás dessa calma verde existem 4 itens de manutenção que o onboarding criou sozinho, sem avisar — "Revisão geral" e "Troca de óleo e filtros" para cada motor (`web/lib/acoes/onboarding.ts:9-12`), todos com `ultimo_ciclo_data` = hoje e vencimento calculado a partir de hoje (`onboarding.ts:71-72`). Nenhum dado real de manutenção foi informado — o app inventou uma linha de base. Ele nunca viu essa lista, nunca confirmou essas datas, e a tela está dizendo "tudo em dia" para dados que ele nunca digitou.
5. Desce e vê "Ligue o boletim do mar" (`hoje/page.tsx:147-151`) — ação clara, tem CTA.
6. Vê o botão "Iniciar navegação — gravar trilha" (`hoje/page.tsx:158-162`) — ele está no píer, nem saiu ainda. Não entende quando usar isso nem o que é "trilha".
7. Vê "Horas de motor": dois cartuchos, "BB 0,0 h" e "BE 0,0 h" (`hoje/page.tsx:164-180`, fallback `?? 0` na linha 176). Ele **não digitou nenhuma hora** — mas a tela mostra "0,0 h" como se fosse uma leitura real do motor. Motor com zero hora nem existe nesse barco (ele já roda a lancha há anos). Isso quebra confiança: "esse app não sabe nada do meu barco e ainda inventa número".
8. "Acesso rápido" (motores, docs, diário, contatos) — ícones + texto curto, ele entende o que são, mas todos levam a telas vazias.
9. **Próxima ação óbvia? Não existe.** Nada na tela diz "seu cadastro está incompleto, complete X". A cor verde e a frase "tudo em dia" dizem exatamente o oposto do que é verdade.

### (b) Dono com barco em dia (dados reais, revisões em dia)

Olho bate no mesmo lugar — badge verde "Tudo em dia" — e aqui a informação é **verdadeira**. Horímetros mostram horas reais. Boletim do mar aparece (se marina cadastrada). Não há próxima ação óbvia e está certo que não haja: é o estado de repouso do produto. **Este caminho funciona bem** — o problema é que, no código, os casos (a) e (b) são visualmente idênticos.

### (c) Dono com item vencido

1. Olho bate no badge **vermelho** "Item vencido" no card (`card-embarcacao.tsx:81-84`) — correto, alto contraste, posição de destaque.
2. Desce e bate no primeiro card de "Precisa de atenção" (`hoje/page.tsx:114-116, 123-141`): ícone vermelho, texto "vencido há 12 dias" em destaque à direita (`textoRestante`, `web/lib/domain/semaforo.ts:78-87`). É o texto mais claro de toda a tela.
3. **Ele tenta tocar no card para resolver o vencimento (renovar o seguro, dar baixa na revisão) — e nada acontece.** O card é um `<div>` sem `href`, sem `onClick` (`hoje/page.tsx:124-141`). Compare com `web/app/(app)/barco/page.tsx:140-144`, onde o item equivalente (documento na aba Embarcação) **é** um `<Link href="/barco/itens/${i.id}/editar">`. Na Início, especificamente, o alerta mais importante da tela é morto ao toque.
4. Ele toca de novo, tateia em volta do card, não acontece nada — **é aqui que ele trava e desiste.**

---

## Problemas de descoberta (não acha)

| Arquivo:linha | O que acontece | Correção mais barata |
|---|---|---|
| `web/app/(app)/hoje/page.tsx:124-141` | O card de alerta ("Item vencido"/"Precisa de atenção") é um `<div>` sem link. Não existe nenhum caminho, nem óbvio nem escondido, para ir da Início até a tela que resolve o vencimento (`/barco/itens/{id}/editar`). | Fluxo (mudança barata): envolver o card num `<Link href={\`/barco/itens/${item.id}/editar\`}>` quando `podeEditar` permitir — mesmo padrão já usado em `barco/page.tsx:140-144`. |
| `web/app/(app)/barco/page.tsx:127-133` | Seção "Documentos e embarcação" vazia mostra só "Nenhum vencimento cadastrado ainda." (linha 132), sem link de ação — diferente das seções "Motores" (linha 66-70, tem link "+ Motor") e "Elétrica" logo acima (linha 93-100, é o próprio link). Quem quer cadastrar um documento não acha o caminho a partir daqui; precisa saber que existe `/barco/documentos` mais abaixo em "Acervo do barco". | Layout: adicionar um link "+ Documento" no cabeçalho da seção (linha 127-129), igual ao padrão de "Motores". |
| `web/lib/acoes/onboarding.ts:9-12, 62-77` + `web/app/onboarding/page.tsx:59-78` | O onboarding cria 4 itens de manutenção (revisão + óleo por motor) sem nunca mostrar isso ao usuário nem pedir confirmação. Ele não sabe que esses itens existem, não sabe que tem uma "Troca de óleo" com vencimento em 12 meses a partir de hoje rodando por trás. Não vai procurar algo que não sabe que existe. | Texto: no fim do onboarding (tela de sucesso/redirect), somar uma linha: "Criamos 2 itens de manutenção por motor com base em prazos padrão — confira em Embarcação → Motores." |
| `web/app/(app)/barco/local/page.tsx` (link a partir de `hoje/page.tsx:148`) | O caminho existe e é descoberto (o card "Ligue o boletim do mar" é clicável), mas fica fora da Início — dono recém-cadastrado não vê o boletim do mar na primeira visita e pode achar que o recurso simplesmente "não existe" se não tocar no card. | Já resolvido pelo link — manter, é um dos poucos CTAs corretos da tela. |

---

## Problemas de compreensão (acha mas não entende)

| Arquivo:linha | Texto/elemento exato | Por que não entende | Correção mais barata |
|---|---|---|---|
| `web/app/(app)/hoje/page.tsx:120` | "Nenhum vencimento na margem. Bom vento e mar calmo." | "Na margem" é jargão do sistema (janela de 30 dias antes do vencimento, `MARGEM_DIAS` em `semaforo.ts:17`). Pior: essa MESMA frase aparece tanto para "revisei tudo e está em dia" quanto para "acabei de cadastrar e não tenho nada real monitorado" — ele não consegue distinguir os dois casos. | Texto: trocar por "Nenhum vencimento nos próximos 30 dias." E, quando os itens ainda são os padrão do onboarding sem dado real informado, trocar o badge por um terceiro estado neutro (cinza) "Sem dados suficientes" em vez de verde "Tudo em dia". |
| `web/app/(app)/hoje/page.tsx:176` e `web/app/(app)/barco/page.tsx:80` | Horímetro mostra `horas_atuais ?? 0` → "0,0 h" | Motor com zero hora real inexiste numa lancha usada; ele lê "0,0 h" como "o app não sabe nada" ou pior, como um erro. Não fica claro que é ausência de leitura, não uma leitura de fato. | Texto/layout: se `horas_atuais == null`, mostrar "sem leitura" no lugar do número, em vez de forçar "0,0 h" (`web/components/horimetro.tsx:15,21-22`). |
| `web/components/registro-rapido.tsx:34-39` | Botão flutuante "+ Registrar" | Sozinho, "Registrar" não diz registrar o quê. Só ao abrir a folha é que aparece "Registrar volta ao mar" (linha 46). Antes de tocar, o dono não sabe se é um novo evento, uma despesa, uma foto ou o quê. | Texto: mudar o rótulo do botão fixo para "+ Horas do motor" ou "+ Voltei do mar" — o mesmo texto que já existe dentro da folha (linha 46), só que visível antes do toque. |
| `web/components/bottom-nav.tsx:17-21` + `web/components/icone.tsx:6` | Aba "Marketplace", ícone de fachada de loja | "Marketplace" é estrangeirismo; o ícone de loja sugere "comprar algo", mas a aba é para contratar comandante via WhatsApp (`web/app/(app)/marketplace/page.tsx:18`). Dono de 55 anos que só usa WhatsApp/banco/Instagram não tem por que reconhecer a palavra nem associar o ícone à função real. | Texto: renomear a aba para "Comandantes" — a própria página já usa esse conceito ("Sou comandante", "Comandantes disponíveis"). Zero mudança de rota necessária, só o rótulo em `bottom-nav.tsx:19`. |
| `web/app/(app)/hoje/page.tsx:158-162` | "Iniciar navegação — gravar trilha" | Dono recém-cadastrado, ainda no píer, não relaciona isso a nada que ele vá fazer agora — soa a funcionalidade avançada de app náutico profissional, não a próximo passo óbvio de quem acabou de abrir o app pela primeira vez. | Nada a corrigir na primeira visita além de prioridade: não é urgente mexer no texto, mas ele não deveria competir em destaque visual com o card de alerta vencido (ver Top 5). |
| `web/app/(app)/hoje/page.tsx:104-108` | Fileira de 3 bolinhas (vermelho/amarelo/verde) com números, sem texto | Ele nunca viu em lugar nenhum do app uma legenda explicando o que os pontos coloridos significam antes desse resumo aparecer comprimido em números soltos. | Texto: adicionar `aria-label`/tooltip ou, mais barato, transformar em texto curto: "0 vencidos · 0 na margem · 4 em dia". |
| `web/lib/domain/semaforo.ts:78-87` (`textoRestante`) | Ex.: "em 42 h ou 12 dias" quando o item tem regra por hora E por mês | "Ou" soa como incerteza ("não sei se são 42h ou 12 dias") quando na real o sistema quer dizer "o que vencer primeiro". Item padrão do onboarding (Troca de óleo, `onboarding.ts:11`) tem as duas regras e vai gerar esse texto ambíguo. | Texto: trocar `join(" ou ")` por `join(" ou ") + " — o que vencer primeiro"`, ou mostrar só o critério mais próximo do vencimento. |
| `web/app/(app)/barco/page.tsx:165-182` | Bloco "Dados gerais" com 7 linhas, todas "—" para um barco recém-cadastrado (Comprimento, Boca, Calado, Casco, Propulsão, TIE, Capitania — nenhum coletado no onboarding) | Ele vê uma parede de travessões e não entende se é erro, se é "não se aplica" ou se falta preencher. O único link "Editar" fica no cabeçalho da seção (linha 161-163), longe visualmente do bloco de traços. | Texto: quando todos os campos são nulos, trocar o bloco por uma única linha "Nenhum dado técnico cadastrado ainda — toque em Editar para completar." em vez de 7 linhas de "—". |
| `web/app/onboarding/page.tsx:45-86` | Nenhum campo (exceto Nome) indica "opcional" | Em outras telas do app, campos opcionais dizem isso explicitamente — ex. "Vence em — opcional" (`web/app/(app)/barco/documentos/page.tsx:127`). No onboarding, nada sinaliza que ele pode pular número de série, marca do motor, data do seguro. Um dono no píer pode travar tentando lembrar dados que não tem em mãos, achando que são obrigatórios. | Texto: acrescentar "— opcional" nos rótulos de Estaleiro, Modelo, Ano, Marina, Marca, Modelo do motor, Horas, Seguro, TIE — mesmo padrão já usado em Documentos. |

---

## Estados vazios (um a um)

| Tela | Texto exato | Explica o que fazer? |
|---|---|---|
| `hoje/page.tsx:120` | "Nenhum vencimento na margem. Bom vento e mar calmo." | Bonito, mas **enganoso** quando o painel está vazio de dado real — ver tabela de compreensão acima. |
| `barco/page.tsx:73` | "Nenhum motor cadastrado ainda." | Simples, sem CTA embutido no texto, mas o link "+ Motor" já está visível ao lado (linha 67-69) — funciona na prática, embora raro acontecer (onboarding sempre cria ao menos 1 motor). |
| `barco/page.tsx:95-99` | "Cadastre gerador e baterias" / "Manutenção do gerador, troca das baterias e painel de bordo" | **Bom** — título é o próprio call-to-action, subtítulo explica o benefício. |
| `barco/page.tsx:116-118` (por categoria de casco) | Link "Monitorar" por linha vazia (Deck, Fibra, Inox, Vidros, Estofados, Outros) | Funcional e granular, mas não explica o que "Monitorar" faz antes do toque (cria um item de vencimento para aquela categoria). Aceitável dado o padrão consistente de ícones da tela. |
| `barco/page.tsx:131-133` | "Nenhum vencimento cadastrado ainda." | **Não** — sem CTA na própria seção (ver tabela de descoberta). |
| `barco/page.tsx:165-182` (Dados gerais) | 7× "—" | **Não** — nenhum texto, só travessões (ver tabela de compreensão). |
| `barco/documentos/page.tsx:51-52` | "Nenhum documento com vencimento cadastrado." | **Bom** — formulário "Novo documento" está logo abaixo, na mesma tela (linha 114-136). |
| `barco/contatos/page.tsx:42-43` | "Salve aqui o mecânico, o eletricista e todo mundo que cuida do barco." | **Muito bom** — explica o propósito, não só a ausência, e o formulário está logo abaixo. |
| `barco/gastos/page.tsx:85-88` | "Nenhum gasto registrado. Registre custos nos eventos do diário e eles aparecem aqui." | **Bom** — avisa exatamente onde ir (Diário), já que esta tela não tem formulário próprio. |
| `barco/eletrica/page.tsx:66-74` | Ícone + "Nada cadastrado ainda" + "Cadastre o gerador e as baterias para o app avisar das manutenções deles também." | **O melhor estado vazio do app** — ícone, título e explicação do benefício em 3 camadas. Deveria ser o padrão replicado nas outras telas. |
| `barco/eletrica/page.tsx:109-113` | "Nenhum contato de elétrica cadastrado ainda. Salve o eletricista de confiança para achar rápido na próxima vez." | **Bom** — explica o benefício futuro. |
| `barco/fotos/page.tsx:80-85` | Ícone de câmera + "Nenhuma foto em {álbum}" + "Fotos boas valorizam o barco e contam a história dele." | **Bom** — mesmo padrão de 3 camadas do estado da Elétrica, formulário de upload logo abaixo. |
| `diario/page.tsx:85-90` | "Nenhum evento por aqui ainda. Toque em "+ Evento" para registrar o primeiro — cada serviço registrado vira histórico e dossiê do barco." | **Muito bom** — cita o texto exato do botão visível acima e explica o valor de longo prazo. |
| `notificacoes/page.tsx:44-47` | "Nada vencido nem na margem. Bom vento e mar calmo." | Igual ao da Início — mesmo risco de mascarar "sem dado real" como "tudo revisado". |
| `notificacoes/page.tsx:64-67` | "Nenhum aviso enviado ainda. Quando um item entrar na margem, você recebe aqui e no aparelho." | **Bom** — explica o gatilho futuro. |
| `marketplace/page.tsx:21-24` | "Nenhum comandante na vitrine ainda. É comandante? Toque em "Sou comandante" e crie seu perfil." | **Bom** — cita o texto exato do botão visível. |

**Conclusão da varredura:** a maioria dos estados vazios do app está bem escrita — é um padrão genuinamente bom que o time já domina (ver Elétrica e Diário como referência). Os dois furos reais são "Documentos e embarcação" sem CTA e "Dados gerais" sem nenhuma explicação — ambos em `barco/page.tsx`. O problema maior não é texto vazio faltando explicação — é a Início **fingir que não está vazia** quando está.

---

## O que já está bom

- **Onboarding em 3 passos, sem exigir quase nada.** Só "Nome" é obrigatório (`web/app/onboarding/page.tsx:47`); todo o resto é opcional na prática, mesmo sem dizer isso na tela. Um dono no píer consegue terminar em 15 segundos.
- **"Olá, {primeiro nome}"** (`hoje/page.tsx:91`) com fallback educado "comandante" (linha 75) quando o perfil não tem nome — toque humano, no tema certo, sem soar genérico.
- **Padrão de estado vazio em 3 camadas** (ícone + título + explicação do benefício) em Elétrica (`barco/eletrica/page.tsx:66-74`) e Fotos (`barco/fotos/page.tsx:80-85`) — é o melhor material de UX writing do app e deveria virar o padrão único.
- **Textos de estado vazio que citam o botão exato visível na tela** ("+ Evento", "Sou comandante") — reduz fricção cognitiva de forma barata e consistente.
- **Farol de status (verde/amarelo/vermelho) é a metáfora certa** para o público: semáforo é universal no Brasil, não exige alfabetização digital.
- **"Iniciar navegação — gravar trilha" e "Registro Rápido"** resolvem um problema real (registrar horas em 30 segundos, `registro-rapido.tsx:47`) e a cópia interna da folha ("30 segundos — é isso que mantém os alertas vivos") é honesta e objetiva.
- **Onboarding permite cadastrar uma segunda embarcação sem expulsar quem já tem uma** (`web/lib/acoes/onboarding.ts:15-18` comenta essa correção explicitamente) — bom sinal de que o time já itera em cima de fricção real.
- **"Usar minha posição atual" em `/barco/local`** evita pedir latitude/longitude manual de um público não-técnico — um toque resolve.

---

## Top 5 correções por impacto

1. **[CRÍTICO — provavelmente a causa do "travei"] Tornar clicável o card de alerta na Início.** `web/app/(app)/hoje/page.tsx:124-141` — envolver em `<Link href={\`/barco/itens/${item.id}/editar\`}>` (respeitando `podeEditar`), igual ao padrão já usado em `barco/page.tsx:140-144`. É o único lugar do app onde o alerta mais urgente da tela é morto ao toque. Fluxo, mudança de poucas linhas.

2. **[CRÍTICO] Parar de mostrar "Tudo em dia" verde quando não há dado real.** `web/lib/acoes/onboarding.ts:9-12,62-77` cria itens de manutenção com vencimento calculado a partir de hoje, sem o dono nunca ter informado uma data ou hora real — e a Início trata isso como status "ok" verde (`hoje/page.tsx:70`, `semaforo.ts:73-75`). Corrigir com um terceiro estado visual "sem dados" (cinza) para itens cuja última leitura foi o próprio onboarding sem input do usuário. Fluxo + dado.

3. **[ALTO] Trocar "0,0 h" por "sem leitura" nos horímetros sem dado.** `web/components/horimetro.tsx:15,21-22`, usado em `hoje/page.tsx:176` e `barco/page.tsx:80`. Mostrar zero horas para um motor usado quebra a confiança do dono no app já no primeiro olhar. Texto, uma linha.

4. **[ALTO] Diferenciar a mensagem "tudo em dia" de "nada foi cadastrado ainda".** `hoje/page.tsx:120` usa a mesma frase para os dois casos. Trocar a condição (`alertas.length === 0`) por três estados: vencido / atenção / ok-com-dado / ok-sem-dado — ao menos o texto do estado "ok-sem-dado" precisa dizer isso claramente. Texto + lógica simples.

5. **[MÉDIO] Renomear a aba "Marketplace" para "Comandantes".** `web/components/bottom-nav.tsx:19-20`. Palavra em inglês + ícone de loja não comunicam "contratar comandante via WhatsApp" para esse público antes do toque. Mudança de um rótulo, zero risco.

---

*Metodologia: leitura integral de `hoje/page.tsx`, `layout.tsx`, `bottom-nav.tsx`, `onboarding.ts`/`onboarding/page.tsx` e das 12 telas principais de `barco/*`, `diario`, `marketplace`, `notificacoes`, `menu`, além da lógica de domínio em `lib/domain/semaforo.ts`, `lib/domain/diario.ts` e `lib/consultas.ts`, para reconstruir com precisão o que cada estado de dados produz na tela. Sem acesso a login/produção — toda a reconstrução é a partir do código-fonte.*
