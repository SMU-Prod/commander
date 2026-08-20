import Link from "next/link"
import type { Equipamento, ItemMonitorado } from "@/lib/db/types"
import { itemMonitoradoToItemCalc } from "@/lib/domain/conversores"
import { nomeDoEquipamento } from "@/lib/domain/diario"
import { apoioDaRevisao, horasDoMotor } from "@/lib/domain/inicio"
import {
  calcularSemaforo, PESO, temInformacaoSuficiente,
  type ResultadoCalc, type StatusFarol,
} from "@/lib/domain/semaforo"
import { Avatar } from "./avatar"
import { Icone } from "./icone"
import { Logo } from "./logo"
import { SeletorEmbarcacao } from "./seletor-embarcacao"
import { ContadorAvisos } from "./ui/contador-avisos"

/**
 * ONDA 60 — A FAIXA DE TOPO DO DESKTOP (spec fundação §3.3, imagem 1 do
 * catálogo `docs/DESIGN-SYSTEM.md`).
 *
 * A peça que faltava da casca da onda 57: fora da Início, o desktop não
 * tinha nem o nome do barco nem o sino — o trilho carrega o contador, mas
 * contexto ("de QUAL barco esta tela fala") não existia em lugar nenhum a
 * partir de 1024px. A faixa põe, em toda tela: nome da embarcação (o
 * `SeletorEmbarcacao` quando houver mais de uma — §3.3), KPIs de motor,
 * sino e avatar. E, porque agora ELA carrega sino e nome no desktop, o
 * cabeçalho próprio da Início esconde os dele em `lg:` — antes eram dois
 * sinos e dois nomes empilhados na tela de casa.
 *
 * A RESTRIÇÃO QUE DECIDE TUDO AQUI: a faixa deriva CADA pedaço de dado do
 * que o layout de `(app)` JÁ carrega (`carregarPainel` + `avisos`) — zero
 * consulta nova por página. É por isso que Saúde e Documentos, que a imagem
 * 1 também mostra na fileira de KPIs, ficam DE FORA: os dois exigiriam a
 * consulta de ocorrências (saúde) em TODA página, um preço por navegação que
 * um enfeite de topo não paga. O ⚠️ parcial está anotado no catálogo.
 *
 * ELA MORA DENTRO DA `[data-moldura]` (via prop `faixa` da `MolduraApp`),
 * não em `fixed`: primeiro filho da caixa de conteúdo, herda o
 * `lg:pl-[88px]` do trilho e a largura máxima de graça — alinha com o
 * conteúdo, nunca passa por baixo do trilho — e, por estar NO FLUXO, o
 * conteúdo desce a altura dela sozinho: nada sobrepõe nada (a varredura a
 * 1440 continua limpa por construção).
 *
 * DOURADO: zero. A regra refinada desta onda diz que o dourado de MOLDURA é
 * só o de navegação (o onde-estou); a faixa nem disso precisa.
 *
 * ===========================================================================
 * ONDA 7 (mockup de 19/08) — A FAIXA DESCE PARA O CELULAR, E ISSO É O QUE
 * PAGA A VAGA DE "SERVIÇOS" NA BARRA DE BAIXO.
 * ===========================================================================
 * Ela era `hidden lg:flex`: no celular o sino existia em UM lugar só — o
 * cabeçalho escrito à mão dentro de `/hoje` — e por isso "Avisos" tinha de
 * ocupar uma das cinco vagas da barra inferior. Está escrito no
 * `components/bottom-nav.tsx` desde a onda 57, com todas as letras: trocar
 * Avisos por Serviços *"apagaria o aviso de seguro vencido de todo lugar"*.
 *
 * O mockup resolve a causa em vez do sintoma: o cabeçalho dele é **marca à
 * esquerda, sino à direita, em toda tela**. Com o sino no topo de todas as
 * ~109 telas do celular — e com o MESMO `ContadorAvisos` do trilho e da barra,
 * então nenhum dos três pode divergir dos outros —, a objeção da onda 57 deixa
 * de existir e a vaga da barra fica livre para Serviços, que é o quinto item
 * do menu do proprietário no §2.1 da spec.
 *
 * O QUE ISSO CUSTA, medido a 390px: 56px de barra + 16px de respiro em telas
 * que não tinham cabeçalho nenhum. Na Início o custo é NEGATIVO — ela paga
 * hoje ~48px com a fileira de saudação (avatar + "Olá, fulano" + seletor +
 * sino), que esta faixa substitui inteira.
 *
 * O SELETOR DE EMBARCAÇÃO VEM JUNTO, E É OBRIGAÇÃO, NÃO ENFEITE. No celular
 * ele existia SÓ na Início (o trilho é `lg`), então tirar aquela fileira sem
 * trazê-lo mataria a única porta de troca de barco de quem usa o telefone —
 * e "nada que hoje se alcança pode ficar inalcançável". Ele entra no lugar do
 * WORDMARK, não ao lado dele: a marca é decoração e trocar de barco é função,
 * e a 390px não cabem os dois. Fica à ESQUERDA (e não junto do sino) porque o
 * menu dele abre com `left-0` — ancorado na direita, a lista de 200px sairia
 * pela borda da tela.
 *
 * O AVATAR CONTINUA `lg`. No mockup não há avatar no topo; no celular a conta
 * mora no Menu, que é uma das cinco vagas da barra. No desktop ele fica: lá
 * não há barra de baixo e o trilho não tem a foto.
 */

