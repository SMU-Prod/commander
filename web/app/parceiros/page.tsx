import type { Metadata } from "next"
import Link from "next/link"
import { Icone, type NomeIcone } from "@/components/icone"
import { Logo } from "@/components/logo"
import { TOQUE, TOQUE_AMPLO } from "@/lib/ui/acoes"

/** O MESMO desenho de `app/page.tsx` e de `BotaoEnviar variante="principal"`.
 *  As duas páginas de venda tinham `rounded-xl`/`py-3.5` — 12px de raio e
 *  52px de altura, nenhum dos dois na escala do docs/DESIGN.md §5 — e quem
 *  vem da landing para cá via rodapé encontrava dois botões diferentes para
 *  o mesmo gesto. */
const CTA = `inline-flex h-12 items-center justify-center rounded-[var(--raio-controle)] bg-accent px-6 text-center text-base font-semibold text-acao-texto ${TOQUE_AMPLO}`

// Onda 25 (auditoria CMO P0) — página pública de vendas pro parceiro
// comercial (marina, posto, pousada, restaurante). Antes só existia
// `/parceiro` (singular), que é gate de login direto pro formulário de
// edição — o Pedro não tinha nada pra mostrar numa reunião de 10 minutos
// na marina. Esta página é o pitch: sem login (ver middleware.ts,
// `rotaPublica`), conteúdo honesto sobre o que o parceiro ganha, sem
// prometer volume de público nenhum (regra do produto: zero número
// inventado — nenhuma contagem de "donos de barco" ou "marinas
// cadastradas" aparece aqui).

export const metadata: Metadata = {
  title: "Seja parceiro Commander — apareça no mapa dos donos de barco",
  description: "Marina, posto, loja náutica, prestador de serviço, restaurante ou pousada: cadastre seu negócio no app que os donos de embarcação já usam pra navegar e contratar. Autoatendimento, sem mensalidade de agência.",
  openGraph: {
    title: "Seja parceiro Commander",
    description: "Apareça no mapa náutico que os donos de embarcação já usam pra navegar.",
    url: "/parceiros",
  },
}

const GANHOS: { icone: NomeIcone; titulo: string; desc: string }[] = [
  {
    icone: "mapa",
    titulo: "Pino no mapa náutico",
    desc: "Apareça no mesmo mapa que os donos de barco usam pra navegar e planejar parada — categoria, localização e o que você oferece, tudo visível ali.",
  },
  {
    icone: "camera",
    titulo: "Painel só seu",
    desc: "Fotos, preços e disponibilidade você mesmo cadastra e atualiza — autoatendimento, sem esperar ninguém.",
  },
  {
    icone: "grafico",
    titulo: "Quantos proprietários te viram",
    desc: "Seu painel mostra quantos donos de barco já abriram o seu perfil no mapa.",
  },
  {
    icone: "estrela",
    titulo: "Destaque opcional",
    desc: "Anel dourado no pino e selo \"Destaque\" no seu cartão do mapa — fale com a gente pra saber mais.",
  },
]

const PASSOS = [
  { titulo: "Cadastre seu negócio", desc: "Categoria, ponto no mapa, fotos e preço — poucos minutos, direto no seu painel, sem intermediário." },
  { titulo: "Apareça pros donos de barco", desc: "Seu pino entra no mapa náutico assim que você publica o perfil." },
  { titulo: "Atualize quando quiser", desc: "Preço, disponibilidade de poita e fotos ficam sob seu controle, direto no seu painel." },
]

const CATEGORIAS: { icone: NomeIcone; rotulo: string }[] = [
  { icone: "ancora", rotulo: "Marina" },
  { icone: "oleo", rotulo: "Posto" },
  { icone: "inicio", rotulo: "Pousada" },
  { icone: "estrela", rotulo: "Restaurante" },
]

