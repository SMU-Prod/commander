import { redirect } from "next/navigation"
import { Confirmar } from "@/components/confirmar"
import { Icone } from "@/components/icone"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import {
  compartilharCompromisso,
  concluirCompromisso,
  descompartilharCompromisso,
  excluirCompromisso,
  salvarCompromisso,
} from "@/lib/acoes/agenda"
import { carregarPainel } from "@/lib/consultas"
import { horaCurta, podeVerAgenda, ROTULO_VISIBILIDADE, rotuloDia, visibilidadeEfetiva } from "@/lib/domain/agenda"
import { nomeDoEquipamento } from "@/lib/domain/diario"
import { rot } from "@/lib/ui/form"
import { supabaseServer } from "@/lib/supabase/server"
import { ALVO_ACAO, PILULA_ACAO } from "@/lib/ui/acoes"
import type { AgendaEvento, AgendaParticipante } from "@/lib/db/types"

/**
 * Detalhe de um compromisso da Agenda (onda 43, PRD §8).
 *
 * A regra que este arquivo existe pra demonstrar: **"Receber um evento não
 * concede acesso ao Hub relacionado."** O compromisso pode apontar pra uma
 * manutenção, mas o nome do item só aparece se o item estiver em
 * `painel.itens` — que já vem filtrado pela RLS de `itens_monitorados`.
 * Quem não tem Motores vê que existe um vínculo técnico e nada mais; não há
 * denormalização do nome do item dentro de `agenda_eventos` justamente
 * porque isso seria a porta dos fundos.
 */
