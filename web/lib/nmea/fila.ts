import { celulaId, reduzirPorCelula, type CelulaReduzida, type LeituraParaReducao } from "@/lib/domain/sondagem"
import type { TransporteSondagem } from "@/lib/db/types"

/**
 * Fila persistente de sondagem (onda 14) — o coração do "guardar a bordo e
 * subir quando voltar ao sinal". A caixa de sonar cria a PRÓPRIA rede WiFi
 * (o celular conectado nela fica sem internet) e, mesmo lendo o ecobatímetro
 * do barco por gateway NMEA, a 20 milhas da costa não há sinal de celular —
 * então não existe "enviar sondagem ao vivo". Toda leitura aceita
 * (`validarLeituraSondagem` + `deveAceitarPorMovimento`, já filtradas antes
 * de chegar aqui) entra nesta fila; só sai quando o servidor confirmar que
 * gravou.
 *
 * ## Por que `localStorage`, não IndexedDB
 * `localStorage` é síncrono, já é o padrão do resto do app (`camadas.ts`,
 * `sondagem-painel.tsx` guarda a URL do Signal K nele) e não exige nenhuma
 * dependência nova — importante porque `package.json` está fora do escopo
 * desta onda (outro agente mexe nele). O volume cabe: mesmo no pior caso
 * realista (leitura aceita ~1x/segundo, o teto do próprio NMEA/GPS, numa
 * saída de muitas horas sem sinal) o TETO abaixo limita o JSON a poucos MB,
 * bem dentro da cota típica de localStorage por origem (~5 MB). IndexedDB
 * seria mais correto para volumes MAIORES (não tem teto prático de
 * tamanho), mas exigiria uma API assíncrona só pra isso e, sem
 * `fake-indexeddb` como devDependency (que também exigiria mexer no
 * `package.json`), ficaria sem cobertura de teste real no ambiente atual
 * (Vitest roda em Node puro, sem `indexedDB` global — mesmo motivo pelo
 * qual `camadas.test.ts` já documenta a ausência de `localStorage` nesse
 * ambiente e stuba na mão).
 *
 * ## Teto e descarte
 * `TETO_PENDENTES_FILA` limita quantas leituras BRUTAS ainda não confirmadas
 * ficam guardadas. Estourar o teto descarta as MAIS ANTIGAS primeiro (FIFO,
 * `descartarExcedente`) — a leitura mais recente reflete onde o barco está
 * AGORA (ou pra onde está indo), a área mais provável de ainda não ter
 * outras leituras cobrindo, e é a que tem mais chance de sincronizar em
 * breve (perto da costa, perto do fim da saída). A leitura mais antiga de
 * uma saída sem sinal o dia inteiro já teria tido a MAIOR janela pra tentar
 * sincronizar e não conseguiu — não é a mais valiosa de proteger.
 *
 * ## Reduzir ao enfileirar ou ao enviar?
 * Aqui, ao ENVIAR — não ao enfileirar. `reduzirPorCelula` (onda 13) só
 * "perdoa" um outlier isolado (um bounce de sonar, ver `medianaConservadora`
 * em `sondagem.ts`) quando enxerga o conjunto CHEIO de leituras da célula de
 * uma vez; mesclar leitura por leitura numa mediana incremental (sem manter
 * o bruto) enfraqueceria essa garantia testada na onda 13 ou exigiria
 * reimplementar a lógica de mediana aqui. Guardar o bruto até o envio
 * também é mais seguro: nada é "resumido" (com perda) antes de saber que o
 * servidor confirmou. O custo (mais bytes por leitura bruta do que por
 * célula já reduzida) é absorvido pelo TETO acima.
 *
 * ## Idempotência do retry
 * Um envio "congela" um LOTE (`loteEmVoo`): um `loteId` (UUID) sorteado UMA
 * vez, e a MESMA lista de itens em toda retentativa — nunca recalculado a
 * partir da fila atual (que pode ter crescido com leituras novas enquanto o
 * lote antigo ainda está em voo). Isso garante que um retry gera a MESMA
 * chave de deduplicação (`loteId:celulaId`, ver `lib/acoes/sondagem.ts` e a
 * migration `026_sondagens_idempotencia.sql`) — se a primeira tentativa
 * gravou no banco mas a resposta se perdeu, a segunda tentativa manda os
 * MESMOS dados com a MESMA chave, e o `unique` no banco rejeita a
 * duplicata silenciosamente (`upsert` com `ignoreDuplicates`), sem duplicar
 * linha nem perder a leitura original.
 */

