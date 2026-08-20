"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icone, type NomeIcone } from "./icone"
import { TOQUE } from "@/lib/ui/acoes"

const abas: { href: string; rotulo: string; icone: NomeIcone }[] = [
  {
    href: "/hoje",
    rotulo: "Início",
    icone: "inicio",
  },
  {
    // ONDA 105 — "MEU BARCO" POR EXTENSO, COMO NAS IMAGENS DO GUIA.
    // O rótulo era "Barco" por uma restrição de largura que a CAIXA ALTA criava:
    // a 375px cada coluna tem ~75px e "MEU BARCO" em maiúsculas mede ~62px,
    // raspando. Em caixa de título mede ~48px e sobra folga. A troca de caixa
    // vem das próprias imagens (§1, normativas para composição) e paga o
    // vocabulário completo do §2.1 da spec do dono — que é o mesmo nome usado
    // no Menu e no trilho. Nomes diferentes pro mesmo lugar é a coisa que mais
    // faz alguém achar que se perdeu.
    href: "/barco",
    rotulo: "Meu Barco",
    icone: "embarcacao",
  },
  {
    // Onda 57 — Comandantes sai, Diário entra. A troca é UMA só, de
    // propósito: "Avisos" fica, porque é o único indicador de alerta
    // crítico presente em toda tela (o app não tem barra superior, ver
    // onda 44) e tirá-lo apagaria o aviso de seguro vencido de todo lugar.
    //
    // O PRD chama o Diário de coração do app e ele era um ícone num grid
    // de cinco atalhos. De brinde, conserta o defeito tipográfico
    // documentado abaixo: "Comandantes" não cabia em 11px e precisou da
    // exceção de 9.5px — "Diário" cabe.
    //
    // Comandantes continua alcançável pelo Menu e pela RedeNav.
    href: "/diario",
    rotulo: "Diário",
    icone: "relatorio",
  },
  {
    // ONDA 7 — "AVISOS" SAI, "SERVIÇOS" ENTRA. A conta que autoriza a troca
    // está no bloco grande abaixo; em uma frase: o sino subiu para o cabeçalho
    // de TODA tela do celular (`components/faixa-topo.tsx`), então a vaga
    // deixou de ser a única superfície de alerta do aparelho.
    //
    // Âncora e não sacola: `marketplace` é o ícone de UMA das cinco áreas de
    // dentro de Serviços, e usá-lo aqui faria a aba prometer o Marketplace e
    // entregar um índice. A âncora é o que o mockup desenha e é o símbolo
    // náutico de "quem te atende em terra" — nenhuma outra aba a usa.
    href: "/servicos",
    rotulo: "Serviços",
    icone: "ancora",
  },
  {
    // ONDA 105 — "MENU" SAI DA BARRA E "AGENDA" ENTRA. A DECISÃO É DAS IMAGENS.
    // ==========================================================================
    // As oito imagens do Guia de Design v1 desenham a mesma barra em todas:
    // **Início · Meu Barco · Diário · Agenda · Serviços**. E o §13 do guia
    // fecha: *"no mobile, sidebar vira menu e as CINCO ÁREAS PRINCIPAIS
    // permanecem na bottom navigation"* — a sidebar das imagens tem exatamente
    // esses cinco.
    //
    // ISSO REVERTE A DECISÃO DE 15/08, e a reversão é do dono, não minha. O
    // comentário grande abaixo preserva o "não" dele à Agenda aqui, e o motivo
    // era físico: só cabem cinco, e "Comandantes" já tinha forçado uma exceção
    // tipográfica. O motivo continua verdadeiro — o que mudou é QUEM sai. A
    // Agenda entra ocupando a vaga do Menu, não uma sexta.
    //
    // O MENU NÃO PERDE PORTA: ele sobe para o botão de hambúrguer no canto
    // esquerdo do cabeçalho, presente em toda tela do celular — que é onde as
    // imagens o desenham. Trocar uma aba por um hambúrguer sem esse botão
    // existir teria deixado Minha Conta, Ajustes e Assinatura sem caminho
    // nenhum no telefone; o botão entra no MESMO commit (`faixa-topo.tsx`).
    //
    // POR QUE A AGENDA MERECE A VAGA MAIS QUE O MENU: menu é navegação sobre
    // navegação — um lugar que só leva a outros lugares. Agenda é um lugar. A
    // barra de baixo tem cinco vagas e elas valem mais em destino do que em
    // índice.
    href: "/agenda",
    rotulo: "Agenda",
    icone: "calendario",
  },
]

