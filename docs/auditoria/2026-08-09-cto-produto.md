# Auditoria de produto — necessidade real vs. o que foi construído
**Head of Product · 09/08/2026 · Commander (GEST-NAV)**

Escopo: `web/app/**/page.tsx` (33 rotas) + `web/lib/acoes/*` (20 actions) + domínio (`web/lib/domain/*`) + as duas rotas de cron (`web/app/api/alertas/disparar`, `web/app/api/relatorio/mensal`). Lente única: o dono de lancha de 50 pés no Rio, 55 anos, gasta R$ 15-30 mil/mês no barco, não é pessoa de tecnologia, usa o celular no píer sob sol, e não é quem alimenta o app no dia a dia — quem alimenta é o marinheiro.

Não repito o que a auditoria CTO (07/08) e a auditoria de cobertura funcional (07/08) já cravaram sobre RLS, atomicidade e cobertura de espec — essas já foram parcialmente corrigidas (migration `010_matriz_no_banco_e_integridade.sql`, `011_indices_auditoria.sql`, billing Asaas real em `lib/acoes/assinatura.ts`/`app/(assinatura)/assinar`). Esta auditoria é outra pergunta: **dado tudo que já existe e funciona, é isso que esse dono precisa?**

---

## Veredito em 5 linhas

O motor de domínio é sólido e a base (documentos com alerta, diário unificado, matriz de permissão PROP/CMDT, assinatura Asaas) resolve exatamente a dor certa — mas o produto tem features de mais, não de menos, e a mais cara delas (`/navegar`, ~1060 linhas só no componente do mapa, mais A* em Web Worker, máscara água/terra e scripts de batimetria) serve a mão que segura o timão, não a mão que paga a mensalidade. O "aha moment" prometido pela auditoria de marketing existe no código como reação instantânea (o farol acende assim que a tela carrega, sem esperar cron) — mas só dispara se o dono souber de cabeça uma data de vencimento próxima, e a própria auditoria de marketing já provou que ele não sabe: na prática o primeiro alerta de verdade demora semanas a meses, não dias. O maior buraco não é uma feature ausente — é a ausência de uma saída física do "dossiê" (PDF/link pra mostrar a um comprador ou corretor), que é a própria promessa central da marca ("o dossiê do seu barco") sem um botão que a entregue. E o app já resolve razoavelmente bem a assimetria "quem paga não é quem usa": convite por link, matriz de permissão por aba, e um perfil público do comandante que é dele — não do barco — e continua com ele se ele trocar de embarcação.

---

## Inventário de features

