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

A voz do app é a que ele já acerta nos bons momentos: *"Bom vento e mar calmo"*,
*"Agora não"*, *"Essa saída durou 3 h 30 — atualizar as horas dos motores?"*.
Mensagem de erro diz **o que fazer**, não só que deu errado.

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
   - **nenhuma rota sem link** que leve até ela (exceções permitidas: webhook, convite
     por link externo — e elas ficam listadas aqui quando surgirem);
   - **todo dado que a interface grava aparece em algum lugar** (o contrário também:
     nada exibido que ninguém consiga preencher);
   - **o glossário acima vale** — um conceito, um nome, em toda a tela.
5. Conferir cobertura da espec: `docs/superpowers/specs/2026-08-06-commander-v2-design.md`
