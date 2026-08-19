# Auditoria de PRODUTO — a promessa contra a entrega

**Data:** 19/08/2026 (noite)
**Escopo:** o que o Commander PROMETE (landing, PRD, o texto da própria tela) contra o que
ele ENTREGA. Não é auditoria de código.
**Método:** leitura do código de hoje + consulta só-leitura ao banco vivo
`khgjtxvmduizyooqaoox` (`information_schema`, `pg_proc`, `pg_class`, contagens). Nenhum
arquivo de aplicação alterado, nenhuma escrita no banco. O único arquivo escrito é este.
**Regra que governou cada linha:** toda afirmação vem com `arquivo:linha` ou com a consulta
que a mediu. Onde não deu para medir, está escrito "não verificado".

---

## VEREDITO EM UMA PÁGINA

**A boa notícia primeiro, e ela muda o mapa: as quatro lacunas de PRD que este projeto vinha
repetindo há semanas estão FECHADAS.** Verifiquei cada uma contra o código de hoje antes de
escrever qualquer coisa:

| lacuna herdada | veredito de hoje | prova |
|---|---|---|
| Resumos (tela / PDF / semestral / anual) | **EXISTE** | `web/app/(app)/barco/resumos/page.tsx` — abas Gastos/Uso/Ano no mar (`:152-160`), períodos mensal/semestral/anual (`:52-56`, `:87-89`), Exportar PDF (`:443`) |
| Transferência de embarcação | **EXISTE** | `web/app/(app)/barco/transferir/page.tsx` + `web/lib/acoes/transferencia.ts` + RPC `aceitar_transferencia` no banco vivo |
| Free / paywall com gating real | **EXISTE e é aplicado no servidor** | `web/lib/domain/plano-acesso.ts:187` (`recursoLiberado`), chamado nas *actions*: `eventos.ts:15`, `fotos.ts:7`, `agenda.ts:12`, `financeiro.ts:15`, `marketplace.ts:29`, `convites.ts:6` |
| Marketplace do PRD (vagas, diárias, "COMPRO — rádio VHF") | **EXISTE, completo** | `web/lib/domain/marketplace.ts:26-33` — os 5 tipos do PRD §11.1 (`servico`, `tripulacao`, `produto`, `vaga`, `caminhao`); `PERIODOS_VAGA` diária/mensal/período (`:539`), `TIPOS_VAGA` seca/molhada (`:547`), matching (`:332`), confirmação bilateral (`:634`) |

Também conferi e **estão entregues** itens do PRD que costumam faltar: Agenda com Mês/Semana/
Lista (§8 — `agenda/page.tsx:331`, `:447`), recorrente com "somente este" × "este e os
próximos" (§9.2 — `financeiro/recorrentes/[id]/page.tsx:141-142`), Verified com o prazo de 15
dias e reativação automática (§15 — `lib/domain/verified.ts:178,225-298`), Gold pago pelo
interessado por link (§16 — `barco/selos/gold/page.tsx:125`), devolução de saldo na Carteira
(§9.4 — `lib/domain/carteira.ts:19,150`), e o disparo de aviso do Marketplace que era mentira
esta manhã e hoje é código (`lib/avisos/marketplace.ts` chamado por
`lib/acoes/marketplace.ts:24`).

**A má notícia: o problema deste app deixou de ser função faltando e virou FRASE ERRADA.**
Os achados abaixo quase não são funcionalidades ausentes — são telas que dizem uma coisa e
fazem outra. A pior delas apaga a contabilidade inteira do barco depois de mostrar ao dono um
aviso que não menciona isso; a segunda promete um aviso que nenhum canal do app emite, e o
dono perde o selo em silêncio por confiar nela.

E a lacuna de marca continua exatamente onde estava: **o app se chama "o dossiê do seu barco"
e não tem um botão que gere o dossiê.**

**Um padrão atravessa quase tudo o que sobrou, e vale nomeá-lo:** o Commander sabe *calcular*
e não sabe *chamar*. O semáforo, o Verified, a máquina do Gold, a fila de contestação e a
tolerância de pagamento estão todos corretos como cálculo — e quase nenhum deles tem gatilho.
A frase da tela descreve o cálculo usando o verbo do gatilho ("avisamos", "você recebe",
"entramos em contato"), e é aí que ela vira mentira. O caso do Marketplace de hoje de manhã
era este padrão; ele foi consertado em um lugar e continua vivo em pelo menos seis.

---

## OS 15 ACHADOS, EM UMA TABELA

| # | achado | tamanho |
|---|---|---|
| **1.1** | Transferir a embarcação APAGA todo o financeiro do dono anterior; a tela não avisa | meia onda (+1 linha urgente) |
| **1.2** | "Enviar convite de transferência" não envia nada a ninguém | uma linha |
| **1.3** | O link que o dono compartilha pode ser `http://localhost:3010` | uma linha |
| **1.4** | Verified promete "você recebe o aviso"; o selo é suspenso em silêncio | meia onda (ou 1 linha) |
| **2.1** | "O dossiê do seu barco" não tem botão de dossiê | **uma onda** |
| **2.2** | "Concierge de bordo" não existe em lugar nenhum | uma linha |
| **2.3** | "Mais escolhido" com 0 assinaturas no banco | uma linha |
| **3.1** | Canal de e-mail não existe; a política de privacidade declara que existe | uma linha + operação |
| **3.2** | Relatório Mensal do Diário (PRD §6, §18) não existe | meia onda |
| **3.3** | Cadastro de Documento mais magro que o PRD §4.8 | meia onda |
| **3.4** | "Contrate comandantes direto na plataforma" × a tela diz WhatsApp | uma linha |
| **3.5** | "Chegam aqui **e no aparelho**" — só 1 das 4 categorias chega | uma linha |
| **3.6** | "Cruzamos horas de motor com prazos de documento" — não cruza | uma linha |
| **3.7** | Quatro telas dizem "a equipe entra em contato"; nada avisa a equipe | meia onda |
| **3.8** | "Se mudarmos este texto, avisamos" — não há como | uma linha |
| **5.1** | A regra dos 3 toques não tem teste; o guardião é cego a rota dinâmica | meia onda |
| **5.2** | `/marketplace/disponibilidades/nova` a 4 toques, sem exceção escrita | uma linha |

**Se der para fazer só três coisas:** o quarto marcador da tela de transferência (1.1), o
rótulo do botão de transferência (1.2), e a onda do dossiê (2.1). As duas primeiras somam meia
hora e param uma perda de dado; a terceira é a que faz o nome do produto virar verdade.