| Feature | Rota/arquivo | Dor que resolve | Frequência | Veredito |
|---|---|---|---|---|
| Painel do dia (Início) | `app/(app)/hoje/page.tsx` | "O que precisa da minha atenção agora, sem eu ter que procurar" | Toda abertura do app | **Manter** — é a tela certa pra ser a primeira |
| Ficha da embarcação (hub) | `app/(app)/barco/page.tsx` | Organização central de tudo do barco | Semanal | **Manter** |
| Editar dados gerais | `app/(app)/barco/editar/page.tsx` | Comprimento/boca/calado/TIE/capitania — documentação formal | Anual | **Manter**, mas é a que menos merece espaço no topo (já reordenado pela Onda 7) |
| Posição da marina | `app/(app)/barco/local/page.tsx` | Liga o boletim do mar | Uma vez (setup) | **Manter** |
| Motores (CRUD + histórico) | `app/(app)/barco/equipamento/*`, `lib/acoes/equipamentos.ts` | "Meu motor vai parar em alto-mar por falta de manutenção" | Mensal (registro) | **Manter — core** |
| Elétrica (gerador/bateria) | `app/(app)/barco/eletrica/page.tsx` | Mesma dor dos motores, pro sistema elétrico | Mensal/baixa | **Manter** |
| Casco por categoria | dentro de `app/(app)/barco/page.tsx:104-127` | Histórico de reparo estrutural (pintura, avaria) | Baixa | **Manter**, custo de manutenção é baixo (reusa `itens_monitorados`) |
| Documentos com alerta | `app/(app)/barco/documentos/page.tsx` + `api/alertas/disparar` | Multa, apreensão, seguro negado por documento vencido | Consulta mensal, ação anual | **Manter — core, é a fonte do aha moment** |
| Fotos (álbuns + cota) | `app/(app)/barco/fotos/page.tsx`, `lib/domain/cota.ts` | Dossiê visual pra revenda | Rara | **Manter, simplificar** (ver corte abaixo) |
| Contatos com nota | `app/(app)/barco/contatos/page.tsx` | "Quem eu chamo pra resolver isso" | Mensal | **Manter**, bom custo-benefício |
| Gastos (mês + 6 meses) | `app/(app)/barco/gastos/page.tsx`, `lib/domain/gastos.ts` | "Quanto esse barco me come" | Mensal | **Manter — core**, mas falta o "custo por hora navegada" que a própria CMO já indicou como gancho de retenção e os dados (gastos + horímetro) já existem pra calcular |
| Selo Ouro (checklist) | `app/(app)/barco/selo/page.tsx`, `lib/domain/selo.ts` | Diferencial de revenda / "quanto documentado vale" | Crescente, eventual | **Manter o checklist; cautela com o botão** (ver abaixo) |
| Diário de Bordo unificado | `app/(app)/diario/page.tsx`, `diario/novo/page.tsx`, `lib/acoes/eventos.ts` | Substitui caderno/planilha/WhatsApp com o marinheiro | Toda saída/serviço | **Manter — core, é a fonte de dado de tudo o resto** |
| Prompt pós-saída (atualizar horas) | `app/(app)/diario/[id]/horas/page.tsx` | "Ninguém atualiza a hora do motor" | Toda saída registrada | **Manter — a melhor ideia pequena do app** |
| Trilha GPS (resumo) | `app/(app)/diario/trilha/[id]/page.tsx` | Documentar uso pra seguro/revenda | Por saída navegada | **Manter**, baixo custo incremental |
| Navegar (modo completo) | `app/(app)/navegar/page.tsx`, `components/mapa/navegar-mapa.tsx` (1063 linhas), `scripts/gerar-mascara-agua.mjs`, `scripts/gerar-batimetria.mjs` | Ajuda a pilotar: SOG, rumo/ETA, alarme de âncora, MOB, rota que contorna terra | Toda saída **se quem pilota usar o celular no leme** | **Adiar novo investimento** (ver corte abaixo) — quem paga não é quem usa isso |
| Marketplace (vitrine CMDT) | `app/(app)/marketplace/page.tsx`, `marketplace/perfil/page.tsx` | Achar comandante de confiança sem depender só de boca a boca | Rara, mas decisiva quando acontece | **Manter** — hoje é lista + WhatsApp, sem transação (fase 8, bloqueada por jurídico, por decisão) |
| `/rede` | `app/(app)/rede/page.tsx` (3 linhas: redirect) | Nenhuma — é rota morta | — | **Cortar** |
| Menu (hub) | `app/(app)/menu/page.tsx` | Acesso a conta/assinatura/tripulação | Ocasional | **Manter** |
| Perfil pessoal | `app/(app)/menu/perfil/page.tsx` | Nome/telefone/avatar | Rara | **Manter** |
| Assinatura + faturas | `app/(app)/menu/assinatura/page.tsx`, `app/(assinatura)/assinar/page.tsx`, `lib/acoes/assinatura.ts` | Cobrar e o dono acompanhar a cobrança | Mensal (consulta) | **Manter — core, é o negócio** |
| Tripulação + matriz de permissão | `app/(app)/menu/tripulacao/page.tsx`, `[id]/page.tsx`, `lib/domain/permissoes.ts` | A assimetria "quem paga não é quem usa" | Setup raro, mas estrutural | **Manter — core** |
| Convite (aceite) | `app/(app)/convite/[codigo]/page.tsx` | Onboarding do CMDT | Uma vez por CMDT | **Manter** |
| Avisos (push + histórico) | `app/(app)/notificacoes/page.tsx` | "Quero saber sem abrir o app" | Configurar 1x, consultar raro | **Manter** |
| Painel do Parceiro | `app/(parceiro)/parceiro/page.tsx`, `lib/acoes/parceiro.ts` | Receita paralela + motivo de abrir o mapa toda saída | Setup 1x pro parceiro | **Manter** — prioridade estratégica do roteiro (Onda 4) |
| Landing pública | `app/page.tsx` | Aquisição — hoje é a única porta de entrada que existe | — | **Manter — core** |
| Login/cadastro | `app/(auth)/login/page.tsx`, `lib/acoes/auth.ts` | Autenticação | — | **Manter** |
| Onboarding (3 passos) | `app/onboarding/page.tsx`, `lib/acoes/onboarding.ts` | Criar o primeiro/próximo barco | Uma vez por barco | **Manter, mas é o gargalo do aha moment** (seção própria abaixo) |
| Relatório mensal por e-mail | `app/api/relatorio/mensal/route.ts` | Anti-churn: justifica a fatura mesmo sem abrir o app | Mensal automático | **Manter**, ótimo custo-benefício, pula meses vazios (`resumoVazio`) |
| Motor de alertas (cron) | `app/api/alertas/disparar/route.ts` | O coração do produto | Diário (gated por `ALERTAS_ATIVOS` em `.github/workflows/alertas.yml:10`, ainda desligado) | **Manter — core** |

