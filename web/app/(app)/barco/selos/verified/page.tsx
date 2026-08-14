import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { LinhaLista } from "@/components/ui/linha-lista"
import { carregarPainel, carregarVerified } from "@/lib/consultas"

/**
 * Checklist do Commander Verified — verificação DIGITAL (cadastro +
 * histórico + dados atualizados), nunca vistoria física (Correção 05 do PRD
 * de Correções). Por isso a identidade visual aqui usa tons neutros
 * (prata/navy — `text-dim`/`bg-dim`), sem o dourado que o app usa como
 * accent geral: esse dourado passa a ser reservado pro Commander Gold
 * (`/barco/selos/gold`), que é o selo presencial de verdade.
 *
 * Sem CTA de "solicitar avaliação" aqui — esse pedido é o primeiro passo do
 * fluxo do Gold, não do Verified (Correção 02), então mora na tela do Gold.
 */
export default async function VerifiedPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const verified = await carregarVerified()
  if (!verified) redirect("/onboarding")

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/barco/selos" voltarRotulo="Selos Commander" />
      <h1 className="titulo-pagina mt-3 inline-flex items-center gap-2">
        <Icone nome="escudo" className="size-5 text-dim" /> Commander Verified
      </h1>
      <p className="apoio mt-1 text-dim">
        Verificação digital: reconhece documentação e histórico completos no app. Não é vistoria
        física — quem avalia presencialmente é o Commander Gold.
      </p>

      <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel p-4">
        <div className="flex items-baseline justify-between">
          <p className="rotulo text-dim">Completude</p>
          <p className="font-mono-instr text-xs tabular-nums text-dim">
            {verified.completos} de {verified.total}
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel2">
          <div
            className="h-full rounded-full bg-dim"
            style={{ width: `${Math.max(2, verified.percentual)}%` }}
          />
        </div>
      </div>

      <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel px-4">
        {verified.itens.map((item) => (
          <LinhaLista
            key={item.chave}
            leading={
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                  item.ok ? "border-ok bg-ok/15" : "border-line"
                }`}
                aria-hidden="true"
              >
                {item.ok && <span className="size-2 rounded-full bg-ok" />}
              </span>
            }
            titulo={<span className={item.ok ? "" : "text-dim"}>{item.rotulo}</span>}
            subtitulo={!item.ok ? item.dica : undefined}
            trailing={
              !item.ok ? (
                <Link href={item.href} className="shrink-0 text-sm text-texto underline underline-offset-2">
                  Resolver
                </Link>
              ) : undefined
            }
          />
        ))}
      </div>

      <Link
        href="/barco/selos/gold"
        className="sombra-1 mt-6 block rounded-[14px] border border-line bg-panel p-3.5"
      >
        <p className="titulo-card inline-flex items-center gap-1.5">
          <Icone nome="ancora" className="size-4 text-accent-forte" /> Quer avaliação presencial?
        </p>
        <p className="apoio mt-0.5 text-dim">
          Conheça o Commander Gold — não depende de completar o Verified.
        </p>
      </Link>
    </main>
  )
}