---

# GRAVIDADE 1 — custa dado que não volta

## 1.1 · Transferir a embarcação APAGA todo o financeiro do dono anterior. A tela não avisa.

**O que promete.** `web/app/(app)/barco/transferir/page.tsx:51-58` — a caixa de aviso
"O que acontece quando for aceito", com exatamente três marcadores:

> · Você perde o acesso a esta embarcação — não dá pra desfazer depois de aceito.
> · A tripulação atual também perde o acesso; o novo dono reconvida quem quiser.
> · Motores, horas, manutenções, ocorrências, fotos e documentos continuam com o barco.

**O que entrega.** A RPC `aceitar_transferencia`, lida da definição viva do banco
(`pg_get_functiondef`), executa — além do que a tela diz:

```
update public.eventos
  set custo_centavos = null, passageiros = '{}', tripulacao = '{}'
  where embarcacao_id = t.embarcacao_id;
delete from public.contatos                 where embarcacao_id = t.embarcacao_id;
delete from public.carteiras                where embarcacao_id = t.embarcacao_id;
delete from public.lancamentos_financeiros  where embarcacao_id = t.embarcacao_id;
delete from public.recorrencias_financeiras where embarcacao_id = t.embarcacao_id;
```

Ou seja: **todo o Financeiro daquele barco, todas as recorrentes, todas as Carteiras da
tripulação, toda a agenda de contatos de confiança e o custo de cada saída do Diário são
destruídos** no instante em que o outro lado clica em aceitar. Não são ocultados, não são
transferidos, não são exportados antes — são `DELETE`. O dono anterior autorizou isso lendo
uma tela que só falava do que **continua com o barco** e nunca do que some.

**Por que isso é o achado mais caro do app.** É o único lugar em que o Commander destrói
registro de cliente sem aviso, e é justamente o registro que a landing usa como argumento de
venda ("um histórico que vale dinheiro na hora de vender", `app/page.tsx:106`). Quem vende o
barco é exatamente quem executa esta ação — e perde a memória de quanto o barco custou a ele,
na hora em que mais precisaria dela para declarar imposto ou justificar preço.

**Isso também não é o que o PRD pede.** §17 (`upgrade2-master-final.txt:398`) diz *"Não
transferir automaticamente: dados pessoais, passageiros, custos privados, informações
financeiras pessoais"*. **Não transferir ≠ apagar.** E §7 (`:206`) é explícito na direção
contrária: *"Registros finalizados relevantes não são apagados silenciosamente"*.

**Contradição interna, de quebra.** `web/app/(app)/menu/assinatura/page.tsx:354` promete
*"Nada é apagado — o dossiê do barco continua guardado"* e `app/page.tsx:64` promete *"nada do
que você registrou é apagado"*. As duas frases são verdadeiras para cancelamento e falsas para
transferência, e nada na interface separa os dois casos para quem lê.

**Ninguém foi ferido ainda, e é por isso que dá tempo.** `select count(*) from transferencias`
= **0** no banco vivo. Nenhuma transferência foi criada, quanto mais aceita. O custo deste
achado é inteiramente futuro — e vira irreversível na primeira vez que acontecer.

**Tamanho do conserto.** **Meia onda.** Duas partes, e a primeira é urgente sozinha:
1. *(uma linha, hoje)* — acrescentar o quarto marcador na caixa de aviso, dizendo em voz alta
   o que é apagado, e repetir no `Confirmar`.
2. *(meia onda)* — decidir o destino certo desses dados. O comportamento coerente com o §17 é
   o financeiro **ficar com o dono anterior** (desvincular, não deletar) ou, no mínimo,
   forçar uma exportação antes de a transferência ser criada.

---

## 1.2 · "Enviar convite de transferência" não envia nada a ninguém.

**O que promete.** `web/app/(app)/barco/transferir/page.tsx:104` — o botão diz
**"Enviar convite de transferência"**. E `:102`, a dica do campo de e-mail, reforça:
*"Ele(a) confirma pelo próprio Commander — se ainda não tiver conta, cria na hora."*

**O que entrega.** `web/lib/acoes/transferencia.ts:43-53`: cancela pendências, faz um
`insert` em `transferencias` e redireciona. **Nenhum e-mail, nenhum push, nenhuma
notificação.** O destinatário não fica sabendo de nada. A única forma de ele descobrir é o
dono copiar o link e mandar na mão — e é isso que a tela oferece na tela SEGUINTE
(`:81-86`, "Compartilhar no WhatsApp"), depois que a pessoa já acreditou que enviou.

**Prova de que o app sabe fazer diferente.** `/tripulacao`, que é o mesmo mecanismo de
convite por link, é honesta: o botão é *"Convidar comandante"* (`tripulacao/page.tsx:383`), o
resultado é *"Convite criado"* (`:179`) e o WhatsApp aparece como o caminho
(`:186-190`). Transferência é a única tela do app que usa o verbo **enviar** para uma ação que
não envia.

**Custo.** O dono digita o e-mail do comprador, lê "Enviar", vê a tela de sucesso e vai
embora. A transferência fica pendurada em `transferencias` até expirar. Ninguém é avisado de
nada — nem o dono de que ele ainda precisa mandar o link.

**Tamanho do conserto.** **Uma linha** — trocar o rótulo para "Gerar link de transferência" e
ajustar a dica. (Mandar o e-mail de verdade é meia onda e depende do item 3.1 abaixo.)

---

## 1.3 · O link que o dono compartilha pode ser `http://localhost:3010`.

**O que promete.** Três telas geram um link para o dono mandar a terceiros e tratam esse link
como o produto:
- `web/app/(app)/barco/transferir/page.tsx:13` — `linkTransferencia`
- `web/app/(app)/tripulacao/page.tsx:162` — `linkConvite`
- `web/app/(app)/cotistas/page.tsx:72` — o link do cotista

**O que entrega.** As três escrevem `process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3010"`.
Se a variável não estiver no ambiente de produção, o app renderiza — com cara de link bom,
em fonte de instrumento, dentro de uma caixa — um endereço que não abre para ninguém no
mundo. E o botão de WhatsApp ao lado o empacota numa mensagem pronta.

