import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Icone, type NomeIcone } from "@/components/icone"
import { Logo } from "@/components/logo"
import { RotaPorCalado } from "@/components/landing/rota-por-calado"
import { VencePrimeiro } from "@/components/landing/vence-primeiro"
import { asaasConfigurado } from "@/lib/asaas"
import { DIAS_REGULARIZACAO_VERIFIED } from "@/lib/domain/verified"
import { ABAS } from "@/lib/domain/permissoes"
import { formatarPreco, PLANOS } from "@/lib/domain/planos"
import { LIMITES_FREE } from "@/lib/domain/plano-acesso"
import { temCookieDeSessao } from "@/lib/seguranca/rotas-publicas"
import { TOQUE, TOQUE_AMPLO } from "@/lib/ui/acoes"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * A VITRINE — REESCRITA EM 19/08/2026, COM TRÊS ACUSAÇÕES DO DONO NA MÃO.
 * ===========================================================================
 * *"essa merda de landing page retrógrada que não tem 1/4 do que nosso app
 * disponibiliza e está com cara de IA — quero uma landing page séria e
 * interativa com nossas features de forma inteligente"*
 *
 * As três acusações são verificáveis, e cada uma tem uma resposta estrutural:
 *
 * 1. DESATUALIZADA. A página anterior vendia três coisas (avisos, diário,
 *    comandantes) de um app que hoje faz navegação por água com calado,
 *    marketplace com aviso ao prestador, selos, cotas, pátio, permissão em 15
 *    áreas e relatório em PDF. A seção "A vida do barco" cobre a extensão em
 *    QUATRO ATOS — antes de sair, no mar, depois que atraca, quem cuida junto
 *    — porque despejar sessenta funcionalidades numa lista seria virar o mesmo
 *    depósito que ele reclamou do app.
 *
 * 2. CARA DE IA. O `docs/DESIGN.md` §1 nomeia o padrão: decoração distribuída
 *    em vez de sistema, cartão para tudo, ícone em toda linha, tudo com o
 *    mesmo peso. Esta página tem UM ícone por ato (quatro na página inteira),
 *    nenhum cartão fora dos planos e do demo, e um assunto por seção. A
 *    personalidade vem de uma decisão só — a carta náutica do herói — e todo o
 *    resto se cala para ela funcionar (§4).
 *
 * 3. SEM INTERAÇÃO. Há duas, e as duas ENSINAM em vez de enfeitar
 *    (`components/landing/rota-por-calado.tsx` e `vence-primeiro.tsx`). A
 *    primeira roda o A* de verdade sobre a máscara de costa e a grade de
 *    profundidade reais; a segunda roda `calcularSemaforo` do domínio. Nenhuma
 *    das duas é vídeo, GIF ou mock.
 *
 * ---------------------------------------------------------------------------
 * AS CINCO AFIRMAÇÕES FALSAS QUE ESTAVAM AQUI, E O QUE FOI FEITO DE CADA UMA
 * ---------------------------------------------------------------------------
 * Todas medidas em `docs/auditoria/2026-08-19-produto-promessa-x-entrega.md`.
 *
 * · "Concierge de bordo: a equipe monta o dossiê do seu barco com você" —
 *   APAGADA. `concierge` tinha uma única ocorrência em todo o repositório: esta
 *   linha. Nenhuma tela, formulário, canal ou tabela. Era promessa de trabalho
 *   humano feita a quem está decidindo pagar.
 * · "Mais escolhido" no plano Commander — APAGADA. `select count(*) from
 *   assinaturas` = 0. É a mesma doença do contador "restam 100 de 100 vagas de
 *   fundador" que a onda 47 aposentou, na mesma página, sobrevivendo à
 *   cirurgia. O rótulo agora é "Recomendado", que é uma opinião nossa
 *   declarada como tal, não uma contagem inventada.
 * · "Contrate comandantes … direto na plataforma" — CORRIGIDA. A tela
 *   `/comandantes` diz, letra por letra, "para contratar direto pelo WhatsApp",
 *   e `perfis_comandante` = 0. O que a página descreve agora é o fluxo que
 *   EXISTE: pedido no Marketplace, candidatura, confirmação das duas partes.
 * · "Cruzamos horas de motor com prazos de documento" — CORRIGIDA, e virou a
 *   segunda interação. Documento não tem `intervaloHoras` no domínio; o
 *   cruzamento real acontece DENTRO do mesmo item. `VencePrimeiro` mostra isso
 *   acontecendo com a função do app.
 * · "O dossiê do seu barco" (o H1) — TROCADA. `grep dossi` em todo o `web/`:
 *   zero rota, zero botão, zero action. O PDF que existe (`/barco/resumos`) é
 *   custo e uso do período — não sai nele nem o nome do estaleiro. A palavra
 *   prometia um documento que não existe.
 *   FICA A DÍVIDA: `app/layout.tsx` (title, description, twitter), `app/manifest.ts`
 *   e `app/termos/page.tsx` ainda dizem "dossiê" e estão fora do alcance desta
 *   onda. Estão no relatório.
 *
 * ---------------------------------------------------------------------------
 * ONDA 103 — A PÁGINA DEIXA DE PAGAR UMA IDA À REDE POR VISITANTE ANÔNIMO
 * ---------------------------------------------------------------------------
 * O `redirect("/hoje")` de quem já está logado custava um `getUser()` — uma
 * volta até o servidor de autenticação — em TODA visita, inclusive a de quem
 * nunca teve conta, que é a maioria absoluta do público de uma vitrine. A
 * função roda em Washington e o banco em São Paulo: ~150 ms no caminho crítico
 * da primeira impressão.
 *
 * `temCookieDeSessao` (`lib/seguranca/rotas-publicas.ts`) já existe, tem teste
 * e responde de graça a UMA pergunta: "certamente NÃO há sessão?". Sem cookie
 * não existe sessão possível. Quem TEM cookie continua sendo validado no
 * servidor — cookie forjado não entra em lugar nenhum; o que muda é quantas
 * vezes a validação precisa ser paga.
 */