/** Uma leitura já validada e filtrada por movimento (onda 13), pronta pra
 *  entrar na fila — mesmo formato bruto de `LeituraParaReducao` mais o
 *  "quando" e "por qual transporte" que a fila precisa pra montar o lote
 *  depois. */
export interface LeituraParaFila {
  lat: number
  lon: number
  profundidadeM: number
  /** ISO — momento da leitura original (não de quando entrou na fila nem de
   *  quando foi enviada). */
  medidoEm: string
  transporte: TransporteSondagem
}

interface LeituraNaFila extends LeituraParaFila {
  /** Id só pra rastrear a leitura dentro da fila local (descarte por
   *  antiguidade); NÃO é a chave de deduplicação do servidor — essa é
   *  `loteId:celulaId`, calculada só na hora de montar o lote. */
  id: string
}

/** O que `despachar` entrega pra função de envio (injetada — ver `despachar`)
 *  depois de reduzir por célula. `ultimoMomentoPorCelula` existe porque
 *  `reduzirPorCelula` (dominio puro) não carrega timestamp — recompõe aqui
 *  o momento mais recente de cada célula, mesma lógica que
 *  `sondagem-painel.tsx` já fazia manualmente antes desta onda. */
export interface LoteParaEnviar {
  loteId: string
  transporte: TransporteSondagem
  celulas: CelulaReduzida[]
  ultimoMomentoPorCelula: Record<string, string>
}

export type ResultadoEnvioLote = { ok: true; gravadas: number } | { ok: false; erro: string }

interface LoteEmVoo {
  id: string
  itens: LeituraNaFila[]
  tentativas: number
  /** epoch ms; 0 = pode tentar agora. */
  proximaTentativaEm: number
}

interface EstadoPersistido {
  pendentes: LeituraNaFila[]
  loteEmVoo: LoteEmVoo | null
  ultimoEnvioSucessoEm: number | null
}

/** O que a tela precisa saber pra mostrar a verdade da fila — nunca deixar a
 *  pessoa achar que perdeu a saída. */
export interface EstadoFila {
  /** Leituras brutas esperando (ainda não fazem parte de um lote em voo). */
  pendentes: number
  /** Leituras já congeladas num lote tentando enviar (ainda não confirmadas
   *  — contam junto de `pendentes` pra "quanto falta enviar" na tela, mas
   *  separadas aqui pra quem quiser distinguir "esperando" de "enviando"). */
  emVoo: number
  /** A fila bateu no teto — leituras mais antigas estão sendo descartadas
   *  pra abrir espaço pras novas. */
  filaCheia: boolean
  ultimoEnvioEm: number | null
  /** Quando a próxima retentativa do lote em voo é permitida (backoff);
   *  `null` quando não há lote em voo ou nada falhou ainda. */
  proximaTentativaEm: number | null
}

const CHAVE_STORAGE = "commander:fila-sondagem"

/** Ver "Teto e descarte" no comentário do topo do arquivo. */
export const TETO_PENDENTES_FILA = 10_000

/** Backoff exponencial do envio (não é o mesmo backoff do WebSocket do
 *  Signal K em `signalk.ts` — aqui é sincronização em segundo plano, não
 *  uma conexão ao vivo, então a base é mais longa: não faz sentido bater no
 *  servidor a cada 1s enquanto o barco está sem sinal há horas). 5s a
 *  primeira retentativa, dobra a cada falha, teto de 5 min — evita o laço
 *  apertado pedido na task sem exigir um timer próprio dentro da fila (ver
 *  `despachar`: quem decide QUANDO retentar é o chamador, via ciclo de
 *  vida; a fila só recusa tentar antes da hora). */
const BACKOFF_BASE_MS = 5_000
const BACKOFF_MAXIMO_MS = 300_000

function estadoVazio(): EstadoPersistido {
  return { pendentes: [], loteEmVoo: null, ultimoEnvioSucessoEm: null }
}

function carregar(): EstadoPersistido {
  if (typeof localStorage === "undefined") return estadoVazio()
  try {
    const bruto = localStorage.getItem(CHAVE_STORAGE)
    if (!bruto) return estadoVazio()
    const salvo = JSON.parse(bruto) as Partial<EstadoPersistido> | null
    if (!salvo || !Array.isArray(salvo.pendentes)) return estadoVazio()
    return {
      pendentes: salvo.pendentes,
      loteEmVoo: salvo.loteEmVoo ?? null,
      ultimoEnvioSucessoEm: typeof salvo.ultimoEnvioSucessoEm === "number" ? salvo.ultimoEnvioSucessoEm : null,
    }
  } catch {
    // JSON corrompido (ou getItem falhando em modo privado/quota) — fila
    // vazia é uma resposta segura, não um erro que precise subir.
    return estadoVazio()
  }
}