/**
 * ONDA 7 — "SERVIÇOS" ENTRA, "AVISOS" SAI, E A CONTA FOI FEITA ANTES.
 * ===========================================================================
 * O mockup do sócio comercial (`public/imagens/novodesignmodelo.png`) desenha
 * a barra como **Início · Barco · Diário · Serviços · Menu**. A onda 102
 * recusou exatamente essa troca, e a recusa está preservada abaixo porque o
 * ARGUMENTO dela continuava certo: *"Avisos é a única superfície de alerta
 * presente em TODA tela do celular; trocá-la apagaria o aviso de seguro
 * vencido de todo lugar"*.
 *
 * O QUE MUDOU NÃO FOI A OPINIÃO — FOI O FATO. Na mesma onda o cabeçalho do
 * mockup (marca à esquerda, sino à direita) desceu para o celular em TODA
 * tela, inclusive para quem ainda não tem barco (`FaixaMarca`, em
 * `components/faixa-topo.tsx`, e o `||` que a chama em `moldura-app.tsx`).
 * A premissa da recusa — "só existe uma superfície de alerta e é esta vaga" —
 * deixou de ser verdade, e aí a troca passa a ser certa em vez de errada.
 *
 * O QUE FOI VERIFICADO ANTES DE APLICAR, item por item:
 *   · o contador é o MESMO `ContadorAvisos` nos três lugares (sino do topo,
 *     trilho de desktop, e antes aqui) — ele lê o `avisos` que o layout de
 *     `(app)` calcula uma vez com `contadorSino(await carregarNotificacoes())`.
 *     Sair daqui não muda a fonte nem o número: muda onde ele é desenhado;
 *   · o alvo do sino no topo é `size-11` (44px), o mesmo piso da barra;
 *   · `/notificacoes` continua a UM toque de qualquer tela, e continua listada
 *     no Menu — os dois caminhos que o gate de descoberta exige;
 *   · quem não tem barco também mantém o sino (`FaixaMarca`), que era o furo
 *     mais fácil de deixar aberto nesta troca.
 *
 * O CUSTO QUE SOBRA, e ele é real: o sino do topo é MENOS visível que uma aba
 * de 78px com rótulo escrito. A troca não é de graça — ela compra a porta da
 * rede náutica, que é o segundo dos quatro aplicativos do §1 da spec e não
 * tinha entrada nenhuma no celular fora do Menu. Se o dono medir que os avisos
 * caíram, o caminho de volta está inteiro: são estas seis linhas.
 *
 * ---------------------------------------------------------------------------
 * ONDA 102 — COMO ESTAS CINCO SE ENCAIXAM NOS SEIS ITENS DO MENU PRINCIPAL.
 *
 * A spec de 19/08 (§2.1) fixa o menu do proprietário em seis: Início · Meu
 * Barco · Diário · Agenda · Serviços · Minha Conta. A barra cabe cinco, por
 * motivo físico (a conta está 30 linhas abaixo), então o encaixe é este:
 *
 *   · Início, Meu Barco, Diário e Serviços têm vaga própria — são os quatro
 *     destinos do §2.1 que a pessoa abre no dia a dia;
 *   · Agenda e Minha Conta moram no Menu, que é a quinta vaga e o gate de
 *     descoberta (PRD §9);
 *   · Avisos não é um dos seis e agora também não está aqui: mora no sino do
 *     cabeçalho, presente em toda tela.
 *
 * O rótulo continua "Barco" e não "Meu barco" pela MESMA restrição que tirou
 * "Comandantes" daqui na onda 57: a 375px cada coluna tem ~75px, e "MEU
 * BARCO" em caixa alta não cabe sem truncar ou sem descer a fonte abaixo do
 * piso de 11px da escala. O vocabulário completo do dono vive onde há largura
 * pra ele — o Menu e a pastilha do trilho.
 *
 * DECISÃO FECHADA (onda 46) — A AGENDA NÃO VIRA ABA AQUI.
 *
 * A onda 43 entregou a Agenda e deixou a pergunta em aberto: ela merece uma
 * das posições do menu de baixo? O dono respondeu em 15/08/2026: NÃO.
 * O motivo é físico e já está documentado 30 linhas abaixo — só cabem 5
 * abas, e 71px por coluna já é pouco pra rótulo longo: era o caso de
 * "Comandantes", que forçou a exceção de 9.5px removida na onda 57 ao
 * trocá-lo por "Diário". Uma sexta aba não encolhe o rótulo: encolhe todas
 * as seis até nenhuma ser legível.
 *
 * A Agenda continua a 1 toque da Início (atalho de "Acesso rápido") e
 * listada no Menu — os dois caminhos que o gate de descoberta exige
 * (docs/CONTRIBUTING.md). Não é falta de acesso; é escolha de onde.
 * Não reabra esta discussão sem trazer um rótulo mais curto ou uma aba pra
 * sacrificar.
 *
 * O CONTADOR DE AVISOS NÃO CHEGA MAIS AQUI (onda 7). Ele acompanha o sino, e
 * o sino subiu para o cabeçalho de toda tela — a prop foi removida junto para
 * que ninguém a passe achando que ela ainda desenha alguma coisa. A fonte
 * continua a mesma no layout de `(app)`; só o destino mudou.
 */