---

## O que eu cortaria

### 1. `/navegar` — parar de investir, não de usar o que já existe
`components/mapa/navegar-mapa.tsx` tem 1063 linhas: GeolocateControl, SOG em nós, linha de rumo com distância/bearing/ETA, alarme de âncora com filtro anti-jitter de 3 leituras seguidas, botão MOB, overlay OpenSeaMap, e — na Onda 5 — um A* octile rodando em Web Worker sobre uma máscara água/terra de 4088×1547 células (`scripts/gerar-mascara-agua.mjs`), com string-pulling pra suavizar a rota. É engenharia genuinamente impressionante. O problema é pra quem: o dono de 55 anos que gasta R$ 20 mil/mês não é quem segura o celular no leme sob sol forte tentando ler um alarme de âncora — é o marinheiro, ou ninguém, porque a lancha tem os instrumentos de bordo dela. E o próprio app admite o limite real (`navegar-mapa.tsx:130-133`, disclaimer fixo): "sabe contornar TERRA, não conhece PROFUNDIDADE" — ele compete de cabeça erguida com Navionics/C-Map em UX e perde de longe em dado (batimetria de verdade). Isso tem cheiro de feature construída porque era o desafio técnico mais divertido da lista (rota marítima com pathfinding é um problema de engenheiro adorar resolver), não porque o dono pediu.
**Não cortar o que já está pronto** — ele demonstra bem no píer (a auditoria CMO pede exatamente telas que impressionem em 5 segundos) e o marinheiro pode de fato usar o alarme de âncora. **Cortar é a Onda 7** do roteiro ("cartas náuticas e offline" — pipeline de tiles BSB/NOAA, cache de service worker, sombreamento de batimetria): mais meses de engenharia num recurso que o pagador não vai tocar, competindo numa categoria (carta náutica) que tem player estabelecido e o app não tem dado pra vencer. **O que se ganha**: meses de engenharia redirecionados pro que falta e é óbvio (seção abaixo) — que custa muito menos e devolve mais R$/hora de trabalho.

### 2. Fotos — 4 álbuns + barra de cota visível
`app/(app)/barco/fotos/page.tsx:64-78` categoriza em Exterior/Interior/Convés/Documentação visual, e mostra uma barra de progresso de 500 MB (`lib/domain/cota.ts:3`) toda vez que a tela abre. Pra um dono que provavelmente vai subir 10-30 fotos no total da vida do app, isso é: (a) fricção de navegação — escolher álbum antes de ver qualquer coisa — pra um acervo pequeno que caberia numa grade só; (b) uma barra de "500 MB usados: 2%" que não comunica nada útil a quem nunca vai chegar perto do limite. **Cortar**: unificar num "Fotos" só, sem categoria, mantendo a capa. **Manter escondida** a lógica de cota (ela existe pra proteger o P1-5 já apontado pela auditoria CTO — bomba de custo de storage — e deve continuar bloqueando silenciosamente perto do limite real, só não precisa de UI dedicada pra isso na tela principal). **O que se ganha**: uma tela mais rápida de usar no píer com uma mão só, e menos decisão pra quem só quer "photo do barco bonito lá".

### 3. `/rede`
`app/(app)/rede/page.tsx` inteiro é:
```
export default function RedePage() {
  redirect("/marketplace")
}
```
Rota morta, provavelmente resquício de nomenclatura anterior ao "Marketplace" virar o nome oficial. **Cortar**: apagar o arquivo e qualquer link residual que aponte pra `/rede`. Custo de manutenção zero pra manter, mas também zero motivo pra existir — é o tipo de achado que só aparece varrendo o código todo, exatamente o exercício desta auditoria.

