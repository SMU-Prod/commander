import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { LinhaLista } from "@/components/ui/linha-lista"
import { carregarPainel, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { hojeISO } from "@/lib/domain/datas"
import { abaDoEquipamento } from "@/lib/domain/diario"
import { formatarReais, resumoGastos } from "@/lib/domain/gastos"
import { ESTADOS_QUE_PESAM_NA_SAUDE } from "@/lib/domain/ocorrencias"
import { podeVer } from "@/lib/domain/permissoes"
import { calcularSemaforo } from "@/lib/domain/semaforo"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * ONDA 103 — "MEU BARCO" DEIXA DE SER UM TÍTULO E VIRA UMA TELA.
 * ===========================================================================
 * O §2.1 da spec `2026-08-19-arquitetura-quatro-apps.md` fixa o menu do
 * proprietário em SEIS itens — Início · Meu Barco · Diário · Agenda · Serviços
 * · Minha Conta — e o defeito nº 5 da lista do dono diz por quê: *"menu longo
 * demais, exige muita rolagem"*.
 *
 * A onda 102 entregou os seis como SEÇÕES da mesma lista, e o resultado foi o
 * defeito 5 intacto: "Meu barco" virou um cabeçalho com treze linhas
 * empilhadas embaixo e o Menu continuou com 1788px de rolagem (2,1 telas a
 * 390×844, medido). Seção não é nível de navegação — ela agrupa o que já está
 * na tela, e o problema era justamente o que estava na tela.
 *
 * Esta tela é o nível que faltava: o Menu mostra SEIS linhas, e as treze que
 * moravam debaixo do título "Meu barco" moram aqui.
 *
 * ---------------------------------------------------------------------------
 * POR QUE `/meu-barco` E NÃO `/barco`
 * ---------------------------------------------------------------------------
 * `/barco` já é a CENTRAL TÉCNICA que a onda 101 construiu a partir do §3
 * (*"cards grandes… a pessoa toca no card e entra naquele hub"*). Ela é uma das
 * treze linhas daqui — a primeira —, não o índice delas. Fundir as duas
 * devolveria a "página interminável" que o §3 acabou de desmontar: os oito
 * cards MAIS treze linhas numa tela só.
 *
 * ---------------------------------------------------------------------------
 * A BARRA DE BAIXO NÃO MUDA DE DESTINO, E ISSO É DECISÃO
 * ---------------------------------------------------------------------------
 * A aba "Barco" continua apontando pra `/barco`. Apontá-la pra cá poria o
 * índice a um toque e empurraria motores/casco/elétrica pra três — e o que se
 * abre todo dia num barco é o estado técnico, não a lista de áreas. Além
 * disso, `components/trilho-lateral.tsx` (o mesmo destino no desktop) está
 * fora do alcance desta rodada: mover só o celular faria "Barco" significar
 * duas telas diferentes conforme o tamanho do aparelho.
 *
 * ---------------------------------------------------------------------------
 * AS QUATRO CONSULTAS DESCERAM UM NÍVEL — E É AQUI QUE ELAS PAGAM O QUE CUSTAM
 * ---------------------------------------------------------------------------
 * Ocorrências vivas, despesas do mês, pessoas com acesso e fotos do acervo
 * estavam no Menu, alimentando linhas que agora moram nesta tela. Elas vieram
 * junto: cada ida ao banco custa ~150 ms (função em Washington, banco em São
 * Paulo — a leitura obrigatória é o comentário de `carregarPainel` em
 * `lib/consultas.ts`), e o Menu é atravessado pelo app inteiro enquanto esta
 * tela só é aberta por quem de fato quer uma destas áreas. As quatro seguem em
 * UM `Promise.all`, nunca em fila.
 *
 * `carregarPainel()` NÃO acrescenta uma quinta: ela é `cache()` e o layout de
 * `(app)` já a resolveu nesta mesma requisição.
 *
 * ---------------------------------------------------------------------------
 * O NÚMERO DA PORTA É O NÚMERO DA SALA (regra da onda 101, mantida inteira)
 * ---------------------------------------------------------------------------
 * Cada contagem abaixo reusa a MESMA função de domínio que a tela de destino
 * usa — `abaDoEquipamento`, `resumoGastos`, `calcularSemaforo`,
 * `ESTADOS_QUE_PESAM_NA_SAUDE`. Contagem escrita à mão aqui foi o defeito que
 * a onda 101 passou inteira consertando, e nenhuma linha ganhou número novo
 * nesta rodada.
 */

/** O painel de lista do canvas: uma borda pra lista inteira, linhas com
 *  `border-b` dentro (`LinhaLista` variant "grupo"). Escrito aqui e no Menu
 *  em vez de virar componente porque `components/ui/` está com outro agente
 *  nesta rodada — é uma classe, não uma abstração perdida. */
function PainelMenu({ children }: { children: React.ReactNode }) {
  return <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">{children}</div>
}

export default async function MeuBarcoPage() {
  const hoje = hojeISO()
  const painel = await carregarPainel()

  // A PORTA SEGUE A SALA (regra da onda 52). Estas telas devolvem quem não tem
  // a área com `redirect(/hoje?erro=...)`; anunciá-las no índice é prometer uma
  // sala que o servidor fecha. `/barco/mapa`, `/barco/ocorrencias` e
  // `/barco/connect` continuam sem gate porque as próprias telas não têm um —
  // ali quem recorta é a RLS, por setor, e a lista chega vazia em vez de
  // barrada.
  const veEquipamentos = podeVer(painel?.permissoes ?? null, "equipamentos")
  const veFotos = podeVer(painel?.permissoes ?? null, "fotos")
  const veDocumentos = podeVer(painel?.permissoes ?? null, "documentos")
  const veHistorico = podeVer(painel?.permissoes ?? null, "historico")

  // Equipamentos do hub (tipo "outro") já vêm inteiros em `painel.equipamentos`
  // — contar de novo no banco seria pagar duas vezes pela mesma resposta. O
  // filtro é o MESMO de /barco/equipamentos (`abaDoEquipamento`), senão o
  // número da porta discordaria do que a sala mostra.
  const equipamentosNoHub =
    painel != null && veEquipamentos
      ? painel.equipamentos.filter((e) => abaDoEquipamento(e.tipo) === "equipamentos").length
      : 0

  // A PENDÊNCIA DOS DOCUMENTOS, DE GRAÇA. `painel.itens` já está em memória, e
  // as três linhas abaixo são as MESMAS de `/barco/documentos`: filtrar por
  // `categoria === "documento"`, converter com `itemMonitoradoToItemCalc` e
  // pedir o status a `calcularSemaforo(calc, null, hoje)` — `null` de horas
  // porque documento vence por data, nunca por horímetro. Zero consulta nova.
  //
  // O que esta tela NÃO mostra, e é decisão: o TOTAL de documentos. A tela de
  // destino soma os avulsos (linhas de `documentos` sem item monitorado), que
  // só uma consulta traria — "12" na porta contra "15" na sala seria
  // exatamente o defeito que a onda 101 veio fechar. Vencido e em atenção não
  // correm esse risco: avulso é "arquivo sem vencimento", e o que não vence
  // não entra em semáforo nenhum.
  //
  // Este mesmo par alimenta a linha "Meu barco" do Menu, um nível acima — é o
  // único número que o Menu consegue dar sem pagar consulta, e ele bate dígito
  // por dígito com a linha Documentos aqui embaixo.
  const semaforoDosDocumentos =
    painel != null && veDocumentos
      ? painel.itens
          .filter((i) => i.categoria === "documento")
          .map((i) => calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje).status)
      : []
  const documentosVencidos = semaforoDosDocumentos.filter((s) => s === "vencido").length
  const documentosEmAtencao = semaforoDosDocumentos.filter((s) => s === "atencao").length

  let ocorrenciasVivas = 0
  let totalMesCentavos = 0
  let pessoasComAcesso = 0
  let fotosDoBarco = 0
  if (painel != null) {
    const supabase = await supabaseServer()
    const [{ count: vivas }, { data: despesasMes }, { count: comAcesso }, { count: fotos }] = await Promise.all([
      // `ESTADOS_QUE_PESAM_NA_SAUDE` (aberta + em acompanhamento) e não
      // `estado = 'aberta'`: é a régua de "problema vivo" que a própria
      // `/barco/ocorrencias` usa pra separar as ATIVAS (cartão, no topo) das
      // finalizadas (linha, embaixo). O número da porta é, linha por linha, o
      // bloco de cima da sala. Anulada e resolvida continuam fora — anulada
      // foi declarada inexistente por escrito (PRD §7).
      supabase
        .from("ocorrencias").select("id", { count: "exact", head: true })
        .eq("embarcacao_id", painel.embarcacao.id)
        .in("estado", [...ESTADOS_QUE_PESAM_NA_SAUDE]),
      // Mesmo recorte da Início (/hoje): despesas pagas de
      // `lancamentos_financeiros` — e a soma é a MESMA `resumoGastos` de
      // `lib/domain/gastos.ts`, nunca uma segunda fórmula. Aqui só o mês
      // corrente, porque o subtítulo não compara com o anterior.
      podeVer(painel.permissoes, "gastos")
        ? supabase
            .from("lancamentos_financeiros").select("data, valor_centavos")
            .eq("embarcacao_id", painel.embarcacao.id)
            .eq("tipo", "despesa").eq("status", "pago")
            .gte("data", `${hoje.slice(0, 7)}-01`)
        : Promise.resolve({ data: [] as { data: string; valor_centavos: number }[] }),
      // O "Tripulação · 3" do canvas — a MESMA contagem do cabeçalho "Quem tem
      // acesso — N" de /tripulacao, só que em `head` (o número, não as linhas).
      // `.neq("papel", "PROP")` e não `.eq("papel", "CMDT")`: filtro por lista
      // fechada precisa ser lembrado a cada papel novo, e foi assim que os
      // cinco papéis Enterprise da onda 69 sumiram desta contagem. Só pro
      // PROP, que é quem vê a porta.
      painel.papel === "PROP"
        ? supabase
            .from("vinculos").select("id", { count: "exact", head: true })
            .eq("embarcacao_id", painel.embarcacao.id).neq("papel", "PROP")
        : Promise.resolve({ count: 0 }),
      // O acervo inteiro do barco, cruzando álbuns — é o mesmo total que
      // alimenta a cota "18 / 40" de /barco/fotos (lá é `todas.length`, aqui é
      // o `count` da mesma consulta sem limite). `head` porque a porta quer o
      // número, não os arquivos.
      veFotos
        ? supabase
            .from("fotos").select("id", { count: "exact", head: true })
            .eq("embarcacao_id", painel.embarcacao.id)
        : Promise.resolve({ count: 0 }),
    ])
    ocorrenciasVivas = vivas ?? 0
    pessoasComAcesso = comAcesso ?? 0
    fotosDoBarco = fotos ?? 0
    totalMesCentavos = resumoGastos(
      (despesasMes ?? []).map((l) => ({ data: l.data, custoCentavos: l.valor_centavos, grupo: "" })),
      hoje,
    ).totalMesCentavos
  }

  return (
    <main>
      {/* Volta pro Menu, e não pra `/hoje`: o Menu é o único lugar de onde se
          chega aqui, então o "Voltar" é literalmente o caminho de trás. É o
          mesmo desenho de `/menu/ajustes`, o outro filho do gate. */}
      <CabecalhoDetalhe voltarHref="/menu" voltarRotulo="Menu" titulo="Meu barco" />

      {/* AS TREZE LINHAS, EM UM PAINEL SÓ E SEM CABEÇALHO DE SEÇÃO.
          Cada `SecaoPagina` custa 32px de moldura (o próprio componente
          documenta a conta), e três delas aqui devolveriam ~96px de rolagem à
          tela que existe justamente pra tirar rolagem do Menu. A ordem já faz
          o trabalho que os títulos fariam: técnico → problema → dinheiro →
          gente → registro → acervo → o que ainda vem.

          O §2.3 lista "os oito hubs técnicos · Financeiro · Tripulação ·
          Ocorrências · Histórico · Relatórios · Selos". Os oito NÃO viram oito
          linhas: eles são os oito cards da central técnica, e repeti-los aqui
          desfaria a onda 101. Mapa, Fotos e Connect ficam apesar de o §2.3 não
          os nomear — nenhum é um dos oito, a central técnica não tem card pra
          eles, e sem esta linha ficariam sem porta nenhuma (é o que
          `lib/ui/menu-destinos.test.ts` existe pra impedir). */}
      <PainelMenu>
        <LinhaLista
          href="/barco"
          titulo="Central técnica"
          subtitulo="Motores, casco, elétrica, hidráulica e os demais hubs"
        />
        <LinhaLista
          href="/barco/mapa"
          titulo="Mapa da embarcação"
          subtitulo="O barco em corte, zona por zona"
        />
        {/* "em aberto" e não "abertas": a contagem soma aberta E em
            acompanhamento, e a palavra tem que descrever o que o número mediu
            — "abertas" colidiria com o chip "Aberta" da tela de destino, que é
            um recorte menor. */}
        <LinhaLista
          href="/barco/ocorrencias"
          titulo="Ocorrências"
          subtitulo="Problemas do barco, por setor"
          valor={ocorrenciasVivas > 0 ? String(ocorrenciasVivas) : undefined}
          valorSecundario={ocorrenciasVivas > 0 ? "em aberto" : undefined}
        />
        {/* A porta segue a sala: /financeiro devolve o CMDT sem `gastos` com
            faixa de erro, e anunciar porta que o backend fecha era o defeito
            que a revisão da onda 58 apontou. `podeVer(null, ...)` é true —
            PROP vê tudo. */}
        {painel != null && podeVer(painel.permissoes, "gastos") && (
          <LinhaLista
            href="/financeiro"
            titulo="Financeiro"
            subtitulo="Despesas, entradas, recorrentes e relatórios"
            valor={totalMesCentavos > 0 ? formatarReais(totalMesCentavos) : undefined}
            /* "pago este mês", não "este mês": a mesma tela mostra "A pagar"
               logo abaixo do total, e um R$ sem qualificação na porta seria
               lido como a conta inteira do mês. */
            valorSecundario={totalMesCentavos > 0 ? "pago este mês" : undefined}
          />
        )}
        {/* Mesmo gate da própria /carteira: PROP sempre; CMDT só com a área.
            A ressalva legal ("o app não movimenta dinheiro") é texto
            obrigatório do PRD §9.4 e a primeira coisa que a /carteira diz, em
            faixa — ressalva mora na sala, não na porta. */}
        {painel != null && (painel.papel === "PROP" || podeVer(painel.permissoes, "carteira")) && (
          <LinhaLista
            href="/carteira"
            titulo="Carteira da Tripulação"
            subtitulo="Repasse, gasto e devolução — controle contábil"
          />
        )}
        {painel?.papel === "PROP" && (
          <LinhaLista
            href="/tripulacao"
            titulo="Tripulação"
            subtitulo="Convide comandantes e ajuste as permissões"
            valor={pessoasComAcesso > 0 ? String(pessoasComAcesso) : undefined}
            /* A palavra é a do cabeçalho da sala ("Quem tem acesso — 3"). Sem
               ela, "3" ao lado de Tripulação pode ser lido como convites
               pendentes, que é outro número da mesma tela. */
            valorSecundario={pessoasComAcesso > 0 ? "com acesso" : undefined}
          />
        )}
        {veHistorico && (
          <LinhaLista
            href="/barco/historico"
            titulo="Histórico"
            subtitulo="Tudo que já aconteceu com o barco, num lugar só"
          />
        )}
        <LinhaLista
          href="/barco/resumos"
          titulo="Relatórios"
          subtitulo="Custo e uso do período, em PDF"
        />
        <LinhaLista
          href="/barco/selos"
          titulo="Selos"
          subtitulo="Commander Verified e a avaliação Gold"
        />
        {veFotos && (
          <LinhaLista
            href="/barco/fotos"
            titulo="Fotos"
            subtitulo="Os álbuns do barco"
            valor={fotosDoBarco > 0 ? String(fotosDoBarco) : undefined}
          />
        )}
        {/* Equipamentos e Documentos SÃO dois dos oito hubs e têm card na
            central técnica — a linha aqui é o segundo caminho que o gate de
            descoberta pede, e ela carrega o que o card não carrega: a
            pendência. Entre "quantos documentos existem" e "quantos estão
            vencidos", só o segundo decide se vale abrir agora; vencido tem
            precedência sobre em atenção, porque a porta mostra UM número e
            mostrar o pior é o que a hierarquia progressiva manda. Sem
            pendência a linha volta a ser só o nome: `undefined` nunca vira
            zero desenhado, e "0 vencidos" é moldura fazendo o trabalho do
            conteúdo. */}
        {veDocumentos && (
          <LinhaLista
            href="/barco/documentos"
            titulo="Documentos"
            subtitulo="Validade e arquivo — avisamos antes de vencer"
            valor={
              documentosVencidos > 0
                ? String(documentosVencidos)
                : documentosEmAtencao > 0
                  ? String(documentosEmAtencao)
                  : undefined
            }
            valorSecundario={
              documentosVencidos > 0
                ? documentosVencidos === 1 ? "vencido" : "vencidos"
                : documentosEmAtencao > 0
                  ? "vencendo"
                  : undefined
            }
            valorClassName={documentosVencidos > 0 ? "text-crit" : documentosEmAtencao > 0 ? "text-warn" : ""}
          />
        )}
        {veEquipamentos && (
          <LinhaLista
            href="/barco/equipamentos"
            titulo="Equipamentos"
            subtitulo="Bote, guincho, ar-condicionado e afins"
            valor={equipamentosNoHub > 0 ? String(equipamentosNoHub) : undefined}
          />
        )}
        <LinhaLista
          href="/barco/connect"
          titulo="Commander Connect"
          subtitulo="Em breve — conectividade NMEA 2000"
        />
      </PainelMenu>
    </main>
  )
}
