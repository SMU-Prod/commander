import Link from "next/link"
import { CampoSenha } from "@/components/campo-senha"
import { Logo } from "@/components/logo"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { cadastrar, entrar, pedirNovaSenha, reenviarConfirmacao } from "@/lib/acoes/auth"
import { mensagemAviso, mensagemErro } from "@/lib/seguranca/mensagens-auth"

/**
 * ENTRAR (onda 62, canvas tela-1a) — wordmark no topo, campos com rótulo
 * mono, UMA ação dourada, e a ressalva de honestidade no rodapé desde o
 * primeiro toque (CONTRIBUTING.md a exige em toda superfície de navegação).
 *
 * ONDA 83 — "ESQUECI MINHA SENHA" E "NÃO RECEBI O E-MAIL" DEIXAM DE SER
 * PROMESSAS QUE O CANVAS FAZIA E O APP NÃO CUMPRIA.
 *
 * O comentário que estava aqui dizia, com razão, que os dois ficaram de fora
 * porque "não existe backend de recuperação hoje, e link pra porta que não
 * abre é o beco que a onda 54 caçou". A decisão estava certa; o que estava
 * errado era o backend não existir. A auditoria de 19/08/2026 mediu o
 * tamanho do buraco: das quatro contas reais, TRÊS confirmaram o e-mail e
 * nunca conseguiram entrar, e nenhuma delas tinha uma única saída na tela.
 *
 * Agora as portas existem (`lib/acoes/auth.ts`) e a tela abre as três:
 * entrar, cadastrar, e — quando a pessoa está presa — recuperar a senha ou
 * pedir um novo link de confirmação.
 *
 * TRÊS MODOS NA MESMA TELA, e não três telas: quem está preso já falhou uma
 * vez; mandar essa pessoa navegar é a segunda falha. `?modo=recuperar` troca
 * o formulário por um campo de e-mail só; `?reenviar=1` acrescenta o bloco de
 * reenvio ABAIXO do formulário normal, sem tirar dela a chance de simplesmente
 * tentar entrar de novo — que é o que resolve para quem já confirmou.
 */

