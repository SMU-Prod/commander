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
| Marketplace | **Comandantes** |
| matriz de permissões | **o que ele pode ver e editar** |
| cota de nuvem | **espaço de fotos** |
| "confira seu acesso a esta aba" | o nome da área: **"Seu acesso não permite editar Motores"** |
| mapa de profundidade (sem qualificar) | **camada Profundidade** (grade estática ETOPO, `lib/mapa/camadas.ts`, onda 6/12) — não confundir com **sondagem colaborativa** (onda 13, pontos gravados por barcos) |
| dado de sonar cru · leitura de NMEA | **sondagem colaborativa** (a funcionalidade) · **leitura** (um ponto) |
| buffer · cache local · enviar sondagem | **fila** (leituras guardadas no aparelho esperando conexão pra enviar, `web/lib/nmea/fila.ts`, onda 14) — nunca "enviar" sozinho: sondagem sempre entra na fila primeiro, o envio é automático e em segundo plano |

A voz do app é a que ele já acerta nos bons momentos: *"Bom vento e mar calmo"*,
*"Agora não"*, *"Essa saída durou 3 h 30 — atualizar as horas dos motores?"*.
Mensagem de erro diz **o que fazer**, não só que deu errado.

### Sondagem colaborativa (onda 13) — honestidade obrigatória

A tela de `/navegar` nunca pode sugerir que a sondagem coletada pelos usuários
vira carta confiável. É **dado colaborativo bruto**: melhora com o tempo (mais
barcos passando pela mesma célula, mais confiança), mas **nunca substitui a
carta náutica oficial** — mesma régua que já vale para a camada de
profundidade ETOPO (onda 6/12) e para a rota por calado (onda 12). Todo texto
novo que mencionar profundidade medida por usuário repete essa ressalva, não
assume que quem lê já sabe.

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
     de compatibilidade que redireciona para Comandantes, fora do robots.txt).
     Rota nova fora dessa lista precisa de link ou vira exceção documentada aqui;
   - **todo dado que a interface grava aparece em algum lugar** (o contrário também:
     nada exibido que ninguém consiga preencher);
   - **o glossário acima vale** — um conceito, um nome, em toda a tela.
5. Conferir cobertura da espec: `docs/superpowers/specs/2026-08-06-commander-v2-design.md`
