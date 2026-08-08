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

## Antes de fechar uma fase
1. `npm test` e `npm run build` verdes
2. Passe visual contra as pranchas da marca (navy/dourado, ícones, tipografia),
   incluindo a landing pública, a tela `/assinar`, o mapa de `/navegar` (com e
   sem token Mapbox) e o painel `/parceiro`
3. Traçar uma rota real no mapa (Marina da Glória → Vila do Abraão) e confirmar
   de olho que ela contorna a costa em vez de cruzar terra — o teste automatizado
   (`lib/domain/rota-real.test.ts`) cobre a matemática, mas quem vê a linha torta
   na tela é o olho
3. Conferir cobertura da espec: `docs/superpowers/specs/2026-08-06-commander-v2-design.md`
