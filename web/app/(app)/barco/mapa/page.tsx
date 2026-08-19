import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol, FarolOcorrencia } from "@/components/farol"
import { Casco, type ZonaDoCasco } from "@/components/mapa-embarcacao/casco"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { Selo } from "@/components/ui/selo"
import { carregarMapaDaEmbarcacao, type EquipamentoNoMapa, type ZonaDoMapa } from "@/lib/consultas-mapa"
import { nomeDoEquipamento } from "@/lib/domain/diario"
import { ROTULO_ZONA, ZONAS, type ZonaEmbarcacao } from "@/lib/domain/mapa-embarcacao"
import { ROTULO_ESTADO, ROTULO_GRAVIDADE } from "@/lib/domain/ocorrencias"
import { rotuloDoFarol, seloDoFarol, textoRestante, type StatusFarol } from "@/lib/domain/semaforo"
import { ALVO_ACAO, PILULA_ACAO } from "@/lib/ui/acoes"

/**
 * MAPA DA EMBARCAÇÃO (onda 61, T4) — a tela que junta as três camadas do
 * subsistema: a zona no banco (T1), `estadoDaZona` (T2) e o corte SVG com
 * pinos (T3). Spec §3; referência visual do dono em
 * `docs/design-mobile/tela-1d.html` (cartão do mapa + lista de zonas com
 * farol, resumo e contagem).
 *
 * Decisões de forma:
 * - RSC puro, seleção em `?zona=` (§3.3): voltar do navegador funciona,
 *   link compartilhável, zero useState. `?zona=` inválida = nenhuma.
 * - Celular: desenho em cima, painel embaixo — o pino leva a `#painel-zona`
 *   e a página rola até a resposta. Desktop (`lg:`): desenho e lista à
 *   esquerda, painel à direita (o "Packages" da imagem 2 do catálogo).
 * - O dourado de conteúdo da tela é UM: o contorno da zona selecionada no
 *   corte (constraint da onda). Farol cinza/neutro quando não há dado —
 *   nunca verde por omissão.
 * - "Não mapeados" fecha o painel com a ação "Definir zona" (→ edição do
 *   equipamento, onde o select da T2 mora): o mapa do dia 1 é um convite,
 *   não um dashboard (spec §6).
 */

/** Farol da zona na LISTA — o `Farol` de sempre (com o brilho que a
 *  referência pede) quando há estado; ponto neutro sem brilho quando a zona
 *  não tem NENHUM dado atrás (mesmo desenho do "anulada" em
 *  `FarolOcorrencia`: presente, mas visivelmente fora de jogo). */
function FarolZona({ estado }: { estado: StatusFarol | null }) {
  if (estado) return <Farol status={estado} />
  return <span aria-label="Sem dados" className="inline-block size-2 shrink-0 rounded-full border border-dim/60" />
}

/** O resumo de uma zona, na voz da referência ("1 ocorrência aberta ·
 *  pintura de fundo vencida") — contagens honestas, nunca adjetivo sem dado. */
function resumoDaZona(z: ZonaDoMapa): string {
  const partes: string[] = []
  const abertas = z.ocorrencias.length
  if (abertas > 0) partes.push(abertas === 1 ? "1 ocorrência aberta" : `${abertas} ocorrências abertas`)
  const vencidos = z.equipamentos.filter((e) => e.status === "vencido").length
  const atencao = z.equipamentos.filter((e) => e.status === "atencao").length
  if (vencidos > 0) partes.push(vencidos === 1 ? "1 equipamento vencido" : `${vencidos} equipamentos vencidos`)
  else if (atencao > 0) partes.push(atencao === 1 ? "1 equipamento em atenção" : `${atencao} equipamentos em atenção`)
  if (partes.length > 0) return partes.join(" · ")
  return z.estado === "ok" ? "Sem pendência" : "Sem dados ainda"
}

/** Nome da linha — `nomeDoEquipamento` quando o tipo já diz o que é (Motor
 *  BB, Gerador); pra "outro"/"painel" a MESMA régua do hub
 *  /barco/equipamentos: identificação interna, senão marca+modelo, senão o
 *  genérico — "Guincho de proa" diz mais que "Equipamento". */
function tituloDoEquipamento(e: EquipamentoNoMapa["equipamento"]): string {
  if (e.tipo === "motor" || e.tipo === "gerador" || e.tipo === "bateria") return nomeDoEquipamento(e)
  return e.identificacao_interna || [e.marca, e.modelo].filter(Boolean).join(" ") || nomeDoEquipamento(e)
}

/** Marca e modelo embaixo — some quando já viraram o título (senão a linha
 *  diria a mesma coisa duas vezes). */
function subtituloDoEquipamento(e: EquipamentoNoMapa["equipamento"]): string | undefined {
  const marcaModelo = [e.marca, e.modelo].filter(Boolean).join(" ")
  if (!marcaModelo || tituloDoEquipamento(e) === marcaModelo) return undefined
  return marcaModelo
}

