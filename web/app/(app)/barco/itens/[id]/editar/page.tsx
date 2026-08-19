import { notFound, redirect } from "next/navigation"
import { Confirmar } from "@/components/confirmar"
import { BASE_BOTAO_FICHA } from "@/components/ui/botao-ficha"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect } from "@/components/ui/campo"
import { FaixaKpi, PastilhaKpi } from "@/components/ui/faixa-kpi"
import { MigalhaPao } from "@/components/ui/migalha-pao"
import { Selo } from "@/components/ui/selo"
import { excluirItemMonitorado, salvarItemMonitorado } from "@/lib/acoes/itens"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import {
  abaDoItem, CATEGORIA_SEGURANCA, CATEGORIAS_CASCO, CATEGORIAS_HIDRAULICA, CATEGORIAS_MOTOR,
  nomeDoEquipamento, ROTULO_CASCO, ROTULO_HIDRAULICA, ROTULO_MOTOR,
} from "@/lib/domain/diario"
import { prazoCompacto } from "@/lib/domain/inicio"
import { podeEditar, ROTULO_ABA } from "@/lib/domain/permissoes"
import {
  calcularSemaforo, formatarDataCurtaComAno, linhaDaRegra, rotuloDoFarol, seloDoFarol,
  temInformacaoSuficiente, vencimentoPorData,
} from "@/lib/domain/semaforo"
import { numeroParaCampoPtBr } from "@/lib/ui/form"
import { ACAO_NAO_ESTICA, TETO_FORMULARIO } from "@/lib/ui/superficies"

