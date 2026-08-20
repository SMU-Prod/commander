import { CampoSenha } from "@/components/campo-senha"
import { Logo } from "@/components/logo"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { definirNovaSenha } from "@/lib/acoes/auth"
import { mensagemErro } from "@/lib/seguranca/mensagens-auth"

/**
 * NOVA SENHA (onda 83) — o segundo passo da recuperação.
 *
 * Quem chega aqui veio de `/auth/callback`, que já trocou o código do e-mail
 * por uma sessão de recuperação. Por isso a tela pede SÓ a senha nova: a
 * identidade já foi provada pelo link, e pedir o e-mail de novo seria teatro.
 *
 * ELA FICA ATRÁS DO GATE NORMAL DO MIDDLEWARE, de propósito. Sem a sessão que
 * o link cria não há nada a fazer aqui — e o middleware devolve a pessoa pro
 * login, que é exatamente onde ela precisa estar para pedir um link novo.
 *
 * A casca é a mesma de `/login` (dois painéis no desktop, coluna no celular)
 * porque é a mesma etapa da mesma jornada: mudar o vestido no meio do
 * caminho faria a pessoa achar que saiu do app.
 */
export default async function NovaSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{
    /** CÓDIGO, não frase — `senha-curta`, `senha-nao-trocada`… Quem traduz é
     *  `lib/seguranca/mensagens-auth.ts`; desconhecido vira a genérica. */
    erro?: string
  }>
}) {
  const { erro } = await searchParams
  // ONDA 86 (P2-11) — mesma correção do `/login`: a URL carrega código, a
  // frase é escolhida aqui. Um link forjado não fala mais pela boca do
  // produto. O porquê está inteiro em `lib/seguranca/mensagens-auth.ts`.
  const textoErro = mensagemErro(erro)
  return (
    <div data-theme="dark" className="min-h-dvh bg-ink text-texto lg:grid lg:grid-cols-2">
      <aside
        aria-hidden="true"
        className="relative hidden flex-col justify-end overflow-hidden border-r border-line bg-meter p-12 lg:flex"
      >
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_10%,rgb(212_175_55/.10),transparent_60%)]" />
        <div className="relative">
          <div className="text-base"><Logo /></div>
          <p className="mt-6 max-w-[26ch] text-2xl font-semibold leading-tight text-meter-texto">
            Escolha uma senha nova e volte pro seu barco.
          </p>
        </div>
      </aside>

      <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 pb-10 pt-16 lg:min-h-dvh lg:justify-center lg:py-16">
        <div className="text-sm lg:hidden"><Logo /></div>

        <h1 className="titulo-pagina mt-10">Criar uma nova senha</h1>
        <p className="apoio mt-1.5 text-dim">
          O link confirmou que a conta é sua. Agora escolha a senha que você vai usar daqui pra
          frente.
        </p>

        {textoErro && (
          <p className="corpo mt-4 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">
            {textoErro}
          </p>
        )}

        <form action={definirNovaSenha} className="mt-7 space-y-3.5">
          <CampoSenha autoComplete="new-password" placeholder="Mínimo de 8 caracteres" />
          {/* ONDA 85 — o aviso de envio importa aqui mais do que parece: quem
              chega nesta tela já falhou uma vez pra entrar. Um botão mudo, e a
              pessoa toca de novo achando que não pegou. */}
          <BotaoEnviar larguraCheia className="mt-1" rotulo="Salvar senha" />
        </form>

        <p className="mt-auto pt-10 text-center font-mono-instr text-xs leading-relaxed text-dim">
          O Commander não é auxílio à navegação.<br />
          Consulte sempre a carta náutica oficial.
        </p>
      </main>
    </div>
  )
}
