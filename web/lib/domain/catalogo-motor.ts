/**
 * O CATÁLOGO DE MOTOR (onda 64 — PRD-3D-ENGINE §16, §23, §24).
 *
 * O §16 manda a corrente de manutenção existir SEM depender do 3D:
 * Fabricante → Família → Modelo/Variante → Componente → Part Number OEM →
 * Plano de manutenção. Este módulo é o lado puro dela — nenhuma função aqui
 * toca o banco (mesmo espírito de `semaforo.ts` e `plano-acesso.ts`: quem
 * consulta é `lib/consultas*.ts`, que entrega o dado pronto).
 *
 * ---------------------------------------------------------------------------
 * A REGRA QUE ATRAVESSA O ARQUIVO INTEIRO: O CATÁLOGO NUNCA APAGA O DONO
 * ---------------------------------------------------------------------------
 * `equipamentos.marca` e `.modelo` são texto livre desde a onda 1 e continuam
 * valendo. O catálogo é um vínculo OPCIONAL por cima. Toda função daqui que
 * escolhe entre "o que o catálogo diz" e "o que o dono escreveu" está
 * documentada com quem ganha e por quê — e em nenhum caso o texto do dono é
 * descartado em silêncio.
 *
 * Motivo prático: o Commander atende barco de 40 a 60 pés no Rio, e uma parte
 * dessa frota tem motor que não vai estar no catálogo tão cedo. Um catálogo
 * que exige escolher da lista transformaria "cadastrar meu motor" em "seu
 * motor não existe".
 */

// ---------------------------------------------------------------------------
// Vocabulário
// ---------------------------------------------------------------------------

/** Os oito sistemas do componente. O §2 do PRD mostra "Sistema: Lubrificação"
 *  no painel da peça — é este rótulo. Espelha o `check` da migration 057. */
export const SISTEMAS_MOTOR = [
  "lubrificacao", "combustivel", "arrefecimento", "eletrica",
  "transmissao", "admissao_escape", "propulsao", "outro",
] as const

export type SistemaMotor = (typeof SISTEMAS_MOTOR)[number]

export const ROTULO_SISTEMA: Record<SistemaMotor, string> = {
  lubrificacao: "Lubrificação",
  combustivel: "Combustível",
  arrefecimento: "Arrefecimento",
  eletrica: "Elétrica do motor",
  transmissao: "Transmissão",
  admissao_escape: "Admissão e escape",
  propulsao: "Propulsão",
  outro: "Outro",
}

/** O agrupamento do §20, que separa o levantamento por natureza do motor.
 *  Serve de filtro na busca: quem tem popa não precisa ver MTU. */
export const SEGMENTOS_MOTOR = ["popa", "centro_rabeta", "diesel_interno"] as const

export type SegmentoMotor = (typeof SEGMENTOS_MOTOR)[number]

export const ROTULO_SEGMENTO: Record<SegmentoMotor, string> = {
  popa: "Popa",
  centro_rabeta: "Centro-rabeta",
  diesel_interno: "Diesel interno",
}

/** A porta de entrada do texto do banco neste vocabulário. `motor_fabricantes
 *  .segmento` é `text`, e um `as SegmentoMotor` no `map` da consulta faria o
 *  tipo prometer o que a coluna não garante. */
export function ehSegmentoMotor(valor: string | null | undefined): valor is SegmentoMotor {
  return (SEGMENTOS_MOTOR as readonly string[]).includes(valor ?? "")
}

// ---------------------------------------------------------------------------
// As formas que o domínio recebe (o mínimo — nunca a linha inteira do banco)
// ---------------------------------------------------------------------------

export interface ModeloCatalogo {
  id: string
  nome: string
  potenciaHp: number | null
  anoInicio: number | null
  anoFim: number | null
  familia: string
  fabricante: string
  /**
   * O segmento do FABRICANTE, que sobe pela família até aqui (a coluna mora em
   * `motor_fabricantes`, migration 057).
   *
   * `null` NÃO é "sem segmento": é "o catálogo trouxe um valor que este
   * vocabulário não conhece". A coluna é `not null` no banco e os três valores
   * de hoje batem com `SEGMENTOS_MOTOR` — mas o dia em que alguém cadastrar um
   * quarto segmento pelo SQL, o modelo tem que continuar aparecendo na busca
   * em vez de ser empurrado para uma gaveta errada. Quem lê este `null` é
   * `podeFiltrarPorSegmento`, que desliga o filtro inteiro nesse caso.
   */
  segmento: SegmentoMotor | null
}

export interface ComponenteCatalogo {
  id: string
  nome: string
  sistema: SistemaMotor
  partNumberOem: string | null
  intervaloHoras: number | null
  intervaloMeses: number | null
}

// ---------------------------------------------------------------------------
// Identidade do motor
// ---------------------------------------------------------------------------

/**
 * "Volvo Penta D6-440" — o nome completo, sem repetir pedaço.
 *
 * O `startsWith` não é preciosismo: no catálogo real a família é "D6" e o
 * modelo é "D6-440". Concatenar os três às cegas daria "Volvo Penta D6 D6-440".
 * Quando o nome do modelo já começa pela família, a família sai.
 */