### 4. O botão "Solicitar avaliação presencial" do Selo Ouro — não cortar, mas não ligar ainda em escala
`lib/acoes/selo.ts:23-90` está bem construído — nunca finge que despachou algo que não despachou, tem trava de 30 dias contra clique repetido, e o e-mail vai pro mesmo endereço da equipe (`atendimento.smu@gmail.com`, hoje o fundador sozinho). O risco não é de código, é operacional: com zero funcionários dedicados a visita física, cada clique nesse botão é uma promessa de alguém aparecer no barco. Em escala de dezenas de fundadores simultâneos, ou o fundador vira consultoria de campo em tempo integral, ou o pedido fica sem resposta e o Selo Ouro — que é o argumento de venda mais forte do produto — vira a primeira decepção do assinante. **Não cortar** (o checklist sozinho já tem valor: ele é grátis pra manter, já usa dado que existe, e dá ao dono uma "nota" do próprio cadastro). **Cautela de lançamento**: não anunciar o Selo Ouro amplamente até o processo de avaliação presencial ter capacidade real, ou colocar fila/expectativa de prazo explícita no texto da tela.

---

## O que falta e é óbvio

1. **Não existe um botão que gere o dossiê.** A marca inteira se vende como "o dossiê do seu barco" (`app/page.tsx:76`, "Manutenção em dia, documentos alertados, e um dossiê que vale dinheiro na hora de vender" — `docs/auditoria/auditoria-cmo.md:109`), e não existe em nenhuma tela um "Exportar dossiê em PDF" ou um link público read-only pra mostrar a um comprador/corretor. Hoje o "dossiê" é só a % de completude do Selo Ouro dentro do app — pra usar a favor de uma venda, o dono precisaria mostrar o celular dele, logado, telas por tela, a um estranho comprador. Ninguém faz isso. Isso é o que ele faz hoje sem o app: manda um PDF de manutenções pro comprador ou pro corretor. É a lacuna mais gritante porque é a promessa #1 da marca sem entrega física.
2. **Sem custo por hora navegada.** A CMO já apontou isso como gancho de retenção — "o número que esse público comenta no píer" — e os dois dados que ele precisa (gastos em `lib/domain/gastos.ts` e horas em `equipamentos.horas_atuais`/leituras) já existem na base. Não tem cálculo, não tem card. Custo de implementar: baixo (é uma divisão sobre dado que já é gravado); ganho: alto (vicia, gera boca a boca).
3. **Sem chat com a equipe Commander** (espec §12) — zero WhatsApp Business/Zendesk embutido. Pra um dono que "não é pessoa de tecnologia", ter uma dúvida sem saber a quem perguntar é motivo de abandono silencioso.
4. **Sem gatilho de seguradora parceira** no vencimento do documento de seguro (espec §12) — o momento exato em que o app já sabe que o seguro vence é o melhor momento comercial pra oferecer cotação, e não existe.
5. **Sem importação por foto (OCR) no onboarding** — a correção de maior impacto que a CMO já apontou (tirar foto da plaqueta do motor/apólice/TIE em vez de digitar) continua sem uma linha de código. É o que resolve o gargalo real da seção seguinte.
6. **Sem export/apagar conta (LGPD)** — já sinalizado pela auditoria CTO em 07/08, continua valendo: `profiles` sem policy de DELETE, sem rota de exclusão nem exportação de dados.

---

## O caminho até o primeiro alerta (cronometrado)

Passo a passo real, seguindo o código:

1. **Cadastro** (`app/(auth)/login/page.tsx`) — nome, e-mail, senha. ~30 s.
2. **Redirect automático para `/onboarding`** (`lib/acoes/auth.ts:35`) — sem passar por nenhuma tela de valor antes.
3. **Onboarding, passo 1 "O barco"** (`app/onboarding/page.tsx:44-57`) — só **nome** é obrigatório; estaleiro/modelo/ano/marina são opcionais. ~10 s se só preencher o nome, ~1 min se souber tudo de cabeça.
4. **Passo 2 "Motores"** — quantidade (padrão 2), marca/modelo/horas — tudo opcional. ~1 min **se souber as horas de cabeça**; senão, pula.
5. **Passo 3 "Vencimentos críticos"** — data de vencimento do seguro e do TIE, **ambas opcionais**, enterradas na última etapa. ~30 s **se souber as datas de cabeça** — o que a própria auditoria CMO já provou que ele não sabe (está na pasta do barco ou na cabeça do marinheiro).
6. **Submit** → `concluirEmbarcao` grava a embarcação e, **independente de ter horas reais ou não**, cria 2 itens de manutenção por motor com `ultimo_ciclo_data = hoje` (`lib/acoes/onboarding.ts:73-74`) → redirect pra `/hoje`.

