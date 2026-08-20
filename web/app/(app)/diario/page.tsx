import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone, type NomeIcone } from "@/components/icone"
import { BarraFerramentas } from "@/components/ui/barra-ferramentas"
import { Chip, ChipDado } from "@/components/ui/chip"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { ObjetoHub } from "@/components/ui/objeto-hub"
import { carregarPainel } from "@/lib/consultas"
import { duracaoHoras, textoDuracao, tituloDaSaida, tituloDoRegistro } from "@/lib/domain/bordo"
import { agruparPorMes, eventoNoFiltro, nomeDoEquipamento, TIPO_ROTULO, type FiltroDiario } from "@/lib/domain/diario"
import { formatarReais } from "@/lib/domain/gastos"
import { podeEditar } from "@/lib/domain/permissoes"
import { formatarDataCurta } from "@/lib/domain/semaforo"
import { supabaseServer } from "@/lib/supabase/server"
import type { Contato, Evento } from "@/lib/db/types"

const FILTROS: { valor: FiltroDiario; rotulo: string }[] = [
  { valor: "tudo", rotulo: "Tudo" }, { valor: "motores", rotulo: "Motores" },
  { valor: "eletrica", rotulo: "Elétrica" }, { valor: "casco", rotulo: "Casco" },
  { valor: "docs", rotulo: "Docs" }, { valor: "gastos", rotulo: "Gastos" },
]

// O ícone da pastilha de cada registro (canvas tela-3a): a SAÍDA leva o
// barco em dourado — é a atividade, o coração do feed; todo o resto fica
// neutro. Mesmo desenho dos cartões de "O que aconteceu?" no formulário,
// exceto navegação, que lá é mapa (gesto de registrar) e aqui é o barco
// (a coisa que saiu).
const ICONE_TIPO: Record<string, NomeIcone> = {
  navegacao: "embarcacao", manutencao: "ferramenta", abastecimento: "oleo",
  avaria: "alerta", docagem: "ancora", leitura_horas: "relogio", outro: "mais",
}

