import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { TarjaPushDesligado } from "@/components/tarja-push-desligado"
import { Abas } from "@/components/ui/abas"
import { Chip, ChipDado, ChipLinha } from "@/components/ui/chip"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarNotificacoes, carregarPainel } from "@/lib/consultas"
import { formatarCarimbo } from "@/lib/domain/datas"
import {
  agruparSemelhantes, CATEGORIAS_NOTIFICACAO, contarPorCategoria, filtrarPorCategoria,
  iconeDoAviso, ROTULO_CATEGORIA_NOTIFICACAO, ROTULO_NIVEL_NOTIFICACAO,
  VAZIO_CATEGORIA_NOTIFICACAO,
  type CategoriaNotificacao, type NivelNotificacao, type NotificacaoAgrupada,
} from "@/lib/domain/notificacoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { AlertaEnviado } from "@/lib/db/types"

/**
 * AVISOS — CAIXA DE ENTRADA CUJO OBJETIVO É FICAR VAZIA (onda 58, spec de
 * arquitetura §3). A tela da onda 44 empilhava quatro trabalhos com o mesmo
 * peso: ativar push, filtrar, ler, auditar histórico. Agora cada um tem o
 * peso do seu papel:
 *
 *   - LER é o trabalho. Críticas com peso inteiro; importantes e
 *     informativas recolhidas atrás da contagem (hierarquia progressiva,
 *     DESIGN.md §2: contagem → item → detalhe).
 *   - AUDITAR vira a aba Histórico — registro de "o app me avisou?", útil
 *     na dúvida e inútil no dia a dia.
 *   - ATIVAR PUSH morou aqui até esta onda; agora mora em Ajustes. Sobra a
 *     `TarjaPushDesligado`, que só aparece quando há o que dizer.
 *   - FILTRAR continua, só em Pendentes.
 *
 * Agenda, Marketplace e Financeiro aparecem como filtro mesmo sem o módulo
 * por trás — e mostram um estado vazio honesto, que diz que o módulo ainda
 * não está no ar. Esconder o filtro seria mais "limpo" e menos verdadeiro:
 * o dono precisa saber o que o app cobre e o que ainda não cobre.
 *
 * Quem monta a lista é `carregarNotificacoes` (`lib/consultas.ts`), a mesma
 * função que alimenta o contador do sino — o badge e a tela nunca divergem.
 * A filtragem por permissão acontece lá, antes de qualquer coisa chegar
 * aqui.
 */

/** Destaque visual por nível — a borda LATERAL por severidade da imagem 6
 *  do catálogo: o sinal é a borda, não um preenchimento (o `bg-crit/[0.06]`
 *  da onda 58 saiu — era o paliativo de quando a borda era igual nos três
 *  níveis). Informativa fica na `border-line` de todo cartão. Nada de
 *  dourado (`accent`): esse é do Commander Gold.
 *
 *  ONDA 101 (HAULIX §26) — O CHIP DE NÍVEL VIRA PILL PREENCHIDA.
 *
 *  A régua entregue pelo dono descreve status badge como "pill sobre o
 *  respectivo `-soft`", e o app tinha DUAS formas de escrever severidade no
 *  mesmo cartão: o ícone já era `bg-crit/12 text-crit` (pill preenchida) e o
 *  chip ao lado era contorno (`border-crit/50`). Mesma cor, mesma informação,
 *  dois vestidos a 30px um do outro. Agora os dois usam o tratamento que o
 *  documento nomeia — e o cartão perde uma borda, que §04 pede discreta.
 *
 *  A informativa fica em `bg-line` e não em `bg-panel2` de propósito: o cartão
 *  inteiro passa a `bg-panel2` no hover (§49, "sobe um nível de superfície"), e
 *  um chip pintado da cor do hover desapareceria justo quando o dedo está em
 *  cima dele. `line` é o degrau vizinho, e sobrevive aos dois fundos. */