Neste ponto: o farol de `/hoje` (`app/(app)/hoje/page.tsx:62`) é calculado **na hora, direto do painel carregado** — não depende do cron rodar. Então, tecnicamente, a primeira pista visual pode aparecer **no instante em que a tela `/hoje` carrega**, sem esperar nada.

Mas só acontece **se**: o dono soube e digitou uma data de seguro/TIE que já está a ≤30 dias de vencer (pouco provável — ele raramente loga justamente perto do vencimento) — que é o único caminho pra um alerta de verdade em dias. Fora isso, os dois itens de manutenção sementeados (revisão 500h / óleo 250h-12m) só entram na janela de alerta **daqui a meses**, e o único outro gatilho automático é o "lembrete de motor parado" — 30 dias sem atualizar horas (`lib/domain/alertas.ts`, chamado em `api/alertas/disparar/route.ts:174-181`) — que é um nudge de boa prática, não "o alerta que salva de um problema" que a CMO define como aha moment real.

E mesmo no melhor caso, o **push/e-mail** só sai no próximo disparo do cron — hoje 1×/dia às 08h de Brasília, e esse cron está **desligado por padrão**, atrás de uma flag de repositório (`.github/workflows/alertas.yml:10`, `if: vars.ALERTAS_ATIVOS == 'true'`) que ainda não foi ligada. O farol na tela é instantâneo; a notificação fora do app, não.

**Veredito**: tempo até a primeira pista visual = literalmente o tempo do onboarding (3-5 min), **contingente a um dado que o dono raramente tem de cabeça**. Tempo até o alerta real, que ele não foi atrás de procurar, cair sozinho no colo dele = semanas a meses. Confirma, com números concretos de código, o que a auditoria CMO já tinha diagnosticado.

### Proposta de encurtar
1. **Trocar a ordem do onboarding.** Hoje "vencimentos críticos" é o passo 3, enterrado atrás de motor. Perguntar "quando vence seu seguro?" **primeiro** — é a pergunta mais fácil de responder de cabeça (está no e-mail da seguradora) e é o único campo capaz de gerar um alerta em dias, não meses.
2. **Oferecer "não sei agora, me lembre em 7 dias"** como opção nos campos de data que hoje são abandonados quando o dono não sabe — mantém o app "vivo" na primeira semana em vez de silenciosamente vazio.
3. **Rotear o pós-signup por `/navegar` antes do onboarding.** O código já permite: `app/(app)/navegar/page.tsx` não chama `carregarPainel()` e o middleware (`middleware.ts:27-32`) só exige estar logado, não ter barco cadastrado. Ou seja, **o valor "útil desde o minuto 1" que a CMO já recomendou já existe em código** — boletim do mar e trilha GPS funcionam sem nenhum dado do barco — só não está no caminho: hoje `cadastrar()` manda direto pro formulário (`lib/acoes/auth.ts:35`). Trocar o destino padrão pós-cadastro por uma tela intermediária ("veja o mar da sua marina agora, cadastre o barco depois") é reordenar rota, não escrever feature nova.
4. **Importação por foto (OCR)** continua sendo a correção de maior impacto pra resolver o gargalo de fundo: ninguém tem os números de cabeça, foto resolve.

---

## Quem paga vs. quem usa

O app tem uma resposta estrutural razoável pra essa assimetria, e ela está bem pensada:
- **Convite por link** (`lib/acoes/convites.ts`, `app/(app)/convite/[codigo]/page.tsx`) — o PROP manda um link de WhatsApp, o CMDT entra sem precisar saber nada de tecnologia além de clicar.
- **Matriz de permissão por aba** (`lib/domain/permissoes.ts`, `app/(app)/menu/tripulacao/[id]/page.tsx`) — o PROP decide, aba por aba, o que o CMDT vê e edita, com 2 presets prontos ("Operacional"/"Completo") pra não obrigar configuração fina logo de cara. Migration `010_matriz_no_banco_e_integridade.sql` sugere que a trava hoje é reforçada no banco, não só na UI — o que endereça o achado mais grave da auditoria CTO anterior (P0-1).
- **O perfil público do comandante é dele, não do barco** (`perfis_comandante`, `app/(app)/marketplace/perfil/page.tsx`) — um incentivo genuíno: o CMDT constrói reputação portátil entre embarcações, não fica preso a um dono só. Isso é a resposta certa pra "o que falta pro marinheiro querer usar": ele ganha algo que continua com ele.

