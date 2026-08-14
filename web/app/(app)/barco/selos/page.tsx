import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { carregarPainel, carregarVerified } from "@/lib/consultas"

/**
 * Hub "Selos Commander" — apresenta os dois selos diretamente, sem uma
 * terceira marca entre eles (Correção 04 do PRD de Correções: proibido
 * chamar isso de "Selos & Review"). Só existem dois:
 *
 *   COMMANDER VERIFIED — digital, conquistado por completude do app.
 *   COMMANDER GOLD — presencial, obtido por avaliação com o Protocolo Commander.
 *
 * Gold NÃO depende de Verified (Correção 14) — texto abaixo deixa isso
 * explícito pra não sugerir uma progressão linear entre os dois.
 */
export default async function SelosPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const verified = await carregarVerified()

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/barco" voltarRotulo="Barco" titulo="Selos Commander" />
      <p className="apoio mt-1 text-dim">
        Duas formas de confiança, independentes uma da outra — o Gold não exige o Verified antes.
      </p>

      <Link
        href="/barco/selos/verified"
        className="sombra-1 mt-5 block rounded-[14px] border border-line bg-panel p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="titulo-card inline-flex items-center gap-1.5">
            <Icone nome="escudo" className="size-4 text-dim" /> Commander Verified
          </p>
          {verified && (
            <span className="font-mono-instr text-xs tabular-nums text-dim">
              {verified.completos} de {verified.total}
            </span>
          )}
        </div>
        <p className="apoio mt-1 text-dim">
          Verificação digital — cadastro, histórico e dados atualizados no app. Sem vistoria física.
        </p>
        {verified && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-panel2">
            <div
              className="h-full rounded-full bg-dim"
              style={{ width: `${Math.max(2, verified.percentual)}%` }}
            />
          </div>
        )}
      </Link>

      <Link
        href="/barco/selos/gold"
        className="sombra-1 mt-3 block rounded-[14px] border border-line bg-panel p-4"
      >
        <p className="titulo-card inline-flex items-center gap-1.5">
          <Icone nome="ancora" className="size-4 text-accent-forte" /> Commander Gold
        </p>
        <p className="apoio mt-1 text-dim">
          Avaliação presencial de um consultor náutico, seguindo o Protocolo Commander.
        </p>
      </Link>
    </main>
  )
}