const campo =
  "h-12 w-full rounded-[var(--raio-controle)] border border-line bg-campo px-3.5 text-[15px] text-texto placeholder:text-dim"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    /** CÓDIGO, não frase: `credenciais`, `link-expirado`, `muitas-tentativas`…
     *  Quem traduz é `lib/seguranca/mensagens-auth.ts`, aqui no servidor.
     *  Código de fora da lista vira a frase genérica. */
    erro?: string
    /** Mesma regra do `erro`, mas na tarja neutra. */
    aviso?: string
    modo?: string; volta?: string
    /** `1` abre o bloco de reenvio de confirmação — quem manda é `entrar`
     *  (conta não confirmada) e `/auth/callback` (link morto). */
    reenviar?: string
    /** E-mail que a pessoa acabou de digitar, pra ela não redigitar no bloco
     *  de reenvio. Nunca vem de fonte externa: só de `entrar`. */
    email?: string
  }>
}) {
  const { erro, aviso, modo, volta, reenviar, email } = await searchParams
  // ONDA 86 (P2-11) — O TEXTO DAS TARJAS NÃO VEM MAIS DA URL.
  //
  // Antes a tela imprimia a frase que chegasse em `?erro=`, e por isso um link
  // forjado por qualquer pessoa saía com a nossa cara, no nosso domínio e com
  // o cadeado do lado. Agora a URL carrega só um código e a frase é escolhida
  // aqui no servidor, contra a lista fechada de `lib/seguranca/mensagens-auth.ts`
  // — que explica o vetor em detalhe. `null` quando não há nada a dizer.
  const textoErro = mensagemErro(erro)
  const textoAviso = mensagemAviso(aviso)
  const cadastro = modo === "cadastro"
  const recuperar = modo === "recuperar"
  const linkAlternar = cadastro
    ? `/login${volta ? `?volta=${encodeURIComponent(volta)}` : ""}`
    : `/login?modo=cadastro${volta ? `&volta=${encodeURIComponent(volta)}` : ""}`
  return (
    // ONDA 63 — O LOGIN DEIXA DE SER UMA COLUNA DE CELULAR NO NOTEBOOK.
    //
    // Até aqui o `<main>` era `mx-auto max-w-[430px] bg-ink`: a faixa escura
    // media 430px no meio da tela e o resto do monitor ficava com o fundo do
    // BODY aparecendo dos dois lados — no tema claro, duas tarjas brancas
    // ladeando a tela de entrada. É a primeira tela que qualquer pessoa vê,
    // e a primeira impressão era de página quebrada.
    //
    // O escuro agora cobre a viewport inteira e, a partir de `lg`, a tela vira
    // duas colunas: à esquerda a marca (o mesmo tratamento do herói da
    // Início — navy com véu), à direita o formulário centralizado. No celular
    // nada muda: a coluna de 430px continua, porque lá ela é a tela toda.
    <div data-theme="dark" className="min-h-dvh bg-ink text-texto lg:grid lg:grid-cols-2">
      {/* Painel da marca — só no desktop, e decorativo: quem entra pelo
          teclado vai direto pro formulário, sem passar por aqui. */}
      <aside
        aria-hidden="true"
        className="relative hidden flex-col justify-end overflow-hidden border-r border-line bg-meter p-12 lg:flex"
      >
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_10%,rgb(212_175_55/.10),transparent_60%)]" />
        <div className="relative">
          <div className="text-base"><Logo /></div>
          <p className="mt-6 max-w-[26ch] text-[26px] font-semibold leading-tight text-meter-texto">
            Manutenção em dia, documentos alertados e um histórico que vale
            dinheiro na hora de vender.
          </p>
          <p className="apoio mt-4 max-w-[38ch] text-meter-dim">
            Marina da Glória, Angra, Búzios.
          </p>
        </div>
      </aside>

      <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 pb-10 pt-16 lg:min-h-dvh lg:justify-center lg:py-16">
      {/* No desktop a marca já está no painel ao lado — aqui ela sairia
          repetida duas vezes na mesma tela. */}
      <div className="text-sm lg:hidden"><Logo /></div>

      <h1 className="titulo-pagina mt-10">
        {recuperar ? "Recuperar acesso" : cadastro ? "Crie sua conta" : "Bem-vindo a bordo"}
      </h1>
      <p className="apoio mt-1.5 text-dim">
        {recuperar
          ? "Diga seu e-mail e mandamos um link para você criar uma senha nova."
          : cadastro
            ? "Sua conta primeiro; a embarcação você cadastra logo depois."
            : "Entre para acompanhar sua embarcação, o diário e o que precisa de você."}
      </p>

      {textoErro && (
        <p className="corpo mt-4 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{textoErro}</p>
      )}
      {textoAviso && (
        <p className="corpo mt-4 rounded-lg border border-line bg-panel px-3 py-2">{textoAviso}</p>
      )}

      <form
        action={recuperar ? pedirNovaSenha : cadastro ? cadastrar : entrar}
        className="mt-7 space-y-3.5"
      >
        <input type="hidden" name="volta" value={volta ?? ""} />
        {cadastro && (
          <div>
            <label htmlFor="nome" className="rotulo mb-1.5 block text-dim">Nome</label>
            <input id="nome" name="nome" required placeholder="Seu nome" autoComplete="name" className={campo} />
          </div>
        )}
        <div>
          <label htmlFor="email" className="rotulo mb-1.5 block text-dim">E-mail</label>
          <input
            id="email" name="email" type="email" required defaultValue={email ?? ""}
            placeholder="voce@exemplo.com" autoComplete="email" className={campo}
          />
        </div>
        {/* Sem senha na recuperação: é justamente o que a pessoa não tem. */}
        {!recuperar && (
          <CampoSenha
            autoComplete={cadastro ? "new-password" : "current-password"}
            placeholder={cadastro ? "Mínimo de 8 caracteres" : undefined}
          />
        )}
        {/* A única dourada da tela (DESIGN §5): uma ação principal.
            ONDA 85 — e a que mais precisava avisar que estava enviando: entrar
            e cadastrar batem na rede, e o duplo-toque disparava a action duas
            vezes. `larguraCheia` porque esta coluna é 430px em qualquer
            monitor — ver a prop. */}
        <BotaoEnviar
          larguraCheia
          className="mt-1"
          rotulo={recuperar ? "Enviar link" : cadastro ? "Criar conta" : "Entrar"}
        />
        {cadastro && (
          <p className="apoio text-center text-dim">
            Ao criar a conta você concorda com os{" "}
            <Link href="/termos" className="text-accent-forte underline underline-offset-2">
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" className="text-accent-forte underline underline-offset-2">
              Política de Privacidade
            </Link>
            .
          </p>
        )}
      </form>

      {/* AS SAÍDAS (onda 83). Ficam ABAIXO da ação principal e sem dourado:
          quem chega aqui está preso, mas o caminho mais provável ainda é
          simplesmente entrar — só que agora, se não for, existe porta. */}
      {!recuperar && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          {!cadastro && (
            <Link
              href={`/login?modo=recuperar${email ? `&email=${encodeURIComponent(email)}` : ""}`}
              className="corpo -my-2 flex min-h-11 items-center text-dim underline underline-offset-2"
            >
              Esqueci minha senha
            </Link>
          )}
          <Link
            href={`/login?reenviar=1${email ? `&email=${encodeURIComponent(email)}` : ""}`}
            className="corpo -my-2 flex min-h-11 items-center text-dim underline underline-offset-2"
          >
            Não recebeu o e-mail de confirmação?
          </Link>
        </div>
      )}

      {/* O bloco de reenvio só abre quando alguém pediu — `entrar` ao detectar
          conta não confirmada, `/auth/callback` ao receber link morto, ou o
          link acima. Aberto sempre, ele viraria uma segunda ação competindo
          com a principal em toda visita. */}
      {reenviar === "1" && !recuperar && (
        <form
          action={reenviarConfirmacao}
          className="mt-5 rounded-[var(--raio-cartao)] border border-line bg-panel p-4"
        >
          <p className="titulo-card">Reenviar confirmação</p>
          <p className="apoio mt-1 text-dim">
            Mandamos um link novo. Se você cadastrou num aparelho e vai abrir o link em outro,
            tudo bem — este link funciona em qualquer um.
          </p>
          <label htmlFor="email-reenvio" className="rotulo mb-1.5 mt-3 block text-dim">E-mail</label>
          <input
            id="email-reenvio" name="email" type="email" required defaultValue={email ?? ""}
            placeholder="voce@exemplo.com" autoComplete="email" className={campo}
          />
          {/* ONDA 85 — vira a PÍLULA DE CONTORNO, e contida. Era um botão de
              largura cheia com o canto de um controle: do outro lado da tela
              ele lia como uma segunda ação principal, competindo com "Entrar"
              — e a auditoria (§3.3) já tinha flagrado as duas alturas
              diferentes desta mesma tela como hierarquia embaralhada. Contorno
              + largura do próprio conteúdo diz "sou a saída secundária" pela
              FORMA, que é a régua de `lib/ui/acoes.ts`. */}
          <BotaoEnviar variante="contorno" className="mt-3" rotulo="Reenviar" />
        </form>
      )}

      {/* O rodapé do canvas: divisor, a troca entrar/cadastrar e a ressalva
          de honestidade — presente antes mesmo do primeiro login. */}
      <div className="mt-auto flex flex-col gap-4 pt-10">
        <div className="h-px bg-line" />
        <a href={linkAlternar} className="corpo -my-2 flex min-h-11 items-center justify-center text-dim">
          {cadastro ? (
            <>Já tem conta?&nbsp;<span className="font-semibold text-accent-forte">Entrar</span></>
          ) : (
            <>Ainda não tem conta?&nbsp;<span className="font-semibold text-accent-forte">Cadastrar embarcação</span></>
          )}
        </a>
        <p className="text-center font-mono-instr text-[11px] leading-relaxed text-dim">
          O Commander não é auxílio à navegação.<br />
          Consulte sempre a carta náutica oficial.
        </p>
      </div>
      </main>
    </div>
  )
}