const ESTILO_NIVEL: Record<NivelNotificacao, { cartao: string; chip: string; icone: string }> = {
  critica: {
    cartao: "border-l-crit",
    chip: "bg-crit/12 text-crit",
    icone: "bg-crit/12 text-crit",
  },
  importante: {
    cartao: "border-l-warn",
    chip: "bg-warn/12 text-warn",
    icone: "bg-warn/12 text-warn",
  },
  informativa: {
    cartao: "",
    chip: "bg-line text-dim",
    icone: "bg-panel2 text-dim",
  },
}

function CartaoNotificacao({ n }: { n: NotificacaoAgrupada }) {
  const estilo = ESTILO_NIVEL[n.nivel]
  return (
    <Link
      href={n.href}
      /* ONDA 101 (HAULIX §49) — O HOVER QUE NÃO EXISTIA.
         Cada item desta lista é um link, e a lista inteira não dava retorno
         nenhum ao ponteiro: no desktop não havia como saber qual linha ia
         receber o clique. A régua é literal — "hover sobe UM nível de
         superfície" (`bg-panel` → `bg-panel2`), o mesmo degrau que o trilho e
         a faixa de topo já usam. `transition-colors` fica na faixa de 120–180ms
         que o §49 pede; nada de animação decorativa. No toque isto não custa
         nada: `hover` não dispara em tela sensível. */
      className={`sombra-1 flex items-center gap-3 rounded-[var(--raio-cartao)] border border-l-2 border-line bg-panel p-3 transition-colors hover:bg-panel2 ${estilo.cartao}`}
    >
      {/* O desenho da ÁREA de origem, não um sino repetido (canvas tela-1e):
          documento vencido mostra a folha, extintor o escudo, revisão o motor
          — `iconeDoAviso` deriva de categoria+aba, nada gravado à parte. */}
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-[var(--raio-pilula)] ${estilo.icone}`}>
        <Icone nome={iconeDoAviso(n)} className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="titulo-card truncate">{n.titulo}</p>
        <p className="apoio mt-0.5 truncate text-dim">
          {n.detalhe}
          {/* "Oportunidades semelhantes devem ser agrupadas para evitar spam"
              (PRD §5.2) — o resto do grupo vira um "+N" em vez de N linhas. */}
          {n.quantidade > 1 && ` · +${n.quantidade - 1} semelhante${n.quantidade > 2 ? "s" : ""}`}
        </p>
        {/* A ação nomeada dentro do aviso (spec §3.2: "aviso que não se
            resolve pelo aviso é aviso que se lê duas vezes"). É texto, não um
            segundo link: o cartão INTEIRO já é o link, e <a> dentro de <a> é
            o HTML inválido em que o app tropeçou na onda 28. Peso e cor de
            texto — não dourado: os dois dourados da tela já têm dono. */}
        <p className="mt-1.5 flex items-center gap-1 text-sm font-medium text-texto">
          {n.acao}
          <Icone nome="chevron" className="size-3.5 text-dim" />
        </p>
      </div>
      {/* 11px, não 10.5: o piso tipográfico do app (DESIGN §5) vale também
          pro chip de nível — o canvas (tela-1e) escreve o chip exatamente
          no piso, e o HAULIX §26 pede 10–11 na pill de status. `px-2 py-0.5`
          dá a altura de ~20px que o documento fixa; a borda saiu junto com o
          contorno (ver `ESTILO_NIVEL`). */}
      <span className={`rotulo shrink-0 rounded-[var(--raio-pilula)] px-2 py-0.5 font-semibold ${estilo.chip}`}>
        {ROTULO_NIVEL_NOTIFICACAO[n.nivel]}
      </span>
    </Link>
  )
}

/**
 * Nível recolhido atrás da contagem — `<details>` nativo, zero JS, a página
 * continua RSC. Quem quer varrer as importantes abre; quem só passou pra
 * ver se há fogo não paga três cabeçalhos por dois itens.
 */
function NivelRecolhido({
  rotulo,
  itens,
  aberto = false,
}: {
  rotulo: string
  itens: NotificacaoAgrupada[]
  aberto?: boolean
}) {
  return (
    <details className="group mt-4" open={aberto}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium text-dim [&::-webkit-details-marker]:hidden">
        <Icone nome="chevron" className="size-4 transition-transform group-open:rotate-90" />
        {/* ONDA 93 (achado 5.7) — A CONTAGEM VOLTA PARA DENTRO DO CHIP.
            A onda 87 acertou a VOZ do número (`.valor`, 14px, dado e não
            legenda) e parou aí: ele continuava sendo um mono solto ao lado do
            rótulo, que é a terceira das três formas que o app tinha para
            escrever contagem. A régua é uma só — número colado no rótulo,
            dentro do chip — e `ChipDado` é ela em componente. O rótulo do
            grupo entra como `rotulo` do próprio chip, senão apareceria duas
            vezes na mesma linha. */}
        <ChipDado rotulo={rotulo}>{itens.length}</ChipDado>
      </summary>
      <div className="mt-2 space-y-2">
        {itens.map((n) => <CartaoNotificacao key={n.id} n={n} />)}
      </div>
    </details>
  )
}

export default async function NotificacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; aba?: string }>
}) {
  const { categoria: categoriaBruta, aba: abaBruta } = await searchParams
  const supabase = await supabaseServer()

  // ONDA 100 — TRÊS ESPERAS EM FILA PARA MONTAR UMA LISTA SÓ.
  //
  // A tela abria com `auth.getUser()` — que NÃO lê cookie, é uma ida à rede até
  // o servidor de autenticação —, depois esperava o painel, depois os avisos. E
  // as três respondem à mesma pergunta em ordens diferentes: o painel já sabe
  // quem é a pessoa (`usuarioId`, onda 100) e `carregarNotificacoes` já espera
  // o painel por dentro, pelo mesmo `cache()`. Pedir os dois juntos não duplica
  // consulta nenhuma — a segunda chamada encontra a primeira em andamento.
  //
  // A GUARDA DE SESSÃO CONTINUA, e continua sendo do servidor: sem painel, aí
  // sim se pergunta ao Supabase quem é (é o caso do Partner/Captain sem barco,
  // para quem `carregarPainel` devolve `null` sem poder dizer o id). Quem tem
  // painel tem vínculo, e vínculo é linha filtrada por `usuario_id` — ou seja,
  // a sessão já está provada. O middleware, que valida antes de a página
  // existir, é a primeira tranca; esta é a segunda, e ela só custa quando
  // precisa custar.
  const [painel, todas] = await Promise.all([carregarPainel(), carregarNotificacoes()])
  if (!painel) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect("/login?volta=/notificacoes")
  }
  // ONDA 99 — ESTA TELA MANDAVA O PARTNER PARA O ONBOARDING DE EMBARCAÇÃO.
  //
  // O `redirect("/onboarding")` daqui pressupunha que caixa de entrada é coisa
  // de dono de barco. Deixou de ser: desde esta onda o Marketplace avisa quem
  // atende quando um pedido é publicado, e quem atende é justamente o Partner
  // (marina, posto, loja) e o Captain — gente que NUNCA vai ter embarcação, e
  // que era mandada para um cadastro de barco ao tocar no próprio aviso.
  //
  // Sem barco a lista existe e traz só o que não pertence a hub nenhum (é o
  // que `carregarNotificacoes` devolve nesse caso), e o Histórico — que é
  // histórico DE ALERTA DE EMBARCAÇÃO — some junto com a embarcação, em vez de
  // mostrar aba vazia sem explicação.

  // Só "historico" muda de aba; qualquer outro valor (inclusive lixo na URL)
  // cai em Pendentes — a caixa de entrada é o default e o fallback.
  const aba = abaBruta === "historico" && painel != null ? "historico" : "pendentes"

  const categoria = (CATEGORIAS_NOTIFICACAO as readonly string[]).includes(categoriaBruta ?? "")
    ? (categoriaBruta as CategoriaNotificacao)
    : "todas"

  const contagem = contarPorCategoria(todas)
  const visiveis = agruparSemelhantes(filtrarPorCategoria(todas, categoria))

  const criticas = visiveis.filter((n) => n.nivel === "critica")
  const importantes = visiveis.filter((n) => n.nivel === "importante")
  const informativas = visiveis.filter((n) => n.nivel === "informativa")

  // Como os links se compõem: o de CATEGORIA preserva a aba (filtrar não é
  // trocar de assunto), o de ABA não preserva a categoria — trocar de aba
  // limpa o filtro de propósito: o Histórico não filtra por categoria, então
  // um `?categoria=` sobrevivente na URL seria estado fantasma que voltaria
  // a filtrar Pendentes sem ninguém ter pedido. A rota ACEITA os dois juntos
  // (`?aba=historico&categoria=x` não quebra — o histórico só ignora a
  // categoria); os links é que não geram essa combinação.
  const linkCategoria = (valor: CategoriaNotificacao | "todas") => {
    const params = new URLSearchParams()
    if (aba !== "pendentes") params.set("aba", aba)
    if (valor !== "todas") params.set("categoria", valor)
    const query = params.toString()
    return query ? `/notificacoes?${query}` : "/notificacoes"
  }

  const filtros: { valor: CategoriaNotificacao | "todas"; rotulo: string; total: number }[] = [
    { valor: "todas", rotulo: "Todas", total: todas.length },
    ...CATEGORIAS_NOTIFICACAO.map((c) => ({
      valor: c,
      rotulo: ROTULO_CATEGORIA_NOTIFICACAO[c],
      total: contagem[c],
    })),
  ]

  // Histórico do que já foi disparado — só quando a aba pede. A RLS de
  // `alertas_enviados` passou a respeitar a matriz na migration 045 — antes
  // qualquer pessoa com vínculo lia o título de todo alerta, inclusive de
  // hubs que ela não pode ver.
  let enviados: Pick<AlertaEnviado, "id" | "titulo" | "janela" | "enviado_em">[] = []
  if (aba === "historico" && painel) {
    const { data } = await supabase
      .from("alertas_enviados")
      .select("id, titulo, janela, enviado_em")
      .eq("embarcacao_id", painel.embarcacao.id)
      .order("enviado_em", { ascending: false })
      .limit(20)
    enviados = data ?? []
  }

  return (
    <main>
      <h1 className="titulo-pagina">Avisos</h1>
      <p className="apoio mt-1 text-dim">
        Você só recebe aviso das áreas a que tem acesso.
      </p>

      {/* O sublinhado dourado da aba ativa é indicador de NAVEGAÇÃO — fora
          do orçamento de dois dourados da tela (DESIGN §5, regra refinada na
          onda 60). O único dourado de CONTEÚDO aqui é o chip de categoria
          ativo, em Pendentes. */}
      <Abas
        className="mt-4"
        ativa={aba}
        abas={[
          // A contagem da aba é a CAIXA INTEIRA, sem filtro e sem
          // agrupamento — a mesma régua do chip "Todas" logo abaixo, e a
          // mesma aritmética que o cartão mostra ("+2 semelhantes" somam).
          // Com `visiveis.length` o número encolhia junto do filtro de
          // categoria, mas o href da aba limpa o filtro: o número prometia
          // um tanto e o clique mostrava outro. O sino usa OUTRA régua de
          // propósito (só o que pede ação, spec §3.3): ele mede urgência,
          // a aba mede volume.
          { valor: "pendentes", rotulo: "Pendentes", href: "/notificacoes", contagem: todas.length },
          // Sem embarcação não há histórico de alerta de embarcação — e uma
          // aba que abriria sempre vazia é pior que a ausência dela (§24).
          ...(painel
            ? [{ valor: "historico", rotulo: "Histórico", href: "/notificacoes?aba=historico" }]
            : []),
        ]}
      />

      {aba === "historico" ? (
        /* A aba já diz "Histórico" — repetir "Histórico de avisos" num
           cabeçalho de seção logo abaixo seria moldura fazendo o trabalho do
           conteúdo (spec §3.2), então o bloco entra sem `SecaoPagina`. */
        <div className="sombra-1 mt-4 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
          {enviados.length === 0 && (
            <EstadoVazio
              variant="linha"
              icone="calendario"
              titulo="Nenhum aviso enviado ainda"
              descricao="Quando algo entrar na margem, você recebe aqui e no aparelho."
            />
          )}
          {enviados.map((a) => (
            <div key={a.id} className="border-b border-line py-3 last:border-0">
              <p className="titulo-card">{a.titulo}</p>
              {/* `.rotulo-dado` — mesmo piso de 11px, pela escala: é legenda
                  de um valor dentro de um cartão, que é exatamente o papel
                  que a onda 79 criou essa classe para cobrir. */}
              <p className="rotulo-dado mt-0.5 font-mono-instr tabular-nums">
                {formatarCarimbo(a.enviado_em)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="mt-4">
            <TarjaPushDesligado />
          </div>

          <ChipLinha className="mt-4">
            {filtros.map((f) => (
              <Chip key={f.valor} href={linkCategoria(f.valor)} ativo={categoria === f.valor}>
                {f.rotulo}
                {/* A contagem é número: fica em mono tabular mesmo com o rótulo
                    em sans — é exatamente a divisão que o app faz em toda lista. */}
                {f.total > 0 && <span className="ml-1.5 font-mono-instr tabular-nums">{f.total}</span>}
              </Chip>
            ))}
          </ChipLinha>

          {visiveis.length === 0 && (
            categoria === "todas" ? (
              /* Zero é uma resposta boa (spec §3.2): a caixa de entrada
                 EXISTE pra ficar vazia, então o vazio sem filtro é boa
                 notícia, não lápide — e sem decoração (DESIGN.md §6 regra 4).
                 "Verificado agora" é literal: a lista é calculada ao vivo
                 nesta requisição (`carregarNotificacoes`) — por isso a frase
                 dispensa carimbo de hora. */
              /* Achado 3.5 da auditoria de 19/08. A frase dizia "Críticas e
                 importantes chegam aqui E NO APARELHO", e o push não cobre nem
                 metade disso: o cron (`app/api/alertas/disparar`) varre
                 `itens_monitorados`, boletim de mar e motor parado, e a onda 99
                 acrescentou o pedido novo do Marketplace
                 (`lib/avisos/marketplace.ts`). Agenda, Financeiro e o resto do
                 Marketplace são in-app puro — o próprio código já dizia isso em
                 voz alta (`lib/consultas.ts:537`), só a tela é que não tinha
                 sido atualizada. Nem ocorrência crítica aberta vira push,
                 embora `nivelDaOcorrencia` a classifique como crítica. A frase
                 agora lista o que de fato chega no celular, porque é isso que
                 decide se a pessoa continua conferindo esta tela. */
              <EstadoVazio
                icone="escudo"
                titulo="Nenhuma pendência"
                descricao="Verificado agora. Vencimentos, motor parado, alertas do mar e pedidos novos do Marketplace também chegam no aparelho — o resto aparece só aqui."
                className="mt-6"
              />
            ) : (
              /* Com filtro ativo o vazio é da categoria: diz o que o app
                 cobre (ou ainda não cobre) naquela área. */
              <EstadoVazio
                icone="escudo"
                titulo="Nenhum aviso por aqui"
                descricao={VAZIO_CATEGORIA_NOTIFICACAO[categoria]}
                className="mt-6"
              />
            )
          )}

          {criticas.length > 0 && (
            <>
              <SecaoPagina icone="alerta">Críticas — {criticas.length}</SecaoPagina>
              <div className="space-y-2">
                {criticas.map((n) => <CartaoNotificacao key={n.id} n={n} />)}
              </div>
            </>
          )}

          {/* Sem crítica nenhuma e com importantes, o `<details>` de
              importantes nasce aberto: caixa de entrada sem nada em destaque
              e com o trabalho escondido atrás de um clique seria PIOR que a
              tela antiga — a pessoa veria "Importantes 3" fechado, leria
              como "nada urgente" e iria embora sem ver os três. */}
          {importantes.length > 0 && (
            <NivelRecolhido
              rotulo="Importantes"
              itens={importantes}
              aberto={criticas.length === 0}
            />
          )}

          {/* Mesma regra descendo um degrau: se informativas são TUDO que
              há, elas abrem — senão a tela inteira vira dois títulos
              fechados e a pessoa sai achando que não havia nada. */}
          {informativas.length > 0 && (
            <NivelRecolhido
              rotulo="Informativas"
              itens={informativas}
              aberto={criticas.length === 0 && importantes.length === 0}
            />
          )}
        </>
      )}
    </main>
  )
}
