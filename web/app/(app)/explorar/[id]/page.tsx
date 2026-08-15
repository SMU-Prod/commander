import Link from "next/link"
import { notFound } from "next/navigation"
import { Icone } from "@/components/icone"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarMapaTaxonomia, nomeDaRegiao } from "@/lib/consultas-marketplace"
import { carregarElegibilidadeExplorar, urlFotoParceiro } from "@/lib/consultas-partner"
import { formatarReais } from "@/lib/domain/gastos"
import { tempoDesde } from "@/lib/domain/navegacao"
import { mensagemBloqueio } from "@/lib/domain/plano-acesso"
import {
  AVISO_DISPONIBILIDADE_MARINA,
  perfilTem,
  ROTULO_TIPO_PARTNER,
  ROTULO_TIPO_VAGA,
  vagaTemConteudo,
} from "@/lib/domain/partner"
import { supabaseServer } from "@/lib/supabase/server"
import type {
  ItemTaxonomiaDb,
  Parceiro,
  ParceiroAcomodacao,
  ParceiroAtividade,
  ParceiroVaga,
} from "@/lib/db/types"

/**
 * PERFIL COMPLETO DO PARTNER (PRD §10: "Clique abre perfil completo para
 * usuários ELEGÍVEIS", e §13.3 a §13.6 pro que cada tipo mostra).
 *
 * "Elegível" é o §2.3: no Free, "qualquer detalhe, contato ou ação comercial
 * permanece bloqueado". O corte é feito ANTES de qualquer consulta ao perfil
 * — a página nem chega a ler telefone, preço ou vaga de ninguém. É o mesmo
 * princípio da vitrine: o dado não sai do banco, em vez de sair e ficar
 * escondido no HTML.
 */