export default function ParceirosPage() {
  return (
    <div data-theme="dark" className="bg-ink text-texto">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-2">
          <Logo compacto />
          <span className="rotulo text-accent">Commander</span>
        </div>
        <Link href="/parceiro" className={`corpo inline-flex min-h-11 items-center font-medium text-dim hover:text-texto ${TOQUE}`}>
          Já é parceiro? Entrar
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pb-16 pt-10 text-center lg:pb-24 lg:pt-16">
        {/* Onda 51 (PRD §13): os tipos de Partner passaram de quatro pra seis —
            Prestador de Serviço e Loja Náutica entraram, e os dois são
            vendáveis em /assinar. A página de vendas tinha que dizer o mesmo
            que a tela de plano, senão o pitch exclui justamente quem paga. */}
        <p className="rotulo text-accent">Para marinas, postos, lojas náuticas, prestadores, restaurantes e pousadas</p>
        {/* ESTE `tracking` NEGATIVO NÃO É O GESTO DO RÓTULO — não o troque por
            `.rotulo`. O degrau único de rastreio do app (`.16em`) descreve
            "palavra em caixa alta, rastreada"; isto aqui é o oposto, o APERTO da
            Inter em título grande, e a casa dele é `.titulo-pagina`
            (docs/DESIGN.md §5, "Rastreio", último marcador).
            E a classe também não serve, pelo mesmo motivo medido na irmã desta
            página (`app/page.tsx`, hero): `.titulo-pagina` carrega
            `font-size: 1.5rem` e, vindo depois na cascata de layers, vence o
            `text-4xl`/`sm:text-4xl` na mesma tag — o título de venda cairia pra
            24px. Aqui o tamanho é o argumento. Fica escrito à mão, replicando a
            voz da classe (peso, aperto, entrelinha) num corpo maior. */}
        <h1 className="mt-3 text-4xl font-semibold leading-[1.08] tracking-[-0.02em] text-balance sm:text-4xl">
          Seu ponto no mapa que os donos de barco já usam.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-xl text-dim">
          Quem navega no Commander vê seu negócio na hora certa: no meio do trajeto, procurando onde parar.
          Autoatendimento, sem mensalidade de agência.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/parceiro" className={`sombra-2 ${CTA}`}>
            Cadastrar meu negócio
          </Link>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          {CATEGORIAS.map((c) => (
            <span key={c.rotulo} className="apoio inline-flex items-center gap-1.5 rounded-[var(--raio-pilula)] border border-line bg-panel px-3 py-1.5 text-dim">
              <Icone nome={c.icone} className="size-3.5 text-accent" /> {c.rotulo}
            </span>
          ))}
        </div>
      </section>

      {/* O que você ganha */}
      <section className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
        <p className="rotulo text-center text-accent">O que você ganha</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {GANHOS.map((g) => (
            <div key={g.titulo} className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-5">
              <span className="flex size-10 items-center justify-center rounded-[var(--raio-pilula)] bg-accent/12 text-accent-forte">
                <Icone nome={g.icone} className="size-5" />
              </span>
              <h2 className="titulo-card mt-4">{g.titulo}</h2>
              <p className="corpo mt-1.5 text-dim">{g.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
        <p className="rotulo text-center text-accent">Como funciona</p>
        <ol className="mt-10 grid gap-8 sm:grid-cols-3">
          {PASSOS.map((p, i) => (
            <li key={p.titulo} className="text-center sm:text-left">
              <span className="mx-auto flex size-9 items-center justify-center rounded-[var(--raio-pilula)] border border-accent/40 font-mono-instr text-sm font-semibold text-accent-forte sm:mx-0">
                {i + 1}
              </span>
              <h2 className="titulo-card mt-3">{p.titulo}</h2>
              <p className="corpo mt-1.5 text-dim">{p.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-3xl px-6 py-14 text-center sm:py-20">
        <h2 className="titulo-pagina">Leva poucos minutos pra publicar seu perfil.</h2>
        <p className="corpo mx-auto mt-3 max-w-md text-dim">
          Sem contrato, sem mensalidade de agência — você mesmo cadastra e atualiza, direto no seu painel.
        </p>
        <div className="mt-8">
          <Link href="/parceiro" className={`sombra-2 px-8 ${CTA}`}>
            Cadastrar meu negócio
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-2">
            <Logo compacto />
            <span className="apoio text-dim">Commander</span>
          </div>
          <p className="apoio text-dim">Feito no Rio de Janeiro</p>
          <Link href="/" className="apoio text-dim hover:text-texto">
            Sou dono de barco
          </Link>
          <a href="mailto:atendimento.smu@gmail.com" className="apoio text-dim hover:text-texto">
            atendimento.smu@gmail.com
          </a>
        </div>
      </footer>
    </div>
  )
}
