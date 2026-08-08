import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone, type NomeIcone } from "@/components/icone"
import { Logo } from "@/components/logo"
import { MockTelas } from "@/components/landing/mock-telas"
import { ANCORA_MENSAL_CENTAVOS, formatarPreco, PLANOS, VAGAS_FUNDADOR } from "@/lib/domain/planos"
import { supabaseServer } from "@/lib/supabase/server"

// A página é dinâmica (o redirect de logado lê cookies), então não há ISR a
// configurar — o contador de vagas é buscado a cada request e isso basta.

const VALORES: { icone: NomeIcone; titulo: string; desc: string }[] = [
  {
    icone: "alerta",
    titulo: "Avisos antes do prazo",
    desc: "Cruzamos horas de motor com prazos de documento e mostramos o que vence primeiro — sem susto na doca.",
  },
  {
    icone: "documento",
    titulo: "Diário de bordo único",
    desc: "Cada manutenção, gasto e saída no mesmo histórico. Na hora de vender, esse dossiê vale dinheiro.",
  },
  {
    icone: "pessoas",
    titulo: "Comandantes de confiança",
    desc: "Contrate comandantes com documentação declarada, direto na plataforma — sem depender de boca a boca.",
  },
]

const PASSOS = [
  { titulo: "Cadastre a embarcação", desc: "Dados gerais, motores e documentos em poucos minutos." },
  { titulo: "Convide seu comandante", desc: "Ele registra manutenções e o diário de bordo evolui junto com você." },
  { titulo: "O Commander vigia os prazos", desc: "Alerta antes de vencer, pelo que chegar primeiro: hora de motor ou data." },
]

const BENEFICIOS = [
  "Preço travado enquanto a assinatura durar — mesmo que o valor cheio suba depois.",
  "Fundador #N gravado no seu perfil, para sempre.",
  "Concierge de bordo: a equipe monta o dossiê do seu barco com você.",
]

export default async function LandingPage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect("/hoje")

  // RPC anon (grant em vagas_fundador_restantes) — se falhar por qualquer
  // motivo, a seção de fundadores segue de pé, só sem o contador.
  let restantes: number | null = null
  try {
    const { data } = await supabase.rpc("vagas_fundador_restantes")
    if (typeof data === "number") restantes = data
  } catch {
    restantes = null
  }

  return (
    <div data-theme="dark" className="bg-ink text-texto">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-2">
          <Logo compacto />
          <span className="rotulo text-accent">Commander</span>
        </div>
        <Link href="/login" className="corpo font-medium text-dim hover:text-texto">Entrar</Link>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-16 pt-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pb-24 lg:pt-16">
        <div>
          {/* Tamanho explícito, não "titulo-pagina": aquela utilitária carrega
              font-size:1.5rem e, por vir depois no CSS em cascade layers,
              vence qualquer text-4xl/5xl combinado na mesma tag — testado
              via computed style no browser (ficava em 24px). O peso/tracking/
              line-height aqui replicam a voz de titulo-pagina, só maiores. */}
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.02em] text-balance sm:text-5xl lg:text-6xl">
            O dossiê do seu barco.
          </h1>
          <p className="mt-5 max-w-md text-lg text-dim sm:text-xl">
            Manutenção em dia, documentos alertados e um histórico que vale dinheiro na hora de vender.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#fundador" className="sombra-2 rounded-xl bg-accent px-6 py-3.5 text-center font-semibold text-acao-texto">
              Quero ser fundador
            </a>
            <Link href="/login" className="rounded-xl border border-white/15 px-6 py-3.5 text-center font-semibold text-texto">
              Entrar
            </Link>
          </div>
        </div>
        <MockTelas />
      </section>

      {/* Blocos de valor */}
      <section className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
        <div className="grid gap-4 sm:grid-cols-3">
          {VALORES.map((v) => (
            <div key={v.titulo} className="sombra-1 rounded-[14px] border border-line bg-panel p-5">
              <span className="flex size-10 items-center justify-center rounded-full bg-accent/12 text-accent-forte">
                <Icone nome={v.icone} className="size-5" />
              </span>
              <h2 className="titulo-card mt-4">{v.titulo}</h2>
              <p className="corpo mt-1.5 text-dim">{v.desc}</p>
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
              <span className="mx-auto flex size-9 items-center justify-center rounded-full border border-accent/40 font-mono-instr text-sm font-semibold text-accent-forte sm:mx-0">
                {i + 1}
              </span>
              <h2 className="titulo-card mt-3">{p.titulo}</h2>
              <p className="corpo mt-1.5 text-dim">{p.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Fundador */}
      <section id="fundador" className="mx-auto max-w-4xl px-6 py-14 sm:py-20">
        <div className="text-center">
          <p className="rotulo text-accent">Fundadores — {VAGAS_FUNDADOR} vagas</p>
          <h2 className="titulo-pagina mt-2">Preço travado para quem entra agora.</h2>
          <p className="corpo mx-auto mt-3 max-w-md text-dim">
            {VAGAS_FUNDADOR} assinaturas com o valor de lançamento — depois disso o Commander passa a
            valer {formatarPreco(ANCORA_MENSAL_CENTAVOS)}/mês.
          </p>
          {restantes !== null && (
            <p className="apoio mt-4 inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1.5 text-dim">
              <Icone nome="estrela" className="size-3.5 text-accent" /> Restam {restantes} de {VAGAS_FUNDADOR} vagas
            </p>
          )}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="sombra-1 rounded-[16px] border border-line bg-panel p-5">
            <p className="titulo-card">{PLANOS.fundador_mensal.rotulo}</p>
            <p className="mt-3">
              <span className="apoio mr-1.5 text-dim line-through">{formatarPreco(ANCORA_MENSAL_CENTAVOS)}</span>
              <span className="text-3xl font-semibold text-accent-forte">{formatarPreco(PLANOS.fundador_mensal.valorCentavos)}</span>
              <span className="corpo text-dim"> /mês</span>
            </p>
          </div>
          <div className="sombra-2 relative rounded-[16px] border border-accent/50 bg-panel p-5">
            <span className="absolute -top-3 right-4 rounded-full bg-accent px-2.5 py-1 font-mono-instr text-[10px] uppercase tracking-[.1em] text-acao-texto">
              2 meses grátis
            </span>
            <p className="titulo-card">{PLANOS.fundador_anual.rotulo}</p>
            <p className="mt-3">
              <span className="text-3xl font-semibold text-accent-forte">{formatarPreco(PLANOS.fundador_anual.valorCentavos)}</span>
              <span className="corpo text-dim"> /ano</span>
            </p>
          </div>
        </div>

        <ul className="mt-6 space-y-2.5">
          {BENEFICIOS.map((b) => (
            <li key={b} className="corpo flex items-start gap-2.5 text-dim">
              <Icone nome="escudo" className="mt-0.5 size-4 shrink-0 text-accent-forte" />
              {b}
            </li>
          ))}
        </ul>

        <div className="mt-8 text-center">
          <Link
            href="/login?volta=/assinar"
            className="sombra-2 inline-block rounded-xl bg-accent px-8 py-3.5 font-semibold text-acao-texto"
          >
            Quero ser fundador
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
          <Link href="/parceiro" className="apoio text-dim hover:text-texto">
            Para marinas, pousadas e restaurantes
          </Link>
          <a href="mailto:atendimento.smu@gmail.com" className="apoio text-dim hover:text-texto">
            atendimento.smu@gmail.com
          </a>
        </div>
        <p className="apoio mt-6 text-center text-dim/70">© {new Date().getFullYear()} Commander</p>
      </footer>
    </div>
  )
}
