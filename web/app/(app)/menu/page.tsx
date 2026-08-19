import { Logo } from "@/components/logo"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarPainel, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { contarConversasComNaoLidas } from "@/lib/consultas-mensagens"
import { podeVerAgenda } from "@/lib/domain/agenda"
import { hojeISO } from "@/lib/domain/datas"
import { veHubDeAtualizacoes, veOperacaoDaFrota } from "@/lib/domain/enterprise"
import { podeVer } from "@/lib/domain/permissoes"
import { calcularSemaforo } from "@/lib/domain/semaforo"
import type { ReactNode } from "react"

/**
 * ONDA 103 — O MENU VIRA SEIS LINHAS DE VERDADE.
 * ===========================================================================
 * O §2.1 da spec `2026-08-19-arquitetura-quatro-apps.md` desenha o menu do
 * proprietário assim, e são seis:
 *
 *     Início · Meu Barco · Diário · Agenda · Serviços · Minha Conta
 *
 * A onda 102 leu "Meu Barco" e "Serviços" como SEÇÕES desta lista. O
 * resultado, medido a 390×844 antes de reescrever: **1788px de rolagem (2,1
 * telas), 22 linhas**, com treze delas empilhadas debaixo do título "Meu
 * barco". Ou seja: o defeito nº 5 da lista do dono — *"menu longo demais,
 * exige muita rolagem"* — continuava de pé, porque seção não é um nível de
 * navegação. Ela dá nome ao que já está na tela, e o problema era o que estava
 * na tela.
 *
 * Agora **Meu Barco e Serviços são TELAS**: `app/(app)/meu-barco/page.tsx` e
 * `app/(app)/servicos/page.tsx`. Este arquivo mostra seis linhas e nada mais.
 *
 * ---------------------------------------------------------------------------
 * UM NÍVEL A MAIS É UM TOQUE A MAIS — O QUE ELE COMPRA
 * ---------------------------------------------------------------------------
 * A régua da casa é caminho de `/hoje` em no máximo 3 toques
 * (docs/CONTRIBUTING.md, "gate de descoberta"), e ela continua respeitada: as
 * áreas de uso diário não passam por aqui. `/barco`, `/diario`, `/agenda`,
 * `/barco/documentos`, `/financeiro` e `/tripulacao` são UM toque a partir da
 * Início (barra de baixo, "Acesso rápido" e os "Ver tudo" dos cartões);
 * `/barco/motores` e os outros hubs, dois. O toque a mais recai sobre o que se
 * abre de vez em quando — Carteira, Selos, Relatórios, Comandantes —, e a
 * troca é essa: 2,1 telas de rolagem TODA VEZ que alguém abre o Menu, contra
 * um toque a mais quando alguém quer especificamente uma dessas áreas.
 *
 * ---------------------------------------------------------------------------
 * A LINHA DIZ O QUE TEM DENTRO — E QUANDO NÃO SABE, FICA CALADA
 * ---------------------------------------------------------------------------
 * A regra da onda 101 vale inteira num índice de dois níveis: o número da
 * porta é o número da sala. Por isso só duas das seis carregam número, e as
 * duas são as únicas que o Menu consegue provar:
 *
 *   · **Meu barco** mostra a pendência de DOCUMENTO, calculada de graça a
 *     partir de `painel.itens` com o mesmo `calcularSemaforo` de
 *     `/barco/documentos` — e reexibida dígito por dígito na linha Documentos
 *     de `/meu-barco`, um nível abaixo. É a única pendência do grupo que o
 *     Menu lê sem pagar consulta, e é a que tem prazo legal: documento vencido
 *     impede o barco de sair.
 *   · **Serviços** mostra conversas por ler, que é a mesma
 *     `contarConversasComNaoLidas` da linha Mensagens lá dentro.
 *
 * As outras quatro dizem o que têm dentro em PALAVRA — o subtítulo de "Meu
 * barco" e o de "Serviços" enumeram os destinos do grupo, que é o que um
 * agrupador deve à pessoa antes de ela gastar o toque. Inventar contagem para
 * as demais custaria consulta nesta tela, que é a mais atravessada do app.
 *
 * ---------------------------------------------------------------------------
 * O CUSTO — QUATRO CONSULTAS SAÍRAM DAQUI
 * ---------------------------------------------------------------------------
 * Ocorrências vivas, despesas do mês, pessoas com acesso e fotos do acervo
 * desceram para `/meu-barco`, junto com as linhas que alimentavam. O Menu fica
 * com UMA ida ao banco (a caixa de entrada, que a linha Serviços usa) —
 * `carregarPainel` é `cache()` e o layout de `(app)` já a resolveu nesta
 * mesma requisição, então ela não conta. A leitura obrigatória sobre o assunto
 * segue sendo o comentário de `carregarPainel` em `lib/consultas.ts`: cada ida
 * custa ~150 ms (função em Washington, banco em São Paulo).
 *
 * ---------------------------------------------------------------------------
 * O RECORTE POR TIPO DE USUÁRIO NÃO FOI TOCADO
 * ---------------------------------------------------------------------------
 * `veOperacaoDaFrota` e `veHubDeAtualizacoes` (`lib/domain/enterprise.ts`)
 * continuam decidindo quem vê o terceiro aplicativo, e o sinal continua sendo
 * `embarcacoes.cotas_total`. Um proprietário comum não vê Pátio, Mecânica,
 * Estoque, Combustível, Custo da frota, Cotistas nem Admin Commander — os três
 * últimos moram em `/menu/ajustes` desde a onda 102, com o porquê escrito lá.
 *
 * POR QUE A OPERAÇÃO DA FROTA CONTINUA SENDO SEÇÃO E NÃO VIROU UMA SÉTIMA
 * LINHA: o §2.1 descreve o menu **do proprietário**, e para ele esta tela tem
 * exatamente seis linhas — a seção não existe, não fica vazia, não fica cinza.
 * Quem a vê é funcionário de uma administradora, e para ele o §2.4 pede coisa
 * maior que uma linha: um ambiente separado, com rota, trilho e barra
 * próprios. Empacotar a operação num agrupador agora daria a impressão de que
 * essa separação foi feita. Ela não foi, e continua registrada como pendente.
 *
 * FALHA FECHADO: na dúvida, a linha não aparece. Menu que esconde demais é
 * reclamação de um cliente; menu que mostra Admin Commander para um cliente é
 * vazamento — e o segundo não tem desfazer.
 */