**Sinal de que ninguém consolidou isso.** O mesmo fallback aparece com **duas portas
diferentes** no repositório: `3010` nas três telas acima e `3000` em outros cinco lugares
(`lib/acoes/assinatura.ts:39`, `lib/acoes/gold.ts:48`, `lib/acoes/auth.ts:55`, `app/sitemap.ts:3`,
`app/robots.ts:3`, `app/layout.tsx:44`). `auth.ts:52-55` inclusive tem um comentário dizendo
que o fallback *"só vale em desenvolvimento"* — e é a única função nomeada; as três telas de
link repetem a expressão à mão.

**Não verificado:** se `NEXT_PUBLIC_APP_URL` está setada na Vercel — não houve acesso ao
projeto nesta sessão. O que se sabe é que `web/.env.example:18` aponta para
`commander.soumardivers.com` enquanto a produção roda em `commander-tau.vercel.app` (a decisão
de domínio já está registrada como pendência do dono).

**Custo.** Falha silenciosa e total dos três fluxos de entrada de gente nova no app —
transferência, tripulação e cotista. Nada quebra na tela; o link só não funciona do outro lado.

**Tamanho do conserto.** **Uma linha** — as três telas passarem a usar a função que já existe
(`urlBase()` de `lib/acoes/auth.ts:55`), e essa função falhar alto em produção quando a
variável não existir, em vez de inventar `localhost`.

---

## 1.4 · O Verified promete "você recebe o aviso" — e o selo é suspenso em silêncio.

**O que promete.** `web/app/(app)/barco/selos/verified/page.tsx:109-110`, o texto que o dono lê
enquanto o selo está **ativo**:

> Os cinco pilares estão de pé. Se algum deixar de ser atendido, **você recebe o aviso** e tem
> 15 dias pra regularizar antes de qualquer suspensão.

**O que entrega.** Nada emite esse aviso. Verifiquei os quatro canais possíveis, um a um:

1. **Push/cron** — `web/app/api/alertas/disparar/route.ts`: grep por `verified`, `selo` ou
   `verified_estado` no arquivo inteiro devolve **zero ocorrências**. O disparador conhece
   `itens_monitorados`, boletim de mar e motor parado. O selo não está na lista.
2. **Central de Notificações** — `web/lib/domain/notificacoes.ts:30`, `CATEGORIAS_NOTIFICACAO`
   = `embarcacao, agenda, marketplace, financeiro`. Não existe categoria de selo, e
   `carregarNotificacoes` (`web/lib/consultas.ts:565`+) não lê `verified_estado`.
3. **E-mail** — morto (item 3.1).
4. **A própria tela** — só se o dono abrir `/barco/selos/verified` por conta própria.