export function nomeCompletoDoModelo(m: ModeloCatalogo): string {
  const familia = normalizar(m.nome).startsWith(normalizar(m.familia)) ? null : m.familia
  return [m.fabricante, familia, m.nome].filter(Boolean).join(" ")
}

/**
 * A identidade que a ficha do motor mostra.
 *
 * Catálogo ganha do texto livre — é justamente a identidade que ele existe
 * pra dar. Sem catálogo, vale o que o dono escreveu. Sem nenhum dos dois,
 * `null`: a ficha diz "—", nunca inventa "Motor".
 */
export function identidadeDoMotor(
  livre: { marca: string | null; modelo: string | null },
  catalogo: ModeloCatalogo | null,
): string | null {
  if (catalogo) return nomeCompletoDoModelo(catalogo)
  const texto = [livre.marca?.trim(), livre.modelo?.trim()].filter(Boolean).join(" ")
  return texto || null
}

/**
 * "2015–2021", "desde 2015", "até 2010" ou `null`.
 *
 * As três formas existem porque as duas pontas são nullable de propósito
 * (migration 057): motor em linha não tem ano final, e de motor antigo às
 * vezes não se sabe o inicial. Traço longo (–) porque é intervalo, não hífen.
 */
export function faixaDeAno(m: Pick<ModeloCatalogo, "anoInicio" | "anoFim">): string | null {
  if (m.anoInicio != null && m.anoFim != null) {
    return m.anoInicio === m.anoFim ? `${m.anoInicio}` : `${m.anoInicio}–${m.anoFim}`
  }
  if (m.anoInicio != null) return `desde ${m.anoInicio}`
  if (m.anoFim != null) return `até ${m.anoFim}`
  return null
}

// ---------------------------------------------------------------------------
// Componente → peça → plano (os três últimos elos do §16)
// ---------------------------------------------------------------------------

/**
 * `partNumberVigente` MORAVA AQUI, E SAIU NA VARREDURA DE 19/08/2026.
 *
 * Ela escolhia entre o part number do item e o do componente do catálogo (o
 * dono ganhava, o catálogo era reserva). A regra continua certa no papel; o
 * que não existia era o caminho até ela. Medido antes de apagar:
 *
 *   · o único consumidor em todo o `web/` era o próprio `.test.ts` — a citação
 *     em `lib/db/types.ts` era comentário, não chamada;
 *   · `itens_monitorados.motor_componente_id`, que é o elo por onde o part
 *     number do catálogo chegaria, NUNCA é gravado por nenhuma action nem
 *     pedido por nenhum formulário. O segundo argumento da função não tinha
 *     como ser diferente de `null`;
 *   · e nenhuma tela exibe `itens_monitorados.part_number_oem` — os dois
 *     formulários (`barco/itens/novo` e `barco/itens/[id]/editar`) COLETAM o
 *     campo e nada o mostra de volta.
 *
 * Ou seja: uma função que dava a impressão de que o elo "peça → código OEM" do
 * §16 estava fechado, num app onde ele não começou. Quando a ficha do item
 * passar a exibir o part number — e quando algo popular `motor_componente_id`
 * —, a regra do dono-ganha-do-catálogo volta junto com o consumidor, que é a
 * ordem que esta rodada inteira aplicou.
 */

/**
 * O plano que o catálogo sugere quando um item é ligado a um componente.
 *
 * É SUGESTÃO, não imposição: devolve os intervalos pra pré-preencher o
 * formulário, e o dono ajusta. Componente sem nenhum intervalo devolve `null`
 * — peça que só se troca quando quebra não ganha plano inventado (é a mesma
 * confissão do "sem informação suficiente" da ficha de equipamento).
 */
export function planoSugerido(
  c: Pick<ComponenteCatalogo, "intervaloHoras" | "intervaloMeses">,
): { intervaloHoras: number | null; intervaloMeses: number | null } | null {
  if (c.intervaloHoras == null && c.intervaloMeses == null) return null
  return { intervaloHoras: c.intervaloHoras, intervaloMeses: c.intervaloMeses }
}

// ---------------------------------------------------------------------------
// O filtro por segmento (§20)
// ---------------------------------------------------------------------------

/**
 * Quais segmentos ESTE catálogo realmente tem, na ordem de `SEGMENTOS_MOTOR`.
 *
 * Derivado dos modelos carregados e não da constante: a lista tem hoje um
 * fabricante de centro-rabeta com UMA família e ZERO modelos, e um chip
 * "Centro-rabeta" que abre numa lista vazia é uma promessa que o catálogo não
 * cumpre. A ordem vem da constante porque é a ordem do §20 (do motor mais
 * comum ao menos comum na frota que o Commander atende), não a alfabética nem
 * a de chegada no banco.
 */
export function segmentosPresentes(modelos: readonly ModeloCatalogo[]): SegmentoMotor[] {
  const achados = new Set(modelos.map((m) => m.segmento).filter(ehSegmentoMotor))
  return SEGMENTOS_MOTOR.filter((s) => achados.has(s))
}