const CTA = `inline-flex h-12 items-center justify-center rounded-[var(--raio-controle)] bg-accent px-6 text-center text-base font-semibold text-acao-texto ${TOQUE_AMPLO}`
const CTA_CONTORNO = `inline-flex h-12 items-center justify-center rounded-[var(--raio-controle)] border border-line px-6 text-center text-base font-semibold text-texto ${TOQUE_AMPLO}`

/**
 * A EXTENSÃO DO APP, AGRUPADA PELA VIDA DO BARCO — NÃO PELO MENU.
 *
 * Quatro atos, e a ordem é a do dia de quem usa: preparar, navegar, registrar,
 * dividir com quem cuida junto. O menu do app tem outra ordem (é a de
 * `docs/superpowers/specs/2026-08-19-arquitetura-quatro-apps.md` §2) e não
 * serve aqui: quem ainda não é cliente não conhece nomes de tela, conhece o
 * dia dele.
 *
 * CADA LINHA FOI CONFERIDA CONTRA O CÓDIGO. Onde a auditoria de 19/08 achou
 * distância entre a promessa e a entrega, a linha ficou de fora — a lista do
 * que NÃO está aqui, e por quê, está no relatório da onda.
 */
const ATOS: { icone: NomeIcone; ordem: string; titulo: string; tese: string; itens: string[] }[] = [
  {
    icone: "embarcacao",
    ordem: "01",
    titulo: "Antes de soltar a amarra",
    tese: "O estado do barco em uma tela, sem abrir gaveta nem ligar para o mecânico.",
    itens: [
      "Ficha técnica em oito hubs: motores, casco, elétrica, hidráulica, segurança, equipamentos, documentos e manutenções.",
      "Semáforo por item monitorado, com as duas contagens — horas e calendário — correndo juntas.",
      "Aviso no aparelho a 30, 15 e 5 dias do vencimento, e no dia. Também quando o mar vira e quando o motor fica tempo demais parado.",
      "Saúde por setor, e nada fica verde por falta de informação: sem dado, o app diz que não sabe.",
      "Ocorrências abertas e resolvidas, com o nível de cada uma.",
      "Checklist de saída, para o que se confere sempre.",
    ],
  },
  {
    icone: "mapa",
    ordem: "02",
    titulo: "No mar",
    tese: "A navegação e a ficha do barco no mesmo aplicativo — é isto que não existe em outro lugar.",
    itens: [
      "Rota traçada pela água, contornando a costa numa malha de 100 metros por célula.",
      "Profundidade e calado: a rota recusa passar onde o seu barco não passa, e prefere água mais funda quando o desvio é barato.",
      "Corredores: a trilha real dos barcos que já passaram vira preferência de rota para os próximos.",
      "Modo navegando, alarme de âncora e homem ao mar.",
      "Maré estimada e vento na tela, sempre rotulados como estimativa, com link para a tábua oficial.",
      "A sonda de bordo entra no app pela rede da embarcação, no iPhone e no Android.",
    ],
  },
  {
    icone: "documento",
    ordem: "03",
    titulo: "Depois que atraca",
    tese: "O que aconteceu fica registrado sozinho — e continua com o barco.",
    itens: [
      "Diário de bordo com a trilha de GPS gravada dentro dele, com importação e exportação em GPX.",
      "Fotos em álbuns, por embarcação.",
      "Financeiro com lançamentos, despesas recorrentes e custo por hora de motor.",
      "Resumos por mês, semestre e ano: gastos, uso e o seu ano no mar.",
      "Exportação em PDF do resumo do período.",
      "Histórico de manutenções e de serviços de mecânica, com orçamento.",
    ],
  },
  {
    icone: "pessoas",
    ordem: "04",
    titulo: "Quem cuida do barco com você",
    tese: "Comandante, tripulação, cotista e prestador — cada um enxergando só o que lhe cabe.",
    itens: [
      `Convite por link, com permissão em ${ABAS.length} áreas, separadas em ver e editar.`,
      "Carteira da tripulação, com saldo e devolução.",
      "Agenda em mês, semana e lista.",
      "Marketplace com cinco tipos de pedido: serviço, tripulação, produto, vaga e caminhão.",
      "Quem atende aquela categoria na sua região é avisado quando surge um pedido compatível.",
      "A conversa acontece dentro do app. Ninguém vê o seu telefone só por ler o pedido.",
    ],
  },
]