/** Linha de equipamento do painel — farol + nome + próximo vencimento
 *  (`textoRestante`, a mesma frase da ficha), levando pra ficha dele. */
function LinhaEquipamento({ e }: { e: EquipamentoNoMapa }) {
  return (
    <LinhaLista
      href={`/barco/equipamento/${e.equipamento.id}`}
      leading={<FarolZona estado={e.status} />}
      titulo={tituloDoEquipamento(e.equipamento)}
      subtitulo={subtituloDoEquipamento(e.equipamento)}
      valor={e.pior ? textoRestante(e.pior) || "—" : "sem dados"}
      valorClassName={e.status === "vencido" ? "text-crit" : e.status === "atencao" ? "text-warn" : "text-dim"}
    />
  )
}

export default async function MapaEmbarcacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ zona?: string }>
}) {
  const { zona: zonaBruta } = await searchParams
  const mapa = await carregarMapaDaEmbarcacao()
  if (!mapa) redirect("/onboarding")
  const { zonas, naoMapeados, zonasPedindoAtencao } = mapa

  // `?zona=` inválida = nenhuma selecionada (§3.3) — o vocabulário decide,
  // não a existência de equipamento (zona vazia selecionada acende a região
  // no corte mesmo sem pino: o mapa responde "é aqui").
  const selecionada = (ZONAS as readonly string[]).includes(zonaBruta ?? "")
    ? (zonaBruta as ZonaEmbarcacao)
    : null
  const daSelecionada = selecionada ? zonas.find((z) => z.zona === selecionada) ?? null : null

  const pinos: ZonaDoCasco[] = zonas.map((z) => ({
    zona: z.zona,
    quantidade: z.equipamentos.length,
    estado: z.estado,
  }))

  // O chip do topo, na anatomia da referência ("1 crítico" à direita do
  // rótulo): a contagem do PIOR nível presente entre as zonas — cor E
  // palavra, e neutro honesto quando nenhum equipamento foi mapeado ainda.
  const criticas = zonas.filter((z) => z.estado === "vencido").length
  const emAtencao = zonas.filter((z) => z.estado === "atencao").length
  const chipDoTopo =
    criticas > 0 ? (
      <Selo estado="critico">{criticas === 1 ? "1 crítico" : `${criticas} críticos`}</Selo>
    ) : emAtencao > 0 ? (
      <Selo estado="atencao">{emAtencao === 1 ? "1 atenção" : `${emAtencao} atenção`}</Selo>
    ) : zonas.some((z) => z.estado === "ok") ? (
      <Selo estado="ok">Em dia</Selo>
    ) : null

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/barco"
        voltarRotulo="Embarcação"
        titulo="Mapa da Embarcação"
        selo={chipDoTopo ?? undefined}
        descricao={
          zonasPedindoAtencao > 0
            ? `${zonasPedindoAtencao === 1 ? "1 zona pede" : `${zonasPedindoAtencao} zonas pedem`} atenção agora.`
            : "Onde cada equipamento mora no barco — e como cada zona está."
        }
      />

      {/*
        ONDA 63 — O CORTE GANHA A MAIOR CÉLULA, E TUDO QUE É LISTA VIRA
        TRILHA.

        A auditoria de 18/08 mediu esta tela a 1440 como "60% vazia", e a
        conta era simples: duas colunas iguais davam ao desenho metade da
        largura (o corte é travado em 760×320, então metade da largura é
        também metade da altura — 259px de barco), enquanto a outra metade
        exibia UMA frase com ~700px de nada embaixo. Ao mesmo tempo, a lista
        de zonas ficava presa embaixo do desenho, na coluna larga, com
        ~500px entre o nome da zona e a contagem — uma ponte de vazio no
        meio de cada linha.

        A referência (Haulix, imagens 4 e 5) põe o objeto central na maior
        célula da grade e empilha os cartões pequenos numa coluna densa ao
        lado. É o que passa a valer: `1.6fr / 1fr` dá ~780px ao corte (o
        barco cresce pra ~320px de altura, um terço a mais) e a coluna da
        direita recebe TUDO que é lista — zonas, painel da zona aberta e não
        mapeados —, empilhado, com ~460px de linha em vez de 780.

        O CELULAR NÃO MUDA, e não muda por acidente: a lista de zonas era o
        segundo bloco da coluna esquerda e vira o primeiro da direita, que
        vem logo em seguida — a ordem de leitura empilhada (corte → zonas →
        painel → não mapeados) é byte a byte a mesma. As margens
        acompanham: o `lg:mt-0` sai do painel e vai pra lista, que agora é
        quem encabeça a coluna.
      */}
      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start lg:gap-4">
        {/* ---- a maior célula: o corte, e só ele --------------------- */}
        <div>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3">
            <Casco zonas={pinos} selecionada={selecionada} hrefBase="/barco/mapa" ancora="painel-zona" />
            <p className="apoio mt-2 border-t border-line pt-2 text-dim">
              Toque numa zona para ver equipamentos, manutenções e ocorrências fixados nela.
            </p>
          </div>
        </div>

        {/* ---- a trilha densa: zonas, a zona aberta e os não mapeados --- */}
        <div className="scroll-mt-4">
          {zonas.length > 0 ? (
            <div className="sombra-1 mt-3 rounded-[var(--raio-cartao)] border border-line bg-panel px-4 lg:mt-0">
              {zonas.map((z) => (
                <LinhaLista
                  key={z.zona}
                  href={`/barco/mapa?zona=${z.zona}#painel-zona`}
                  leading={<FarolZona estado={z.estado} />}
                  titulo={ROTULO_ZONA[z.zona]}
                  subtitulo={resumoDaZona(z)}
                  valor={z.equipamentos.length}
                  valorClassName="text-dim"
                />
              ))}
            </div>
          ) : (
            <EstadoVazio
              className="mt-3 lg:mt-0"
              icone="mapa"
              titulo="Nenhum equipamento mapeado ainda"
              descricao="Diga onde cada um mora — abra o equipamento em “Não mapeados” e escolha a zona."
            />
          )}

          {selecionada ? (
            <section
              /* A âncora do pino mora AQUI, e não mais na coluna inteira: a
                 lista de zonas passou a encabeçar esta coluna, e com o id
                 no wrapper o toque num pino no celular pararia de rolar até
                 a resposta e pararia na lista (§3.3 — "tocar num pino rola
                 até o painel"). Os dois ramos deste ternário são
                 excludentes, então o id nunca aparece duas vezes na página. */
              id="painel-zona"
              aria-label={ROTULO_ZONA[selecionada]}
              className="sombra-1 mt-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4 scroll-mt-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="titulo-card">{ROTULO_ZONA[selecionada]}</h2>
                <Selo estado={seloDoFarol(daSelecionada?.estado ?? null)}>
                  {rotuloDoFarol(daSelecionada?.estado ?? null)}
                </Selo>
              </div>

              {daSelecionada == null || daSelecionada.equipamentos.length === 0 ? (
                <p className="apoio mt-3 text-dim">
                  Nada fixado nesta zona ainda. Pra fixar um equipamento aqui, abra a ficha dele e
                  escolha a zona em “Onde fica no barco”.
                </p>
              ) : (
                <div className="mt-1">
                  {daSelecionada.equipamentos.map((e) => (
                    <LinhaEquipamento key={e.equipamento.id} e={e} />
                  ))}
                </div>
              )}

              {daSelecionada != null && daSelecionada.ocorrencias.length > 0 && (
                <>
                  <p className="rotulo mt-4 mb-1 text-dim">Ocorrências abertas</p>
                  <div>
                    {daSelecionada.ocorrencias.map((o) => (
                      <LinhaLista
                        key={o.id}
                        href={`/barco/ocorrencias/${o.id}`}
                        leading={<FarolOcorrencia estado={o.estado} />}
                        titulo={o.titulo}
                        subtitulo={`${ROTULO_ESTADO[o.estado]}${o.gravidade ? ` · gravidade ${ROTULO_GRAVIDADE[o.gravidade]}` : ""}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </section>
          ) : (
            // Sem seleção o convite só aparece no desktop: no celular a lista
            // de zonas logo acima já É o convite, e um cartão "selecione uma
            // zona" entre ela e os não mapeados seria ruído.
            zonas.length > 0 && (
              <div id="painel-zona" className="mt-3 hidden rounded-[var(--raio-cartao)] border border-dashed border-line p-6 text-center lg:block">
                <p className="corpo text-dim">
                  Selecione uma zona no corte ao lado pra ver o que mora nela.
                </p>
              </div>
            )
          )}

          {naoMapeados.length > 0 && (
            <section
              aria-label="Não mapeados"
              className="sombra-1 mt-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="titulo-card">Não mapeados</h2>
                <span className="font-mono-instr text-sm font-semibold tabular-nums text-dim">
                  {naoMapeados.length}
                </span>
              </div>
              <p className="apoio mt-1 text-dim">
                Equipamentos que ainda não têm lugar no corte. Um toque em “Definir zona” resolve.
              </p>
              <div className="mt-1">
                {naoMapeados.map((e) => (
                  <LinhaLista
                    key={e.equipamento.id}
                    href={`/barco/equipamento/${e.equipamento.id}`}
                    leading={<FarolZona estado={e.status} />}
                    titulo={tituloDoEquipamento(e.equipamento)}
                    subtitulo={subtituloDoEquipamento(e.equipamento)}
                    trailing={
                      // Discreta, não dourada: o orçamento de dourado de
                      // conteúdo desta tela é 1 (o contorno da zona
                      // selecionada), e esta ação se repete por linha —
                      // mesmo tratamento de `EstadoVazio enfase="discreta"`.
                      // Onda 82 — pílula de contorno; ver `lib/ui/acoes.ts`.
                      <Link
                        href={`/barco/equipamento/${e.equipamento.id}/editar`}
                        className={ALVO_ACAO}
                      >
                        <span className={PILULA_ACAO}>Definir zona</span>
                      </Link>
                    }
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  )
}