/** O que a faixa precisa saber de um equipamento — subconjunto estrutural de
 *  `painel.equipamentos`, pra o teste não ter que fabricar a linha inteira. */
export type EquipamentoFaixa = Pick<Equipamento, "id" | "tipo" | "posicao" | "horas_atuais">

/** Idem para itens monitorados: os campos que `itemMonitoradoToItemCalc` lê,
 *  mais o vínculo com o equipamento. `painel.itens` satisfaz por estrutura. */
export type ItemFaixa = Pick<
  ItemMonitorado,
  "equipamento_id" | "intervalo_horas" | "intervalo_meses" | "data_fixa" | "ultimo_ciclo_data" | "ultimo_ciclo_horas"
>

/**
 * O nome que alimenta as iniciais do avatar.
 *
 * ONDA 63 — O NOME REAL MANDA; O E-MAIL É A RESERVA. Até aqui esta função
 * derivava as iniciais SÓ do e-mail ("e2e-3f@…" → "E3"), enquanto a saudação
 * da Início lia o `nome` do perfil ("Erick Cardoso" → "EC"): dois avatares
 * com iniciais diferentes a 60px um do outro, na mesma tela (auditoria
 * visual 18/08, §10). O argumento de então — "carregar o profile seria uma
 * consulta nova por página" — caiu quando se olhou o custo de verdade:
 * `/hoje` e `/menu/ajustes` já pagavam essa consulta por conta própria, e
 * trazê-la pro `carregarPainel` (que é `cache()` por requisição) eliminou a
 * repetição em vez de somar.
 *
 * O e-mail continua aqui como reserva porque cadastro incompleto existe:
 * quem entrou e não pôs nome tem avatar mesmo assim.
 */
export function nomeDoAvatar(nome: string | null, email: string | null): string {
  const limpo = nome?.trim()
  if (limpo) return limpo
  if (!email) return ""
  return email.split("@")[0].split(/[._\-+]+/).filter(Boolean).join(" ")
}

/**
 * A cor da pílula de revisão segue o estado do semáforo — cor E palavra
 * (a palavra "vencida"/"em" já está na frase de `apoioDaRevisao`), o mesmo
 * par do `Kpi` da Início. `ok` fica `text-dim`: revisão longe não é
 * informação que precise gritar no topo de toda tela.
 */
const COR_REVISAO: Record<StatusFarol, string> = {
  ok: "text-dim", atencao: "text-warn", vencido: "text-crit",
}

