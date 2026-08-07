import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { criarEquipamento } from "@/lib/acoes/equipamentos"
import { carregarPainel } from "@/lib/consultas"
import { podeEditar } from "@/lib/domain/permissoes"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
const rot = "rotulo mb-1.5 block text-dim"

export default async function NovoEquipamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; tipo?: string }>
}) {
  const { erro, tipo } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const tipoInicial = ["motor", "gerador", "bateria", "outro"].includes(tipo ?? "") ? tipo! : "gerador"
  const aba = tipoInicial === "motor" ? "motores" : "eletrica"
  if (!podeEditar(painel.permissoes, aba)) {
    redirect(`/barco?erro=${encodeURIComponent("Seu acesso não permite cadastrar este equipamento.")}`)
  }

  return (
    <main>
      <Link href={tipoInicial === "motor" ? "/barco" : "/barco/eletrica"}
        className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> {tipoInicial === "motor" ? "Embarcação" : "Elétrica"}
      </Link>
      <h1 className="titulo-pagina mt-3">Novo equipamento</h1>
      <p className="apoio mt-1 text-dim">Gerador, baterias, motor — tudo que tem manutenção própria.</p>
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <form action={criarEquipamento} className="mt-5 space-y-4">
        <div className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="tipo">Tipo</label>
              <select id="tipo" name="tipo" defaultValue={tipoInicial} className={campo}>
                <option value="gerador">Gerador</option>
                <option value="bateria">Baterias</option>
                <option value="motor">Motor</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className={rot} htmlFor="posicao">Posição</label>
              <select id="posicao" name="posicao" defaultValue="" className={campo}>
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
              <input id="marca" name="marca" placeholder="Kohler" className={campo} />
            </div>
            <div>
              <label className={rot} htmlFor="modelo">Modelo</label>
              <input id="modelo" name="modelo" placeholder="9EFKOZD" className={campo} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="numero_serie">Nº de série</label>
              <input id="numero_serie" name="numero_serie" className={`${campo} font-mono-instr`} />
            </div>
            <div>
              <label className={rot} htmlFor="identificacao_interna">Identificação interna</label>
              <input id="identificacao_interna" name="identificacao_interna" placeholder="Motor 1" className={campo} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={rot} htmlFor="ano">Ano</label>
              <input id="ano" name="ano" inputMode="numeric" className={`${campo} font-mono-instr tabular-nums`} />
            </div>
            <div>
              <label className={rot} htmlFor="potencia_hp">Potência (hp)</label>
              <input id="potencia_hp" name="potencia_hp" inputMode="numeric" className={`${campo} font-mono-instr tabular-nums`} />
            </div>
            <div>
              <label className={rot} htmlFor="quantidade">Quantidade</label>
              <input id="quantidade" name="quantidade" inputMode="numeric" placeholder="4" className={`${campo} font-mono-instr tabular-nums`} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="combustivel">Combustível</label>
              <input id="combustivel" name="combustivel" list="combustiveis" placeholder="Diesel S10" className={campo} />
              <datalist id="combustiveis">
                <option value="Diesel S10" /><option value="Diesel S500" /><option value="Gasolina" />
              </datalist>
            </div>
            <div>
              <label className={rot} htmlFor="horas_atuais">Horas atuais</label>
              <input id="horas_atuais" name="horas_atuais" inputMode="decimal" className={`${campo} font-mono-instr tabular-nums`} />
            </div>
          </div>
          <div>
            <label className={rot} htmlFor="observacoes">Observações</label>
            <input id="observacoes" name="observacoes" placeholder="Ex.: revenda autorizada em Niterói" className={campo} />
          </div>
          <div>
            <label className={rot} htmlFor="foto">Foto — opcional</label>
            <input id="foto" name="foto" type="file" accept="image/jpeg,image/png,image/webp"
              className={`${campo} py-2.5 corpo`} />
          </div>
        </div>
        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">Criar equipamento</button>
      </form>
    </main>
  )
}