/**
 * O FOSSO, EM AFIRMAÇÕES QUE SE CONFEREM — E SEM CITAR CONCORRENTE PELO NOME.
 *
 * As três saem de `docs/auditoria/2026-08-19-concorrentes-*.md`, e cada número
 * foi MEDIDO, não estimado: a contagem de ocorrências veio da leitura do bundle
 * publicado, a cobertura de maré veio do nome do próprio módulo do produto
 * estrangeiro, a ausência de vistoria veio de varredura em seis produtos.
 * Nenhuma alegação de concorrente ("1000+ embarcações", "10.8K reviews") entra
 * aqui — nenhuma delas foi confirmada, e repetir número alheio sem base é
 * exatamente o que esta página acabou de parar de fazer com os próprios.
 */
const SO_AQUI: { titulo: string; corpo: string }[] = [
  {
    titulo: "Rota pela água, com o seu calado",
    corpo:
      "Nenhum aplicativo brasileiro de gestão de embarcação traça rota. Conferimos o código publicado do mais próximo de nós: profundidade, batimetria, calado, waypoint, sondagem e rota aparecem zero vez.",
  },
  {
    titulo: "Vistoria pedida pelo dono",
    corpo:
      "Nenhum app de gestão náutica do mercado tem selo ou vistoria. As ferramentas que existem lá fora são feitas para o vistoriador, e o selo de seminovo é vendido ao revendedor — nunca ao dono do barco.",
  },
  {
    titulo: "Maré daqui",
    corpo:
      "O líder mundial de navegação não vende assinatura da região Brasil, e o app de carta mais usado por aqui traz maré e corrente só da América do Norte e da Oceania. A nossa é estimativa de modelo, e está escrito na tela.",
  },
]