/**
 * O FILTRO SÓ APARECE QUANDO ELE NÃO ESCONDE NADA EM SILÊNCIO.
 *
 * Esta é a régua que a auditoria de 19/08 cobrou caro, e ela vale tanto pra
 * desenhar um dado quanto pra ESCONDER um: um chip de segmento tira modelos da
 * lista, e modelo que some sem explicação é pior do que filtro nenhum — quem
 * digita "D6" e não acha conclui que o catálogo não tem o motor dele.
 *
 * Duas condições, e as duas são sobre o dado, não sobre o desenho:
 *
 *   · NENHUM modelo com segmento desconhecido. Se um único vier fora do
 *     vocabulário, ele não caberia em chip nenhum e sumiria ao primeiro
 *     toque. Com o filtro desligado ele continua achável pela busca, que é o
 *     comportamento que o app tinha antes e nunca mentiu.
 *   · PELO MENOS DOIS segmentos presentes. Filtrar uma lista que é toda do
 *     mesmo segmento é um controle que não faz nada — e controle que não faz
 *     nada ensina a ignorar os que fazem.
 *
 * Medido no banco em 19/08/2026 antes de ligar: 12 fabricantes, 12 com
 * segmento preenchido, 0 nulos, três valores distintos — todos os três dentro
 * de `SEGMENTOS_MOTOR`. Dos três, dois têm modelo (popa 16, diesel interno 7);
 * centro-rabeta tem 0 e por isso não vira chip.
 */
export function podeFiltrarPorSegmento(modelos: readonly ModeloCatalogo[]): boolean {
  if (modelos.some((m) => m.segmento === null)) return false
  return segmentosPresentes(modelos).length >= 2
}

/** O recorte em si. `null` é "Todos" — e é o padrão da tela, porque quem não
 *  escolheu segmento nenhum quer ver o catálogo inteiro. */
export function filtrarPorSegmento(
  modelos: readonly ModeloCatalogo[],
  segmento: SegmentoMotor | null,
): ModeloCatalogo[] {
  return segmento === null ? [...modelos] : modelos.filter((m) => m.segmento === segmento)
}

// ---------------------------------------------------------------------------
// Busca
// ---------------------------------------------------------------------------

/**
 * A busca do cadastro de motor.
 *
 * O problema que ela resolve é o do §16 em miniatura: a mesma pessoa escreve
 * "D6-440", "d6 440" e "D6440" em dias diferentes. `normalizar` tira acento,
 * caixa e todo separador, então as três chegam em "d6440" e acham a mesma
 * linha. Sem isso, o catálogo teria identidade no banco e nenhuma na busca.
 *
 * A ordenação é por qualidade do casamento, não alfabética: prefixo antes de
 * meio, e nome antes de família/fabricante. Quem digita "d6" quer o D6 no
 * topo, não um Mercury cuja descrição por acaso contém "d6".
 */
export function buscarModelos(
  termo: string,
  modelos: readonly ModeloCatalogo[],
  limite = 8,
): ModeloCatalogo[] {
  const palavras = termo.split(/[^\p{L}\p{N}]+/u).map(normalizar).filter(Boolean)
  if (palavras.length === 0) return []
  return modelos
    .map((m) => ({ m, peso: pesoDoCasamento(palavras, m) }))
    .filter((x) => x.peso > 0)
    .sort((a, b) => b.peso - a.peso || a.m.nome.localeCompare(b.m.nome, "pt-BR"))
    .slice(0, Math.max(0, limite))
    .map((x) => x.m)
}

/**
 * 0 = não casa. Maior = casamento melhor.
 *
 * As palavras são tratadas de duas formas, e as duas são necessárias:
 *
 * GRUDADAS, pro casamento no nome do modelo — "d6 440", "D6-440" e "d6440"
 * têm que achar a mesma linha, e é grudando que as três viram "d6440".
 *
 * SEPARADAS, pro casamento no nome completo — quem digita "volvo d6" espera o
 * D6 da Volvo. Grudado isso vira "volvod6", que não existe em
 * "volvopentad6440" porque "penta" está no meio; exigindo cada palavra em
 * separado, "volvo" e "d6" acham a linha certa. Exigir TODAS (e não qualquer
 * uma) é o que impede "volvo d6" de trazer o D4 junto.
 */
function pesoDoCasamento(palavras: readonly string[], m: ModeloCatalogo): number {
  const grudado = palavras.join("")
  const nome = normalizar(m.nome)
  if (nome.startsWith(grudado)) return 4
  if (nome.includes(grudado)) return 3
  const completo = normalizar(nomeCompletoDoModelo(m))
  if (palavras.every((p) => completo.includes(p))) return 2
  if (normalizar(m.familia).startsWith(grudado)) return 1
  return 0
}

/** Minúscula, sem acento e sem separador — "D6-440", "d6 440" e "D6440"
 *  viram a mesma coisa. `NFD` + faixa de combining marks é o mesmo truque
 *  que o resto do app usa pra comparar texto digitado por gente. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}
