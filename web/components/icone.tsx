import type { ReactNode } from "react"

const PATHS = {
  inicio: <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8z" />,
  embarcacao: <path d="M3 15h18l-3 5H6l-3-5zM6 15V9h12v6M12 9V4" />,
  marketplace: <path d="M4 9l1.5-5h13L20 9M4 9h16M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M9 13h6" />,
  alerta: <path d="M6 16V10a6 6 0 0 1 12 0v6l2 3H4l2-3zM10 19a2 2 0 0 0 4 0" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  ancora: <><circle cx="12" cy="5" r="2" /><path d="M12 7v13M5 13a7 7 0 0 0 14 0M8 10H5m14 0h-3" /></>,
  motor: <path d="M4 10h2V8h4l2-2h4v4h2l2 2v4h-2v2H8l-2-2H4z" />,
  documento: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  escudo: <path d="M12 3l7 3v6c0 4-3 7.5-7 9-4-1.5-7-5-7-9V6z" />,
  oleo: <path d="M12 3s6 6.5 6 10.5A6 6 0 0 1 6 13.5C6 9.5 12 3 12 3z" />,
  ferramenta: <path d="M15 3a5 5 0 0 0-4.6 7L3 17.4 6.6 21l7.4-7.4A5 5 0 1 0 15 3z" />,
  calendario: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v12H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  grafico: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  chat: <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-5.2A8.5 8.5 0 1 1 21 11.5z" />,
  selo: <><circle cx="12" cy="9" r="6" /><path d="M9 14.5 8 22l4-2 4 2-1-7.5" /></>,
  cifrao: <path d="M12 3v18M16 7.5C16 5.6 14.2 4.5 12 4.5S8 5.6 8 7.5s1.8 3 4 3.5 4 1.6 4 3.5-1.8 3-4 3-4-1.1-4-3" />,
  bateria: <><rect x="3" y="8" width="16" height="9" rx="2" /><path d="M21 11v3M7 12.5h4M9 10.5v4" /></>,
  raio: <path d="M13 3 5 14h6l-2 7 8-11h-6z" />,
  pessoas: <><circle cx="9" cy="8" r="3" /><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" /><circle cx="17" cy="9" r="2.4" /><path d="M15.6 15c2.5.3 4.4 2.2 4.4 4.6" /></>,
  imagem: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="m21 16-5-5-9 8" /></>,
  estrela: <path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9L9.6 9z" />,
  medalha: <><circle cx="12" cy="15" r="5" /><path d="M8.5 10.5 6 3h12l-2.5 7.5M12 13v4l2 1" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  voltar: <path d="m15 5-7 7 7 7" />,
  mais: <path d="M12 5v14M5 12h14" />,
  relogio: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  mapa: <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15" />,
  // Onda 13 (sondagem colaborativa): pulso do ecobatimetro descendo ate um
  // fundo irregular — nao e so um icone generico, representa a propria ideia
  // do produto (medir profundidade e comparar com o que ja foi medido).
  sonar: <><path d="M4 5h16" /><path d="M12 5v11" /><path d="m9 13 3 3 3-3" /><path d="M3 20c1.3 0 1.3-1.4 2.6-1.4S7.9 20 9.2 20s1.3-1.4 2.6-1.4S14.1 20 15.4 20s1.3-1.4 2.6-1.4S20.3 20 21 20" /></>,
  // Estado da conexao com o transporte (Signal K hoje) — 3 arcos + ponto,
  // leitura universal de "sinal"/conectividade.
  sinal: <><path d="M4 9a12 12 0 0 1 16 0" /><path d="M7 12.5a7.5 7.5 0 0 1 10 0" /><path d="M10 16a3.2 3.2 0 0 1 4 0" /><circle cx="12" cy="19" r="1" /></>,
  // Onda 14 (fila de sondagem): caixa/arquivo com um check dentro — "guardado
  // com seguranca, confirmado" (leituras esperando envio na fila local, ou
  // ja confirmadas). Nao e "nuvem" de proposito: nuvem sugere que ja saiu do
  // aparelho, e o ponto desta tela e o contrario — mostrar o que ESTA
  // guardado a bordo enquanto nao ha sinal pra enviar.
  guardado: <><path d="M3 8l2-4h14l2 4" /><path d="M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8z" /><path d="m9 13 2 2 4-4" /></>,
  // Onda 18 (saída como atividade): seta saindo de uma caixa — "exportar
  // esta saída pra fora do app" (Web Share API ou clipboard).
  compartilhar: <><path d="M12 14V4M8 8l4-4 4 4" /><path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" /></>,
  // Onda 20 (tempo no mar): três linhas de vento com voltas, ícone universal
  // de "vento" (mesmo desenho da família Feather) — usado no cabeçalho do
  // painel de Tempo, distinto da seta rotacionada (essa é SVG à parte, não
  // entra neste sistema de ícones fixos porque precisa girar por grau).
  vento: <><path d="M3 8h11a3 3 0 1 0-3-3" /><path d="M3 13h15a3 3 0 1 1-3 3" /><path d="M3 18h8a2 2 0 1 0-2-2" /></>,
} satisfies Record<string, ReactNode>

export type NomeIcone = keyof typeof PATHS

export function Icone({ nome, className = "size-5" }: { nome: NomeIcone; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[nome]}
    </svg>
  )
}