/** ISO curto (`AAAA-MM-DD`) — o formato que `lib/domain/semaforo.ts` lê. */
function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default async function LandingPage() {
  // O atalho: sem cookie de sessão não há sessão possível, e a pergunta ao
  // servidor de autenticação é pura despesa. Ver o comentário longo no topo.
  const biscoitos = await cookies()
  if (temCookieDeSessao(biscoitos.getAll())) {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) redirect("/hoje")
  }

  // As datas da segunda demonstração nascem AQUI, no servidor, e descem por
  // prop: `new Date()` dentro do componente cliente divergiria do HTML do
  // servidor na virada do dia, e hidratação divergente em página pública é
  // erro de console em produção. Ver `components/landing/vence-primeiro.tsx`.
  const agora = new Date()
  const hoje = iso(agora)
  const extintoresEm = iso(new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate() + 12)))
  // Vinte e quatro meses antes de daqui a 45 dias: somado ao intervalo de 24
  // meses do item, cai 45 dias à frente e dá à contagem de calendário uma
  // folga maior que a de horas — que é o contraste que a peça ensina.
  const ultimoImpelidor = iso(
    new Date(Date.UTC(agora.getUTCFullYear() - 2, agora.getUTCMonth(), agora.getUTCDate() + 45)),
  )

  // A landing não pode vender contratação quando a cobrança não está ligada —
  // `/assinar` já se comporta assim (`assinar/page.tsx`), e era a página
  // pública a única que mostrava preço e "Começar agora" em qualquer cenário.
  // Leitura de variável de ambiente: zero ida à rede.
  const cobrancaLigada = asaasConfigurado()

  return (
    <div className="bg-ink text-texto">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-2">
          <Logo compacto />
          <span className="rotulo">Commander</span>
        </div>
        {/* `min-h-11`: é a única saída do topo da página, e alvo de 21px de
            altura não é alvo (docs/DESIGN.md §5). */}
        <Link href="/login" className={`corpo inline-flex min-h-11 items-center font-medium text-dim hover:text-texto ${TOQUE}`}>
          Entrar
        </Link>
      </header>

      {/* ===================================================================
          HERÓI — A DECISÃO ASSUMIDA DA PÁGINA (docs/DESIGN.md §4)
          ===================================================================
          Uma decisão grande, não sete médias. Aqui ela é a carta náutica com o
          A* rodando: é o que o produto tem de mais característico e o que
          nenhum concorrente daqui tem. Todo o resto da página é instrumento e
          se comporta como instrumento.

          O H1 sai em 24px no celular e 32 no resto — os degraus H1 e Display XL
          do HAULIX §08–11. O tamanho é escrito à mão, e não pela classe
          `.titulo-pagina`, por um motivo mecânico: a utilitária crava
          `font-size: 1.5rem` e, por vir depois no CSS em cascade layers, vence
          qualquer `sm:text-[32px]` na mesma tag. Peso, entrelinha e aperto
          replicam a voz dela — é a mesma classe, num corpo maior, não uma voz
          nova. (A página anterior fazia o mesmo em 36/48/60px: aqui o teto
          desce para o degrau que o documento declara, porque "tipografia
          superdimensionada" está na lista do §58 do que não fazer.) */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-16 pt-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:pb-24 lg:pt-16">
        <div>
          <p className="rotulo text-dim">Navegação e ficha do barco no mesmo app</p>
          <h1 className="mt-3 text-2xl font-[650] leading-[1.25] tracking-[-0.022em] text-balance sm:text-[32px]">
            A rota passa onde o seu barco passa.
          </h1>
          <p className="corpo mt-4 max-w-md text-dim">
            O Commander traça a rota pela água — contornando a costa, não o mapa de ruas — e recusa o caminho
            onde o seu calado não cabe. É o mesmo aplicativo que guarda a manutenção, os prazos e o histórico
            da embarcação.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/login" className={CTA}>
              Criar conta grátis
            </Link>
            <a href="#planos" className={CTA_CONTORNO}>
              Ver planos
            </a>
          </div>
          <p className="apoio mt-4 text-dim">
            Arraste o calado ao lado. A rota é recalculada no seu aparelho, com a mesma malha de costa que o
            app usa.
          </p>
        </div>
        <RotaPorCalado />
      </section>

      {/* ===================================================================
          A EXTENSÃO — "não tem 1/4 do que nosso app disponibiliza"
          ===================================================================
          Quatro colunas densas, sem cartão e sem ícone por linha. A régua é a
          do §5 do docs/DESIGN.md: densidade é respeito, e informação espalhada
          em cartões arejados obriga a rolar. Um ícone por ATO — quatro na
          página inteira — porque ícone em toda linha é a assinatura visual que
          o §1 nomeia. */}
      <section className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
        <h2 className="titulo-secao">A vida do barco, do começo ao fim</h2>
        <p className="corpo mt-2 max-w-xl text-dim">
          O que o Commander faz, na ordem em que o dia acontece.
        </p>
        <div className="mt-10 grid gap-10 sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-4">
          {ATOS.map((ato) => (
            <div key={ato.ordem}>
              <div className="flex items-center gap-2 border-b border-line pb-3">
                <Icone nome={ato.icone} className="size-4 shrink-0 text-dim" />
                <span className="rotulo tabular-nums text-dim">{ato.ordem}</span>
              </div>
              <h3 className="titulo-card mt-3">{ato.titulo}</h3>
              <p className="corpo mt-1.5 text-dim">{ato.tese}</p>
              <ul className="mt-4 space-y-2.5">
                {ato.itens.map((item) => (
                  <li key={item} className="apoio text-dim">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ===================================================================
          A SEGUNDA DEMONSTRAÇÃO — E A CORREÇÃO DE UMA FRASE FALSA
          =================================================================== */}
      <section className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <p className="rotulo text-dim">Manutenção</p>
            <h2 className="titulo-secao mt-2">O que vence primeiro</h2>
            <p className="corpo mt-3 text-dim">
              Uma revisão pode vencer a cada 300 horas de motor <em>ou</em> a cada 24 meses — as duas
              contagens correm ao mesmo tempo, dentro do mesmo item. O Commander acompanha as duas e assume
              sempre a pior, para você nunca descobrir na doca.
            </p>
            <p className="corpo mt-3 text-dim">
              Arraste o horímetro. A lista se reordena sozinha, porque é assim que a tela de hoje decide o que
              você precisa ver antes.
            </p>
          </div>
          <VencePrimeiro hoje={hoje} extintoresEm={extintoresEm} ultimoImpelidor={ultimoImpelidor} />
        </div>
      </section>

      {/* ===================================================================
          O FOSSO + OS SELOS — um assunto, duas metades
          =================================================================== */}
      <section className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
        <h2 className="titulo-secao">Três coisas que só existem aqui</h2>
        <dl className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-3">
          {SO_AQUI.map((s) => (
            <div key={s.titulo} className="border-t border-line pt-4">
              <dt className="titulo-card">{s.titulo}</dt>
              <dd className="corpo mt-2 text-dim">{s.corpo}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-12 grid gap-8 border-t border-line pt-8 sm:grid-cols-2 sm:gap-x-8">
          <div>
            <h3 className="titulo-card">Commander Verified</h3>
            <p className="corpo mt-2 text-dim">
              Cinco critérios que o próprio app confere no seu barco: motores cadastrados, manutenções
              acompanhadas, segurança cadastrada, documentação acompanhada e histórico ativo. Se algum deixar
              de ser atendido, o selo entra em prazo de regularização de {DIAS_REGULARIZACAO_VERIFIED} dias —
              acompanhe na tela do selo.
            </p>
          </div>
          <div>
            <h3 className="titulo-card">Commander Gold</h3>
            <p className="corpo mt-2 text-dim">
              Vistoria presencial, feita por um consultor, contratada pelo dono e com preço por faixa de porte
              da embarcação. É o selo que existe porque uma promessa conferida por gente vale mais que uma
              conferida por software.
            </p>
          </div>
        </div>
      </section>

      {/* ===================================================================
          PLANOS (PRD FINAL §2)
          =================================================================== */}
      <section id="planos" className="mx-auto max-w-4xl px-6 py-14 sm:py-20">
        <div className="text-center">
          <p className="rotulo text-dim">Planos</p>
          <h2 className="titulo-secao mt-2">Comece de graça. Pague quando fizer sentido.</h2>
          <p className="corpo mx-auto mt-3 max-w-md text-dim">
            Os avisos de vencimento e os alertas de segurança valem em qualquer plano, inclusive no gratuito —
            isso nunca fica atrás de assinatura.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-[var(--raio-painel)] border border-line bg-panel p-5">
            <p className="titulo-card">{PLANOS.proprietario_free.rotulo}</p>
            <p className="mt-3">
              <span className="valor-instrumento tabular-nums">Grátis</span>
            </p>
            <p className="corpo mt-2 text-dim">
              1 embarcação, {LIMITES_FREE.diarioRegistros} Diários de Bordo completos e o resto do app aberto
              para conhecer.
            </p>
          </div>
          {/* O único cartão com borda de acento da página. "Recomendado" é uma
              opinião nossa dita como opinião — o "Mais escolhido" que estava
              aqui era uma CONTAGEM, e a contagem é zero. */}
          <div className="relative rounded-[var(--raio-painel)] border border-accent/50 bg-panel p-5">
            <span className="rotulo absolute -top-3 right-4 rounded-[var(--raio-pilula)] bg-accent px-2.5 py-1 text-acao-texto">
              Recomendado
            </span>
            <p className="titulo-card">{PLANOS.commander.rotulo}</p>
            <p className="mt-3">
              <span className="valor-instrumento tabular-nums">
                {formatarPreco(PLANOS.commander.valorCentavos!)}
              </span>
              <span className="corpo text-dim"> /mês</span>
            </p>
            <p className="corpo mt-2 text-dim">{PLANOS.commander.regra}</p>
          </div>
          <div className="rounded-[var(--raio-painel)] border border-line bg-panel p-5">
            <p className="titulo-card">{PLANOS.commander_pro.rotulo}</p>
            <p className="mt-3">
              <span className="valor-instrumento tabular-nums">
                {formatarPreco(PLANOS.commander_pro.valorCentavos!)}
              </span>
              <span className="corpo text-dim"> /mês</span>
            </p>
            <p className="corpo mt-2 text-dim">{PLANOS.commander_pro.regra}</p>
          </div>
        </div>

        <ul className="mt-6 space-y-2.5">
          {[
            "Comece de graça: 1 embarcação com os hubs técnicos, os documentos e os avisos de vencimento.",
            "Cancele quando quiser: a conta volta ao gratuito e o que você registrou continua na sua conta.",
            "Sem comissão sobre nada que você contratar pelo Marketplace.",
          ].map((b) => (
            <li key={b} className="corpo flex items-start gap-2.5 text-dim">
              <Icone nome="check" className="mt-0.5 size-4 shrink-0 text-ok" />
              {b}
            </li>
          ))}
        </ul>

        <div className="mt-8 text-center">
          <Link href={cobrancaLigada ? "/login?volta=/assinar" : "/login"} className={`px-8 ${CTA}`}>
            {cobrancaLigada ? "Começar agora" : "Criar conta grátis"}
          </Link>
          {!cobrancaLigada && (
            <p className="apoio mt-3 text-dim">
              A contratação dos planos pagos abre em breve. A conta gratuita já funciona inteira.
            </p>
          )}
        </div>
      </section>

      <footer className="border-t border-line px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-2">
            <Logo compacto />
            <span className="apoio text-dim">Commander</span>
          </div>
          <p className="apoio text-dim">Feito no Rio de Janeiro</p>
          <Link href="/parceiros" className="apoio text-dim hover:text-texto">
            Para marinas, pousadas e restaurantes
          </Link>
          <a href="mailto:atendimento.smu@gmail.com" className="apoio text-dim hover:text-texto">
            atendimento.smu@gmail.com
          </a>
        </div>
        <div className="mx-auto mt-6 flex max-w-6xl flex-col items-center gap-3 text-center sm:flex-row sm:justify-center sm:gap-4">
          <Link href="/termos" className="apoio text-dim hover:text-texto">
            Termos de Uso
          </Link>
          <span className="apoio text-dim/50" aria-hidden="true">·</span>
          <Link href="/privacidade" className="apoio text-dim hover:text-texto">
            Política de Privacidade
          </Link>
        </div>
        <p className="apoio mt-6 text-center text-dim/70">© {new Date().getFullYear()} Commander</p>
      </footer>
    </div>
  )
}
