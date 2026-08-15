import { redirect } from "next/navigation"
import { GuardaFormulario } from "@/components/guarda-formulario"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { CamposTipoEquipamento } from "@/components/campos-tipo-equipamento"
import { Campo } from "@/components/ui/campo"
import { linhaCampos } from "@/lib/ui/form"
import { criarEquipamento } from "@/lib/acoes/equipamentos"
import { carregarPainel } from "@/lib/consultas"
import { abaDoEquipamento } from "@/lib/domain/diario"
import { podeEditar } from "@/lib/domain/permissoes"

export default async function NovoEquipamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; tipo?: string }>
}) {
  const { erro, tipo } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const tipoInicial = ["motor", "gerador", "bateria", "painel", "outro"].includes(tipo ?? "") ? tipo! : "gerador"
  const aba = abaDoEquipamento(tipoInicial)
  if (!podeEditar(painel.permissoes, aba)) {
    redirect(`/barco?erro=${encodeURIComponent("Seu acesso não permite cadastrar este equipamento.")}`)
  }

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref={tipoInicial === "motor" ? "/barco" : "/barco/eletrica"}
        voltarRotulo={tipoInicial === "motor" ? "Embarcação" : "Elétrica"}
        titulo="Novo equipamento"
        descricao="Gerador, baterias, motor — tudo que tem manutenção própria."
      />
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <form action={criarEquipamento} className="mt-5 space-y-4">
        {/* Formulário mais longo da ficha (12 campos). `criarEquipamento`
            trata falha com `redirect("/barco/equipamento/novo?erro=")`, que
            devolve a página em branco — sem a guarda, um erro de rede na
            marina apagava o cadastro inteiro. */}
        <GuardaFormulario chave="barco:equipamento-novo" />
        <div className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <CamposTipoEquipamento tipoInicial={tipoInicial} />
          <div className={linhaCampos}>
            <Campo label="Marca" id="marca" name="marca" placeholder="Kohler" />
            <Campo label="Modelo" id="modelo" name="modelo" placeholder="9EFKOZD" />
          </div>
          <div className={linhaCampos}>
            <Campo label="Nº de série" id="numero_serie" name="numero_serie" className="font-mono-instr" />
            <Campo label="Identificação interna" id="identificacao_interna" name="identificacao_interna" placeholder="Motor 1" />
          </div>
          {/* Isto era `grid-cols-3`: a 390px cada célula ficava com 111px, e
              "Potência (hp)" quebrava em duas linhas enquanto "Ano" e
              "Quantidade" ficavam em uma — os três campos saíam em três
              alturas diferentes, em escadinha. Duas colunas dão 173px, que
              é o suficiente pros rótulos caberem inteiros. */}
          <div className={linhaCampos}>
            <Campo label="Ano" id="ano" name="ano" inputMode="numeric" className="font-mono-instr tabular-nums" />
            <Campo label="Potência (hp)" id="potencia_hp" name="potencia_hp" inputMode="numeric" className="font-mono-instr tabular-nums" />
          </div>
          <div className={linhaCampos}>
            <Campo label="Quantidade" id="quantidade" name="quantidade" inputMode="numeric" placeholder="4" className="font-mono-instr tabular-nums" />
            <Campo label="Horas atuais" id="horas_atuais" name="horas_atuais" inputMode="decimal" className="font-mono-instr tabular-nums" />
          </div>
          <Campo label="Combustível" id="combustivel" name="combustivel" list="combustiveis" placeholder="Diesel S10">
            <datalist id="combustiveis">
              <option value="Diesel S10" /><option value="Diesel S500" /><option value="Gasolina" />
            </datalist>
          </Campo>
          <Campo label="Observações" id="observacoes" name="observacoes" placeholder="Ex.: revenda autorizada em Niterói" />
          <Campo
            label="Foto — opcional"
            id="foto"
            name="foto"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="py-2.5 text-sm"
          />
        </div>
        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">Criar equipamento</button>
      </form>
    </main>
  )
}