**E o relógio corre mesmo assim.** O estado do selo é recalculado **na leitura**, não por
rotina — o código diz isso em voz alta em `web/lib/consultas.ts:196` (*"Por que a gravação
acontece durante a leitura, e não num cron"*). `avaliarVerified`
(`web/lib/domain/verified.ts:225-298`) grava `pendencia_desde` e, passados os 15 dias
(`DIAS_REGULARIZACAO_VERIFIED`, `:178`), devolve `suspenso`. Ou seja: **o prazo começa, corre e
termina sem que uma única notificação saia**, e o dono descobre que perdeu o selo na próxima
vez que abrir a tela — se abrir.

**Por que isso é gravidade 1.** A frase não é decorativa: ela **muda o comportamento** de quem
lê. Alguém que leu "você recebe o aviso" para de conferir, exatamente como o produto pediu que
fizesse. O Verified é o que a landing e `/barco/selos:53` vendem como *"o que o histórico da
embarcação comprova para um comprador"* — perdê-lo em silêncio custa na hora da venda.

**Duas ressalvas de precisão, para o achado não ser exagerado.** (a) A tela é honesta em tudo
mais: o prazo escrito é o mesmo `DIAS_REGULARIZACAO_VERIFIED` = 15 do PRD §15, não há
divergência de número; e a reativação automática prometida em `:98` é real
(`web/lib/consultas.ts:209`). (b) `verified_estado` tem **0 linhas** no banco vivo — ninguém
conquistou o selo ainda, então o dano ainda não aconteceu com ninguém.

**Tamanho do conserto.** **Meia onda** — o cron de alertas passar a varrer `verified_estado`
(ele já tem a estrutura de janela e deduplicação em `alertas_enviados`), e uma quinta categoria
em `CATEGORIAS_NOTIFICACAO`. Alternativa de **uma linha**, se a onda não couber agora: trocar a
frase por *"o selo entra em prazo de regularização de 15 dias; confira esta tela"* — que é o
que o produto faz de verdade.

---

# GRAVIDADE 2 — a marca promete algo que não tem botão

## 2.1 · "O dossiê do seu barco" — e não existe dossiê. **Confirmado, continua verdade.**

**O que promete.** É a promessa central do produto, repetida em sete lugares:
`app/page.tsx:103` (H1 da landing), `app/layout.tsx:49,53,67` (title e og), `app/manifest.ts:9`
(nome do PWA), `app/opengraph-image.tsx:26,77`, `app/termos/page.tsx:33`
(*"o dossiê digital do seu barco"*), `app/(assinatura)/assinar/page.tsx:140`
(*"Todo o dossiê do barco…"*), `app/page.tsx:44` (*"Na hora de vender, esse dossiê vale
dinheiro"*).

**O que entrega.** Grep de `dossi` em todo o `web/`: **zero botão, zero rota, zero action**.
A palavra só existe em texto de venda e em comentário de código. O único exportador do app é
`web/components/botao-exportar-pdf.tsx`, e ele tem **um único importador**:
`web/app/(app)/barco/resumos/page.tsx:3`.

**E o que /barco/resumos exporta NÃO é o dossiê.** É o relatório de **custo e uso de um
período** — gastos por grupo, custo/hora, saídas, horas de motor, ano no mar. Não sai nele: a
identificação da embarcação, os motores, os documentos, o histórico de manutenção, as
ocorrências, as fotos, os selos. Um comprador que recebesse esse PDF não saberia nem o nome do
estaleiro.

**O que falta, exatamente — e de onde cada pedaço já sai hoje.** Este é o ponto: o dossiê não
é dado novo, é **uma tela de montagem**. Tudo já existe:

| seção do dossiê | de onde já sai | tela que já mostra |
|---|---|---|
| Identificação (nome, estaleiro, modelo, ano, comprimento, boca, calado, casco, TIE, capitania, propulsão, marina) | tabela `embarcacoes` — as 21 colunas | `/barco/editar` |
| Motores, série, potência, horas atuais e próxima revisão | `equipamentos` (tipo=motor) + `itens_monitorados` | `/barco/equipamento/[id]` |
| Documentos e validades | `documentos` + `itens_monitorados` categoria=documento | `/barco/documentos` |
| Histórico de manutenção e serviços | `eventos`, `servicos_mecanica` | `/barco/historico`, `/mecanica` |
| Ocorrências abertas e resolvidas | `ocorrencias` | `/barco/ocorrencias` |
| Estado por setor (casco, elétrica, hidráulica, segurança, equipamentos) | `calcularSaudeEmbarcacao` (`lib/domain/saude.ts`) | `/barco/saude` |
| Custo do período, custo/hora, gastos por grupo | `montarResumoPeriodo` (`lib/domain/resumo-periodo.ts`) | `/barco/resumos` |
| Ano no mar (saídas, milhas, horas) | `resumoAno` (`lib/domain/resumo-ano.ts`) | `/barco/resumos` |
| Fotos | `fotos` | `/barco/fotos` |
| Selos Verified e Gold | `verified_estado`, `gold_selos` | `/barco/selos` |

**E a infraestrutura de impressão também já existe e é global.** `app/globals.css:738-751` —
o `@media print` esconde a casca pelo `.no-imprimir`, força o tema claro reescrevendo os
tokens de `:root` e define margem de página. Qualquer rota nova herda isso de graça.

**Tamanho do conserto.** **Uma onda.** Uma rota `/barco/dossie` que junta as dez seções acima
em ordem de leitura de comprador, reusa `BotaoExportarPdf`, e ganha porta em `/barco` ao lado
de "Relatórios" (`barco/page.tsx:439`) — e no cartão de venda de `/barco/selos`, que já diz
*"O que o histórico da embarcação comprova para um comprador"* (`barco/selos/page.tsx:53`) e
hoje não tem o que entregar a esse comprador.

Registro de honestidade: nada aqui é dado que falta coletar. É montagem e ordem. É a onda de
melhor razão valor/custo do backlog inteiro, e é a única que faz o nome do produto virar
verdade.

---

## 2.2 · "Concierge de bordo: a equipe monta o dossiê do seu barco com você" — não existe.

**O que promete.** `web/app/page.tsx:65`, terceiro benefício da seção de planos da landing.

**O que entrega.** Grep de `concierge` no repositório inteiro: a palavra aparece **só** nessa
linha e em documentos de auditoria/plano. Nenhuma tela, nenhum formulário de agendamento,
nenhum canal, nenhuma tabela.

**Já foi apontado** em `docs/auditoria/2026-08-18-cmo.md:177-180` ("O concierge é prometido e
não existe em lugar nenhum"). **Continua vivo na landing** 24h depois — reverifiquei a linha.
Repito aqui porque é promessa de tela e não estava no fechamento de hoje.

**Custo.** É promessa de trabalho humano feita a quem está decidindo pagar R$ 49,90/mês.
Quem assina esperando que alguém ligue não recebe ligação nenhuma — e essa é a primeira
quebra de confiança do relacionamento, exatamente no momento da compra.

**Tamanho do conserto.** **Uma linha** (tirar da landing) ou **meia onda** (fazer existir: um
"Quero ajuda para montar o dossiê" que grave interesse e apareça no `/admin`, no mesmo padrão
que `connect_interesses` já usa em `barco/connect/interesse`).

---

## 2.3 · "Mais escolhido" no plano Commander, com 0 assinaturas no banco.

**O que promete.** `web/app/page.tsx:186-188` — o selo **"Mais escolhido"** flutuando sobre o
cartão do plano Commander, na única seção de preço da landing.

**O que entrega.** Medido no banco vivo: `select count(*) from assinaturas` = **0**. Nunca
houve uma assinatura. Nenhum plano foi escolhido por ninguém, então nenhum é "o mais
escolhido".

**Por que isso importa mais do que parece.** Este app já matou uma prova social inventada
pelo mesmo motivo: o contador "restam 100 de 100 vagas de fundador" foi aposentado na onda 47
com a justificativa escrita em `app/page.tsx:73-78` — *"o problema era a prova social
inventada, e a solução acabou sendo não ter nenhuma"*. **"Mais escolhido" é a mesma doença,
na mesma página, e sobreviveu à cirurgia.**

**Tamanho do conserto.** **Uma linha.** Ou apagar o selo, ou trocar por um rótulo que seja
verdade sem depender de venda nenhuma ("Recomendado", "O plano completo").

---

# GRAVIDADE 3 — a promessa vale, o canal não entrega

## 3.1 · O canal de e-mail não existe — e a política de privacidade declara que existe.

**O que promete.** Três documentos, um deles legal:
- `app/privacidade/page.tsx:118-119` — *"avisos de documento/manutenção vencendo e o relatório
  mensal são enviados para o e-mail da sua conta"*
- `app/privacidade/page.tsx:212-213` — declara **Resend** como subprocessador que *"recebe o
  e-mail da sua conta e o conteúdo do aviso"*
- `app/api/relatorio/mensal/route.ts:53` — o Relatório Mensal é, por construção, **só** e-mail:
  recusa rodar sem a chave, com a frase *"relatório sem e-mail não existe"*

**O que entrega.** Nada. E a prova mais forte é do próprio repositório, escrita na onda 99:

> `web/lib/avisos/marketplace.ts:91` — *"o §64 lista os três canais, mas `RESEND_API_KEY` **NÃO
> EXISTE** em produção"*

É uma declaração de primeira pessoa, recente, usada para justificar por que o aviso do
Marketplace saiu só com push e in-app. Se ela está certa, **nenhum e-mail transacional do
Commander jamais saiu**: o envio no cron está atrás de `if (process.env.RESEND_API_KEY)`
(`app/api/alertas/disparar/route.ts:170`) e o Relatório Mensal devolve 500 sem a chave.

**E mesmo com a chave, o remetente está errado.** Os dois únicos pontos de envio mandam de
`onboarding@resend.dev`:
- `app/api/relatorio/mensal/route.ts:144`
- `app/api/alertas/disparar/route.ts:183`

`onboarding@resend.dev` é o remetente compartilhado de sandbox do Resend, que só entrega para o
endereço verificado da própria conta. Ligar a chave hoje faria o e-mail chegar ao dono do
Commander e a mais ninguém. **São dois consertos, não um.**

**A falha é muda dos dois lados.** Em `relatorio/mensal/route.ts:150` o código faz
`if (resposta.ok) enviadas++` e não registra o corpo do erro; o log final
(`:156-158`) reporta `enviadas: 0` sem dizer por quê. Ninguém é avisado de que ninguém foi
avisado.

**Não verificado:** se `RESEND_API_KEY` está na Vercel — sem acesso ao projeto. A evidência é
a afirmação do código acima; o achado do remetente não depende dela.

### O que NÃO está quebrado aqui — e por que isso precisa estar escrito

O canal principal do aviso de prazo — **push + in-app — funciona e rodou de verdade**. Isto é
medição, não inferência, e desmente a conclusão fácil (que eu mesmo quase escrevi) de que o
cron estaria desligado porque `.github/workflows/alertas.yml:10` o gateia atrás de
`vars.ALERTAS_ATIVOS == 'true'`, um valor que esta sessão não conseguiu ler.

`select … from public.alertas_enviados`, banco vivo, 10 linhas:

| enviado_em (UTC) | título | janela |
|---|---|---|
| 2026-08-19 11:12 | 🔴 Prova onda 79 — Motor BB | vencido *(disparo manual de teste)* |
| 2026-08-16 11:08 | 🌊 Mar ruim | mar_ruim |
| 2026-08-15 11:07 | 🌊 Mar ruim | mar_ruim |
| 2026-08-14 11:33 | 🌊 Mar ruim + 🔴 Seguro da embarcação | mar_ruim, vencido |
| 2026-08-13 11:36 | 🌊 Mar ruim + 🟡 TIE | mar_ruim, d15 |
| 2026-08-13 02:23 | 🟡 TIE (d30) + 🟡 Seguro (d5) | d30, d5 |

Cinco dias consecutivos, todos por volta de 11h UTC — que é o `cron: "0 11 * * *"` do
workflow, com a deriva normal do GitHub Actions. **O cron está ligado, o push sai, e a promessa
"Avisos antes do prazo" da landing (`app/page.tsx:39`) é cumprida** — para vencimento de item e
para mar ruim.

**Um sinal a conferir, não um achado:** o último disparo agendado foi em **16/08**. Nos dias 17
e 18 não há linha nenhuma, e o registro de 19/08 é manual. Pode ser simplesmente que nada
tenha entrado em janela nesses dois dias (o mar melhorou, nenhum item virou d30/d15/d5) — é a
explicação mais provável com 12 itens monitorados. Mas é o tipo de silêncio que só se
distingue de uma pane olhando a execução do workflow no GitHub, e vale um olhar.

**O que NÃO está quebrado, e é importante registrar para não exagerar o achado.** O canal
principal do aviso — push + in-app — **funciona e está rodando**. Medido em
`public.alertas_enviados`: 10 alertas gravados, com disparo diário em 12, 13, 14, 15 e 16/08
(`🟡 TIE` d30 e d15, `🟡 Seguro da embarcação` d5, `🔴 Seguro da embarcação` vencido, e o aviso
de mar ruim). O cron do GitHub (`.github/workflows/alertas.yml:4`, 08:00 de Brasília) está
ativo. **A promessa "Avisos antes do prazo" da landing (`app/page.tsx:39`) é cumprida.** O que
não é cumprido é o canal de e-mail e, com ele, o Relatório Mensal inteiro.

**Tamanho do conserto.** **Uma linha** no código (trocar o `from` por um domínio verificado),
mais um passo de operação do dono (verificar o domínio no Resend). Some um segundo item de uma
linha: logar o corpo da recusa em vez de engolir.

---

## 3.2 · O Relatório Mensal do Diário (PRD §6 e §18) não existe.

**O que promete o PRD.** Duas vezes, com a mesma palavra:
- §6, `upgrade2-master-final.txt:200` — *"Existe Relatório Mensal específico do Diário de
  Bordo, **separado** do Resumo Mensal geral da embarcação."*
- §18, `:403` — *"Relatório Mensal do Diário é separado do Resumo Mensal geral."*

**O que entrega.** Grep de `relatorio`/`Relatório` em `web/app/(app)/diario/`: **nenhuma
ocorrência**. O que existe é (a) `/barco/resumos`, que é o Resumo geral, e (b) o e-mail de
`/api/relatorio/mensal`, que também é o resumo geral (`resumoDoMes`, `lib/domain/relatorio.ts`)
— e que não chega a ninguém, pelo item 3.1.

O §6 entrega o irmão dele: *"Cada Diário finalizado possui relatório independente permanente"*
é `/diario/[id]`, que existe e está completo.

**Custo.** Baixo hoje, e é por isso que está na gravidade 3: com 9 embarcações e 9 eventos no
banco (medido), ninguém tem massa de Diário para o relatório mensal significar algo. Vira
custo real quando o primeiro cliente com uso real chegar.

**Tamanho do conserto.** **Meia onda** — uma aba ou período em `/diario` que rode
`resumoDoMes` sobre os eventos do mês e imprima; o cálculo já existe em
`lib/domain/relatorio.ts`.

---

## 3.3 · O cadastro de Documento é mais magro que o PRD §4.8 — e é o dossiê que paga.

**O que promete o PRD.** §4.8, `upgrade2-master-final.txt:165`:
*"Campos: tipo, número, emissor, emissão, validade, arquivo, observação e status."*

**O que entrega.** A tabela `documentos` no banco vivo tem exatamente:
`id, embarcacao_id, nome, arquivo_path, validade, item_monitorado_id, created_at`. E a action
que a alimenta (`web/lib/acoes/documentos.ts:20-52`) coleta **três coisas**: `nome`, `validade`
e `arquivo`. Não existe `numero`, nem `emissor`, nem `emissao`, nem `observacao`, nem `status`
declarado (o status é derivado do semáforo, o que é uma escolha defensável).

**Por que isso liga ao item 2.1.** Documento sem número e sem emissor não serve de dossiê para
comprador nenhum — é justamente o campo que um comprador confere. O PRD pede os campos porque
o produto é o dossiê.

**Medição de contexto:** `documentos` tem **0 linhas** no banco vivo. Nunca foi exercido.

**Tamanho do conserto.** **Meia onda** — três campos no formulário
(`barco/documentos/page.tsx`), três colunas na tabela, e os três aparecendo na linha da lista.

---

## 3.4 · "Contrate comandantes… direto na plataforma" — a própria tela do app diz WhatsApp.

**O que promete a landing.** `web/app/page.tsx:49`, terceiro bloco de valor:
*"Contrate comandantes com documentação declarada, **direto na plataforma** — sem depender de
boca a boca."*

**O que a tela do app diz.** `web/app/(app)/comandantes/page.tsx:68`, o estado vazio:
*"Aqui aparecem comandantes com perfil publicado … **para contratar direto pelo WhatsApp**."*

As duas frases descrevem produtos diferentes. A landing vende contratação na plataforma; a
tela entrega uma vitrine que empurra para o WhatsApp — que é literalmente "boca a boca", o que
a landing diz eliminar.

**Medição.** `select count(*) from perfis_comandante` = **0**. A vitrine está vazia; a landing
não diz isso.

O caminho que existe de verdade é o Marketplace tipo `tripulacao` (demanda → candidatura →
negócio → confirmação bilateral), que é bom e é o que a própria tela sugere na segunda metade
da frase. Ele só não é o que a landing descreve.

**Tamanho do conserto.** **Uma linha** — alinhar a frase da landing ao fluxo que existe
("Peça um comandante e receba candidaturas — com documentação declarada").

---

## 3.5 · "Críticas e importantes chegam aqui **e no aparelho**" — só uma das quatro categorias chega.

**O que promete.** `web/app/(app)/notificacoes/page.tsx:308`, no rodapé da Central:
*"Verificado agora. Críticas e importantes chegam aqui e no aparelho."*

**O que entrega.** O push existe para **uma** das quatro categorias. O próprio código confessa,
em `web/lib/consultas.ts:537-544`: *"O que ficou de fora, dito em voz alta: o PUSH das três
categorias novas [Agenda, Financeiro, Marketplace]"*. E o disparador
(`app/api/alertas/disparar/route.ts:198-247`) varre só `itens_monitorados`, boletim de mar e
motor parado — nem ocorrência crítica aberta vira push, embora `nivelDaOcorrencia` a
classifique como `critica`.

O comentário interno está atualizado; a frase da tela não. É o padrão do topo do documento:
o cálculo sabe o que é crítico, o gatilho não.

**Tamanho do conserto.** **Uma linha** — a frase dizer o que é verdade
(*"Vencimentos e alertas do mar também chegam no aparelho"*), ou **meia onda** para o push das
outras três.

---

## 3.6 · "Cruzamos horas de motor com prazos de documento" descreve uma inteligência que não existe.

**O que promete.** `web/app/page.tsx:39`, o primeiro bloco de valor da landing:
*"**Cruzamos horas de motor com prazos de documento** e mostramos o que vence primeiro — sem
susto na doca."*

**O que entrega.** `calcularSemaforo` (`web/lib/domain/semaforo.ts:75`+) cruza horas × data
**dentro do mesmo item** — um `ItemCalc` pode ter `intervaloHoras` e `intervaloMeses`, e vence
pelo que chegar primeiro. Isso é o PRD §4.2 e está correto. Mas **documento não tem
`intervaloHoras`**: `vencimentoPorData` (`:66-73`) o resolve só por data. Não há, e não faz
sentido haver, cruzamento entre a hora do motor e o prazo de um seguro.

A segunda metade da frase — *"mostramos o que vence primeiro"* — é verdade (`PESO` ordena a
lista em `hoje/page.tsx:180`). A primeira metade vende um raciocínio que o produto não faz.

**Tamanho do conserto.** **Uma linha** — *"Acompanhamos horas de motor e prazos de documento e
mostramos o que vence primeiro"*. Troca uma palavra, deixa de ser falso, e não perde nada de
força.

---

## 3.7 · Quatro telas dizem "a equipe Commander entra em contato" e nada avisa a equipe.

**O que promete.**
- `web/lib/acoes/gold.ts:273` e `app/(app)/barco/selos/gold/[id]/page.tsx:126` — *"a equipe
  Commander entra em contato assim que o pagamento estiver disponível"*
- `web/lib/domain/gold.ts:203` — *"A equipe Commander entra em contato para combinar"*
- `web/lib/acoes/avaliacoes.ts:190` — *"Contestação enviada — a equipe Commander vai analisar"*
- `web/app/(parceiro)/parceiro/conta/page.tsx:61` — *"Se passar a ser cobrado, você é avisado
  antes"*

**O que entrega.** O estado é gravado e entra numa fila que **existe de verdade** —
`iniciarPagamentoGold` (`lib/acoes/gold.ts:262-268`) grava em `gold_pagamentos` e o pedido
aparece em `/admin/gold`; a contestação aparece em `/admin/avaliacoes`
(`lib/consultas-avaliacoes.ts:107`). Mas **nenhum insert de notificação, nenhum push, nenhum
e-mail para quem administra**. A promessa depende inteiramente de alguém abrir o painel por
hábito.

Isto é gravidade 3 e não 1 porque a fila existe e é visível — a diferença entre "não vai
acontecer" e "pode demorar". Mas é a mesma família: verbo de gatilho sobre um cálculo sem
gatilho. Medição de contexto: `gold_solicitacoes`, `gold_pagamentos` e `avaliacoes` têm **0
linhas** no banco vivo; nunca foi exercido.

**Tamanho do conserto.** **Meia onda** — um aviso ao papel administrativo correspondente
quando a linha entra na fila. O app já sabe fazer isso: `lib/avisos/marketplace.ts` é
exatamente esse padrão, construído hoje.

---

## 3.8 · "Se mudarmos este texto, avisamos por e-mail e/ou dentro do app" — não há como.

**O que promete.** `web/components/legal/pagina-legal.tsx:46`, renderizado no rodapé dos dois
documentos legais (`app/termos/page.tsx:205`, `app/privacidade/page.tsx:330`).

**O que entrega.** Não existe versionamento de política, nem banner de "termos atualizados",
nem rotina, nem tabela. E o canal e-mail está morto (item 3.1), o que deixa a promessa inteira
sem nenhuma das duas pernas que ela mesma oferece.

É a menor das promessas quebradas em impacto diário e a mais delicada em natureza: está num
documento legal, e é a cláusula que sustenta a validade de qualquer mudança futura de termos.

**Tamanho do conserto.** **Uma linha** (reescrever para *"a versão vigente é sempre a desta
página, com a data no topo"*, que é o que o app faz) ou **meia onda** (fazer existir).

---

# GRAVIDADE 4 — o que o dono vê no dia 1

Medido lendo `/onboarding`, `/hoje` e `/barco` com a hipótese "barco recém-cadastrado, zero
dado". Esta seção é diagnóstico, não achado de defeito: **a tela do dia 1 está boa**, e vale
registrar por escrito para não ser "consertada" por engano.

**O caminho.** `/onboarding` é um wizard de 4 passos (`onboarding/wizard.tsx`, chamado por
`onboarding/page.tsx:23`) e a rota aceita o primeiro barco e qualquer barco depois (`:11-13`).
Terminado, cai em `/hoje`.

**O que ele encontra em `/hoje`, com nada preenchido.** Cada cartão vazio tem título, motivo e
uma ação — que é exatamente o que o PRD §24 (`:475`) pede (*"Explicar o valor da área e
oferecer a ação principal adequada"*):

| cartão | estado vazio | ação oferecida |
|---|---|---|
| Saúde | *"Cadastre horas de motor ou vencimentos com data pra saber como está a embarcação"* (`hoje/page.tsx:651-653`) | "Completar" → `/barco` (`:633`) |
| Motores | *"Nenhum motor cadastrado — cadastre pra ganhar horímetro e alerta de revisão automáticos"* (`:728-729`) | link de cadastro (`:730`) |
| Gastos do mês | *"Nenhuma despesa paga este mês — vaga, combustível, manutenção…"* (`:554-555`) | "Registrar despesa" (`:556`) |
| Tripulação | *"Só você tem acesso a este barco"* (`:575`) | "Convidar comandante" (`:579`) |
| Mar agora | *"Ligue o boletim do mar — defina a posição da marina"* (`:764-765`) | "Definir posição" (`:766`) |

**A única decisão a rever, e ela é de produto, não de bug.** O cartão "Comandantes
disponíveis" **desaparece inteiro** quando não há perfis (`hoje/page.tsx:601` —
`{(comandantes ?? []).length > 0 && …}`), e hoje `perfis_comandante` = 0, então **ninguém
nunca viu esse cartão**. Some com ele a única porta do ecossistema que aparece na tela
inicial. É consistente com a régua da casa (não decorar o vazio) e ao mesmo tempo esconde
metade da tese do produto de 100% dos donos. Fica registrado como escolha a confirmar, não
como defeito.

**O que o dia 1 não tem, e vale dizer:** nenhuma sequência de ativação. Os cinco cartões
vazios competem entre si com o mesmo peso visual; nada diz ao dono que o caminho é *motor →
horas → documentos*, que é o que acende a Saúde e liga os avisos — a única coisa que o traz
de volta no dia 2.

---

# GRAVIDADE 5 — caminho até o valor (regra dos 3 toques)

**A regra da casa, verbatim.** `docs/CONTRIBUTING.md:187-189`, no "Gate de descoberta":

> - **caminho a partir de `/hoje` em no máximo 3 toques** — se não tem, ela não existe
>   para o usuário, por mais que o código esteja pronto;
> - **nenhuma rota sem link** que leve até ela.

**Método da medição.** Grafo de 128 rotas com `page.tsx`; aresta = `href` presente no fecho
transitivo de imports daquela página (page + layouts ancestrais + componentes), o que atribui
corretamente a navegação inferior e a faixa do topo a toda rota de `(app)`. Duas correções
importaram para o número ser confiável: (a) `lib/consultas.ts` é importado por ~110 arquivos e
carrega os *deep-links das notificações*, o que criava arestas falsas (`/hoje → /marketplace` a
1 toque, que não existe) — ele, `lib/domain/notificacoes.ts` e `lib/domain/agenda.ts` foram
tratados como opacos e seus destinos ligados a `/notificacoes` e `/agenda`, que são as telas
que de fato os renderizam; (b) quase toda saída de `/hoje` é condicional (papel, permissão,
existência de dado) — `hoje/page.tsx` tem 20 saídas e só **7 incondicionais** —, então cada
rota tem melhor e pior caso.

## 5.1 · A regra dos 3 toques não tem teste. A de "nenhuma rota sem link" tem.

Este é o achado estrutural da seção, e explica por que os casos abaixo passaram.
`web/lib/ui/menu-destinos.test.ts:353-364` automatiza **só a segunda regra**, e de forma
binária: `rotas − alcançáveis` deve ser vazio. **Distância nunca é calculada em lugar nenhum.**
Uma rota a 6 toques passa no teste exatamente como uma a 1.

**E o mesmo teste é cego para toda rota dinâmica**: `:355` faz
`.filter((r) => !r.includes("["))` antes de comparar. Consequência medida: a única rota órfã
sem exceção escrita do app é
`/barco/equipamento/[id]/sistemas/[sistemaId]/editar` — sem link literal nem template
resolvível —, e ela é invisível ao guardião. `/convite-cotista/[codigo]` também não aparece em
nenhuma das duas listas de exceção pelo mesmo motivo.

*Conserto: **meia onda*** — o teste passar a calcular BFS a partir de `/hoje` e reprovar acima
de 3, com uma lista de exceções declaradas do mesmo jeito que `SEM_PORTA_POR_DECISAO`
(`:140-151`); e resolver templates `${}` em vez de descartar rotas dinâmicas.

## 5.2 · O que estoura hoje

| rota | melhor | pior | caminho mínimo | veredito |
|---|---|---|---|---|
| `/marketplace/disponibilidades/nova` | **4** | **4** | `/hoje > /menu > /marketplace > .../disponibilidades > .../nova` | **VIOLAÇÃO — sem exceção escrita** |
| `/admin/embarcacoes/[id]` | 5 | 5 | via `/admin > /admin/usuarios > /admin/usuarios/[id]` | exceção `CONTRIBUTING.md:198-200` |
| `/admin/gold/[id]`, `/admin/gold/consultores`, `/admin/taxonomia/solicitacoes`, `/admin/usuarios/[id]` | 4 | 4 | via `/menu > /admin > …` | exceção `CONTRIBUTING.md:198-200` |
| `/financeiro/recorrentes/nova` | 3 | **4** | pior: `/barco > /financeiro > /recorrentes > /nova` | no limite, cai por link condicional |
| `/barco/selos/gold/[id]` | 3 | **4** | pior: `/barco > /barco/selos > /gold > /[id]` | idem |
| `/avaliacoes/[usuarioId]` | 3 | **4** | pior: `/menu > /comandantes > /avaliacoes > /[usuarioId]` | idem |

**A violação real é uma só: `/marketplace/disponibilidades/nova`, a 4 toques nos dois
cenários.** Não é área interna nem alias — é a tela em que o comandante **publica a própria
disponibilidade**, ou seja, o ato que faz a vitrine de comandantes existir. Com
`perfis_comandante` = 0 no banco (item 3.4), essa é justamente a tela que precisava ser a mais
fácil de achar do app, e é a mais difícil. *Conserto: **uma linha*** — um `href` direto de
`/marketplace` (ou do menu do Captain) para `.../disponibilidades/nova`.

## 5.3 · O que está dentro do orçamento

Todas as rotas que carregam promessa da landing cabem em 3 toques:

| destino | toques | porta |
|---|---|---|
| `/barco/resumos` (Relatórios) | **2** | `barco/page.tsx:439` |
| `/barco/selos` | **2** | `barco/page.tsx:457` |
| `/menu/assinatura` | **2** | `barco/page.tsx:140` |
| `/carteira` | **2** | `menu/page.tsx:196` |
| `/marketplace` | **2** | `menu/page.tsx:308` |
| `/patio`, `/mecanica`, `/afazeres`, `/estoque`, `/combustivel`, `/frota`, `/atualizacoes`, `/cotistas`, `/prestadores` | **2** | `menu/page.tsx:225-307` |
| `/barco/transferir` | **3** | `/barco > /barco/editar > :170` |
| `/marketplace/interesses`, `/marketplace/disponibilidades` | **3** | `marketplace/page.tsx:165,170` |
| `/avaliacoes` | **3** | `/menu > /comandantes > /avaliacoes` |
| `/comandantes` | **1** ou **2** | 1 só se o cartão renderiza (`hoje/page.tsx:601`) — ver Gravidade 4 |

As inalcançáveis (`/rede`, `/servicos`, `/oportunidades`, `/barco/selo`, `/barco/gastos`,
`/menu/tripulacao`) batem exatamente com `SEM_PORTA_POR_DECISAO`
(`menu-destinos.test.ts:140-151`) e com `CONTRIBUTING.md:193-197`. **Corretas por desenho.**

O caminho até o **dossiê** não é medível porque a rota não existe (item 2.1) — quando existir,
o lugar certo é ao lado de "Relatórios" em `barco/page.tsx:439`, o que a põe em **2 toques**.

---

# TRÊS AFIRMAÇÕES QUE QUASE ENTRARAM NESTE RELATÓRIO E ESTÃO ERRADAS

Este projeto tem histórico de auditorias que repetem lacunas já fechadas. Registro as que
cheguei a formular e derrubei ao medir, para que a próxima auditoria não as reabra:

1. **"O cron de alertas está desligado."** Formulável a partir de
   `.github/workflows/alertas.yml:10` (`if: vars.ALERTAS_ATIVOS == 'true'`) e da ausência de
   `vercel.json`. **Errado:** `alertas_enviados` tem cinco disparos agendados consecutivos
   entre 12 e 16/08. A ausência da prova de que a variável está ligada não é prova de que está
   desligada — e o banco responde a pergunta de graça.
2. **"A tela do Verified promete 30 dias e o código dá 15."** **Errado:** a tela interpola a
   própria constante (`{DIAS_REGULARIZACAO_VERIFIED}`, `verified/page.tsx:89,96,104,110`), que
   vale 15. Não há divergência de número. O que há é a promessa de aviso (item 1.4) — que é
   outro achado, e esse é real.
3. **"O aviso do Marketplace foi escrito mas a migration não foi aplicada."** Formulável
   porque a migration 089 aparece em `supabase/migrations/RODAR-SEXTO-LOTE-2026-08-19.sql`, um
   nome que sugere lote pendente. **Errado:** `pg_proc` no banco vivo tem
   `avisos_da_demanda(p_demanda uuid)`. Está aplicada; o fluxo funciona em produção.

---

# O QUE NÃO FOI VERIFICADO

Registrado para não virar conclusão por omissão:

- **Variáveis de ambiente da Vercel** — sem acesso ao projeto. Vale para o item 1.3
  (`NEXT_PUBLIC_APP_URL`) e para saber se a cobrança está de fato ligada.
- **Conta Resend** — se o domínio está verificado e se `RESEND_API_KEY` existe em produção.
  O achado 3.1 não depende disso: o `from` está cravado no código.
- **Variável de repositório `ALERTAS_ATIVOS` no GitHub** — não lida diretamente. O que se sabe
  é o resultado: `alertas_enviados` tem disparos diários entre 12 e 16/08, o que só acontece se
  o cron estiver ligado. **A pergunta que sobra é por que 17 e 18/08 estão vazios.**
- **A conta Asaas e se a cobrança está de fato ligada.** `/assinar` já degrada honestamente
  quando não está (`assinar/page.tsx:118`, `cobrancaLigada`); a landing **não** — ela mostra
  preço e "Começar agora" em qualquer cenário (item 2.3 trata do selo, não disto).
- **Runtime.** Nenhum servidor levantado, nenhuma tela aberta em navegador. Todas as leituras
  de tela são de código-fonte.
- **A varredura de copy dos 172 `EstadoVazio`** — cerca de 40 frases de afirmação factual foram
  examinadas nesta auditoria (as que sobreviveram estão listadas acima como CUMPRE, no arquivo
  de trabalho da varredura). A varredura completa dos estados vazios continua não medida.

---

# APÊNDICE — frases que CUMPREM, como régua do que é escrever certo

Levantadas na mesma varredura. Servem de referência do padrão a copiar quando as de cima forem
reescritas:

- `marketplace/[id]/page.tsx:480` — *"Seu pedido está publicado, mas ninguém que atende essa
  categoria na sua região está cadastrado para receber avisos ainda."* Lê o zero real e o diz.
- `marketplace/nova/page.tsx:193` — *"Ninguém vê o seu telefone só por ler o pedido."* Sustentado
  por tabela separada (`046_marketplace_demandas.sql:423-433`).
- `financeiro/recorrentes/page.tsx:86` — *"Nada aqui está pago até você marcar. O Commander não
  dá baixa sozinho."* Negativa honesta.
- `admin/logs/page.tsx:32` — *"O registro não é editável nem apagável — nem por você."*
  Sustentado por `revoke` no banco (`049_admin_papeis.sql:256`).
- `comandantes/page.tsx:85` — *"o Commander não verifica"*. Honestidade ativa sobre limitação.
- **`barco/connect/page.tsx` inteira** — é a melhor tela de promessa do app: "Em breve" no
  título, *"o resultado é uma classificação preliminar — **nunca uma promessa**"* (`:73`),
  *"a Commander **poderá** analisar"* (`:83`), e nenhuma data de lançamento. É exatamente o
  registro que a landing deveria usar para o concierge (item 2.2).

---

*Auditoria de produto só-leitura, 19/08/2026. Nenhum arquivo de aplicação alterado, nenhuma
migration rodada, nenhuma escrita no banco. Funções e contagens lidas da definição viva de
`khgjtxvmduizyooqaoox`.*
