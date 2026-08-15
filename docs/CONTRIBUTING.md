# Como trabalhar neste repositório

## Verificação local
O hook de pré-commit roda `tsc --noEmit` e a suíte de testes. Ative uma vez por clone:

    git config core.hooksPath .githooks

Para um commit emergencial sem o hook (evite): `git commit --no-verify`.

## CI
`.github/workflows/ci.yml` roda lint, typecheck, testes e build em todo push. O build usa
variáveis de ambiente falsas — o app não fala com o Supabase durante a compilação.

## Banco
Toda migration é aplicada via MCP no projeto remoto **e** versionada em `supabase/migrations/`
com o mesmo SQL. Nunca altere o banco sem gravar o arquivo.

## Glossário — um conceito, um nome

Decidido na auditoria de usabilidade de 08/08/2026 (`docs/auditoria/2026-08-08-sintese-ux.md`),
depois que o dono do produto travou no próprio app. **Estes termos não voltam:**

| Não escreva | Escreva |
|---|---|
| item monitorado | **manutenção** (motor/elétrica/casco) · **documento** (documentos) |
| Notificações · Alertas (como nome de tela) | **Avisos** |
| + Evento · + Lançamento · Salvar no diário | **+ Registrar** · **Registrar no diário** |
| Marketplace (pra vitrine de perfis) | **Comandantes** |
| Selo Ouro · Commander Review · Review | **Commander Verified** (digital, checklist do app) · **Commander Gold** (presencial, avaliação com o Protocolo Commander) — aposentados na onda 33 (`docs/prd/upgrade2-correcoes.txt`, Correções 01–20): não existe um terceiro selo entre os dois, e "Review" nunca é nome de produto/serviço, só a avaliação presencial que já é etapa do fluxo do Gold |
| matriz de permissões | **o que ele pode ver e editar** |
| cota de nuvem | **espaço de fotos** |
| "confira seu acesso a esta aba" | o nome da área: **"Seu acesso não permite editar Motores"** |
| mapa de profundidade (sem qualificar) | **camada Profundidade** (grade estática ETOPO, `lib/mapa/camadas.ts`, onda 6/12) — não confundir com **sondagem colaborativa** (onda 13, pontos gravados por barcos) |
| dado de sonar cru · leitura de NMEA | **sondagem colaborativa** (a funcionalidade) · **leitura** (um ponto) |
| buffer · cache local · enviar sondagem | **fila** (leituras guardadas no aparelho esperando conexão pra enviar, `web/lib/nmea/fila.ts`, onda 14) — nunca "enviar" sozinho: sondagem sempre entra na fila primeiro, o envio é automático e em segundo plano |
| tábua de marés · preamar/baixa-mar oficial | **maré estimada** / **curva de maré estimada por modelo** (onda 20, `web/lib/domain/mar.ts`) — a tábua oficial é a do CHM, o Commander não a embute, só linka pra ela |
| Marketplace (pro mural de vagas/diárias/"COMPRO X") | **Oportunidades** (onda 39, ver abaixo) |
| "criar uma agenda" · "evento" (na Agenda) | **compromisso** (onda 43, PRD §8) — o PRD é explícito: *"o usuário não 'cria uma agenda', cria eventos/compromissos"*. E "evento" no Commander **já é** o registro do Diário de Bordo (tabela `eventos`, o que aconteceu); a Agenda é `agenda_eventos` (o que está marcado). Na tela sempre **compromisso**, nunca "evento" |

### Comandantes · Prestadores · Serviços · Oportunidades · Explorar (onda 39) — cinco conceitos, cinco nomes