function salvar(estado: EstadoPersistido): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(CHAVE_STORAGE, JSON.stringify(estado))
  } catch {
    // Quota estourada / modo privado: a leitura já foi capturada em memória
    // por quem chamou `enfileirar` antes desta função rodar — perder a
    // persistência aqui é ruim, mas lançar quebraria a coleta em andamento.
    // A próxima leitura tenta salvar de novo (não é um estado permanente).
  }
}

/** Política de descarte: FIFO — o item no ÍNDICE 0 é o mais antigo, cai
 *  primeiro. Extraída como função pura (sem tocar `localStorage`) pra poder
 *  testar exaustivamente o TETO real (10 mil) sem chamar `enfileirar` em
 *  loop — cada chamada de `enfileirar` serializa a fila inteira de novo, e
 *  10 mil chamadas em sequência custaria O(n²) num teste (medido: ~78s pra
 *  crescer um array até 10 mil serializando a cada passo — inaceitável pra
 *  suíte). O teste de integração real semeia o estado já no teto de uma vez
 *  (uma serialização, O(n)) e confere que só UMA chamada de `enfileirar`
 *  descarta certo. */
export function descartarExcedente<T>(itens: T[], teto: number): T[] {
  if (itens.length <= teto) return itens
  return itens.slice(itens.length - teto)
}

/** UUID v4 com fallback pra contexto inseguro. `crypto.randomUUID` só
 *  existe em contexto seguro (HTTPS ou localhost) — e o shell nativo em
 *  DEV carrega `http://10.0.2.2:3050` (HTTP por IP), onde a função some.
 *  Erro real vivido no primeiro teste no emulador (09/08/2026): a cadeia
 *  inteira do sonar funcionou e morreu aqui, no id do item. O fallback usa
 *  `crypto.getRandomValues` (disponível em qualquer contexto) com os bits
 *  de versão/variante do v4 — mesma unicidade na prática. */
export function gerarUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Adiciona uma leitura já validada à fila persistente. Nunca lança —
 *  sem `localStorage` (SSR) ou com ele falhando (quota/privado), a leitura
 *  em si não é perdida da COLETA em andamento (quem chama já tem o dado),
 *  só não fica garantida entre reaberturas do app. */
export function enfileirar(leitura: LeituraParaFila): void {
  const estado = carregar()
  const nova: LeituraNaFila = { ...leitura, id: gerarUuid() }
  estado.pendentes = descartarExcedente([...estado.pendentes, nova], TETO_PENDENTES_FILA)
  salvar(estado)
}

/** Projeção somente-leitura pra tela — nunca expõe as leituras brutas, só a
 *  contagem e os carimbos de tempo que provam "está tudo guardado". */
export function estadoFila(): EstadoFila {
  const estado = carregar()
  return {
    pendentes: estado.pendentes.length,
    emVoo: estado.loteEmVoo?.itens.length ?? 0,
    filaCheia: estado.pendentes.length >= TETO_PENDENTES_FILA,
    ultimoEnvioEm: estado.ultimoEnvioSucessoEm,
    proximaTentativaEm: estado.loteEmVoo?.proximaTentativaEm ?? null,
  }
}

function construirLote(id: string, itens: LeituraNaFila[]): LoteParaEnviar {
  const paraReduzir: LeituraParaReducao[] = itens.map((i) => ({ lat: i.lat, lon: i.lon, profundidadeM: i.profundidadeM }))
  const celulas = reduzirPorCelula(paraReduzir)

  // Mesma reconstrução de "momento mais recente por célula" que o painel já
  // fazia manualmente antes desta onda (`reduzirPorCelula` não carrega
  // timestamp, é dominio puro de posição+profundidade).
  const ultimoMomentoPorCelula: Record<string, string> = {}
  for (const item of itens) {
    const id2 = celulaId(item.lat, item.lon)
    const atual = ultimoMomentoPorCelula[id2]
    if (!atual || item.medidoEm > atual) ultimoMomentoPorCelula[id2] = item.medidoEm
  }

  // Transporte representativo do lote: o da leitura mais recente (itens
  // ficam em ordem de chegada — FIFO — então o último é o mais novo).
  // Simplificação deliberada: se o seletor trocar de transporte NO MEIO de
  // um lote ainda não enviado (nativo ficou disponível durante a saída), o
  // lote inteiro é gravado com o transporte mais recente — caso raro, sem
  // efeito na profundidade em si, só no campo de procedência.
  const transporte = itens[itens.length - 1]?.transporte ?? "signalk"

  return { loteId: id, transporte, celulas, ultimoMomentoPorCelula }
}