**O que ainda falta pro marinheiro sentir que o app é dele, não uma tarefa do patrão**: o onboarding de hoje é endereçado genericamente a "quem está logado" — não existe um fluxo "convide seu comandante primeiro e deixe ele preencher a ficha", que é a correção de maior impacto que a própria CMO já sugeriu ("inverter o onboarding"). E o Selo Ouro, gastos, e a narrativa de "dossiê que vale dinheiro" são todos enquadrados pro PROP — nenhuma tela devolve ao CMDT algo do tipo "você preencheu 80% da ficha desse barco, seu trabalho está registrado". O incentivo existe (perfil público dele), mas não está costurado ao esforço de preenchimento do dia a dia.

---

## As 3 features essenciais, e as 3 seguintes

**As 3 essenciais** (se só pudesse ter três):
1. **Documentos com alerta** (`/barco/documentos` + `api/alertas/disparar`) — a dor mais cara em R$ real (multa, apreensão, seguro negado) e a mais fácil de esquecer sozinho sem o app.
2. **Diário de Bordo unificado** (`/diario`) — substitui diretamente planilha/WhatsApp/caderno, e é a fonte de dado que alimenta gastos, selo e histórico de tudo mais.
3. **Convite + matriz de permissão CMDT** (`/menu/tripulacao`) — sem isso, as duas primeiras morrem: o dono não vai digitar nada sozinho, é o marinheiro quem alimenta.

**As 3 seguintes**:
4. **Gastos com quebra por categoria** (`/barco/gastos`) — converte dado que já foi digitado (pela feature #2) em percepção de valor mensal, e é o gancho de retenção mais barato de melhorar (custo por hora).
5. **Assinatura/cobrança** (`/menu/assinatura`, `/assinar`) — sem isso não tem negócio, mas só importa depois que 1-3 já provaram retenção com os primeiros fundadores.
6. **Marketplace vitrine de comandantes** (`/marketplace`) — motor de aquisição (o canal "comandante embaixador" que a CMO aponta como o melhor CAC) e cross-sell, mas só faz sentido com massa mínima de comandantes cadastrados primeiro.

---

## O que está certo

- **O motor de domínio é a espinha dorsal certa.** `lib/domain/semaforo.ts` (revisão por horas OU data, o que vier primeiro) é reusado sem exceção em `/hoje`, `/barco`, `/barco/equipamento/[id]`, `/barco/documentos`, `/barco/gastos` e no cron de alertas — nenhuma tela discorda de outra sobre o mesmo dado, o que é raro de ver e caro de manter se não fosse assim desde o início.
- **O prompt pós-saída pra atualizar horímetro** (`app/(app)/diario/[id]/horas/page.tsx`) é a melhor ideia pequena do produto: pega um hábito que a pessoa já teria (registrar quando saiu/voltou) e converte automaticamente no dado que ninguém mantém atualizado (hora do motor), com "Agora não" tão fácil de tocar quanto "Atualizar" — sem armadilha.
- **Onda 7 ("Fala como gente") já corrigiu os dois piores achados de UX**: o card de alerta da Início agora é `<Link>` de verdade (antes era `<div>` morto), e "Tudo em dia" agora distingue de "falta informação" (`hoje/page.tsx:70-84`) — não mente mais pra quem acabou de chegar. O horímetro sem leitura mostra "—", não "0,0 h" (`components/horimetro.tsx:16-20`) — detalhe pequeno que evita destruir confiança na primeira olhada de quem tem um motor com 600 horas reais.
- **Falhas nunca fingem sucesso.** `lib/acoes/selo.ts`, `registro.ts`, `onboarding.ts` — todos verificam o resultado real da escrita antes de dizer "salvo", e quando falha parcialmente dizem exatamente isso em vez de mentir. É um padrão consistente em todo o código de actions.
- **O relatório mensal por e-mail pula meses vazios** (`resumoVazio` em `api/relatorio/mensal/route.ts:20-22, 102-106`) — decisão de produto correta: um e-mail de relatório zerado treina o dono a ignorar o próximo, então melhor não mandar nada do que mandar ruído.
- **O painel do parceiro comercial é autoatendimento de verdade** (`app/(parceiro)/parceiro/page.tsx`) — arrastar o pino no mapa em vez de pedir endereço (que não funciona no mar) é a decisão certa, e o contador de visualizações reforça valor na hora da renovação sem precisar de dashboard separado.