/**
 * "Mais apertada" de verdade, não "a primeira do array": estado pior vence
 * (o mesmo `PESO` da Início); no empate de estado, menos horas restantes
 * vence, e horas mandam sobre dias — pelo mesmo motivo de `apoioDaRevisao`:
 * é o prazo mais preciso que um motor tem. A Início nunca precisou deste
 * desempate porque mostra UM KPI por motor; a faixa reduz tudo a uma pílula.
 */
function maisApertada(a: ResultadoCalc, b: ResultadoCalc): number {
  const porEstado = PESO[b.status] - PESO[a.status]
  if (porEstado !== 0) return porEstado
  if (a.horasRestantes != null && b.horasRestantes != null) return a.horasRestantes - b.horasRestantes
  if (a.horasRestantes != null) return -1
  if (b.horasRestantes != null) return 1
  return (a.diasRestantes ?? Infinity) - (b.diasRestantes ?? Infinity)
}

/**
 * A CASCA DO TOPO — o que TODA tela tem: marca à esquerda no celular, sino à
 * direita sempre.
 *
 * Existe como peça própria porque o sino passou a ter DOIS chamadores — esta
 * faixa (quem tem barco) e a `FaixaMarca` (quem não tem) — e é exatamente
 * assim que o app já ganhou um badge de avisos na barra de baixo e nenhum no
 * trilho, defeito que `ContadorAvisos` foi criado pra fechar. Um cabeçalho
 * escrito duas vezes é o mesmo erro um nível acima.
 *
 * `h-14` fixo: a altura da barra não pode depender do que está dentro dela,
 * senão a Início (com seletor) e o Marketplace (sem) empurram o conteúdo pra
 * baixo em medidas diferentes e a tela "pula" ao navegar.
 */
function CascaTopo({
  avisos,
  marca,
  conta,
  children,
  hamburguer = false,
  className = "",
}: {
  avisos: number
  marca: React.ReactNode
  conta?: React.ReactNode
  children?: React.ReactNode
  /** ONDA 105 — o botão de menu do canto esquerdo, como nas imagens do guia.
   *  Só no celular: a partir de `lg` quem navega é o `TrilhoLateral`. */
  hamburguer?: boolean
  className?: string
}) {
  return (
    <header
      // ONDA 117 — o gancho que some com o cabeçalho nas telas de mapa
      // (`body.fundo-tela-mapa [data-casca-topo]` em globals.css). Mapa é
      // instrumento de tela cheia: moldura por cima dele é defeito, não casca.
      data-casca-topo
      className={`mb-4 flex h-14 items-center gap-2 border-b border-line lg:mb-5 lg:gap-4 ${className}`}
    >
      {/* O HAMBÚRGUER É PRÉ-REQUISITO DA TROCA NA BARRA DE BAIXO, não enfeite.
          "Menu" saiu das cinco vagas para a Agenda entrar (as oito imagens do
          guia desenham a barra assim, e o §13 confirma). Sem este botão, Minha
          Conta, Ajustes, Assinatura, Tripulação e Financeiro ficariam sem
          caminho nenhum no telefone — a lista inteira do Menu some junto com a
          aba. Ele entra no MESMO commit que tira a aba, e é onde as imagens o
          desenham: canto esquerdo, antes da marca.
          `-ml-2` devolve ao layout a folga que os 44px de alvo acrescentam à
          esquerda, pro logo não descolar da margem da página. */}
      {hamburguer && (
        <Link
          href="/menu"
          aria-label="Menu"
          /* `lg:hidden` no próprio botão porque a `FaixaTopo` completa NÃO é
             `lg:hidden` — ela é a faixa do desktop também, e lá quem navega é o
             trilho. Um hambúrguer ao lado de um trilho sempre aberto seriam
             duas portas para a mesma sala. */
          className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-[var(--raio-controle)] text-dim hover:bg-panel2 lg:hidden"
        >
          <Icone nome="menu" className="size-5" />
        </Link>
      )}
      {marca}
      {children}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {/* O sino — mesma anatomia do trilho: alvo de 44px, badge ancorado
            no ícone (o `ContadorAvisos` compartilhado, não uma cópia). */}
        <Link
          href="/notificacoes"
          aria-label="Avisos"
          className="flex size-11 items-center justify-center rounded-[var(--raio-controle)] text-dim hover:bg-panel2"
        >
          <span className="relative flex">
            <Icone nome="alerta" className="size-5" />
            <ContadorAvisos avisos={avisos} />
          </span>
        </Link>
        {conta}
      </div>
    </header>
  )
}