export default async function PerfilParceiroPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  // §10, "usuários elegíveis" — proprietário pago, Captain Pro ou quem tem
  // perfil de Partner. Ver `explorarCompletoLiberado` em lib/domain/partner.ts.
  const elegivel = await carregarElegibilidadeExplorar()

  if (!elegivel) {
    const { titulo, descricao } = mensagemBloqueio("explorar_perfil_completo")
    return (
      <main>
        <Link href="/explorar" className="apoio inline-flex items-center gap-1 text-dim">
          <Icone nome="voltar" className="size-3.5" /> Explorar
        </Link>
        <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel p-5 text-center">
          <Icone nome="cadeado" className="mx-auto size-6 text-dim" />
          <h1 className="titulo-card mt-2">{titulo}</h1>
          <p className="apoio mt-1 text-dim">{descricao}</p>
          <Link
            href="/assinar"
            className="mt-4 inline-block rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-acao-texto"
          >
            Ver planos
          </Link>
        </div>
      </main>
    )
  }

  const supabase = await supabaseServer()
  const { data } = await supabase
    .from("parceiros").select("*").eq("id", id).eq("visivel", true).maybeSingle()
  const p = data as Parceiro | null
  if (!p) notFound()

  const [{ data: atividadesBrutas }, { data: vagasBrutas }, { data: acomodacoesBrutas }, mapaTaxonomia] =
    await Promise.all([
      supabase.from("parceiro_atividades").select("*").eq("parceiro_id", p.id),
      supabase.from("parceiro_vagas").select("*").eq("parceiro_id", p.id).order("tipo"),
      supabase.from("parceiro_acomodacoes").select("*").eq("parceiro_id", p.id).order("ordem").order("criado_em"),
      carregarMapaTaxonomia(),
    ])

  // Métrica de renovação do parceiro (migration 020). Fire-and-forget: se
  // falhar, ninguém perde a visita da tela por causa de um contador.
  await supabase.rpc("registrar_visualizacao", { p_parceiro_id: p.id }).then(
    () => {},
    () => {},
  )

  const atividades = ((atividadesBrutas as ParceiroAtividade[] | null) ?? [])
    .map((a) => mapaTaxonomia.get(a.taxonomia_id))
    .filter((t): t is ItemTaxonomiaDb => t != null)
  const servicos = atividades.filter((t) => t.tipo === "categoria_servico")
  const produtos = atividades.filter((t) => t.tipo === "categoria_produto")
  const marcas = atividades.filter((t) => t.tipo === "marca")
  const combustiveis = atividades.filter((t) => t.tipo === "combustivel")

  const vagas = ((vagasBrutas as ParceiroVaga[] | null) ?? []).filter(vagaTemConteudo)
  const acomodacoes = (acomodacoesBrutas as ParceiroAcomodacao[] | null) ?? []

  const fotos = await Promise.all(p.fotos.map((f) => urlFotoParceiro(f)))
  const cardapio = await Promise.all(p.fotos_cardapio.map((f) => urlFotoParceiro(f)))
  const telefoneLimpo = p.telefone?.replace(/\D/g, "") ?? ""
  const agora = new Date().toISOString()

  return (
    <main>
      <Link href="/explorar" className="apoio inline-flex items-center gap-1 text-dim hover:text-texto">
        <Icone nome="voltar" className="size-3.5" /> Explorar
      </Link>

      <div className="mt-3 flex items-start gap-3">
        <div
          className={`flex size-12 shrink-0 items-center justify-center rounded-full ${
            p.plano === "destaque" ? "ring-2 ring-[#D4AF37]" : "ring-2 ring-white"
          }`}
          style={{ backgroundColor: p.cor }}
        >
          <Icone nome={p.icone} className="size-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="titulo-pagina">{p.nome}</h1>
          {/* §13: "o Dashboard e o perfil exibem o TIPO REAL do parceiro" —
              "Marina", não "Commander Partner". */}
          <p className="apoio mt-0.5 text-dim">
            {ROTULO_TIPO_PARTNER[p.categoria]} · {nomeDaRegiao(mapaTaxonomia, p.regiao_id)}
          </p>
        </div>
      </div>

      {fotos.length > 0 && (
        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4" style={{ scrollbarWidth: "none" }}>
          {fotos.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element -- URL pública do bucket parceiros
            <img key={url} src={url} alt="" className="h-40 w-56 shrink-0 rounded-[12px] object-cover" loading="lazy" />
          ))}
        </div>
      )}

      {p.sobre && <p className="corpo mt-4">{p.sobre}</p>}

      {/* §13.1/§13.2 — as atividades declaradas. É o mesmo vocabulário do
          Marketplace (taxonomia), então "Elétrica" aqui e "Elétrica" numa
          demanda são o MESMO item, não dois textos parecidos. */}
      {(servicos.length > 0 || produtos.length > 0 || marcas.length > 0 || combustiveis.length > 0) && (
        <>
          <SecaoPagina icone="ferramenta">O que atende</SecaoPagina>
          <div className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
            <Fichas titulo="Serviços" itens={servicos} />
            <Fichas titulo="Produtos" itens={produtos} />
            <Fichas titulo="Marcas" itens={marcas} />
            <Fichas titulo="Combustíveis" itens={combustiveis} />
          </div>
        </>
      )}

      {/* §13.3 — vagas da Marina */}
      {perfilTem(p.categoria, "vagas") && vagas.length > 0 && (
        <>
          <SecaoPagina icone="ancora">Vagas</SecaoPagina>
          <div className="space-y-2.5">
            {vagas.map((v) => (
              <div key={v.tipo} className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="titulo-card">{ROTULO_TIPO_VAGA[v.tipo]}</p>
                  {v.disponiveis != null && (
                    <p className="corpo font-mono-instr tabular-nums">
                      {v.disponiveis}
                      {v.total != null ? ` de ${v.total}` : ""} livre{v.disponiveis === 1 ? "" : "s"}
                    </p>
                  )}
                </div>
                <div className="corpo mt-1.5 space-y-0.5 text-dim">
                  {v.porte_max_pes != null && <p>Porte máximo: {v.porte_max_pes} pés</p>}
                  {v.sob_consulta ? (
                    <p>Valores sob consulta</p>
                  ) : (
                    <>
                      {v.preco_diaria_centavos != null && (
                        <p>Diária: <span className="font-mono-instr tabular-nums">{formatarReais(v.preco_diaria_centavos)}</span></p>
                      )}
                      {v.preco_mensal_centavos != null && (
                        <p>Mensal: <span className="font-mono-instr tabular-nums">{formatarReais(v.preco_mensal_centavos)}</span></p>
                      )}
                    </>
                  )}
                </div>
                <p className="apoio mt-1.5 text-dim">
                  Declarado {tempoDesde(v.declarado_em, agora)}
                </p>
              </div>
            ))}
          </div>
          {/* §13.3, palavra por palavra: "Informação de disponibilidade é
              declarada pela Marina; não é estoque/reserva transacional."
              Precisa estar NA TELA, não só no código. */}
          <p className="apoio mt-2 rounded-lg border border-line bg-panel2 px-3 py-2 text-dim">
            {AVISO_DISPONIBILIDADE_MARINA}
          </p>
        </>
      )}

      {/* §13.3/§13.5/§13.6 — o que interessa a quem chega pela água */}
      {(p.acesso_nautico || p.estrutura || p.atracacao || p.calado_max_m != null || p.tem_combustivel) && (
        <>
          <SecaoPagina icone="embarcacao">Chegada e estrutura</SecaoPagina>
          <div className="sombra-1 corpo space-y-2 rounded-[14px] border border-line bg-panel p-4">
            {p.acesso_nautico && <p><span className="text-dim">Acesso náutico:</span> {p.acesso_nautico}</p>}
            {p.calado_max_m != null && (
              <p>
                <span className="text-dim">Calado máximo:</span>{" "}
                <span className="font-mono-instr tabular-nums">{p.calado_max_m.toLocaleString("pt-BR")} m</span>
              </p>
            )}
            {p.atracacao && <p><span className="text-dim">Atracação:</span> {p.atracacao}</p>}
            {p.estrutura && <p><span className="text-dim">Estrutura:</span> {p.estrutura}</p>}
            {p.tem_combustivel && <p>Combustível no local</p>}
            {p.tem_poita && <p>Poita{p.qtd_poitas ? ` (${p.qtd_poitas})` : ""}</p>}
          </div>
        </>
      )}

      {/* §13.4 — o preço do Posto, com a idade dele (§13.4: "última
          atualização"). A diária legada de `parceiros` (migration 020) só
          aparece pra quem NÃO tem estrutura de preço própria: numa Marina ela
          seria uma terceira diária ao lado das vagas, e numa Pousada ao lado
          das acomodações. O valor antigo continua no banco — §23 manda
          preservar, não apagar — só não é exibido duas vezes. */}
      {(p.preco_diesel_centavos != null ||
        (p.preco_diaria_centavos != null &&
          !perfilTem(p.categoria, "vagas") &&
          !perfilTem(p.categoria, "acomodacoes"))) && (
        <>
          <SecaoPagina icone="cifrao">Preços</SecaoPagina>
          <div className="sombra-1 corpo space-y-1 rounded-[14px] border border-line bg-panel p-4">
            {p.preco_diesel_centavos != null && (
              <p>
                Combustível: <span className="font-mono-instr tabular-nums">{formatarReais(p.preco_diesel_centavos)}</span>/L
              </p>
            )}
            {p.preco_diaria_centavos != null &&
              !perfilTem(p.categoria, "vagas") &&
              !perfilTem(p.categoria, "acomodacoes") && (
                <p>
                  Diária: <span className="font-mono-instr tabular-nums">{formatarReais(p.preco_diaria_centavos)}</span>
                </p>
              )}
            <p className="apoio text-dim">
              {p.precos_atualizados_em
                ? `Atualizado ${tempoDesde(p.precos_atualizados_em, agora)}`
                : "Nunca atualizado desde o cadastro"}
              . Confirme antes de contar com o valor.
            </p>
          </div>
        </>
      )}

      {/* §13.5 — "Cardápio; cardápio é galeria de imagens, não cadastro de pratos" */}
      {perfilTem(p.categoria, "cardapio") && (
        <>
          <SecaoPagina icone="imagem">Cardápio</SecaoPagina>
          {cardapio.length > 0 ? (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4" style={{ scrollbarWidth: "none" }}>
              {cardapio.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element -- URL pública do bucket parceiros
                <img key={url} src={url} alt="Página do cardápio" className="h-56 w-40 shrink-0 rounded-[12px] object-cover" loading="lazy" />
              ))}
            </div>
          ) : (
            <p className="apoio rounded-[14px] border border-line bg-panel p-4 text-dim">
              Este restaurante ainda não publicou o cardápio.
            </p>
          )}
          {p.culinaria && <p className="corpo mt-2">Cozinha: {p.culinaria}</p>}
          {p.vaga_cortesia && <p className="corpo mt-1">Vaga de carro cortesia</p>}
        </>
      )}

      {/* §13.6 — acomodações e check-in/out. Sem calendário e sem booking. */}
      {perfilTem(p.categoria, "acomodacoes") && (
        <>
          <SecaoPagina icone="inicio">Acomodações</SecaoPagina>
          {acomodacoes.length > 0 ? (
            <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
              {acomodacoes.map((a) => (
                <div key={a.id} className="border-b border-line py-3 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="corpo font-medium">{a.nome}</p>
                    {a.valor_diaria_centavos != null && (
                      <p className="corpo font-mono-instr tabular-nums">{formatarReais(a.valor_diaria_centavos)}</p>
                    )}
                  </div>
                  <p className="apoio text-dim">
                    {a.capacidade != null && `Até ${a.capacidade} ${a.capacidade === 1 ? "pessoa" : "pessoas"}`}
                    {a.capacidade != null && a.descricao ? " · " : ""}
                    {a.descricao}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="apoio rounded-[14px] border border-line bg-panel p-4 text-dim">
              Esta pousada ainda não cadastrou as acomodações.
            </p>
          )}
          {(p.check_in || p.check_out) && (
            <p className="corpo mt-2">
              {p.check_in && `Check-in a partir das ${p.check_in.slice(0, 5)}`}
              {p.check_in && p.check_out ? " · " : ""}
              {p.check_out && `check-out até ${p.check_out.slice(0, 5)}`}
            </p>
          )}
          {p.traslado_incluso && <p className="corpo mt-1">Traslado incluso</p>}
          <p className="apoio mt-2 text-dim">
            Reserva e pagamento são feitos direto com a pousada — o Commander não intermedeia.
          </p>
        </>
      )}

      <SecaoPagina icone="chat">Contato</SecaoPagina>
      <div className="sombra-1 corpo space-y-1 rounded-[14px] border border-line bg-panel p-4">
        {p.horario && <p><span className="text-dim">Horário:</span> {p.horario}</p>}
        {p.email && (
          <a href={`mailto:${p.email}`} className="block break-all text-accent-forte">{p.email}</a>
        )}
        {!p.horario && !p.email && !p.telefone && <p className="text-dim">Sem contato publicado.</p>}
      </div>

      <div className="mt-4 flex gap-2">
        {p.telefone && (
          <a
            href={`tel:${telefoneLimpo}`}
            className="corpo flex h-12 flex-1 items-center justify-center rounded-xl border border-line"
          >
            Ligar
          </a>
        )}
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="corpo flex h-12 flex-1 items-center justify-center rounded-xl border border-line"
        >
          Como chegar
        </a>
        <Link
          href={`/navegar?destino_la=${p.lat}&destino_lo=${p.lng}&destino_nome=${encodeURIComponent(p.nome)}`}
          className="flex h-12 flex-1 items-center justify-center rounded-xl bg-accent font-semibold text-acao-texto"
        >
          Traçar rumo
        </Link>
      </div>
    </main>
  )
}

/** Lista de fichas de taxonomia. Some quando não há nada — nenhuma seção
 *  "Marcas: —" na tela. */
function Fichas({ titulo, itens }: { titulo: string; itens: readonly ItemTaxonomiaDb[] }) {
  if (itens.length === 0) return null
  return (
    <div>
      <p className="rotulo text-dim">{titulo}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {itens.map((i) => (
          <span key={i.id} className="apoio rounded-full border border-line bg-panel2 px-2.5 py-1">
            {i.nome}
          </span>
        ))}
      </div>
    </div>
  )
}