export default async function DiarioPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; erro?: string }>
}) {
  const { filtro: bruto, erro } = await searchParams
  const filtro = (FILTROS.some((f) => f.valor === bruto) ? bruto : "tudo") as FiltroDiario

  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const podeEscrever = podeEditar(painel.permissoes, "diario")
  const supabase = await supabaseServer()
  const [{ data: eventos, error: erroEventos }, { data: contatos }] = await Promise.all([
    supabase.from("eventos")
      // `local_saida` e `passageiros` entraram na onda 62: o feed do canvas
      // (tela-3a) põe a rota no título ("Angra dos Reis → Ilha Grande") e
      // conta quem estava a bordo — os dois campos já existiam na tabela
      // (PRD §23), só não eram lidos aqui.
      //
      // ONDA 100 — `distancia_nm` NO LUGAR DE `trilha`. O feed pede 300
      // registros e baixava a trilha GPS inteira de cada saída para desenhar
      // um chip de uma linha. Com o teto de 4.000 pontos por trilha, 300
      // saídas são ~66 MB numa tela que mostra "TRILHA 12,4 MN" — mais do que
      // o `statement_timeout` de 8 s desta função aguenta transferir. A
      // distância agora é gravada quando a saída é salva (migration 092); a
      // trilha crua desce só em `/diario/[id]`, que de fato desenha o traçado.
      .select("id, embarcacao_id, equipamento_id, item_monitorado_id, contato_id, tipo, categoria, data, horas_no_momento, descricao, custo_centavos, anexo_path, distancia_nm, hora_saida, hora_retorno, local_saida, destino, tripulacao, passageiros, mar_onda_m, mar_vento_kt, importado_do_plotter")
      .eq("embarcacao_id", painel.embarcacao.id)
      .order("data", { ascending: false }).order("created_at", { ascending: false }).limit(300),
    supabase.from("contatos").select("id, nome"),
  ])
  if (erroEventos) throw new Error("Não foi possível carregar o diário. Recarregue a página.")

  const porId = new Map(painel.equipamentos.map((e) => [e.id, e]))
  const nomeContato = new Map((contatos ?? []).map((c: Pick<Contato, "id" | "nome">) => [c.id, c.nome]))

  const visiveis = ((eventos ?? []) as Evento[]).filter((e) =>
    eventoNoFiltro(
      {
        tipo: e.tipo, categoria: e.categoria, custoCentavos: e.custo_centavos,
        tipoEquipamento: e.equipamento_id ? porId.get(e.equipamento_id)?.tipo ?? null : null,
      },
      filtro,
    ),
  )
  const grupos = agruparPorMes(visiveis)

  // ONDA 100 — AS DUAS ÚLTIMAS ESPERAS DESTA TELA VIRARAM UMA.
  //
  // As URLs de anexo e os nomes da tripulação dependem os dois de `visiveis`, e
  // de mais nada um do outro: estavam em fila só porque uma variável foi
  // escrita antes da outra. Uma volta de rede a menos por abertura do Diário.
  const [urlsAnexo, nomePerfil] = await Promise.all([
    // Anexo (NF, foto do serviço) só era gravado — nunca reaparecia em lugar
    // nenhum. Mesmo padrão de URL assinada já usado em Documentos.
    Promise.all(
      visiveis
        .filter((e): e is Evento & { anexo_path: string } => e.anexo_path != null)
        .map(async (e) => {
          const { data } = await supabase.storage.from("acervo").createSignedUrl(e.anexo_path, 3600)
          return [e.id, data?.signedUrl ?? null] as const
        }),
    ).then((pares) => new Map(pares)),
    // Nomes da tripulacao a bordo (Livro de Bordo) — so busca perfis dos ids
    // que realmente aparecem nos eventos visiveis.
    (async () => {
      const idsTripulacao = [...new Set(visiveis.flatMap((e) => e.tripulacao ?? []))]
      const { data: perfisTripulacao } = idsTripulacao.length
        ? await supabase.from("profiles").select("id, nome").in("id", idsTripulacao)
        : { data: [] as { id: string; nome: string }[] }
      return new Map((perfisTripulacao ?? []).map((p: { id: string; nome: string }) => [p.id, p.nome]))
    })(),
  ])

  return (
    <main>
      <h1 className="titulo-pagina">Diário de Bordo</h1>

      {/* ONDA 118 — O BARCO ABRE O DIÁRIO, como na imagem 5 do guia; onda 119
          pôs o render do iate holográfico no lugar da cena desenhada.
          ONDA 122 — A MOLDURA CAI. A imagem 5 não desenha caixa nenhuma em
          volta do barco: ele FLUTUA sobre o fundo da tela. A borda + painel
          que este bloco vestia era exatamente a "linha do card" que o dono
          mandou não existir na Início — mesmo pedido, mesma resposta: a
          máscara de bordas esvaídas (`mascara-borda-esvaida`, globals.css).
          `h-36` e não os 176px de herói de hub: §9 do guia — o objeto nas
          telas operacionais é menor e de apoio, nunca compete com os dados. */}
      <div aria-hidden="true" className="mascara-borda-esvaida relative mt-2 h-36">
        <ObjetoHub chave="iate" className="h-full w-full !rounded-none" />
      </div>
      {/* A frase de baixo do título é a do canvas (tela-3a): diz de uma vez o
          que mora aqui, pra primeira visita não precisar deduzir do filtro. */}
      {/* Importar do plotter (onda 21) — anos de trilha ja gravada no
          Garmin/Raymarine/Navionics viram saida de uma vez, sem digitar nada.
          Segunda acao discreta pra nao competir com o "Registrar" da
          BarraFerramentas (o gesto mais comum), mas ainda ≤3 toques a
          partir de /hoje. */}
      {podeEscrever ? (
        <div className="mt-2 flex justify-end">
          <Link
            href="/diario/importar"
            className="rotulo inline-flex min-h-11 items-center gap-1.5 rounded-[var(--raio-pilula)] px-2 text-accent-forte"
          >
            <Icone nome="guardado" className="size-3.5" /> Importar do plotter
          </Link>
        </div>
      ) : (
        // §24: em vez de a área de ação sumir sem explicação, ela diz por quê.
        <p className="apoio mt-2 text-dim">
          Seu acesso ao Diário é de leitura. Quem registra saídas e manutenções é quem tem permissão de
          editar — fale com o proprietário.
        </p>
      )}
      {erro && <p className="mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erro}</p>}

      {/* ONDA 59 — a barra engole o ChipLinha de filtros e ganha a ação de
          criar, que saiu do cabeçalho. §27.2 continua valendo: a ação só
          existe pra quem pode escrever (`podeEscrever`); quem só lê vê os
          filtros sozinhos, sem a pílula dourada. */}
      <BarraFerramentas
        className="mt-4"
        filtros={
          <>
            {FILTROS.map((f) => (
              <Chip
                key={f.valor}
                href={f.valor === "tudo" ? "/diario" : `/diario?filtro=${f.valor}`}
                ativo={filtro === f.valor}
              >
                {f.rotulo}
              </Chip>
            ))}
          </>
        }
        acao={podeEscrever ? { href: "/diario/novo", rotulo: "Registrar" } : undefined}
      />

      {grupos.length === 0 && (
        <EstadoVazio
          icone="calendario"
          titulo="Nenhum registro por aqui ainda"
          descricao="Toque em “Registrar” para criar o primeiro — cada serviço registrado vira histórico e dossiê do barco."
          acao={{ href: "/diario/novo", rotulo: "Registrar" }}
          className="mt-6"
        />
      )}

      {/* ONDA 62 — A ANATOMIA DO FEED É A DO CANVAS (tela-3a): cada registro
          é um CARTÃO próprio — pastilha do tipo à esquerda (dourada só na
          saída, que é a atividade), o verbo no título, o carimbo da data em
          mono à direita. A saída ganha a fileira de pílulas de instrumento
          (No mar · Trilha · A bordo) com "sem GPS" no lugar de distância
          inventada — o diário não inventa milha. Antes era um painel único
          por mês com linhas separadas por borda; o canvas manda cartões. */}
      {grupos.map((g) => (
        <section key={g.rotulo}>
          <SecaoPagina>{g.rotulo}</SecaoPagina>
          {/* ONDA 122 — o FIO da linha do tempo: um traço de 1px atrás da
              coluna de medalhões (centro do círculo de 36px = 18px), ligando
              os registros do mês como a imagem 5 desenha. `top-2/bottom-4`
              param o fio no primeiro e no último medalhão em vez de vazar
              pelas pontas da lista. */}
          <div className="relative flex flex-col gap-2">
            <span aria-hidden="true" className="absolute bottom-4 left-[18px] top-2 w-px bg-line" />
            {g.eventos.map((e) => {
              const eq = e.equipamento_id ? porId.get(e.equipamento_id) : null
              const urlAnexo = e.anexo_path ? urlsAnexo.get(e.id) : null
              // A saida vira feed de atividade (onda 18): cartao inteiro leva pra
              // /diario/[id] (mapa da trilha + painel de numeros + compartilhar).
              // Os demais tipos de registro continuam sem link — nao e tudo que
              // e "atividade".
              const ehSaida = e.tipo === "navegacao"
              const duracaoEvento = ehSaida ? duracaoHoras(e.hora_saida, e.hora_retorno) : null
              // ONDA 100 — A DISTÂNCIA VEM GRAVADA, NÃO RECALCULADA.
              //
              // O comentário anterior dizia que trazer a trilha na consulta era
              // "custo aceitavel" porque um barco tem poucas saídas. A conta
              // estava errada por três ordens de grandeza: o teto é 300 saídas
              // nesta tela e 4.000 pontos por trilha, ou seja ~66 MB no pior
              // caso — para desenhar um chip. `distancia_nm` é o mesmo número,
              // calculado pela mesma `resumoTrilha`, na hora de gravar.
              //
              // `null` continua sendo "sem GPS", nunca "0 MN": saída sem trilha
              // não tem distância, e uma trilha que existe mas não saiu do
              // lugar tem distância zero — são coisas diferentes e a tela
              // continua distinguindo as duas.
              const distanciaNm = ehSaida ? e.distancia_nm : null
              const tripNomes = (e.tripulacao ?? [])
                .map((id) => nomePerfil.get(id))
                .filter((n): n is string => Boolean(n))
              // Quem estava a bordo, em gente: tripulacao com conta + passageiros
              // digitados. Zero nao vira pilula — ninguem registrou ninguem.
              const aBordo = (e.tripulacao ?? []).length + (e.passageiros ?? []).length
              const temMar = e.mar_onda_m != null || e.mar_vento_kt != null
              const apoioSaida = ehSaida
                ? [
                    tripNomes.length > 0 ? tripNomes.join(", ") : null,
                    temMar
                      ? `mar ${e.mar_onda_m != null ? `${e.mar_onda_m.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m` : "—"} / ${e.mar_vento_kt != null ? `${Math.round(e.mar_vento_kt)} kt` : "—"}`
                      : null,
                    e.descricao,
                  ].filter(Boolean).join(" · ")
                : ""
              const titulo = ehSaida
                ? tituloDaSaida(e.local_saida, e.destino) ?? TIPO_ROTULO[e.tipo]
                : tituloDoRegistro(TIPO_ROTULO[e.tipo] ?? e.tipo, e.descricao, eq ? nomeDoEquipamento(eq) : null)
              // ONDA 122 — O CARTÃO GANHA A ANATOMIA DA IMAGEM 5 DO GUIA:
              // a primeira linha é o CARTUCHO "data · tipo" (a imagem escreve
              // "18 ago 2026 · Navegação" em cima de cada registro, na cor do
              // tipo), o título vem na segunda, e o chevron fecha a linha SÓ
              // na saída — que é o único cartão que navega; chevron em cartão
              // que não abre nada seria promessa quebrada. O ícone que morava
              // aqui desceu pro MEDALHÃO da linha do tempo, ao lado do cartão.
              // A data sai do canto direito: dentro de um grupo que já se
              // chama "Agosto", "18/08" à esquerda conta a mesma história sem
              // disputar a borda com o chevron.
              const corDoTipo = ehSaida ? "text-accent-forte" : e.tipo === "avaria" ? "text-crit" : "text-dim"
              const conteudo = (
                <>
                  <p className={`rotulo-dado tabular-nums ${corDoTipo}`}>
                    {formatarDataCurta(e.data)} · {TIPO_ROTULO[e.tipo] ?? e.tipo}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="titulo-card min-w-0 flex-1 line-clamp-2">{titulo}</p>
                    {ehSaida && <Icone nome="chevron" className="size-4 shrink-0 text-dim" />}
                  </div>
                  {ehSaida && (
                    /* ONDA 93 — A FILEIRA VOLTA PRA CASA. Estas três pílulas
                       são a origem do `ChipDado` (a onda 91 promoveu o desenho
                       DAQUI pro componente) e continuavam escritas à mão logo
                       abaixo dele — o jeito clássico de as duas cópias
                       derivarem. Agora o dono do desenho é um só.
                       O que muda na tela: o valor sai em `.valor` (14px) no
                       lugar dos 12px que este arquivo escrevia. É a régua de
                       hierarquia da onda 87 — 12px ao lado de um rótulo de
                       11px liam como a mesma voz — e custa 2,4px de altura no
                       chip (26,5 → 28,9). Os `mt-1` abaixo pagam essa conta
                       com folga; a medida completa está no bloco do fim.
                       `mt-1` e não `mt-2`: é o mesmo respiro que `LinhaLista`
                       usa entre o texto e o slot `chips` — a fileira de chips
                       do app passa a ter um valor só. */
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {duracaoEvento != null && (
                        <ChipDado rotulo="No mar">{textoDuracao(duracaoEvento)}</ChipDado>
                      )}
                      <ChipDado rotulo="Trilha">
                        {distanciaNm != null ? (
                          `${distanciaNm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MN`
                        ) : (
                          // "sem GPS" no lugar de 0 MN — o diário não inventa
                          // distância (nota do próprio canvas). E ele veste
                          // AUSÊNCIA, não leitura: cinza e peso normal contra o
                          // branco seminegrito que o `ChipDado` dá a um número
                          // de verdade. Sem isso, "sem GPS" teria exatamente a
                          // mesma voz de "12,4 MN" — que é a confusão entre
                          // "zero" e "não sei" com outra roupa.
                          <span className="font-normal text-dim">sem GPS</span>
                        )}
                      </ChipDado>
                      {aBordo > 0 && <ChipDado rotulo="A bordo">{aBordo}</ChipDado>}
                    </div>
                  )}
                  {ehSaida
                    ? apoioSaida && <p className="apoio mt-1 text-dim">{apoioSaida}</p>
                    : (e.horas_no_momento != null || e.contato_id || e.custo_centavos != null) && (
                        <p className="apoio mt-1 text-dim">
                          {e.contato_id && nomeContato.get(e.contato_id)}
                          {e.horas_no_momento != null && (
                            <>
                              {e.contato_id ? " · " : ""}horímetro{" "}
                              <span className="tabular-nums tabular-nums text-texto">
                                {e.horas_no_momento.toLocaleString("pt-BR")} h
                              </span>
                            </>
                          )}
                          {e.custo_centavos != null && (
                            <>
                              {e.contato_id || e.horas_no_momento != null ? " · " : ""}
                              <span className="tabular-nums tabular-nums text-texto">{formatarReais(e.custo_centavos)}</span>
                            </>
                          )}
                        </p>
                      )}
                  {(e.importado_do_plotter || (urlAnexo && !ehSaida)) && (
                    <p className="mt-2 flex flex-wrap items-center gap-1.5">
                      {e.importado_do_plotter && (
                        <span className="inline-flex items-center gap-1 rounded-[var(--raio-pilula)] border border-line px-2 py-0.5 tabular-nums rotulo-dado text-dim">
                          <Icone nome="guardado" className="size-3" /> Importada do plotter
                        </span>
                      )}
                      {/* Só fora da saída: o cartão de saída inteiro já é um
                          <Link>, e âncora dentro de âncora é HTML inválido —
                          o anexo dela abre por /diario/[id]. */}
                      {urlAnexo && !ehSaida && (
                        <a href={urlAnexo} target="_blank" rel="noopener noreferrer" className="apoio inline-flex min-h-6 items-center text-accent-forte">
                          Abrir anexo
                        </a>
                      )}
                    </p>
                  )}
                </>
              )
              // A CONTA DA DENSIDADE, PARCELA POR PARCELA (ondas 92 e 93).
              // O `p-3` (12px, degrau da escala e a decisão já tomada em
              // `Cartao`: "a referência é densa") fica. Quem engordava o
              // cartão era o resto:
              //
              //   parcela                      o. 91   o. 92   o. 93
              //   p-3 topo + base               24      24      24
              //   linha 1 (pastilha 30 → ícone) 30      20,25   20,25
              //   folga antes dos chips         10      8 (2)   4 (1)
              //   fileira de chips              28,5    26,5    28,9 (ChipDado)
              //   folga antes do apoio          10      8 (2)   4 (1)
              //   linha de apoio (.apoio)       18      18      18
              //   TOTAL                        120,5   104,75   99,15
              //
              // Com o `gap-2` entre cartões, o passo da lista cai de 128,5
              // (onda 91) para 107,15px. A referência faz o mesmo trabalho em
              // ~64px; continuamos acima dela porque o nosso é um CARTÃO com
              // borda e o dela é uma linha dentro de um painel.
              //
              // ALTERNATIVA DESCARTADA (1): levar a linha de apoio para dentro
              // dos chips ("mar 0,8 m / 12 kt" é leitura, não prosa) e fechar
              // em ~76px. Não fecha: `apoioSaida` é mar MAIS tripulação MAIS
              // descrição — só o mar viraria chip, e a linha continuaria
              // existindo nas saídas com gente ou texto, que são a maioria. E
              // o chip do mar não cabe na primeira fileira em 390px: viraria
              // uma segunda fileira de 28,9px, mais cara que a linha de apoio
              // de 18px que ele veio substituir.
              //
              // ALTERNATIVA DESCARTADA (2), e é a mesma régua da primeira:
              // trocar o cartão inteiro por `LinhaLista variant="cartao"` com
              // o slot `chips` (onda 91). Ele foi feito para isto e mesmo
              // assim não serve AQUI, por largura, não por altura. No
              // `LinhaLista` os chips moram DENTRO do bloco de texto — é a
              // decisão declarada lá ("a mesma largura do título, sem disputar
              // espaço com o número da direita"). Só que a nossa direita é o
              // carimbo da data, e ele mais o ícone da esquerda cobram
              //   20 (ícone) + 42 (data em `.valor`) + 24 (dois `gap-3`) = 86px
              // dos 334px úteis do cartão a 390px — sobram 248. Dois
              // `ChipDado` do vocabulário desta tela ("NO MAR 3 h 30" ≈ 125px
              // + "TRILHA 12,4 MN" ≈ 133px + 6 de gap) medem ~264: a fileira
              // que hoje cabe numa linha passa a quebrar em duas, +28,9px, e o
              // cartão sobe pra ~132px. Ou seja, o mesmo motivo que barrou o
              // chip do mar barra a mudança de casca — a fileira a 390px está
              // no limite, e `meio` é 86px mais estreito que o cartão.
              // O que destravaria: chips em largura cheia (abaixo da linha, e
              // não dentro dela) OU alinhamento ao topo, pra ícone e data não
              // flutuarem no meio de um bloco de três linhas. Prop nova em
              // componente de outro dono — vai no relatório, não aqui.
              //
              // (Nota da onda 122: a conta acima descreve o cartão ANTES da
              // linha do tempo — ícone e data moravam na linha do título. O
              // cartucho "data · tipo" acrescenta ~15px por cartão e o
              // medalhão come 48px de largura; o preço está medido na prova
              // visual da onda, e a régua das alternativas descartadas segue
              // valendo: fileira de chips a 390px continua no limite.)
              // ONDA 122 — O MEDALHÃO DA LINHA DO TEMPO (imagem 5): o círculo
              // com o ícone do tipo, ligado ao vizinho pelo fio que a `<div>`
              // do grupo desenha atrás. A cor obedece a régua do feed: ouro só
              // na saída (a atividade), vermelho só na avaria (semântico), o
              // resto neutro — a imagem pinta cada tipo de uma cor, mas seis
              // cores empilhadas era exatamente o "zoneado" que o redesign
              // veio matar; escopo de cor é a regra da casa (§5).
              // `bg-panel2` opaco de propósito: é quem esconde o fio na
              // passagem por trás do círculo.
              const casca = "block min-w-0 flex-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3 sombra-1"
              const corMedalhao = ehSaida
                ? "border-accent/40 text-accent-forte"
                : e.tipo === "avaria"
                  ? "border-crit/40 text-crit"
                  : "border-line text-dim"
              return (
                <article key={e.id} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className={`relative z-[1] mt-1.5 flex size-9 shrink-0 items-center justify-center rounded-full border bg-panel2 ${corMedalhao}`}
                  >
                    <Icone nome={ICONE_TIPO[e.tipo] ?? "mais"} className="size-4" />
                  </span>
                  {ehSaida ? (
                    <Link href={`/diario/${e.id}`} className={casca}>
                      {conteudo}
                    </Link>
                  ) : (
                    <div className={casca}>{conteudo}</div>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </main>
  )
}
