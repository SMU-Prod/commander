import { redirect } from "next/navigation"
import { FormularioNovoEvento } from "@/components/campos-navegacao-evento"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { BloqueioPremium } from "@/components/ui/bloqueio-premium"
import { criarEvento } from "@/lib/acoes/eventos"
import { carregarNivelPlano, carregarPainel, carregarUsoDiario, hojeISO } from "@/lib/consultas"
import { mensagemBloqueio, recursoLiberado } from "@/lib/domain/plano-acesso"
import { supabaseServer } from "@/lib/supabase/server"

export default async function NovoEventoPage({
  searchParams,
}: {
  searchParams: Promise<{
    erro?: string
    alvo?: string
    item?: string
    custo?: string
    tipo?: string
    data?: string
    descricao?: string
    horas?: string
    contato?: string
  }>
}) {
  const { erro, alvo, item, custo, tipo, data, descricao, horas, contato } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const [nivel, usoDiario] = await Promise.all([carregarNivelPlano(), carregarUsoDiario()])
  const liberado = recursoLiberado("diario_registros", nivel, usoDiario)
  // Sem liberar, nem busca o resto (contatos/tripulação) — a tela vai
  // mostrar só o bloqueio, o formulário nunca aparece.
  if (!liberado) {
    return (
      <main>
        <CabecalhoDetalhe voltarHref="/diario" voltarRotulo="Diário" titulo="Novo registro" />
        <BloqueioPremium {...mensagemBloqueio("diario_registros", usoDiario)} className="mt-5" />
      </main>
    )
  }

  const supabase = await supabaseServer()
  const [{ data: contatos }, { data: vinculos }] = await Promise.all([
    supabase.from("contatos").select("id, nome, especialidade").order("nome"),
    supabase.from("vinculos").select("usuario_id").eq("embarcacao_id", painel.embarcacao.id),
  ])
  const idsTripulacao = [...new Set((vinculos ?? []).map((v: { usuario_id: string }) => v.usuario_id))]
  const { data: perfis } = idsTripulacao.length
    ? await supabase.from("profiles").select("id, nome").in("id", idsTripulacao)
    : { data: [] as { id: string; nome: string }[] }
  const tripulacaoOpcoes = (perfis ?? []).map((p: { id: string; nome: string }) => ({ id: p.id, nome: p.nome }))

  // Chegando direto da ficha de um equipamento ("Registrar serviço") o alvo
  // já vem escolhido — nesse caso pula direto pra Manutenção em vez de fazer
  // a pessoa responder "o que aconteceu" de novo. Sem isso, a pergunta abre
  // em branco e a pessoa escolhe entre os 6 cartões. `tipo` explícito vence
  // (volta de "Cadastrar contato" com um tipo diferente de manutenção, ex.:
  // Avaria, já tinha alvo preenchido também).
  const tipoInicial = tipo ?? (alvo ? "manutencao" : null)

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/diario" voltarRotulo="Diário" titulo="Novo registro" />
      {erro && <p className="mt-4 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      <form action={criarEvento} className="mt-5 space-y-4">
        <FormularioNovoEvento
          tipoInicial={tipoInicial}
          dataInicial={data ?? hojeISO()}
          tripulacao={tripulacaoOpcoes}
          equipamentos={painel.equipamentos}
          itens={painel.itens}
          contatos={contatos ?? []}
          alvoInicial={alvo ?? ""}
          itemInicial={item ?? ""}
          custoInicial={custo ?? ""}
          descricaoInicial={descricao ?? ""}
          horasInicial={horas ?? ""}
          contatoInicial={contato ?? ""}
        />
      </form>
    </main>
  )
}