export function BottomNav() {
  const pathname = usePathname()
  return (
    // Onda 57 — `lg:hidden` porque a partir de `lg` quem navega é o
    // `TrilhoLateral`. As duas ao mesmo tempo seriam duas navegações
    // principais competindo na mesma tela; o breakpoint é o mesmo lá e cá.
    <nav className="no-imprimir fixed inset-x-0 bottom-0 z-10 border-t border-line bg-ink/95 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-[430px]">
        {abas.map((a) => {
          const ativa = pathname.startsWith(a.href)
          return (
            <Link
              key={a.href}
              href={a.href}
              aria-current={ativa ? "page" : undefined}
              /* gap de 5px entre ícone e rótulo — o do canvas
                 (nav-inferior.dc.html); o resto da anatomia já batia:
                 ícone 21px stroke 1.7, rótulo 11px 500 uppercase, ativa
                 em `accent-forte` — que nos dois temas vale exatamente os
                 dois tons de dourado que o canvas pede. */
              /* ONDA 84 — a barra mais tocada do app não dava retorno nenhum:
                 trocava a cor do texto e só, sem transição, sem `active:`. O
                 toque ficava sem resposta até a rota trocar — e quando a rota
                 demora, a pessoa toca de novo. `TOQUE` (e não `TOQUE_AMPLO`)
                 porque cada aba tem ~78px de largura: aqui os 3% são o
                 afundar certo, não um tremor. */
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-[5px] pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2 text-[11px] font-medium ${TOQUE} ${
                ativa ? "text-accent-forte" : "text-dim"
              }`}
            >
              {/* ONDA 98 (HAULIX §24) — O SEGUNDO CANAL DA ABA ATIVA.
                  Conferido antes de mexer, como pedido: a barra de baixo
                  resolvia "você está aqui" com UM canal — a cor do texto e do
                  ícone (`text-accent-forte`). Cor sozinha não basta pela régra
                  3 do `docs/DESIGN.md` §6 ("estado é forma, não só cor"), e
                  aqui ela é ainda mais frágil que no trilho: o alvo tem 78px
                  de largura e o glifo 21px, então não há área para um fundo
                  cheio como o do §16 sem a barra inteira virar um bloco de
                  ouro — o que estouraria a contenção de 1–3%.
                  O §24 dá a forma certa para este caso: indicador de 2px no
                  eixo da aba, que é o mesmo gesto que `Abas` já usa dentro da
                  tela. Fica no TOPO (e não embaixo) porque o rodapé do
                  aparelho come a borda inferior na área segura do iPhone.
                  `aria-hidden`: o estado já é anunciado por `aria-current`. */}
              {ativa && (
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-accent" />
              )}
              {/* Onda 57 (revisão) — o badge saiu deste arquivo pra
                  `ui/contador-avisos.tsx`, porque escrito à mão aqui ele
                  nasceu ausente no trilho de desktop. Onda 7 — saiu da barra
                  inteira: ele acompanha o sino, e o sino agora é do cabeçalho.
                  O componente compartilhado continua sendo o único desenho
                  dele, em `faixa-topo.tsx` e no trilho. */}
              <Icone nome={a.icone} className="size-[21px]" />
              {/* min-w-0 + truncate: sem isso os rótulos longos ("Embarcação")
                  estouram o flex-1 e encostam um no outro em tela de 375px —
                  foi o que acontecia com "Comandantes". tracking removido
                  pelo mesmo motivo.
                  Onda 57 — a exceção de 9.5px ao piso de 11px de globals.css
                  (documentada lá, acima de .titulo-pagina) foi removida
                  junto com Comandantes: "Diário" cabe no piso padrão, então
                  a barra inteira volta a ele. */}
              <span className="w-full truncate px-0.5 text-center">{a.rotulo}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