O PRD (`docs/prd/upgrade2-master.txt` §47–54) usa "Marketplace" pra DUAS coisas diferentes, e a
auditoria de 14/08 (`docs/auditoria/2026-08-14-prd-upgrade2-parte2.md`, seção 1.3) flagrou a
divergência: nosso `/marketplace` (rota antiga) já era a vitrine de perfis de Comandante —
a auditoria de usabilidade de 08/08 já tinha decidido chamar isso de "Comandantes" na UI, só a
URL não tinha acompanhado. O "Marketplace" do PRD §49/§53–54 (vagas, diárias, "COMPRO — Rádio
VHF", prestador respondendo) é um conceito diferente e não existia em lugar nenhum do código.

Decisão da onda 39: **nunca reintroduzir "Marketplace" como nome visível** — ele já causou
confusão suficiente pra virar pauta de duas auditorias. Um conceito, um nome, os cinco:

| Nome final | Rota | O que é | PRD |
|---|---|---|---|
| **Comandantes** | `/comandantes` (renomeada de `/marketplace`) | Vitrine de perfis de comandante pra contratar via WhatsApp | §47 |
| **Prestadores** | `/prestadores` | Perfil profissional por especialidade (mecânico, eletricista, fibra…) — reaproveita `perfis_comandante` com `tipo='prestador'` (migration 037), mesma tabela/RLS/trigger anti-autoverificação de Comandantes | §50 |
| **Serviços** | `/servicos` | Achar quem resolve um problema — categoria primeiro, prestador depois. Mesmo dado de Prestadores, ângulo de busca diferente | §51 |
| **Oportunidades** | `/oportunidades` | O Marketplace de verdade do PRD: mural de vagas/diárias/peça-ou-serviço ("COMPRO — Rádio VHF"), prestadores/comandantes respondem. Tabelas `oportunidades`/`respostas_oportunidade` (migration 037/038). Sem comissão nem preço-piso — PRD §49 marca R$350/10% como "estudados, não fechados", decisão comercial do dono | §49, §53–54 |
| **Explorar** | `/explorar` | Mapa de parceiros (marina, posto, pousada, restaurante) — descoberta, não navegação. Reaproveita `MapaNautico`/`CardParceiro`/os dados de `parceiros` que `/navegar` já usa | §52 |

Serviços e Explorar são o par mais fácil de confundir — o próprio PRD avisa ("não deve ser
confundido com Explorar", §51): Serviços mostra PESSOAS (prestadores), Explorar mostra LUGARES
(parceiros no mapa). A tela de Serviços diz isso explicitamente no texto de apoio, não só aqui.

Todas as cinco telas têm a mesma faixa de navegação no topo (`RedeNav`,
`web/components/ui/rede-nav.tsx`) — a distinção fica visível na interface, não só documentada.

A voz do app é a que ele já acerta nos bons momentos: *"Bom vento e mar calmo"*,
*"Agora não"*, *"Essa saída durou 3 h 30 — atualizar as horas dos motores?"*.
Mensagem de erro diz **o que fazer**, não só que deu errado.

### Corredores (onda 17) — honestidade obrigatória

Corredor é passagem histórica agregada, não garantia: um barco menor pode ter
passado onde o seu não passa. Todo texto sobre rota com corredores diz no
máximo que ela **"considera passagens reais de outros barcos"** — nunca
"validada", "segura" ou "recomendada". O redutor de custo do A* só atua em
célula já aprovada por água/calado; escrever qualquer coisa que sugira o
contrário é bug. E a contrapartida de privacidade: a contagem por célula é
anônima por construção (tabela sem dono); nenhuma tela pode tentar
reconstituir "quem passou aqui".

### Sondagem colaborativa (onda 13) — honestidade obrigatória

A tela de `/navegar` nunca pode sugerir que a sondagem coletada pelos usuários
vira carta confiável. É **dado colaborativo bruto**: melhora com o tempo (mais
barcos passando pela mesma célula, mais confiança), mas **nunca substitui a
carta náutica oficial** — mesma régua que já vale para a camada de
profundidade ETOPO (onda 6/12) e para a rota por calado (onda 12). Todo texto
novo que mencionar profundidade medida por usuário repete essa ressalva, não
assume que quem lê já sabe.

### Tempo no mar — vento, onda, água e maré (onda 20) — honestidade obrigatória

O Commander **não tem** e **não embute** a tábua oficial de marés do CHM (uso restrito a
"fins científicos" — ver `docs/OPERACAO.md`). Toda maré mostrada no app (boletim da Início,
gráfico do painel "Tempo" em `/navegar`) é a curva de nível do mar de um MODELO
meteorológico (Open-Meteo Marine, `sea_level_height_msl`) — **sempre rotulada como
estimativa**, nunca "tábua de marés" nem "preamar/baixa-mar oficial" (ver glossário acima).
Link para a tábua oficial do CHM é livre e obrigatório em toda tela que mostra maré
(`LINK_TABUA_MARE_CHM`, `web/lib/domain/mar.ts` — fonte única do link, nunca duplicada).

O mesmo vale pro resto do painel de tempo: vento/onda/água são previsão de modelo, não
garantia — o selo de condição (`avaliarMar`, reaproveitado do boletim já existente) diz o
que o MODELO indica pro momento, nunca "pode sair com segurança". E sem dado (API fora do
ar, timeout), a tela **diz que está indisponível e oferece tentar de novo** — nunca mantém
um número antigo na tela como se fosse a leitura atual (`TempoPainel`,
`web/components/mapa/tempo-painel.tsx`, estado `"indisponivel"`).

### Fila persistente (onda 14) — honestidade obrigatória

O sonar chega ao celular por WiFi da própria caixa de sonar (o celular fica
sem internet enquanto conectado nela) e, no mar, raramente há sinal de
celular — **não existe "enviar sondagem ao vivo"**. Nenhum texto novo pode
sugerir isso. Toda leitura entra primeiro na **fila** (`web/lib/nmea/fila.ts`)
e só sai quando o servidor confirma; o envio roda sozinho em segundo plano
(conexão voltando, app voltando ao primeiro plano, ou um timer de segurança) —
a pessoa nunca precisa "clicar em enviar" nem esperar olhando a tela. Todo
texto que mencionar o estado da fila é honesto sobre o que está **guardado**
vs. o que já foi **enviado**, e nunca deixa a pessoa achar que perdeu uma
saída sem sinal — é o oposto: nada se perde, só demora pra subir.

### Saúde da Embarcação (onda 36) — fórmula é decisão de produto, não refactor

A fórmula da nota do anel de saúde (pesos por categoria, severidade de status/gravidade,
faixas de rótulo) vive **inteira** em `web/lib/domain/saude.ts` — nenhum outro arquivo
guarda peso nenhum. Qualquer mudança de número ali é decisão de produto (precisa passar
pelo dono, mesmo padrão da decisão de 14/08/2026 registrada no topo do arquivo), nunca um
ajuste de refactor ou "melhoria" de engenharia por conta própria.

## Antes de fechar uma fase
1. `npm test` e `npm run build` verdes
2. Passe visual contra as pranchas da marca (navy/dourado, ícones, tipografia),
   incluindo a landing pública, a tela `/assinar`, o mapa de `/navegar` (com e
   sem token Mapbox) e o painel `/parceiro`
3. Traçar uma rota real no mapa (Marina da Glória → Vila do Abraão) e confirmar
   de olho que ela contorna a costa em vez de cruzar terra — o teste automatizado
   (`lib/domain/rota-real.test.ts`) cobre a matemática, mas quem vê a linha torta
   na tela é o olho
4. **Gate de descoberta** — seis ondas passaram por revisão adversarial de código e
   nenhuma perguntou *"uma pessoa acha isso sozinha?"*. O resultado foi um app com
   muita capacidade e pouca sinalização. Para cada funcionalidade nova, confirme:
   - **caminho a partir de `/hoje` em no máximo 3 toques** — se não tem, ela não existe
     para o usuário, por mais que o código esteja pronto;
   - **nenhuma rota sem link** que leve até ela. Exceções conhecidas hoje, cada uma
     com motivo: rotas de API e webhook; `/convite/[codigo]` (chega por link externo);
     `/diario/[id]/horas` (tela de sinergia pós-ação — aparece por `redirect` logo
     depois de registrar uma saída, não faz sentido revisitar depois); `/rede` (alias
     de compatibilidade que redireciona para Comandantes, fora do robots.txt); `/barco/selo`
     (mesmo padrão do `/rede` — alias de compatibilidade pro antigo "Selo Ouro", redireciona
     para `/barco/selos`, onda 33); `/admin/*` e `/consultor/*` (onda 35 — mesma família de
     `/parceiro`: persona diferente do tripulante, sem link no bottom-nav por design, atrás de
     `exigirAdmin()`/vínculo em `gold_consultores` além da sessão, fora do robots.txt).
     Rota nova fora dessa lista precisa de link ou vira exceção documentada aqui;
   - **todo dado que a interface grava aparece em algum lugar** (o contrário também:
     nada exibido que ninguém consiga preencher);
   - **o glossário acima vale** — um conceito, um nome, em toda a tela.
5. Conferir cobertura da espec: `docs/superpowers/specs/2026-08-06-commander-v2-design.md`
