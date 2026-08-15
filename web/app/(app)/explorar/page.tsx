import Link from "next/link"
import { Icone } from "@/components/icone"
import { CardsParceiros } from "@/components/explorar/cards-parceiros"
import { ExplorarMapa } from "@/components/mapa/explorar-mapa"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { RedeNav } from "@/components/ui/rede-nav"
import { carregarNivelPlano } from "@/lib/consultas"
import { carregarTaxonomia } from "@/lib/consultas-marketplace"
import { carregarDestaquesExplorar } from "@/lib/consultas-publicidade"
import { ordenarComDestaque } from "@/lib/domain/publicidade"
import {
  cardAmostraFree,
  cardCompleto,
  carregarElegibilidadeExplorar,
  carregarVitrine,
} from "@/lib/consultas-partner"
import { hojeISO } from "@/lib/domain/datas"
import { amostraExplorarFree } from "@/lib/domain/plano-acesso"
import {
  FILTRO_TODOS,
  filtrarVitrine,
  filtroTipoValido,
  ROTULO_TIPO_PARTNER,
  TIPOS_PARTNER,
} from "@/lib/domain/partner"
import { campo, rot } from "@/lib/ui/form"

/**
 * EXPLORAR PARCEIROS (PRD FINAL §10, reescrita na onda 51).
 *
 * ---------------------------------------------------------------------------
 * POR QUE DUAS VISTAS, E POR QUE OS CARDS SÃO O PADRÃO
 * ---------------------------------------------------------------------------
 * O §10 é literal sobre a forma: "Experiência PRINCIPAL: cards quadrados/
 * visuais com foto, nome, categoria e localização básica". Então os cards
 * abrem por padrão.
 *
 * O mapa da onda 39 NÃO foi substituído, e a decisão é consciente. Ele
 * responde uma pergunta que card nenhum responde — "o que existe no caminho
 * do meu rumo" — e é a única porta pro "Traçar rumo", que joga o destino
 * direto no /navegar. Trocar mapa por cards teria apagado uma função náutica
 * real pra ganhar uma vitrine; somar as duas custa um botão. O que muda é
 * qual delas abre primeiro: era o mapa, agora é a vitrine, como o PRD pede.
 *
 * ---------------------------------------------------------------------------
 * O CORTE DO FREE ACONTECE AQUI, NO SERVIDOR (§2.3)
 * ---------------------------------------------------------------------------
 * "Alguns Partners aleatórios mostram somente foto + nome; qualquer detalhe,
 * contato ou ação comercial permanece bloqueado."
 *
 * A amostra é montada com `cardAmostraFree`, que devolve tipo, região e
 * atividades NULOS — o dado não chega ao navegador. Filtrar no cliente seria
 * teatro (bastaria ler o HTML), e é a mesma disciplina que a onda 47 aplicou
 * ao mapa. Por consequência, o Free também não recebe os FILTROS: filtrar por
 * região seis cartões cuja região está escondida não filtra nada, e ainda
 * vazaria por dedução a região de quem sobrasse.
 */
