import { notFound, redirect } from "next/navigation"
import { Confirmar } from "@/components/confirmar"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { CamposTipoEquipamento } from "@/components/campos-tipo-equipamento"
import { Campo } from "@/components/ui/campo"
import { CampoArquivo } from "@/components/ui/campo-arquivo"
import { SeletorModeloMotor } from "@/components/seletor-modelo-motor"
import { excluirEquipamento, salvarEquipamento } from "@/lib/acoes/equipamentos"
import { carregarPainel } from "@/lib/consultas"
import { carregarModeloDoCatalogo, carregarModelosDoCatalogo } from "@/lib/consultas-catalogo"
import { abaDoEquipamento } from "@/lib/domain/diario"
import { podeEditar } from "@/lib/domain/permissoes"
import { numeroParaCampoPtBr } from "@/lib/ui/form"
import { ACAO_NAO_ESTICA, TETO_FORMULARIO } from "@/lib/ui/superficies"

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
  const aba = abaDoEquipamento(eq.tipo)
  if (!podeEditar(painel.permissoes, aba)) {
    redirect(`/barco?erro=${encodeURIComponent("Seu acesso não permite editar este equipamento.")}`)
  }
  // Só motor consulta o catálogo (PRD 3D §16 é do módulo Motor).
  const [modelos, modeloAtual] = eq.tipo === "motor"
    ? await Promise.all([carregarModelosDoCatalogo(), carregarModeloDoCatalogo(eq.motor_modelo_id)])
    : [[], null]
  return (
    <main className={TETO_FORMULARIO}>
      <CabecalhoDetalhe voltarHref={`/barco/equipamento/${id}`} titulo="Editar equipamento" />
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <form action={salvarEquipamento} className="mt-5 space-y-4">
        <input type="hidden" name="equipamento_id" value={id} />
        <div className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <CamposTipoEquipamento
            tipoInicial={eq.tipo}
            posicaoInicial={eq.posicao ?? ""}
            tipoBateriaInicial={eq.tipo_bateria ?? ""}
            zonaInicial={eq.zona}
          />
          {/* Onda 64 — mesmo desenho da tela de cadastro: catálogo primeiro
              porque é o caminho melhor quando existe, texto livre logo
              abaixo e sem cadeado porque nem todo motor está no catálogo. */}
          <SeletorModeloMotor modelos={modelos} inicial={modeloAtual} />
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Marca" id="marca" name="marca" defaultValue={eq.marca ?? ""} />
            <Campo label="Modelo" id="modelo" name="modelo" defaultValue={eq.modelo ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Nº de série" id="numero_serie" name="numero_serie" defaultValue={eq.numero_serie ?? ""} className="font-mono-instr" />
            <Campo label="Identificação interna" id="identificacao_interna" name="identificacao_interna" defaultValue={eq.identificacao_interna ?? ""} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Ano" id="ano" name="ano" inputMode="numeric" defaultValue={eq.ano ?? ""} className="font-mono-instr tabular-nums" />
            <Campo label="Potência (hp)" id="potencia_hp" name="potencia_hp" inputMode="numeric" defaultValue={eq.potencia_hp ?? ""} className="font-mono-instr tabular-nums" />
            <Campo label="Quantidade" id="quantidade" name="quantidade" inputMode="numeric" defaultValue={eq.quantidade ?? ""} className="font-mono-instr tabular-nums" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Combustível" id="combustivel" name="combustivel" defaultValue={eq.combustivel ?? ""} />
            <Campo
              label="Horas atuais"
              id="horas_atuais"
              name="horas_atuais"
              inputMode="decimal"
              defaultValue={numeroParaCampoPtBr(eq.horas_atuais)}
              className="font-mono-instr tabular-nums"
            />
          </div>
          <Campo label="Observações" id="observacoes" name="observacoes" defaultValue={eq.observacoes ?? ""} />
          {/* Onda 63 (auditoria visual §8) — o "Choose File · No file chosen"
              do input nativo. Esta tela tinha escapado da troca. */}
          <CampoArquivo
            label="Foto — opcional"
            name="foto"
            accept="image/jpeg,image/png,image/webp"
            ajuda="JPG, PNG ou WebP"
          />
        </div>
        <button className={`${ACAO_NAO_ESTICA} rounded-xl bg-accent py-3.5 font-semibold text-acao-texto`}>Salvar equipamento</button>
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