/** O painel de seção do canvas: uma borda pra lista inteira, linhas com
 *  `border-b` dentro (`LinhaLista` variant "grupo"). Repetido em
 *  `/meu-barco` e `/servicos` porque `components/ui/` está com outro agente
 *  nesta rodada — é uma classe, não uma abstração perdida. */
function PainelMenu({ children }: { children: ReactNode }) {
  return <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">{children}</div>
}

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  const { erro } = await searchParams
  const hoje = hojeISO()

  // `carregarPainel` é `cache()` e o layout já a resolveu — o `Promise.all`
  // existe pela outra: a caixa de entrada é da PESSOA, não do barco (um
  // prestador sem embarcação nenhuma tem conversa), então esperar o painel
  // pra só então pedi-la custaria uma volta de rede por ordem de escrita de
  // variável. Foi o defeito das ondas 96 e 100.
  const [painel, conversasComNaoLidas] = await Promise.all([
    carregarPainel(),
    contarConversasComNaoLidas(),
  ])

  // O RECORTE POR CONFIGURAÇÃO DA EMBARCAÇÃO, EM DUAS LINHAS E ZERO CONSULTA.
  //
  // `painel.embarcacao` já está em memória — `carregarPainel` traz a linha
  // inteira, `cotas_total` incluída. Sem barco nenhum (prestador, comandante
  // recém-convidado), os dois são `false`: falhar fechado é a regra, e quem
  // não tem embarcação certamente não tem uma operação de frota para
  // administrar. O porquê do sinal está inteiro em `lib/domain/enterprise.ts`.
  const veFrota = painel != null && veOperacaoDaFrota(painel.papel, painel.embarcacao.cotas_total)
  const veAtualizacoes = painel != null && veHubDeAtualizacoes(painel.papel, painel.embarcacao.cotas_total)

  // A PENDÊNCIA QUE A LINHA "MEU BARCO" CARREGA, de graça: `painel.itens` já
  // está em memória e estas três linhas são as MESMAS de `/barco/documentos`
  // — filtrar `categoria === "documento"`, converter com
  // `itemMonitoradoToItemCalc` e pedir o status a `calcularSemaforo(calc,
  // null, hoje)`. `null` de horas porque documento vence por data, nunca por
  // horímetro. É o mesmo cálculo que `/meu-barco` faz para a própria linha
  // Documentos: um cálculo escrito duas vezes, nunca duas réguas.
  const semaforoDosDocumentos =
    painel != null && podeVer(painel.permissoes, "documentos")
      ? painel.itens
          .filter((i) => i.categoria === "documento")
          .map((i) => calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje).status)
      : []
  const documentosVencidos = semaforoDosDocumentos.filter((s) => s === "vencido").length
  const documentosEmAtencao = semaforoDosDocumentos.filter((s) => s === "atencao").length

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="titulo-pagina">Menu</h1>
        <Logo compacto />
      </div>
      {/* Outras telas redirecionam pra cá com ?erro= — o toast fica. */}
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {/* OS SEIS ITENS DO §2.1, NA ORDEM DO DONO, NUM PAINEL SÓ.
          Sem `SecaoPagina` nenhuma: um cabeçalho de seção custa 32px e serve
          pra separar assuntos DENTRO de uma lista longa — numa lista de seis
          linhas ele só devolveria a rolagem que esta onda veio tirar. A
          hierarquia que sobrou é a única que importa aqui: quatro destinos
          diretos e dois agrupadores, e o que distingue os dois é o subtítulo
          dizer "o que tem dentro". */}
      <div className="mt-4">
        <PainelMenu>
          <LinhaLista
            href="/hoje"
            titulo="Início"
            subtitulo="O estado do barco e o que pede atenção hoje"
          />
          {/* AGRUPADOR. O subtítulo enumera o começo da lista de dentro em vez
              de descrever a ideia ("tudo sobre o barco") — antes de gastar um
              toque a pessoa precisa saber se o que ela quer está ali, e nome de
              área faz isso; adjetivo não. */}
          <LinhaLista
            href="/meu-barco"
            titulo="Meu barco"
            subtitulo="Central técnica, ocorrências, financeiro, tripulação e documentos"
            valor={
              documentosVencidos > 0
                ? String(documentosVencidos)
                : documentosEmAtencao > 0
                  ? String(documentosEmAtencao)
                  : undefined
            }
            /* A palavra vem junto do número porque um "1" solto ao lado de "Meu
               barco" não diz de quê. "documento vencido" é a frase inteira, e
               é a mesma que a linha Documentos usa um nível abaixo. */
            valorSecundario={
              documentosVencidos > 0
                ? documentosVencidos === 1 ? "documento vencido" : "documentos vencidos"
                : documentosEmAtencao > 0
                  ? documentosEmAtencao === 1 ? "documento vencendo" : "documentos vencendo"
                  : undefined
            }
            valorClassName={documentosVencidos > 0 ? "text-crit" : documentosEmAtencao > 0 ? "text-warn" : ""}
          />
          <LinhaLista
            href="/diario"
            titulo="Diário"
            subtitulo="Saídas, horas de motor e o que foi feito"
          />
          {/* A porta segue a sala: `/agenda` devolve quem não tem a área com
              `redirect`, então quem não pode entrar não vê a linha. Com ela
              escondida o Menu fica com cinco — e está certo assim: o §2.1
              descreve o menu do proprietário, e é ele quem tem as seis. */}
          {painel != null && podeVerAgenda(painel.permissoes) && (
            <LinhaLista
              href="/agenda"
              titulo="Agenda"
              subtitulo="Saídas e compromissos combinados com a tripulação"
            />
          )}
          {/* AGRUPADOR. Nenhuma condição: este é o segundo dos quatro
              aplicativos (a rede náutica) e é o único que não depende de
              embarcação — um prestador ou um comandante sem barco vive aqui.
              O endereço `/servicos` era um alias de compatibilidade e foi
              promovido nesta onda; o julgamento inteiro, incluindo a objeção
              do PRD §10, está escrito em `app/(app)/servicos/page.tsx`. */}
          <LinhaLista
            href="/servicos"
            titulo="Serviços"
            subtitulo="Explorar, Marketplace, prestadores, comandantes e mensagens"
            valor={conversasComNaoLidas > 0 ? String(conversasComNaoLidas) : undefined}
            valorSecundario={conversasComNaoLidas > 0 ? "por ler" : undefined}
          />
          {/* O sexto. A única linha que não é área do produto: é a porta pra
              tudo que é da PESSOA — conta, assinatura, aparência, avisos do
              aparelho, cadastro e cotas da embarcação, e os outros acessos que
              ela porventura tenha na plataforma (parceiro, consultor Gold,
              Admin Commander). */}
          <LinhaLista
            href="/menu/ajustes"
            titulo="Minha conta"
            subtitulo="Assinatura, aparência, avisos e seus outros acessos"
          />
        </PainelMenu>
      </div>

      {/* O TERCEIRO APLICATIVO — A OPERAÇÃO ENTERPRISE (§2.4).
          *"Nada disso pode ficar misturado ao Commander de um proprietário
          particular."*

          Esta seção é a resposta direta ao defeito 6, e o `veFrota` acima é o
          recorte inteiro: quem tem papel de funcionário da operação vê sempre;
          o proprietário só vê se a embarcação estiver configurada para cotas;
          comandante e cotista nunca veem. Para o dono de um barco particular a
          seção não existe — não fica vazia, não fica cinza, não existe, e o
          Menu dele tem as seis linhas do §2.1 e mais nada.

          Ainda é uma SEÇÃO e não um ambiente com casca própria (rota, trilho e
          barra separados, como o §2.4 pede por extenso). O recorte, que é o que
          resolve o vazamento, está entregue desde a onda 102; a casca separada
          é mudança de rota e segue registrada como pendente. */}
      {veFrota && (
        <>
          <SecaoPagina icone="ferramenta">Operação da frota</SecaoPagina>
          <PainelMenu>
            <LinhaLista
              href="/patio"
              titulo="Pátio"
              subtitulo="Saída e retorno da unidade, com fotos e horímetro"
            />
            <LinhaLista
              href="/mecanica"
              titulo="Mecânica"
              subtitulo="Diagnóstico, conserto, orçamento e votação dos cotistas"
            />
            <LinhaLista
              href="/afazeres"
              titulo="Afazeres"
              subtitulo="O que a equipe combinou de fazer"
            />
            <LinhaLista
              href="/estoque"
              titulo="Estoque"
              subtitulo="Peças, óleo e consumíveis da base"
            />
            <LinhaLista
              href="/combustivel"
              titulo="Combustível"
              subtitulo="Tanque próprio, abastecimentos e balanço"
            />
            {/* O "Financeiro operacional" do §2.4: quanto cada unidade custou
                para operar. Segue atrás de `gastos` como sempre — o recorte
                por configuração diz que a frota existe pra esta pessoa, o
                recorte por papel diz se ela pode ver dinheiro. Os dois valem
                juntos, nunca um no lugar do outro: o preset de Mecânica, por
                exemplo, opera a frota e não vê um centavo dela (§7 — o módulo
                não é ERP de oficina). */}
            {podeVer(painel?.permissoes ?? null, "gastos") && (
              <LinhaLista
                href="/frota"
                titulo="Custo da frota"
                subtitulo="Quanto cada unidade custou para operar"
              />
            )}
          </PainelMenu>
        </>
      )}

      {/* Atualizações tem seção própria, e não é capricho de moldura: ela é a
          única tela de mão dupla entre a administradora e o cotista (§15), e o
          cotista — que é quem a alimenta — não vê a Operação da frota logo
          acima. Pendurá-la naquele painel a esconderia justamente de metade de
          quem a usa. O subtítulo troca de voz conforme o lado. */}
      {veAtualizacoes && (
        <>
          <SecaoPagina icone="relatorio">Cotas</SecaoPagina>
          <PainelMenu>
            <LinhaLista
              href="/atualizacoes"
              titulo="Atualizações"
              subtitulo={painel?.papel === "COTISTA"
                ? "Informe a administradora sobre o uso da unidade"
                : "O que os cotistas informaram, aguardando sua análise"}
            />
          </PainelMenu>
        </>
      )}
    </main>
  )
}
