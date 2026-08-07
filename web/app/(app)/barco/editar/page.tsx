import { redirect } from "next/navigation"
import Link from "next/link"
import { Icone } from "@/components/icone"
import { salvarDadosGerais } from "@/lib/acoes/embarcacao"
import { carregarPainel } from "@/lib/consultas"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
const rot = "rotulo mb-1.5 block text-dim"

export default async function EditarEmbarcacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") {
    redirect(`/barco?erro=${encodeURIComponent("Só o proprietário edita os dados da embarcação.")}`)
  }
  const e = painel.embarcacao
  const num = (v: number | null) => (v == null ? "" : String(v).replace(".", ","))

  return (
    <main>
      <Link href="/barco" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Embarcação
      </Link>
      <h1 className="titulo-pagina mt-3">Dados da embarcação</h1>
      <p className="apoio mt-1 text-dim">O que estiver aqui aparece no dossiê e no Selo Ouro.</p>
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <form action={salvarDadosGerais} className="mt-5 space-y-5">
        <section className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo flex items-center gap-1.5 text-dim"><Icone nome="embarcacao" className="size-3.5" /> Identificação</p>
          <div>
            <label className={rot} htmlFor="nome">Nome</label>
            <input id="nome" name="nome" required defaultValue={e.nome} className={campo} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="estaleiro">Estaleiro</label>
              <input id="estaleiro" name="estaleiro" defaultValue={e.estaleiro ?? ""} className={campo} />
            </div>
            <div>
              <label className={rot} htmlFor="modelo">Modelo</label>
              <input id="modelo" name="modelo" defaultValue={e.modelo ?? ""} className={campo} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="ano">Ano</label>
              <input id="ano" name="ano" inputMode="numeric" defaultValue={e.ano ?? ""} className={`${campo} font-mono-instr tabular-nums`} />
            </div>
            <div>
              <label className={rot} htmlFor="marina">Marina</label>
              <input id="marina" name="marina" defaultValue={e.marina ?? ""} className={campo} />
            </div>
          </div>
        </section>

        <section className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo flex items-center gap-1.5 text-dim"><Icone nome="ancora" className="size-3.5" /> Medidas e casco</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={rot} htmlFor="comprimento_m">Compr. (m)</label>
              <input id="comprimento_m" name="comprimento_m" inputMode="decimal" placeholder="14,60"
                defaultValue={num(e.comprimento_m)} className={`${campo} font-mono-instr tabular-nums`} />
            </div>
            <div>
              <label className={rot} htmlFor="boca_m">Boca (m)</label>
              <input id="boca_m" name="boca_m" inputMode="decimal" placeholder="4,35"
                defaultValue={num(e.boca_m)} className={`${campo} font-mono-instr tabular-nums`} />
            </div>
            <div>
              <label className={rot} htmlFor="calado_m">Calado (m)</label>
              <input id="calado_m" name="calado_m" inputMode="decimal" placeholder="1,20"
                defaultValue={num(e.calado_m)} className={`${campo} font-mono-instr tabular-nums`} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="casco_material">Material do casco</label>
              <input id="casco_material" name="casco_material" list="materiais" placeholder="PRFV"
                defaultValue={e.casco_material ?? ""} className={campo} />
              <datalist id="materiais">
                <option value="PRFV" /><option value="Fibra de vidro" /><option value="Alumínio" />
                <option value="Aço" /><option value="Madeira" />
              </datalist>
            </div>
            <div>
              <label className={rot} htmlFor="casco_numero">Nº do casco</label>
              <input id="casco_numero" name="casco_numero" defaultValue={e.casco_numero ?? ""} className={campo} />
            </div>
          </div>
          <div>
            <label className={rot} htmlFor="propulsao">Propulsão</label>
            <input id="propulsao" name="propulsao" list="propulsoes" placeholder="2× diesel · pés IPS"
              defaultValue={e.propulsao ?? ""} className={campo} />
            <datalist id="propulsoes">
              <option value="Centro-rabeta" /><option value="Pés IPS" /><option value="Linha de eixo" />
              <option value="Popa" /><option value="Jato" />
            </datalist>
          </div>
        </section>

        <section className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo flex items-center gap-1.5 text-dim"><Icone nome="documento" className="size-3.5" /> Registro</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="tie">TIE</label>
              <input id="tie" name="tie" defaultValue={e.tie ?? ""} className={`${campo} font-mono-instr`} />
            </div>
            <div>
              <label className={rot} htmlFor="capitania">Capitania</label>
              <input id="capitania" name="capitania" placeholder="CP do Rio de Janeiro"
                defaultValue={e.capitania ?? ""} className={campo} />
            </div>
          </div>
        </section>

        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">Salvar dados</button>
      </form>
    </main>
  )
}
