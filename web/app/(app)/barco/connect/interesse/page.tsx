import Link from "next/link"
import { redirect } from "next/navigation"
import { FormularioInteresseConnect } from "@/components/formulario-interesse-connect"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { registrarInteresseConnect } from "@/lib/acoes/connect"
import { carregarPainel } from "@/lib/consultas"
import { MENSAGEM_CLASSIFICACAO_CONNECT, ROTULO_CLASSIFICACAO_CONNECT, type ClassificacaoConnect } from "@/lib/domain/connect"

const CLASSIFICACOES_VALIDAS = new Set<ClassificacaoConnect>(["ready", "compatible", "consultar"])

/**
 * Questionário de triagem de compatibilidade do Commander Connect (PRD,
 * `docs/prd/commander-connect.txt`, seção 3) — link a partir de
 * `/barco/connect` ("Em breve"). Depois de enviado, a tela mostra a
 * classificação PRELIMINAR de forma persistente (não um toast de 3s) —
 * é a "régua de honestidade" do PRD: nunca uma promessa.
 */
export default async function InteresseConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; enviado?: string }>
}) {
  const { erro, enviado } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const classificacaoEnviada = enviado && CLASSIFICACOES_VALIDAS.has(enviado as ClassificacaoConnect) ? (enviado as ClassificacaoConnect) : null

  if (classificacaoEnviada) {
    return (
      <main>
        <CabecalhoDetalhe voltarHref="/barco/connect" voltarRotulo="Commander Connect" />
        <div className="sombra-1 mt-4 rounded-[14px] border border-ok/40 bg-panel p-4">
          <div className="flex items-center gap-2">
            <Icone nome="guardado" className="size-5 text-ok" />
            <p className="titulo-card">Interesse registrado</p>
          </div>
          <p className="rotulo mt-3 text-dim">Classificação preliminar</p>
          <p className="titulo-card mt-1">{ROTULO_CLASSIFICACAO_CONNECT[classificacaoEnviada]}</p>
          <p className="apoio mt-2 text-dim">{MENSAGEM_CLASSIFICACAO_CONNECT[classificacaoEnviada]}</p>
        </div>
        <p className="apoio mt-4 text-dim">
          Isso não ativa nenhuma integração agora — o Commander Connect ainda está “Em breve”. Guardamos
          seu interesse pra quando a instalação for possível.
        </p>
        <Link href="/barco/connect" className="apoio mt-4 inline-block text-accent-forte">
          Voltar pro Commander Connect
        </Link>
      </main>
    )
  }

  const motorPrincipal = painel.equipamentos.find((e) => e.tipo === "motor") ?? null

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/barco/connect"
        voltarRotulo="Commander Connect"
        titulo="Ver se sua embarcação é compatível"
        descricao="Um questionário curto — o resultado é uma classificação preliminar, nunca uma promessa."
      />
      {erro && <p className="mt-4 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      <form action={registrarInteresseConnect}>
        <FormularioInteresseConnect motorPrincipal={motorPrincipal} />
      </form>

      <p className="apoio mt-6 text-dim">
        Importante: o mesmo modelo de motor pode estar instalado com arquiteturas eletrônicas diferentes
        de barco pra barco — por isso a classificação aqui é sempre preliminar. “Connect Ready” só vale
        de verdade depois de conferido na instalação real.
      </p>
    </main>
  )
}
