"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import type { PedidoRota, RespostaRota } from "@/components/mapa/rota.worker"
import type { Coord } from "@/lib/domain/rota"

/** Estado de UMA perna calculada pelo motor (mesmo Worker que /navegar usa
 *  pro destino único, `rota.worker.ts` — este hook NUNCA recalcula caminho
 *  sozinho, só dispara N pedidos pro Worker existente e junta as respostas).
 *  `pontos: null` + `carregando: false` é o estado honesto "sem caminho" —
 *  a tela decide o texto (calado vs. fora da área) olhando `foraDaArea`.
 *  `caladoAplicado`/`usouCorredores` espelham exatamente o que o Worker já
 *  devolve pro destino único (ver `RespostaRota`) — a viagem herda os MESMOS
 *  disclaimers de calado/corredores de /navegar, nunca um texto novo. */
export interface EstadoPerna {
  pontos: Coord[] | null
  carregando: boolean
  foraDaArea: boolean
  caladoAplicado: number | null
  usouCorredores: boolean
}

const PENDENTE: EstadoPerna = { pontos: null, carregando: true, foraDaArea: false, caladoAplicado: null, usouCorredores: false }

/** Chave estável de UMA perna (índice + coordenadas das duas pontas + calado
 *  em vigor) — usada tanto pra casar a resposta assíncrona do Worker com a
 *  perna certa quanto pra decidir se o resultado guardado ainda vale (calado
 *  mudou = chave muda = perna volta a "carregando" até a resposta nova
 *  chegar, em vez de mostrar um número calculado pro calado ANTERIOR). */
function chavePerna(indice: number, a: { la: number; lo: number }, b: { la: number; lo: number }, caladoM: number | null): string {
  return `${indice}|${a.la.toFixed(6)},${a.lo.toFixed(6)}|${b.la.toFixed(6)},${b.lo.toFixed(6)}|${caladoM ?? "s"}`
}

/** Calcula, em paralelo, o caminho pela água de cada perna consecutiva de
 *  `paradas` (índice i -> i+1) — reusa o MESMO Worker de A* que `/navegar`
 *  já usa pra um destino único (web/components/mapa/rota.worker.ts), só que
 *  chamado uma vez por perna. Onda 19 (planejar viagem): o motor em si
 *  (web/lib/domain/rota.ts) não é tocado, nem o Worker — este hook só
 *  orquestra várias chamadas a ele e junta as respostas por chave.
 *
 *  Resultados guardados num Map por `chavePerna` (não um array resetado a
 *  cada mudança de `paradas`): a resposta do Worker chega dentro do
 *  listener de "message" (evento externo), nunca síncrono no corpo do
 *  efeito — é o padrão que `react-hooks/set-state-in-effect` pede. */