export default async function ExplorarPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; tipo?: string; regiao?: string; atividade?: string }>
}) {
  const { vista, tipo: tipoBruto, regiao, atividade } = await searchParams
  const noMapa = vista === "mapa"

  const [nivel, pago, { parceiros, atividadesPorParceiro }] = await Promise.all([
    carregarNivelPlano(),
    // "Elegível" (§10) não é o mesmo que "proprietário pago": Captain Pro e
    // qualquer Partner cadastrado também entram — ver
    // `explorarCompletoLiberado` em lib/domain/partner.ts. Sem isso, uma
    // Marina clicaria no "Explorar" do próprio menu (§13) e tomaria o
    // paywall de gestão de barco, que não é o produto dela.
    carregarElegibilidadeExplorar(),
    carregarVitrine(),
  ])

  // --- Vista de mapa: exatamente o comportamento da onda 39/47 -------------
  if (noMapa) {
    if (pago) return <ExplorarMapa parceiros={parceiros} />
    const amostra = amostraExplorarFree(parceiros, `${hojeISO()}:${nivel}`).map((p) => ({
      ...p,
      // Foto + nome, e nada além disso (§2.3).
      sobre: null,
      telefone: null,
      email: null,
      horario: null,
      preco_diaria_centavos: null,
      preco_diesel_centavos: null,
      calado_max_m: null,
      qtd_poitas: null,
      traslado_incluso: null,
      vaga_cortesia: null,
      culinaria: null,
      acesso_nautico: null,
      estrutura: null,
      atracacao: null,
      check_in: null,
      check_out: null,
      fotos_cardapio: [],
    }))
    return <ExplorarMapa parceiros={amostra} amostraFree />
  }

  // --- Vista de cards (§10) ------------------------------------------------
  if (!pago) {
    const amostra = amostraExplorarFree(parceiros, `${hojeISO()}:${nivel}`)
    const cards = await Promise.all(amostra.map((p) => cardAmostraFree(p)))
    return (
      <main>
        <RedeNav atual="explorar" />
        <Cabecalho noMapa={false} />
        {cards.length === 0 ? (
          <EstadoVazio
            icone="mapa"
            titulo="Nenhum parceiro por aqui ainda"
            descricao="Marinas, postos, lojas e prestadores aparecem aqui conforme entram na rede Commander."
          />
        ) : (
          <>
            <CardsParceiros cards={cards} bloqueado />
            <div className="sombra-1 mt-4 rounded-[14px] border border-accent/30 bg-accent/5 p-4 text-center">
              <p className="corpo font-medium">Você está vendo uma amostra</p>
              <p className="apoio mt-1 text-dim">
                No plano gratuito o Explorar mostra alguns parceiros só com foto e nome. Perfil completo,
                categoria, região e contato são do plano Commander.
              </p>
              <Link
                href="/assinar"
                className="mt-3 inline-block rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-acao-texto"
              >
                Ver planos
              </Link>
            </div>
          </>
        )}
      </main>
    )
  }

  const filtroTipo = filtroTipoValido(tipoBruto)
  const paraFiltrar = parceiros.map((p) => ({
    parceiro: p,
    id: p.id,
    categoria: p.categoria,
    regiao_id: p.regiao_id,
    atividades: atividadesPorParceiro.get(p.id) ?? [],
  }))
  const filtrados = filtrarVitrine(paraFiltrar, {
    tipo: filtroTipo,
    regiaoId: regiao || null,
    atividadeId: atividade || null,
  })
  // Destaque no Explorar (§20). A onda 52 entregou a regra e a consulta, mas
  // nenhuma tela chamava — o produto era vendável, media impressão e aparecia
  // no Admin sem NUNCA destacar ninguém. Parceiro pagaria por algo que não
  // acontece, que é pior do que não vender.
  //
  // Ordena depois de filtrar, não antes: destaque promove dentro do que a
  // pessoa pediu, nunca traz de volta quem ela acabou de filtrar fora.
  // `ordenarComDestaque` não conhece nota — a ordem de quem não paga continua
  // sendo a que veio (§20: "publicidade nunca interfere na nota/reputação").
  const destaques = await carregarDestaquesExplorar({
    regiaoId: regiao || null,
    categoriaId: atividade || null,
  })
  const cards = await Promise.all(
    ordenarComDestaque(filtrados, (f) => f.id, destaques)
      .map((f) => cardCompleto(f.parceiro, f.atividades)),
  )

  // Só oferece filtro por região/atividade que ALGUÉM realmente tem — uma
  // lista com as 15 regiões da taxonomia mandaria a pessoa pra 12 telas
  // vazias. Honestidade de estado vazio antes de completude de menu (§24).
  const taxonomia = await carregarTaxonomia()
  const regioesUsadas = new Set(parceiros.map((p) => p.regiao_id))
  const atividadesUsadas = new Set([...atividadesPorParceiro.values()].flat())
  const regioes = taxonomia.filter((t) => t.tipo === "regiao" && regioesUsadas.has(t.id))
  const atividades = taxonomia.filter((t) => atividadesUsadas.has(t.id))

  const comFiltro = filtroTipo !== FILTRO_TODOS || Boolean(regiao) || Boolean(atividade)
  const hrefTipo = (valor: string) => {
    const q = new URLSearchParams()
    if (valor !== FILTRO_TODOS) q.set("tipo", valor)
    if (regiao) q.set("regiao", regiao)
    if (atividade) q.set("atividade", atividade)
    const s = q.toString()
    return s ? `/explorar?${s}` : "/explorar"
  }

  return (
    <main>
      <RedeNav atual="explorar" />
      <Cabecalho noMapa={false} />

      {/* §10, "Filtros: Todos, tipo de Partner, categoria/atividade, região".
          Chips são links (sem JS no cliente) e preservam os outros filtros. */}
      <nav
        aria-label="Tipo de parceiro"
        className="rolagem-lateral -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {[FILTRO_TODOS, ...TIPOS_PARTNER].map((valor) => {
          const ativo = filtroTipo === valor
          const rotulo = valor === FILTRO_TODOS ? "Todos" : ROTULO_TIPO_PARTNER[valor]
          return (
            <Link
              key={valor}
              href={hrefTipo(valor)}
              aria-current={ativo ? "true" : undefined}
              className={`flex h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm ${
                ativo ? "border-accent bg-accent font-semibold text-acao-texto" : "border-line bg-panel text-dim"
              }`}
            >
              {rotulo}
            </Link>
          )
        })}
      </nav>

      {/* Região e categoria/atividade são listas longas demais pra chip —
          entram num GET simples, que continua funcionando sem JavaScript. */}
      <form method="get" action="/explorar" className="sombra-1 mt-3 rounded-[14px] border border-line bg-panel p-3">
        {filtroTipo !== FILTRO_TODOS && <input type="hidden" name="tipo" value={filtroTipo} />}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rot} htmlFor="regiao">Região</label>
            <select id="regiao" name="regiao" defaultValue={regiao ?? ""} className={campo}>
              <option value="">Todas</option>
              {regioes.map((r) => (
                <option key={r.id} value={r.id}>{r.uf ? `${r.nome} · ${r.uf}` : r.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={rot} htmlFor="atividade">Categoria / atividade</label>
            <select id="atividade" name="atividade" defaultValue={atividade ?? ""} className={campo}>
              <option value="">Todas</option>
              {atividades.map((a) => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button className="h-11 flex-1 rounded-xl bg-accent text-sm font-semibold text-acao-texto">
            Aplicar filtros
          </button>
          {comFiltro && (
            <Link href="/explorar" className="corpo shrink-0 text-dim">Limpar</Link>
          )}
        </div>
      </form>

      <p className="apoio mt-3 text-dim">
        {cards.length} {cards.length === 1 ? "parceiro" : "parceiros"}
        {comFiltro ? " com esses filtros" : " na rede Commander"}
      </p>

      <div className="mt-2">
        {cards.length === 0 ? (
          <EstadoVazio
            icone="mapa"
            titulo={comFiltro ? "Nenhum parceiro com esses filtros" : "Nenhum parceiro por aqui ainda"}
            descricao={
              comFiltro
                ? "Tente outra região ou outro tipo de parceiro."
                : "Marinas, postos, lojas e prestadores aparecem aqui conforme entram na rede Commander."
            }
            acao={comFiltro ? { href: "/explorar", rotulo: "Limpar filtros" } : undefined}
          />
        ) : (
          <CardsParceiros cards={cards} />
        )}
      </div>
    </main>
  )
}

/** Título + o botão que troca vitrine ↔ mapa. Separado só pra não repetir o
 *  bloco nos três caminhos de retorno acima. */
function Cabecalho({ noMapa }: { noMapa: boolean }) {
  return (
    <div className="mt-3 flex items-start justify-between gap-3">
      <div>
        <h1 className="titulo-pagina">Explorar Parceiros</h1>
        <p className="apoio mt-1 text-dim">
          Marinas, postos, lojas, prestadores, restaurantes e pousadas da rede Commander.
        </p>
      </div>
      <Link
        href={noMapa ? "/explorar" : "/explorar?vista=mapa"}
        className="corpo inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-panel px-3 text-dim"
      >
        <Icone nome={noMapa ? "marketplace" : "mapa"} className="size-4" />
        {noMapa ? "Vitrine" : "Mapa"}
      </Link>
    </div>
  )
}
