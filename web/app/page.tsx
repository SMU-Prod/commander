import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone, type NomeIcone } from "@/components/icone"
import { Logo } from "@/components/logo"
import { MockTelas } from "@/components/landing/mock-telas"
import { formatarPreco, PLANOS } from "@/lib/domain/planos"
import { LIMITES_FREE } from "@/lib/domain/plano-acesso"
import { TOQUE, TOQUE_AMPLO } from "@/lib/ui/acoes"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * ONDA 93 — A LANDING PASSA A USAR O BOTÃO DO APP.
 *
 * As três chamadas desta página eram `rounded-xl` + `py-3.5`: 12px de raio,
 * que não é nenhum dos três raios do docs/DESIGN.md §5, e 52px de altura, que
 * é a sétima altura de botão que a auditoria de 19/08 catalogou. Agora elas
 * repetem, classe por classe, o desenho `principal` de
 * `components/ui/botao-enviar.tsx` — 48px, raio de controle, 15px semibold.
 *
 * Por que importa mais aqui do que em qualquer tela interna: quem toca em
 * "Ver planos" encontra o MESMO botão em /assinar dois toques depois. Quando
 * os dois são objetos diferentes, a passagem da vitrine para o produto lê
 * como troca de site — e é exatamente nessa emenda que a percepção de "app
 * caro" se ganha ou se perde.
 *
 * `<a>`/`<Link>` e não `<button>`: são navegação, e `BotaoEnviar` é peça de
 * formulário (ele existe para o `useFormStatus`, que aqui não tem o que ler).
 */
const CTA = `inline-flex h-12 items-center justify-center rounded-[var(--raio-controle)] bg-accent px-6 text-center text-[15px] font-semibold text-acao-texto ${TOQUE_AMPLO}`
const CTA_CONTORNO = `inline-flex h-12 items-center justify-center rounded-[var(--raio-controle)] border border-line px-6 text-center text-[15px] font-semibold text-texto ${TOQUE_AMPLO}`

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

// Onda 47 — a promo dos 100 fundadores foi aposentada (PRD FINAL §2 congela
// R$ 49,90 e R$ 69,90; ninguém chegou a assinar o plano fundador). O que a
// landing promete agora é o que o produto entrega em qualquer plano.
const BENEFICIOS = [
  "Comece de graça: 1 embarcação com hubs técnicos, documentos e avisos de vencimento.",
  "Cancele quando quiser — nada do que você registrou é apagado.",
  "Concierge de bordo: a equipe monta o dossiê do seu barco com você.",
]

export default async function LandingPage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect("/hoje")

  // Onda 47 — o contador de vagas de fundador saiu junto com a promo. A RPC
  // `vagas_fundador_restantes()` foi removida na migration 048; o que a
  // landing mostra agora é o preço real do §2, sem âncora e sem escassez
  // fabricada (a auditoria CMO de 12/08 já apontava que "restam 100 de 100"
  // lia como zero tração — o problema era a prova social inventada, e a
  // solução acabou sendo não ter nenhuma).

  return (
    <div data-theme="dark" className="bg-ink text-texto">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-2">
          <Logo compacto />
          <span className="rotulo text-accent">Commander</span>
        </div>
        {/* `min-h-11`: era um texto de 21px de altura, e é a única saída do
            topo da página que vende. */}
        <Link href="/login" className={`corpo inline-flex min-h-11 items-center font-medium text-dim hover:text-texto ${TOQUE}`}>
          Entrar
        </Link>
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
            <a href="#planos" className={`sombra-2 ${CTA}`}>
              Ver planos
            </a>
            {/* `border-line` no lugar de `border-white/15`: a página inteira
                roda em `data-theme="dark"`, então o token já entrega a linha
                do tema escuro — e passa a acompanhar a paleta quando ela
                mudar, que é o que a cor à mão não faz. */}
            <Link href="/login" className={CTA_CONTORNO}>
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
            <div key={v.titulo} className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-5">
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

      {/* Planos (PRD FINAL §2) */}
      <section id="planos" className="mx-auto max-w-4xl px-6 py-14 sm:py-20">
        <div className="text-center">
          <p className="rotulo text-accent">Planos</p>
          <h2 className="titulo-pagina mt-2">Comece de graça. Pague quando fizer sentido.</h2>
          <p className="corpo mx-auto mt-3 max-w-md text-dim">
            Os avisos de vencimento e os alertas de segurança valem em qualquer plano, inclusive no gratuito —
            isso nunca fica atrás de assinatura.
          </p>
        </div>

        {/* Os três cartões de plano eram `rounded-[16px]` cravado — o valor de
            `--raio-painel`, escrito à mão. Pelo token, eles passam a dizer o
            que a escala quer que digam: painel de primeiro nível (16) contra
            os cartões de valor logo acima, que são `--raio-cartao` (14). É o
            raio significando profundidade, que é o motivo de o token existir. */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="sombra-1 rounded-[var(--raio-painel)] border border-line bg-panel p-5">
            <p className="titulo-card">{PLANOS.proprietario_free.rotulo}</p>
            <p className="mt-3">
              <span className="text-3xl font-semibold">Grátis</span>
            </p>
            <p className="corpo mt-2 text-dim">
              1 embarcação, {LIMITES_FREE.diarioRegistros} Diários de Bordo completos e o resto do app aberto para
              conhecer.
            </p>
          </div>
          <div className="sombra-2 relative rounded-[var(--raio-painel)] border border-accent/50 bg-panel p-5">
            <span className="absolute -top-3 right-4 rounded-full bg-accent px-2.5 py-1 font-mono-instr text-[11px] uppercase tracking-[.1em] text-acao-texto">
              Mais escolhido
            </span>
            <p className="titulo-card">{PLANOS.commander.rotulo}</p>
            <p className="mt-3">
              <span className="text-3xl font-semibold text-accent-forte">{formatarPreco(PLANOS.commander.valorCentavos!)}</span>
              <span className="corpo text-dim"> /mês</span>
            </p>
            <p className="corpo mt-2 text-dim">{PLANOS.commander.regra}</p>
          </div>
          <div className="sombra-1 rounded-[var(--raio-painel)] border border-line bg-panel p-5">
            <p className="titulo-card">{PLANOS.commander_pro.rotulo}</p>
            <p className="mt-3">
              <span className="text-3xl font-semibold">{formatarPreco(PLANOS.commander_pro.valorCentavos!)}</span>
              <span className="corpo text-dim"> /mês</span>
            </p>
            <p className="corpo mt-2 text-dim">{PLANOS.commander_pro.regra}</p>
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
          <Link href="/login?volta=/assinar" className={`sombra-2 px-8 ${CTA}`}>
            Começar agora
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
          <Link href="/parceiros" className="apoio text-dim hover:text-texto">
            Para marinas, pousadas e restaurantes
          </Link>
          <a href="mailto:atendimento.smu@gmail.com" className="apoio text-dim hover:text-texto">
            atendimento.smu@gmail.com
          </a>
        </div>
        <div className="mx-auto mt-6 flex max-w-6xl flex-col items-center gap-3 text-center sm:flex-row sm:justify-center sm:gap-4">
          <Link href="/termos" className="apoio text-dim hover:text-texto">
            Termos de Uso
          </Link>
          <span className="apoio text-dim/50" aria-hidden="true">·</span>
          <Link href="/privacidade" className="apoio text-dim hover:text-texto">
            Política de Privacidade
          </Link>
        </div>
        <p className="apoio mt-6 text-center text-dim/70">© {new Date().getFullYear()} Commander</p>
      </footer>
    </div>
  )
}