export function usePernasViagem(paradas: { la: number; lo: number }[], caladoM: number | null): EstadoPerna[] {
  const workerRef = useRef<Worker | null>(null)
  const [resultados, setResultados] = useState<Map<string, EstadoPerna>>(new Map())
  const proximoIdRef = useRef(0)
  const pedidosRef = useRef(new Map<number, string>())

  useEffect(() => {
    const worker = new Worker(new URL("./rota.worker.ts", import.meta.url), { type: "module" })
    workerRef.current = worker
    worker.addEventListener("message", (e: MessageEvent<RespostaRota>) => {
      const chave = pedidosRef.current.get(e.data.id)
      if (chave === undefined) return
      pedidosRef.current.delete(e.data.id)
      const novoEstado: EstadoPerna =
        e.data.tipo === "rota"
          ? {
              pontos: e.data.pernas,
              carregando: false,
              foraDaArea: false,
              caladoAplicado: e.data.caladoM,
              usouCorredores: e.data.usouCorredores,
            }
          : e.data.tipo === "fora-da-area"
            ? { pontos: null, carregando: false, foraDaArea: true, caladoAplicado: null, usouCorredores: false }
            // "sem-caminho" ou "sem-mascara": sem caminho pela água pra essa
            // perna — a tela mostra isso honestamente (ver Viagem/PernaViagem).
            : { pontos: null, carregando: false, foraDaArea: false, caladoAplicado: null, usouCorredores: false }
      setResultados((atual) => new Map(atual).set(chave, novoEstado))
    })
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  // Assinatura ESTÁVEL das coordenadas — não do array `paradas` em si. Um
  // novo array com o MESMO conteúdo geográfico (ex.: renomear uma parada
  // não muda la/lo de ninguém) não pode disparar recálculo nenhum pela
  // água; só a ORDEM/POSIÇÃO das paradas (ou o calado) justifica um novo
  // pedido ao Worker.
  const assinatura = useMemo(() => paradas.map((p) => `${p.la.toFixed(6)},${p.lo.toFixed(6)}`).join("|"), [paradas])

  // Recalculado só quando `assinatura`/`caladoM` mudam de verdade (a
  // memoização é o que faz `paradas` "não contar" pra este array quando só
  // o nome mudou) — usa o `paradas` mais recente no corpo, mas só quando o
  // React decide reexecutar o factory.
  const chaves = useMemo(
    () => paradas.slice(0, -1).map((p, i) => chavePerna(i, p, paradas[i + 1], caladoM)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `assinatura` já resume as coordenadas relevantes de `paradas`
    [assinatura, caladoM],
  )

  // Só posta pedido novo pro Worker quando `chaves` muda de referência —
  // que só acontece quando a assinatura de coordenadas ou o calado mudam de
  // verdade (ver acima). Nenhum setState aqui: só `postMessage`; o
  // resultado entra pelo listener registrado no efeito de cima.
  useEffect(() => {
    const worker = workerRef.current
    if (!worker) return
    for (let i = 0; i < chaves.length; i++) {
      const id = ++proximoIdRef.current
      pedidosRef.current.set(id, chaves[i])
      worker.postMessage({ id, de: paradas[i], para: paradas[i + 1], caladoM } satisfies PedidoRota)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `chaves` já resume paradas+caladoM; postar de novo por causa só do array `paradas` mudar de referência recalcularia à toa
  }, [chaves])

  return useMemo(() => chaves.map((k) => resultados.get(k) ?? PENDENTE), [chaves, resultados])
}

export interface AvisoCaladoViagem {
  tom: "info" | "aviso"
  texto: string
  linkCadastrar: boolean
}

/** MESMA lógica de `avisoCalado` em navegar-mapa.tsx (onda 12), só que
 *  agregada pelas pernas da viagem em vez de uma rota só: se PELO MENOS UMA
 *  perna com caminho aplicou o calado, a viagem "respeita o calado" (as
 *  outras pernas sem caminho não têm rota nenhuma pra respeitar ou não);
 *  senão cai nos mesmos dois avisos honestos de antes (sem calado
 *  cadastrado / cadastrado mas não pude aplicar agora). `null` sem nenhuma
 *  perna com caminho ainda — nada a dizer sobre calado de uma rota que não
 *  existe. Texto idêntico ao de /navegar de propósito — a rota planejada
 *  herda o disclaimer, não inventa um novo (regra da onda). */
export function avisoCaladoViagem(pernas: EstadoPerna[], caladoM: number | null): AvisoCaladoViagem | null {
  const comCaminho = pernas.filter((p) => p.pontos != null)
  if (comCaminho.length === 0) return null
  const aplicado = comCaminho.find((p) => p.caladoAplicado != null)?.caladoAplicado
  if (aplicado != null) {
    return {
      tom: "info",
      texto: `Rota respeita o calado de ${aplicado.toLocaleString("pt-BR")} m — evita águas rasas CONHECIDAS na resolução do mapa; não garante a profundidade real no local exato.`,
      linkCadastrar: false,
    }
  }
  if (caladoM == null) {
    return { tom: "aviso", texto: "Calado não cadastrado — a rota não leva em conta a profundidade.", linkCadastrar: true }
  }
  return {
    tom: "aviso",
    texto: "Não consegui carregar o dado de profundidade agora — a rota não leva em conta o calado desta vez.",
    linkCadastrar: false,
  }
}

/** true = pelo menos uma perna da viagem passa por passagens reais de
 *  outros barcos (onda 17) — mesmo critério honesto do destino único em
 *  /navegar (`usouCorredores` só vira `true` quando a rota CALCULADA de
 *  fato usou, nunca só "havia corredor perto"). */
export function usouCorredoresViagem(pernas: EstadoPerna[]): boolean {
  return pernas.some((p) => p.usouCorredores)
}
