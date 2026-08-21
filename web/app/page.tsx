import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Icone, type NomeIcone } from "@/components/icone"
import { Logo } from "@/components/logo"
import { ObjetoHub } from "@/components/ui/objeto-hub"
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
      "Ficha técnica: oito hubs, de motores a documentos.",
      "Semáforo por item: horas e calendário correndo juntos.",
      "Avisos no aparelho: 30, 15 e 5 dias antes do vencimento, e no dia.",
      "Saúde por setor: sem dado, o app diz que não sabe. Nada fica verde à toa.",
      "Ocorrências: abertas e resolvidas, com o nível de cada uma.",
      "Checklist de saída: o que se confere sempre.",
    ],
  },
  {
    icone: "mapa",
    ordem: "02",
    titulo: "No mar",
    tese: "Navegação e ficha do barco no mesmo aplicativo. É isto que não existe em outro lugar.",
    itens: [
      "Rota pela água: contorna a costa numa malha de 100 metros.",
      "Calado: a rota recusa passar onde o seu barco não passa.",
      "Corredores: a trilha real de quem já passou vira preferência de rota.",
      "A bordo: modo navegando, alarme de âncora e homem ao mar.",
      "Tempo: maré estimada e vento na tela, com link para a tábua oficial.",
      "Sonda: a profundidade do seu barco entra pela rede da embarcação.",
    ],
  },
  {
    icone: "documento",
    ordem: "03",
    titulo: "Depois que atraca",
    tese: "O que aconteceu fica registrado sozinho. E continua com o barco.",
    itens: [
      "Diário de bordo: a trilha do GPS gravada dentro dele, em GPX.",
      "Fotos: álbuns por embarcação.",
      "Financeiro: lançamentos, recorrentes e custo por hora de motor.",
      "Resumos: mês, semestre e ano, com exportação em PDF.",
      "Seu ano no mar: milhas, horas e saídas, contadas da trilha real.",
      "Manutenções: histórico completo, com orçamento de serviço.",
    ],
  },
  {
    icone: "pessoas",
    ordem: "04",
    titulo: "Quem cuida do barco com você",
    tese: "Comandante, tripulação, cotista e prestador. Cada um enxerga só o que lhe cabe.",
    itens: [
      `Convite por link: permissão em ${ABAS.length} áreas, separadas em ver e editar.`,
      "Carteira da tripulação: saldo e devolução.",
      "Agenda: mês, semana e lista.",
      "Marketplace: serviço, tripulação, produto, vaga e caminhão.",
      "Aviso certeiro: quem atende a categoria na sua região fica sabendo do pedido.",
      "Conversa no app: ninguém vê o seu telefone só por ler o pedido.",
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
      "Nenhum app de gestão náutica do mercado tem selo ou vistoria. As ferramentas que existem lá fora são feitas para o vistoriador, e o selo de seminovo é vendido ao revendedor, nunca ao dono do barco.",
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
          HERÓI — O PRODUTO APARECE NO PRIMEIRO SEGUNDO (onda 129)
          ===================================================================
          Diagnóstico do dono, 20/08: "a landing destoa totalmente da estética
          visual do nosso app". Tinha razão, e a causa não era token — era
          LINGUAGEM: o herói abria com o demo do A* (uma caixa escura escrita
          "lendo a malha de costa…" e jargão de célula) antes de mostrar UM
          pixel do produto. O demo é diferencial real e CONTINUA na página —
          três seções abaixo, depois que a pessoa viu o que está comprando.
          O herói agora é o do app: o iate em render com as bordas esvaídas
          (`mascara-borda-esvaida`, a mesma assinatura da Início e do Diário).

          O H1 sobe para 32/40 — o Display XL, topo da escala declarada. A
          vitrine é o ÚNICO lugar do produto que usa esse degrau (dentro do
          app o teto de tela é 24): aqui ele é manchete, não título de tela.
          Escrito à mão pelo motivo mecânico de sempre: `.titulo-pagina` crava
          1.5rem em cascade layer e venceria o `sm:`. */}
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-6 pb-12 pt-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-16 lg:pt-12">
        <div>
          <p className="rotulo text-dim">Navegação e ficha do barco no mesmo app</p>
          <h1 className="mt-3 text-[32px] font-[650] leading-[1.15] tracking-[-0.022em] text-balance sm:text-[40px]">
            A rota passa onde o seu barco passa.
          </h1>
          <p className="corpo mt-4 max-w-md text-dim">
            O Commander traça a <strong className="font-semibold text-texto">rota pela água</strong>,
            não pelo mapa de ruas. Recusa o caminho onde o{" "}
            <strong className="font-semibold text-texto">seu calado não passa</strong>. E é o mesmo
            aplicativo que guarda a manutenção, os prazos e o histórico da embarcação.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/login" className={CTA}>
              Criar conta grátis
            </Link>
            <a href="#planos" className={CTA_CONTORNO}>
              Ver planos
            </a>
          </div>
        </div>
        {/* O iate esvaindo pro fundo — sem moldura, sem legenda: é atmosfera,
            e o `aria-hidden` do ObjetoHub já o tira do leitor de tela. */}
        <div className="mascara-borda-esvaida relative h-56 sm:h-72 lg:h-80">
          <ObjetoHub chave="iate" className="h-full w-full !rounded-none" />
        </div>
      </section>

      {/* ===================================================================
          AS TELAS DE VERDADE — a vitrine mostra o produto, não o descreve
          ===================================================================
          Três capturas REAIS, gravadas pela prova visual do repositório (os
          mesmos PNGs que o robô fotografa a cada onda, copiados para
          `public/imagens/landing/`). Zero mock desenhado à mão: quando o app
          muda, a próxima cópia da prova atualiza a vitrine — e a landing
          nunca mais mente sobre o produto (a lição do mock falso que a onda
          103 apagou). Moldura mínima de aparelho: raio grande + borda da
          casa; fileira rolável no celular, a régua de toda fileira. */}
      <section className="mx-auto max-w-6xl px-6 pb-14 sm:pb-20">
        <div className="rolagem-lateral flex snap-x gap-4 overflow-x-auto pb-2 lg:grid lg:grid-cols-3 lg:gap-6" style={{ scrollbarWidth: "none" }}>
          {[
            { src: "/imagens/landing/tela-inicio.png", alt: "Tela Início do Commander: carrossel de fotos do barco, saúde e diário" },
            { src: "/imagens/landing/tela-motores.png", alt: "Hub Motores: horímetros, manutenções e alertas em abas" },
            { src: "/imagens/landing/tela-diario.png", alt: "Diário de Bordo: linha do tempo de saídas, abastecimentos e avarias" },
          ].map((tela) => (
            <div key={tela.src} className="w-60 shrink-0 snap-center overflow-hidden rounded-[28px] border border-line bg-panel p-1.5 sombra-1 lg:w-auto">
              {/* eslint-disable-next-line @next/next/no-img-element -- captura estática da prova visual */}
              <img src={tela.src} alt={tela.alt} loading="lazy" className="w-full rounded-[22px]" />
            </div>
          ))}
        </div>
      </section>

      {/* ===================================================================
          O DEMO DO CALADO — o diferencial continua, no lugar certo
          ===================================================================
          Era o herói; onda 129 o desceu para depois do produto. O argumento
          de engenharia convence DEPOIS que a estética abriu a porta — e
          aqui ele ganha o contexto que o herói não dava. */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-10 sm:py-14 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
        <div>
          <p className="rotulo text-dim">Navegação</p>
          <h2 className="titulo-secao mt-2">Arraste o calado. A rota desvia sozinha.</h2>
          <p className="corpo mt-3 max-w-md text-dim">
            Isto não é um vídeo. É o{" "}
            <strong className="font-semibold text-texto">cálculo real do app</strong> rodando agora no
            seu aparelho, com a mesma malha de costa e a mesma grade de profundidade.
          </p>
        </div>
        <RotaPorCalado />
      </section>

      {/* ===================================================================
          A EXTENSÃO — "não tem 1/4 do que nosso app disponibiliza"
          ===================================================================
          ONDA 129 — os quatro atos vestem o CARTÃO da casa. A versão anterior
          defendia colunas soltas ("densidade é respeito"), e a densidade
          fica; o que muda é a gramática: o app inteiro fala por cartões com
          borda e raio sobre o navy, e a vitrine falando por texto solto era
          exatamente o "destoa totalmente" que o dono nomeou. Um ícone por
          ATO continua — agora no medalhão circular do Diário, a moldura de
          ícone da casa. */}
      <section className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <h2 className="titulo-secao">A vida do barco, do começo ao fim</h2>
        <p className="corpo mt-2 max-w-xl text-dim">
          O que o Commander faz, na ordem em que o dia acontece.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ATOS.map((ato) => (
            <div key={ato.ordem} className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-panel2 text-dim">
                  <Icone nome={ato.icone} className="size-4" />
                </span>
                <span className="rotulo tabular-nums text-dim">{ato.ordem}</span>
              </div>
              <h3 className="titulo-card mt-3">{ato.titulo}</h3>
              <p className="corpo mt-1.5 text-dim">{ato.tese}</p>
              {/* ONDA 144 — "parece documento de Word": cada linha abre com a
                  palavra-chave em peso e cor de destaque, e o resto recua. O
                  dado (o que vem antes dos dois-pontos) vira o que o olho
                  varre; a explicação vira apoio. */}
              <ul className="mt-4 space-y-2.5">
                {ato.itens.map((item) => {
                  const corte = item.indexOf(": ")
                  return (
                    <li key={item} className="apoio text-dim">
                      {corte > 0 ? (
                        <>
                          <strong className="font-semibold text-texto">{item.slice(0, corte)}.</strong>{" "}
                          {item.slice(corte + 2)}
                        </>
                      ) : (
                        item
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ===================================================================
          COMPATIBILIDADE COM O BARCO — a capacidade existia e não era vendida
          ===================================================================
          Recomendação 14 da auditoria de 20/08, no dia em que o plugin foi
          publicado no npm (signalk-commander-connector@1.0.0): o app fala com
          a rede do barco por dois caminhos reais, e a vitrine agora diz isso.
          Sem logo de fabricante e sem a marca "NMEA 2000" (certificação paga
          — dizemos "compatível", como o dossiê do gateway documenta). */}
      <section className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <p className="rotulo text-dim">Conectado ao barco</p>
        <h2 className="titulo-secao mt-2">O Commander fala com a rede da sua embarcação.</h2>
        <p className="corpo mt-2 max-w-xl text-dim">
          Motor, bateria, profundidade e posição, direto dos instrumentos que o barco já tem.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-panel2 text-dim">
                <Icone nome="sinal" className="size-4" />
              </span>
              <h3 className="titulo-card">Tem Signal K a bordo?</h3>
            </div>
            <p className="corpo mt-3 text-dim">
              Instale o plugin{" "}
              <strong className="font-semibold text-texto">Commander Connector</strong> na App Store do
              seu servidor Signal K. Pronto:{" "}
              <strong className="font-semibold text-texto">o barco fala com a sua conta sozinho</strong>.
              Horas de motor, posição e bateria chegam mesmo com você longe. Você escolhe o que
              compartilha, e o código do plugin é aberto para qualquer pessoa auditar.
            </p>
          </div>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-panel2 text-dim">
                <Icone nome="motor" className="size-4" />
              </span>
              <h3 className="titulo-card">Garmin, Raymarine, Simrad, B&G</h3>
            </div>
            <p className="corpo mt-3 text-dim">
              Os instrumentos das grandes marcas publicam tudo na rede padrão do barco. Um{" "}
              <strong className="font-semibold text-texto">gateway Wi-Fi de bordo</strong> entrega
              esses dados ao Commander, e o{" "}
              <strong className="font-semibold text-texto">ecobatímetro que você já tem</strong> passa
              a alimentar o seu mapa de profundidade. Compatível com redes NMEA 2000; SeaTalk NG entra
              com um cabo adaptador.
            </p>
          </div>
        </div>
      </section>

      {/* ===================================================================
          A SEGUNDA DEMONSTRAÇÃO — E A CORREÇÃO DE UMA FRASE FALSA
          =================================================================== */}
      <section className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <p className="rotulo text-dim">Manutenção</p>
            <h2 className="titulo-secao mt-2">O que vence primeiro</h2>
            <p className="corpo mt-3 text-dim">
              Uma revisão pode vencer a cada 300 horas de motor <em>ou</em> a cada 24 meses. As duas
              contagens correm juntas, dentro do mesmo item. O Commander acompanha as duas e assume
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
      <section className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <h2 className="titulo-secao">Três coisas que só existem aqui</h2>
        {/* ONDA 129 — cartões da casa, mesma razão dos quatro atos acima. */}
        <dl className="mt-8 grid gap-4 sm:grid-cols-3">
          {SO_AQUI.map((s) => {
            // Onda 144 — a EVIDÊNCIA na frente: a primeira frase de cada
            // afirmação é o fato verificado, e sai em peso; o resto explica.
            const corte = s.corpo.indexOf(". ")
            const fato = corte > 0 ? s.corpo.slice(0, corte + 1) : s.corpo
            const resto = corte > 0 ? s.corpo.slice(corte + 2) : ""
            return (
              <div key={s.titulo} className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
                <dt className="titulo-card">{s.titulo}</dt>
                <dd className="corpo mt-2 text-dim">
                  <strong className="font-semibold text-texto">{fato}</strong> {resto}
                </dd>
              </div>
            )
          })}
        </dl>

        <div className="mt-10 grid gap-6 border-t border-line pt-8 sm:grid-cols-2 sm:gap-x-8">
          <div>
            <h3 className="titulo-card">Commander Verified</h3>
            <p className="corpo mt-2 text-dim">
              Cinco critérios que o próprio app confere no seu barco: motores cadastrados, manutenções
              acompanhadas, segurança cadastrada, documentação acompanhada e histórico ativo. Se algum
              deixar de ser atendido, o selo entra em prazo de regularização de{" "}
              {DIAS_REGULARIZACAO_VERIFIED} dias, com o andamento na tela do selo.
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
      <section id="planos" className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
        <div className="text-center">
          <p className="rotulo text-dim">Planos</p>
          <h2 className="titulo-secao mt-2">Comece de graça. Pague quando fizer sentido.</h2>
          <p className="corpo mx-auto mt-3 max-w-md text-dim">
            Os avisos de vencimento e os alertas de segurança valem em qualquer plano, inclusive no
            gratuito. <strong className="font-semibold text-texto">Segurança nunca fica atrás de assinatura.</strong>
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