async function tentarEnviar(
  enviar: (lote: LoteParaEnviar) => Promise<ResultadoEnvioLote>,
  lote: LoteParaEnviar,
): Promise<ResultadoEnvioLote> {
  try {
    return await enviar(lote)
  } catch {
    // Nunca deixa uma exceção do transporte de rede (fetch rejeitado,
    // action do Next lançando) escapar pra tela — trata como falha comum,
    // que já tem tratamento de retry/backoff.
    return { ok: false, erro: "Falha inesperada ao enviar." }
  }
}

/** Guarda de reentrância em memória (não persistida): duas chamadas a
 *  `despachar` disparadas quase juntas (ex.: o evento `online` e o timer de
 *  fallback do componente no mesmo instante) não devem tentar enviar o
 *  MESMO lote duas vezes em paralelo — só uma execução por vez. Não cobre
 *  múltiplas ABAS do navegador (cada uma tem sua própria memória de
 *  processo); ver concern no relatório da onda. */
let emAndamento = false

/** Drena a fila: se já existe um lote em voo, tenta reenviar O MESMO lote
 *  (respeitando o backoff — não bate na rede antes da hora); se deu certo e
 *  ainda sobrou algo em `pendentes` (chegou leitura nova enquanto o lote
 *  anterior estava em voo), congela e tenta o PRÓXIMO lote na mesma
 *  chamada. Nunca lança — falha de envio (rejeição de rede, exceção) vira
 *  backoff, não erro pra tela. `enviar` é injetado (não importa
 *  `gravarSondagens` diretamente) pra manter este módulo puro e testável
 *  sem mockar server action nenhuma — quem liga isso à ação real é
 *  `sondagem-painel.tsx`. */
export async function despachar(enviar: (lote: LoteParaEnviar) => Promise<ResultadoEnvioLote>): Promise<void> {
  if (emAndamento) return
  emAndamento = true
  try {
    for (;;) {
      const estado = carregar()

      if (estado.loteEmVoo) {
        if (Date.now() < estado.loteEmVoo.proximaTentativaEm) return // ainda dentro do backoff

        const loteEmVooAntes = estado.loteEmVoo
        const lote = construirLote(loteEmVooAntes.id, loteEmVooAntes.itens)
        const resultado = await tentarEnviar(enviar, lote)

        // Releitura pós-`await`: `enviar` pode ter disparado (direta ou
        // indiretamente, ex.: uma leitura chegando do transporte enquanto a
        // rede respondia) uma chamada a `enfileirar` nesse meio-tempo — usar
        // o `estado` capturado ANTES do await sobrescreveria essa leitura
        // nova. `loteEmVooAntes` continua válido pra decidir o resultado
        // (só `despachar` mexe em `loteEmVoo`, protegido pela guarda de
        // reentrância), só o `pendentes`/resto do estado precisa ser fresco.
        const posEnvio = carregar()

        if (resultado.ok) {
          posEnvio.loteEmVoo = null
          posEnvio.ultimoEnvioSucessoEm = Date.now()
          salvar(posEnvio)
          continue // sobrou algo em `pendentes`? a próxima volta do loop cuida.
        }

        const tentativas = loteEmVooAntes.tentativas + 1
        const atrasoMs = Math.min(BACKOFF_BASE_MS * 2 ** (tentativas - 1), BACKOFF_MAXIMO_MS)
        posEnvio.loteEmVoo = { ...loteEmVooAntes, tentativas, proximaTentativaEm: Date.now() + atrasoMs }
        salvar(posEnvio)
        return
      }

      if (estado.pendentes.length === 0) return

      estado.loteEmVoo = { id: gerarUuid(), itens: estado.pendentes, tentativas: 0, proximaTentativaEm: 0 }
      estado.pendentes = []
      salvar(estado)
      // volta ao topo do loop — cai no ramo "tem loteEmVoo" e tenta na hora.
    }
  } finally {
    emAndamento = false
  }
}