/**
 * O TOPO DE QUEM NÃO TEM BARCO — e ele existe por um motivo de correção, não
 * de simetria.
 *
 * O layout de `(app)` monta a faixa dentro de `painel != null &&`: sem
 * embarcação, sem faixa. Isso era inofensivo enquanto o sino do celular morava
 * na barra de baixo; com "Avisos" saindo dela nesta onda, um Partner ou um
 * Captain sem barco — que a onda 99 tornou destinatário de aviso de
 * Marketplace, e o comentário do layout diz isso com todas as letras — ficaria
 * sem NENHUMA porta para `/notificacoes` no telefone.
 *
 * `lg:hidden` porque a partir de 1024px quem carrega marca e sino é o trilho:
 * uma barra de 56px com um sino solto na ponta direita seria moldura vazia.
 */
export function FaixaMarca({ avisos }: { avisos: number }) {
  return (
    <CascaTopo
      avisos={avisos}
      className="lg:hidden"
      hamburguer
      marca={
        <Link href="/hoje" className="shrink-0 text-base">
          <Logo />
        </Link>
      }
    />
  )
}

export function FaixaTopo({
  embarcacao,
  embarcacoes,
  equipamentos,
  itens,
  hoje,
  avisos,
  email,
  nome,
  estadoDoBarco = true,
}: {
  /** `painel.embarcacao` reduzida a id + nome — com um barco só, o nome é
   *  link pra ficha (`/barco`); o id existe pro seletor saber qual é a atual. */
  embarcacao: { id: string; nome: string }
  /** `painel.embarcacoes` — a MESMA lista que a Início sempre passou ao
   *  seletor, já carregada por `carregarPainel` (zero consulta nova). Com
   *  mais de uma, a faixa troca o nome estático pelo `SeletorEmbarcacao`:
   *  spec fundação §3.3 ("seletor quando houver mais de uma") — e, desde a
   *  correção da onda 60, trocar de barco no desktop deixa de ser função
   *  que só existia na Início. */
  embarcacoes: { id: string; nome: string }[]
  /** `painel.equipamentos` — daqui saem os motores e as horas. */
  equipamentos: EquipamentoFaixa[]
  /** `painel.itens` — daqui sai a revisão mais apertada dos motores. */
  itens: ItemFaixa[]
  /** `hojeISO()` do layout — `calcularSemaforo` é puro, a data entra por fora. */
  hoje: string
  /** O MESMO contador do trilho e da bottom-nav, já filtrado por permissão. */
  avisos: number
  /** E-mail da conta (`painel.emailUsuario`) — reserva pras iniciais quando
   *  o cadastro ainda não tem nome. */
  email: string | null
  /** Nome do perfil (`painel.perfil?.nome`) — é ELE que manda nas iniciais,
   *  pra faixa e saudação nunca mostrarem letras diferentes na mesma tela. */
  nome?: string | null
  /**
   * ONDA 102 (spec 19/08 §5) — MOSTRA O ESTADO DO BARCO NESTA ÁREA?
   *
   * `true` (o padrão) desenha a faixa inteira: nome/seletor da embarcação,
   * pílulas de motor e a revisão mais apertada. `false` reduz a faixa ao que
   * QUALQUER área precisa — sino e avatar — e é o que vale fora de Início e
   * Meu Barco.
   *
   * O diagnóstico, na palavra do dono: *"parece que nunca conseguimos sair da
   * manutenção do barco"*. Quem escolhe é `MolduraApp`, a única peça do app
   * que conhece a rota; aqui só entra a consequência de desenho.
   *
   * O SELETOR DE EMBARCAÇÃO VAI JUNTO, e a decisão é consciente: ele veio pra
   * cá na onda 60 pra que trocar de barco não fosse função exclusiva da
   * Início. Trocar de barco é um gesto de CONTEXTO DO BARCO, então ele
   * pertence às mesmas duas áreas — e as duas áreas onde ele desapareceu
   * ficam a um clique pelo trilho, que está em toda tela.
   */
  estadoDoBarco?: boolean
}) {
  const motores = equipamentos.filter((e) => e.tipo === "motor")

  // KPI de motor SÓ com leitura real: horímetro é sempre informado à mão
  // (PRD §11), então motor sem leitura não vira "—" decorativo na faixa —
  // simplesmente não vira pílula. Mesma régua de honestidade da Início.
  const pilulasMotor = motores
    .filter((m) => m.horas_atuais != null)
    .map((m) => ({ id: m.id, rotulo: nomeDoEquipamento(m), valor: horasDoMotor(m) }))

  // A revisão mais apertada ENTRE OS MOTORES: mesmo cálculo do KPI da Início
  // (`calcularSemaforo` + só itens com informação de verdade), reduzido ao
  // pior resultado por `maisApertada`. Sem nenhum item com informação, a
  // pílula não existe — "Sem revisão programada" no topo de toda tela seria
  // ruído, não aviso.
  const revisao = itens
    .map((i) => {
      const motor = i.equipamento_id != null ? motores.find((m) => m.id === i.equipamento_id) : undefined
      if (!motor) return null
      const calc = itemMonitoradoToItemCalc(i)
      if (!temInformacaoSuficiente(calc, motor.horas_atuais)) return null
      return calcularSemaforo(calc, motor.horas_atuais, hoje)
    })
    .filter((r): r is ResultadoCalc => r != null)
    .sort(maisApertada)[0] ?? null

  // O seletor só ganha o lugar do wordmark quando ele TEM o que oferecer: com
  // um barco só, trocar a marca por um nome que não abre escolha nenhuma seria
  // gastar a única largura da esquerda com um botão inerte.
  const seletorNoCelular = estadoDoBarco && embarcacoes.length > 1

  return (
    <CascaTopo
      avisos={avisos}
      hamburguer
      marca={
        <span className="flex min-w-0 items-center gap-2 lg:hidden">
          {/* `text-base` porque `Logo` dimensiona o símbolo em `1.6em` do corpo
              herdado: sem um corpo declarado aqui, a marca do topo mediria o
              que o `<html>` mandasse e mudaria de tamanho com a preferência de
              fonte do sistema — 16px dá o selo de ~26px do mockup. */}
          {/* Sem `aria-label`: o nome acessível sai do próprio conteúdo — o
              wordmark "Commander" em texto, ou o `alt` do símbolo quando o
              seletor toma o lugar dele. Um rótulo escrito à mão aqui teria de
              conter o texto visível (WCAG 2.5.3) e, na prática, só repetiria a
              palavra que já está desenhada. */}
          <Link href="/hoje" className="shrink-0 text-base">
            <Logo compacto={seletorNoCelular} />
          </Link>
          {seletorNoCelular && (
            <span className="min-w-0 truncate">
              <SeletorEmbarcacao atual={{ id: embarcacao.id, nome: embarcacao.nome }} opcoes={embarcacoes} />
            </span>
          )}
        </span>
      }
      conta={
        /* O avatar reusa o `Avatar` de sempre (url null = iniciais em tom
           NEUTRO — o dourado saiu das iniciais na onda 57 e não volta). */
        <Link
          href="/menu/ajustes"
          aria-label="Sua conta e ajustes"
          className="hidden size-11 items-center justify-center rounded-[var(--raio-pilula)] lg:flex"
        >
          <Avatar url={null} nome={nomeDoAvatar(nome ?? null, email)} tamanho="size-9" />
        </Link>
      }
    >
      {/* Com um barco só, o nome é link pra ficha — no desktop a faixa é o
          caminho mais curto pro barco em qualquer tela. `min-h-11` mantém o
          alvo no piso de 44px mesmo com a faixa medindo pela altura dos
          filhos. Hover por sublinhado, não por cor: a faixa não gasta
          dourado nenhum.
          Com MAIS de um, o nome vira o `SeletorEmbarcacao` (spec fundação
          §3.3) — o MESMO client component da Início, com as MESMAS props
          (`atual` + `opcoes`, ambas já em mãos do layout). É ele, e não um
          link, porque trocar de barco precisa existir no desktop em toda
          tela — e o caminho pra ficha continua a um clique, pelo trilho. */}
      {/* ONDA 102 — TUDO QUE FALA DO BARCO VIVE DENTRO DESTE `&&`, e nada
          fora dele. Assim a faixa reduzida não é um segundo componente com um
          segundo jeito de desenhar sino e avatar: é ESTA faixa sem a metade
          esquerda. Um cabeçalho só, duas formas — que é o que impede as duas
          de divergirem com o tempo, do mesmo jeito que `ContadorAvisos` impede
          o trilho e a barra de baixo de divergirem. */}
      {/* ONDA 7 — O ESTADO DO BARCO PASSA A SER `lg`, E NÃO POR CAPRICHO DE
          largura: a 390px a fileira "Barco de Teste · MOTOR BB 612,0 h ·
          MOTOR BE 608,0 h · Revisão em 18 h" mede ~520px contra 358 úteis, e o
          mockup não a tem em tela nenhuma. No celular esse mesmo dado tem casa
          melhor e maior — o cartão "Motores" da Início, dois blocos abaixo. O
          que o celular herda daqui é o que ele não tinha: marca, sino e o
          seletor de barco em toda tela. */}
      {estadoDoBarco && (
        <div className="hidden min-w-0 flex-1 items-center gap-4 lg:flex">
          {embarcacoes.length > 1 ? (
            /* `shrink-0`: o nome do barco atual não trunca — quem cede espaço é
               a fileira de pílulas ao lado, que já tem `overflow-hidden`. */
            <span className="shrink-0">
              <SeletorEmbarcacao atual={{ id: embarcacao.id, nome: embarcacao.nome }} opcoes={embarcacoes} />
            </span>
          ) : (
            <Link
              href="/barco"
              className="flex min-h-11 min-w-0 items-center text-sm font-semibold text-texto underline-offset-4 hover:underline"
            >
              <span className="truncate">{embarcacao.nome}</span>
            </Link>
          )}

          {/* As pílulas da imagem 1: contorno, rótulo curto + número mono.
              Não são alvos (nada clicável), então podem ter 32px de altura. */}
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            {pilulasMotor.map((p) => (
              <span
                key={p.id}
                className="flex shrink-0 items-center gap-2 rounded-[var(--raio-pilula)] border border-line px-3 py-1.5"
              >
                <span className="rotulo text-dim">{p.rotulo}</span>
                <span className="tabular-nums text-xs font-semibold tabular-nums text-texto">{p.valor}</span>
              </span>
            ))}
            {revisao && (
              /* A frase inteira de `apoioDaRevisao`, sem rótulo "Próxima
                 revisão" ao lado: a frase já carrega o assunto ("Revisão em
                 37h"), e rótulo + frase diriam "revisão" duas vezes. Sem mono:
                 é frase, não número de instrumento (docs/DESIGN.md §5). */
              <span
                className={`shrink-0 rounded-[var(--raio-pilula)] border border-line px-3 py-1.5 text-xs font-medium ${COR_REVISAO[revisao.status]}`}
              >
                {apoioDaRevisao(revisao)}
              </span>
            )}
          </div>
        </div>
      )}
    </CascaTopo>
  )
}