export default async function EditarItemPage({
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
  const item = painel.itens.find((i) => i.id === id)
  if (!item) notFound()

  const aba = abaDoItem(item, painel.equipamentos)
  if (!podeEditar(painel.permissoes, aba)) {
    redirect(`/barco?erro=${encodeURIComponent(`Seu acesso não permite editar ${ROTULO_ABA[aba]}.`)}`)
  }
  const ehDocumento = item.categoria === "documento"

  const alvoAtual = item.equipamento_id
    ? `eq:${item.equipamento_id}`
    : item.categoria
      ? `cat:${item.categoria}`
      : "emb"

  const equipamentoDoItem = item.equipamento_id
    ? painel.equipamentos.find((e) => e.id === item.equipamento_id)
    : undefined

  const voltarPara = equipamentoDoItem
    ? `/barco/equipamento/${equipamentoDoItem.id}`
    : item.categoria === "documento"
      ? "/barco/documentos"
      : "/barco"

  // ONDA 92 (eixo 2.2) — O ESTADO DO ITEM, CALCULADO PELA MESMA RÉGUA DE
  // SEMPRE. Nada aqui é regra nova: `calcularSemaforo`, `linhaDaRegra`,
  // `prazoCompacto` e `temInformacaoSuficiente` são os mesmos que a ficha de
  // equipamento e a lista de documentos consomem. A tela só apresenta.
  const calc = itemMonitoradoToItemCalc(item)
  const horasAtuais = equipamentoDoItem?.horas_atuais ?? null
  const temInfo = temInformacaoSuficiente(calc, horasAtuais)
  const r = calcularSemaforo(calc, horasAtuais, hojeISO())
  // `null` (e NÃO "ok") quando não há informação suficiente: o selo diz "Sem
  // dados" em vez de "Em dia" sem nada por trás — mesma decisão do
  // `statusFicha` da ficha de equipamento.
  const statusItem = temInfo ? r.status : null
  // A data só vira pastilha quando é DERIVADA (último ciclo + intervalo em
  // meses). Com data fixa, a própria linha de regra já a diz por extenso
  // ("Vence em 12/03/26") — repetir logo acima seria dizer duas vezes.
  const vencDerivado = calc.dataFixa == null ? vencimentoPorData(calc) : null

  // ONDA 92 — a migalha pula o degrau do meio quando ele levaria ao MESMO
  // lugar que o "Voltar" (item geral da embarcação → "/barco" nos dois):
  // repetir o mesmo destino duas vezes é migalha decorativa, não caminho. É a
  // mesma regra que a ficha de equipamento aplica ao motor.
  const migalha = [
    { rotulo: "Barco", href: "/barco" },
    ...(equipamentoDoItem
      ? [{ rotulo: nomeDoEquipamento(equipamentoDoItem), href: voltarPara }]
      : item.categoria === "documento"
        ? [{ rotulo: "Documentos", href: voltarPara }]
        : []),
    { rotulo: item.nome },
  ]

  return (
    <main className={TETO_FORMULARIO}>
      <MigalhaPao itens={migalha} />

      {/* Só desenha o que se sabe: sem informação suficiente não há prazo, e
          "0 h" seria uma contagem inventada (§7 do spec — onde o dado não
          existe, o instrumento não entra). Item sem nenhuma das duas coisas
          não ganha faixa nenhuma; o que ele tem a dizer está no selo ("Sem
          dados") e na linha de regra ("Sem intervalo informado"). */}
      {(temInfo || vencDerivado != null) && (
        <FaixaKpi className="mt-2">
          {temInfo && <PastilhaKpi icone="relogio" rotulo="Prazo" valor={prazoCompacto(r)} />}
          {vencDerivado != null && (
            <PastilhaKpi icone="calendario" rotulo="Vence" valor={formatarDataCurtaComAno(vencDerivado)} />
          )}
        </FaixaKpi>
      )}

      <CabecalhoDetalhe
        className="mt-3"
        voltarHref={voltarPara}
        titulo={ehDocumento ? "Editar vencimento" : "Editar manutenção"}
        // O subtítulo explicativo que o spec §3 item 3 chama de "o que separa
        // instrumento documentado de caixa com rótulo": aqui é o nome do item
        // e COMO o prazo dele é contado.
        descricao={`${item.nome} · ${linhaDaRegra(calc)}`}
        selo={<Selo estado={seloDoFarol(statusItem)}>{rotuloDoFarol(statusItem)}</Selo>}
        // ONDA 92 — "Excluir" subiu do rodapé pra barra de ações, com o mesmo
        // vestido e a mesma composição da ficha de equipamento: `Confirmar`
        // (duas etapas) vestido de `BASE_BOTAO_FICHA` na cor de destrutivo. É
        // a única ação de nível "ficha" desta tela — salvar é do formulário.
        acoes={
          <form action={excluirItemMonitorado}>
            <input type="hidden" name="item_id" value={id} />
            <Confirmar
              mensagem={ehDocumento ? "Excluir esse vencimento e seu histórico?" : "Excluir essa manutenção e seu histórico?"}
              rotulo={ehDocumento ? "Excluir vencimento" : "Excluir manutenção"}
              className={`${BASE_BOTAO_FICHA} border-crit/30 bg-panel text-crit`}
            />
          </form>
        }
      />
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <form action={salvarItemMonitorado} className="mt-5 space-y-4">
        <input type="hidden" name="item_id" value={id} />
        <Campo label="Nome" id="nome" name="nome" required defaultValue={item.nome} placeholder="Ex.: Antifouling" />
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Especificação" id="especificacao" name="especificacao" defaultValue={item.especificacao ?? ""} placeholder="Ex.: 15W40" />
          <Campo label="Quantidade" id="quantidade" name="quantidade" defaultValue={item.quantidade ?? ""} placeholder="Ex.: 4 L" />
          {/* Onda 64 — o elo "Component → OEM Part Number" do PRD 3D §16. */}
          <Campo
            label="Código da peça — opcional"
            id="part_number_oem"
            name="part_number_oem"
            defaultValue={item.part_number_oem ?? ""}
            placeholder="Ex.: 3838852"
            className="font-mono-instr"
            dica="O código que você usa pra comprar de novo — OEM ou equivalente."
          />
        </div>
        <CampoSelect label="Pertence a" id="alvo" name="alvo" defaultValue={alvoAtual}>
          <option value="emb">Embarcação (geral)</option>
          {item.categoria === "documento" && <option value="cat:documento">Documento (vencimento)</option>}
          {painel.equipamentos.map((e) => (
            <option key={e.id} value={`eq:${e.id}`}>
              {(e.tipo === "motor" ? "Motor" : e.tipo === "gerador" ? "Gerador" : "Equipamento")} {e.posicao ?? ""}
            </option>
          ))}
          {CATEGORIAS_CASCO.map((c) => (
            <option key={c} value={`cat:${c}`}>Casco — {ROTULO_CASCO[c]}</option>
          ))}
          {CATEGORIAS_HIDRAULICA.map((c) => (
            <option key={c} value={`cat:${c}`}>Hidráulica — {ROTULO_HIDRAULICA[c]}</option>
          ))}
          <option value={`cat:${CATEGORIA_SEGURANCA}`}>Segurança</option>
        </CampoSelect>
        {/* PRD §11 — mesma regra do criar; o servidor solta o subtipo
            sozinho se o item sair de um motor (`categoriaDeItemDeMotor`). */}
        <CampoSelect
          label="É óleo ou filtro de motor?"
          id="tipo_motor"
          name="tipo_motor"
          defaultValue={
            item.categoria != null && (CATEGORIAS_MOTOR as readonly string[]).includes(item.categoria)
              ? item.categoria
              : ""
          }
          dica="Só vale quando a manutenção pertence a um motor."
        >
          <option value="">Não é — outra manutenção</option>
          {CATEGORIAS_MOTOR.map((c) => (
            <option key={c} value={c}>{ROTULO_MOTOR[c]}</option>
          ))}
        </CampoSelect>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="A cada X horas" id="intervalo_horas" name="intervalo_horas" inputMode="decimal"
            defaultValue={numeroParaCampoPtBr(item.intervalo_horas)} placeholder="500" className="font-mono-instr tabular-nums" />
          <Campo label="E/ou a cada X meses" id="intervalo_meses" name="intervalo_meses" inputMode="numeric"
            defaultValue={numeroParaCampoPtBr(item.intervalo_meses)} placeholder="18" className="font-mono-instr tabular-nums" />
        </div>
        <Campo label="Ou vencimento em data fixa" id="data_fixa" name="data_fixa" type="date" defaultValue={item.data_fixa ?? ""} />
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Último serviço em" id="ultimo_ciclo_data" name="ultimo_ciclo_data" type="date"
            defaultValue={item.ultimo_ciclo_data ?? ""} />
          <Campo label="Horas no último serviço" id="ultimo_ciclo_horas" name="ultimo_ciclo_horas" inputMode="decimal"
            defaultValue={numeroParaCampoPtBr(item.ultimo_ciclo_horas)} className="font-mono-instr tabular-nums" />
        </div>
        <button className={`${ACAO_NAO_ESTICA} rounded-xl bg-accent py-3.5 font-semibold text-acao-texto`}>
          {ehDocumento ? "Salvar vencimento" : "Salvar manutenção"}
        </button>
      </form>
    </main>
  )
}
