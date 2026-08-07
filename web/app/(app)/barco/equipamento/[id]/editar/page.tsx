import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Confirmar } from "@/components/confirmar"
import { Icone } from "@/components/icone"
import { excluirEquipamento, salvarEquipamento } from "@/lib/acoes/equipamentos"
import { carregarPainel } from "@/lib/consultas"
import { podeEditar } from "@/lib/domain/permissoes"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
const rot = "rotulo mb-1.5 block text-dim"

export default async function EditarEquipamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string }>
}) {
  const { id } = await params
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const eq = painel.equipamentos.find((e) => e.id === id)
  if (!eq) notFound()
  const aba = eq.tipo === "motor" ? "motores" : "eletrica"
  if (!podeEditar(painel.permissoes, aba)) {
    redirect(`/barco?erro=${encodeURIComponent("Seu acesso não permite editar este equipamento.")}`)
  }
  const n = (v: number | null) => (v == null ? "" : String(v).replace(".", ","))

  return (
    <main>
      <Link href={`/barco/equipamento/${id}`} className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Voltar
      </Link>
      <h1 className="titulo-pagina mt-3">Editar equipamento</h1>
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <form action={salvarEquipamento} className="mt-5 space-y-4">
        <input type="hidden" name="equipamento_id" value={id} />
        <div className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="tipo">Tipo</label>
              <select id="tipo" name="tipo" defaultValue={eq.tipo} className={campo}>
                <option value="gerador">Gerador</option>
                <option value="bateria">Baterias</option>
                <option value="motor">Motor</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className={rot} htmlFor="posicao">Posição</label>
              <select id="posicao" name="posicao" defaultValue={eq.posicao ?? ""} className={campo}>
                <option value="">Sem posição</option>
                <option value="BB">Bombordo (BB)</option>
                <option value="BE">Boreste (BE)</option>
                <option value="central">Central</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="marca">Marca</label>
              <input id="marca" name="marca" defaultValue={eq.marca ?? ""} className={campo} />
            </div>
            <div>
              <label className={rot} htmlFor="modelo">Modelo</label>
              <input id="modelo" name="modelo" defaultValue={eq.modelo ?? ""} className={campo} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="numero_serie">Nº de série</label>
              <input id="numero_serie" name="numero_serie" defaultValue={eq.numero_serie ?? ""} className={`${campo} font-mono-instr`} />
            </div>
            <div>
              <label className={rot} htmlFor="identificacao_interna">Identificação interna</label>
              <input id="identificacao_interna" name="identificacao_interna" defaultValue={eq.identificacao_interna ?? ""} className={campo} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={rot} htmlFor="ano">Ano</label>
              <input id="ano" name="ano" inputMode="numeric" defaultValue={eq.ano ?? ""} className={`${campo} font-mono-instr tabular-nums`} />
            </div>
            <div>
              <label className={rot} htmlFor="potencia_hp">Potência (hp)</label>
              <input id="potencia_hp" name="potencia_hp" inputMode="numeric" defaultValue={eq.potencia_hp ?? ""} className={`${campo} font-mono-instr tabular-nums`} />
            </div>
            <div>
              <label className={rot} htmlFor="quantidade">Quantidade</label>
              <input id="quantidade" name="quantidade" inputMode="numeric" defaultValue={eq.quantidade ?? ""} className={`${campo} font-mono-instr tabular-nums`} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="combustivel">Combustível</label>
              <input id="combustivel" name="combustivel" defaultValue={eq.combustivel ?? ""} className={campo} />
            </div>
            <div>
              <label className={rot} htmlFor="horas_atuais">Horas atuais</label>
              <input id="horas_atuais" name="horas_atuais" inputMode="decimal" defaultValue={n(eq.horas_atuais)} className={`${campo} font-mono-instr tabular-nums`} />
            </div>
          </div>
          <div>
            <label className={rot} htmlFor="observacoes">Observações</label>
            <input id="observacoes" name="observacoes" defaultValue={eq.observacoes ?? ""} className={campo} />
          </div>
          <div>
            <label className={rot} htmlFor="foto">Foto — opcional</label>
            <input id="foto" name="foto" type="file" accept="image/jpeg,image/png,image/webp"
              className={`${campo} py-2.5 corpo`} />
          </div>
        </div>
        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">Salvar equipamento</button>
      </form>

      <form action={excluirEquipamento} className="mt-8 flex justify-center">
        <input type="hidden" name="equipamento_id" value={id} />
        <Confirmar
          mensagem="Excluir equipamento e todo o seu histórico de itens?"
          rotulo="Excluir equipamento"
          className="flex h-11 items-center corpo text-crit"
        />
      </form>
    </main>
  )
}
