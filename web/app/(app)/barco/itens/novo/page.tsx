import { redirect } from "next/navigation"
import { GuardaFormulario } from "@/components/guarda-formulario"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect } from "@/components/ui/campo"
import { linhaCampos } from "@/lib/ui/form"
import { criarItemMonitorado } from "@/lib/acoes/itens"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import {
  CATEGORIA_SEGURANCA, CATEGORIAS_CASCO, CATEGORIAS_HIDRAULICA, CATEGORIAS_MOTOR,
  ROTULO_CASCO, ROTULO_HIDRAULICA, ROTULO_MOTOR,
} from "@/lib/domain/diario"
import { ACAO_NAO_ESTICA, TETO_FORMULARIO } from "@/lib/ui/superficies"

export default async function NovoItemPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; alvo?: string }>
}) {
  const { erro, alvo } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  // Volta pra onde a pessoa veio (ficha do equipamento, documentos, ou a
  // embarcação) em vez de sempre cair em /barco — mesma lógica de
  // itens/[id]/editar/page.tsx, só que a partir do alvo da query string,
  // já que aqui ainda não existe item.
  const equipamentoIdAlvo = alvo?.startsWith("eq:") ? alvo.slice(3) : null
  const categoriaAlvo = alvo?.startsWith("cat:") ? alvo.slice(4) : null
  // ONDA 101 — TODA CATEGORIA TEM HUB AGORA, e o Voltar passa a conhecer os
  // seis. Antes só Documentos tinha destino: quem adicionava um item de casco
  // ou de hidráulica caía na /barco e tinha que reencontrar a área. Casco e
  // Manutenções ganharam tela nesta onda, e as outras quatro já existiam — o
  // que faltava era este mapa. Sem `alvo`, `/barco` continua sendo a resposta
  // certa: é a central técnica, e a pessoa escolhe a área no próprio
  // formulário.
  const hubDaCategoria: Record<string, string> = {
    documento: "/barco/documentos",
    [CATEGORIA_SEGURANCA]: "/barco/seguranca",
    ...Object.fromEntries(CATEGORIAS_CASCO.map((c) => [c, "/barco/casco"])),
    ...Object.fromEntries(CATEGORIAS_HIDRAULICA.map((c) => [c, "/barco/hidraulica"])),
  }
  const voltarPara = equipamentoIdAlvo
    ? `/barco/equipamento/${equipamentoIdAlvo}`
    : (categoriaAlvo && hubDaCategoria[categoriaAlvo]) || "/barco"

  return (
    <main className={TETO_FORMULARIO}>
      <CabecalhoDetalhe
        voltarHref={voltarPara}
        titulo="Nova manutenção"
        descricao="Tudo que vence por horas de uso e/ou por data — o semáforo cuida do resto."
      />
      {erro && <p className="mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      <form action={criarItemMonitorado} className="mt-6 space-y-4">
        {/* `criarItemMonitorado` volta pra cá com `?erro=` quando falha, e o
            redirect re-renderiza a página em branco — sem isto, quem
            preencheu as oito caixas perdia tudo por causa de um campo. */}
        <GuardaFormulario chave="barco:item-novo" />
        <Campo label="Nome" id="nome" name="nome" required placeholder="Ex.: Antifouling" />
        <div className={linhaCampos}>
          <Campo label="Especificação" id="especificacao" name="especificacao" placeholder="Ex.: 15W40" />
          <Campo label="Quantidade" id="quantidade" name="quantidade" placeholder="Ex.: 4 L" />
          {/* Onda 64 — o elo "Component → OEM Part Number" do PRD 3D §16, na
              mão do dono. Mono porque é código, não prosa. */}
          <Campo
            label="Código da peça — opcional"
            id="part_number_oem"
            name="part_number_oem"
            placeholder="Ex.: 3838852"
            className="tabular-nums"
            dica="O código que você usa pra comprar de novo — OEM ou equivalente."
          />
        </div>
        <CampoSelect label="Pertence a" id="alvo" name="alvo" defaultValue={alvo ?? "emb"}>
          <option value="emb">Embarcação (geral)</option>
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
        {/* Óleo e Filtros com tipo (PRD §11). Fica sempre visível, sem
            depender de JS: só vale quando o alvo é um motor, e quem descarta
            fora disso é `categoriaDeItemDeMotor` no servidor. */}
        <CampoSelect
          label="É óleo ou filtro de motor?"
          id="tipo_motor"
          name="tipo_motor"
          defaultValue=""
          dica="Só vale quando a manutenção pertence a um motor. Deixe em branco para os demais itens."
        >
          <option value="">Não é — outra manutenção</option>
          {CATEGORIAS_MOTOR.map((c) => (
            <option key={c} value={c}>{ROTULO_MOTOR[c]}</option>
          ))}
        </CampoSelect>
        <div className={linhaCampos}>
          <Campo label="A cada X horas" id="intervalo_horas" name="intervalo_horas" inputMode="decimal" placeholder="500" className="tabular-nums tabular-nums" />
          <Campo label="E/ou a cada X meses" id="intervalo_meses" name="intervalo_meses" inputMode="numeric" placeholder="18" className="tabular-nums tabular-nums" />
        </div>
        <Campo label="Ou vencimento em data fixa" id="data_fixa" name="data_fixa" type="date" />
        {/* "Horas no último serviço" quebra em duas linhas nos 173px da
            célula e o campo dele descia sozinho — `linhaCampos` alinha os
            dois controles pela base. */}
        <div className={linhaCampos}>
          <Campo label="Último serviço em" id="ultimo_ciclo_data" name="ultimo_ciclo_data" type="date" defaultValue={hojeISO()} />
          <Campo label="Horas no último serviço" id="ultimo_ciclo_horas" name="ultimo_ciclo_horas" inputMode="decimal" className="tabular-nums tabular-nums" />
        </div>
        <button className={`${ACAO_NAO_ESTICA} rounded-[var(--raio-controle)] bg-accent py-3.5 font-semibold text-acao-texto`}>Criar manutenção</button>
      </form>
    </main>
  )
}