export default async function CompromissoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string; ok?: string }>
}) {
  const { id } = await params
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVerAgenda(painel.permissoes)) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui a Agenda desta embarcação.")}`)
  }

  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  // Sem filtro de dono: a RLS devolve a linha só pra quem criou ou pra quem
  // recebeu o compartilhamento. `maybeSingle` + redirect trata os dois casos
  // (não existe / não é seu) com a mesma resposta, que é o certo — dizer
  // "existe, mas não é seu" já é informação demais.
  const { data: bruto } = await supabase.from("agenda_eventos").select("*").eq("id", id).maybeSingle()
  const compromisso = bruto as AgendaEvento | null
  if (!compromisso) {
    redirect(`/agenda?erro=${encodeURIComponent("Não encontramos esse compromisso.")}`)
  }
  const souCriador = user != null && compromisso.criado_por === user.id

  const { data: participantesBrutos } = await supabase
    .from("agenda_participantes").select("*").eq("evento_id", id)
  const participantes = (participantesBrutos ?? []) as AgendaParticipante[]

  const { data: vinculos } = await supabase
    .from("vinculos").select("usuario_id, papel").eq("embarcacao_id", compromisso.embarcacao_id)
  const idsRelevantes = [...new Set([
    ...participantes.map((p) => p.usuario_id),
    ...(vinculos ?? []).map((v: { usuario_id: string }) => v.usuario_id),
    ...(compromisso.criado_por ? [compromisso.criado_por] : []),
  ])]
  const { data: perfis } = idsRelevantes.length > 0
    ? await supabase.from("profiles").select("id, nome").in("id", idsRelevantes)
    : { data: [] as { id: string; nome: string }[] }
  const nomeDe = (uid: string | null) =>
    (perfis ?? []).find((p: { id: string }) => p.id === uid)?.nome?.trim() || "Comandante"

  // Quem ainda dá pra incluir: tripulação do barco menos eu e menos quem já está.
  const jaDentro = new Set(participantes.map((p) => p.usuario_id))
  const disponiveis = (vinculos ?? [])
    .map((v: { usuario_id: string }) => v.usuario_id)
    .filter((uid: string) => uid !== user?.id && !jaDentro.has(uid))

  // Vínculo técnico: só resolve o nome se a RLS deixou o item chegar até aqui.
  const item = compromisso.item_monitorado_id
    ? painel.itens.find((i) => i.id === compromisso.item_monitorado_id) ?? null
    : null
  const equipamentoDoItem = item?.equipamento_id
    ? painel.equipamentos.find((e) => e.id === item.equipamento_id) ?? null
    : null

  const hora = horaCurta(compromisso.hora)
  const concluido = compromisso.concluido_em != null

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/agenda" voltarRotulo="Agenda" titulo={compromisso.titulo} />
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <div className="sombra-1 mt-4 space-y-2 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        <p className="corpo inline-flex items-center gap-2">
          <Icone nome="calendario" className="size-4 text-dim" />
          {rotuloDia(compromisso.data)}{hora ? ` · ${hora}` : " · dia inteiro"}
        </p>
        {/* Rótulo vindo da lista real de participantes, não do campo
            `visibilidade`: quem sai sozinho de um compromisso não tem
            permissão de reescrever o campo (ver `visibilidadeEfetiva`). */}
        <p className="apoio inline-flex items-center gap-2 text-dim">
          <Icone nome="pessoas" className="size-4" />
          {ROTULO_VISIBILIDADE[visibilidadeEfetiva(participantes)]}
          {compromisso.criado_por && !souCriador ? ` · criado por ${nomeDe(compromisso.criado_por)}` : ""}
        </p>
        {compromisso.descricao && <p className="corpo pt-1">{compromisso.descricao}</p>}
        {concluido && (
          <p className="apoio inline-flex items-center gap-2 text-ok">
            <Icone nome="guardado" className="size-4" /> Já realizado
          </p>
        )}
      </div>

      {compromisso.item_monitorado_id && (
        <>
          <SecaoPagina icone="ferramenta">Ligado a</SecaoPagina>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {item ? (
              <LinhaLista
                href={`/barco/itens/${item.id}/editar`}
                titulo={item.nome}
                subtitulo={equipamentoDoItem ? nomeDoEquipamento(equipamentoDoItem) : undefined}
              />
            ) : (
              // Sem o nome, sem o hub, sem link. Receber o compromisso não
              // abre porta nenhuma — só explica por que existe uma âncora aqui.
              <p className="apoio py-3 text-dim">
                Este compromisso está ligado a uma manutenção do barco. Seu acesso não inclui
                essa área, então os detalhes não aparecem aqui.
              </p>
            )}
          </div>
        </>
      )}

      <SecaoPagina icone="pessoas">Com quem está compartilhado</SecaoPagina>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
        {participantes.length === 0 ? (
          <p className="apoio py-3 text-dim">Só você. Este compromisso não aparece na agenda de mais ninguém.</p>
        ) : (
          participantes.map((p) => (
            <LinhaLista
              key={p.usuario_id}
              titulo={nomeDe(p.usuario_id)}
              subtitulo={p.responsavel ? "Responsável" : "Compartilhado"}
              trailing={
                souCriador || p.usuario_id === user?.id ? (
                  <form action={descompartilharCompromisso}>
                    <input type="hidden" name="compromisso_id" value={compromisso.id} />
                    <input type="hidden" name="usuario_id" value={p.usuario_id} />
                    <Confirmar
                      mensagem={p.usuario_id === user?.id ? "Sair deste compromisso?" : "Remover?"}
                      rotulo={p.usuario_id === user?.id ? "Sair" : "Remover"}
                      className={ALVO_ACAO}
                    >
                      <span className={PILULA_ACAO}>{p.usuario_id === user?.id ? "Sair" : "Remover"}</span>
                    </Confirmar>
                  </form>
                ) : undefined
              }
            />
          ))
        )}
      </div>

      {souCriador && disponiveis.length > 0 && (
        <form action={compartilharCompromisso} className="sombra-1 mt-3 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
          <input type="hidden" name="compromisso_id" value={compromisso.id} />
          <CampoSelect label="Compartilhar com" id="usuario_id" name="usuario_id" required defaultValue="">
            <option value="">Selecione</option>
            {disponiveis.map((uid: string) => (
              <option key={uid} value={uid}>{nomeDe(uid)}</option>
            ))}
          </CampoSelect>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="responsavel" value="1" className="size-4" />
            <span className="apoio">Atribuir — essa pessoa fica como responsável</span>
          </label>
          <BotaoEnviar rotulo="Compartilhar" variante="contorno" larguraCheia />
        </form>
      )}

      {souCriador && (
        <>
          <SecaoPagina icone="ferramenta">Editar</SecaoPagina>
          <form action={salvarCompromisso} className="sombra-1 space-y-4 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            <input type="hidden" name="compromisso_id" value={compromisso.id} />
            <Campo label="O quê" id="titulo" name="titulo" required defaultValue={compromisso.titulo} />
            <div className="flex gap-3">
              <Campo label="Dia" id="data" name="data" type="date" required defaultValue={compromisso.data} wrapperClassName="flex-1" />
              <Campo label="Hora" id="hora" name="hora" type="time" defaultValue={hora ?? ""} wrapperClassName="flex-1" dica="Em branco = dia inteiro" />
            </div>
            <CampoTextarea label="Observação" id="descricao" name="descricao" rows={3} defaultValue={compromisso.descricao ?? ""} />
            <BotaoEnviar rotulo="Salvar" />
          </form>

          <div className="mt-4 space-y-3">
            {/* Concluir não apaga: tira da agenda normal e continua em "o que
                já foi feito" (PRD §8). */}
            <form action={concluirCompromisso}>
              <input type="hidden" name="compromisso_id" value={compromisso.id} />
              {concluido && <input type="hidden" name="reabrir" value="1" />}
              <BotaoEnviar
                rotulo={concluido ? "Reabrir compromisso" : "Marcar como realizado"}
                variante="contorno"
                larguraCheia
              />
            </form>
            <form action={excluirCompromisso} className="flex justify-center">
              <input type="hidden" name="compromisso_id" value={compromisso.id} />
              {/* O vermelho fica no passo da confirmação, que o `Confirmar`
                  já desenha; aqui a ação veste a pílula de contorno como as
                  outras. Era 35px de alvo, 9 abaixo da régua. */}
              <Confirmar mensagem="Excluir este compromisso?" rotulo="Excluir compromisso" className={ALVO_ACAO}>
                <span className={PILULA_ACAO}>Excluir compromisso</span>
              </Confirmar>
            </form>
          </div>
        </>
      )}

      {!souCriador && (
        <p className={`${rot} mt-6 text-dim`}>
          Quem criou o compromisso é quem altera a data, o texto e com quem ele é compartilhado.
        </p>
      )}
    </main>
  )
}
