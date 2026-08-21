import { hub, type ChaveHub } from "@/lib/ui/hubs"

/**
 * O CARTÃO "AO VIVO" DE UM HUB — a primeira tela dos dados do Commander
 * Connector (onda 141).
 * ===========================================================================
 * Vive no topo da aba Visão geral dos hubs que têm telemetria pra mostrar
 * (Motores e Elétrica nesta onda). A REGRA DE OURO mora em quem chama, mas o
 * componente a repete por segurança: **sem grupo, sem cartão** — nem casca,
 * nem convite. O convite de conectar já mora em Ajustes e no guia; um cartão
 * vazio aqui seria a tela cobrando uma compra no lugar de mostrar o barco.
 *
 * ANATOMIA: vidro do hub (mesma tinta 10→5% + borda /35 da trinca de números
 * — §5, cor do hub no card daquele sistema), o carimbo de frescor como
 * primeira linha ("Ao vivo · agora" / "Última leitura há 3 h" — o texto vem
 * pronto do domínio, `carimboAoVivo`), e um grupo por máquina (motor, banco)
 * com pares rótulo/valor na dupla da casa (`rotulo-dado` cinza em cima,
 * `valor-forte` tabular embaixo).
 *
 * O PONTO ACESO só existe quando o carimbo diz "ao vivo" — é a cor do hub
 * (não o verde de estado: "ao vivo" é frescor, não saúde) e é decorativo:
 * quem lê por áudio recebe a informação pelo texto do carimbo.
 *
 * VALOR JÁ CHEGA FORMATADO ("1.500 rpm", "12,6 V"): este componente não
 * formata número — quem chama decide a régua, como em `NumerosDoHub` e `Kpi`.
 * E par com valor `null` simplesmente não é passado: null nunca vira zero,
 * então null também não vira traço decorativo.
 */
export function CartaoAoVivo({
  chave,
  carimbo,
  aoVivo,
  grupos,
  className = "",
}: {
  chave: ChaveHub
  /** Texto pronto de `carimboAoVivo` — "Ao vivo · agora" / "Última leitura há 3 h". */
  carimbo: string
  /** `true` = leitura deste instante; acende o ponto na cor do hub. */
  aoVivo: boolean
  grupos: readonly {
    rotulo: string
    dados: readonly { rotulo: string; valor: string }[]
  }[]
  className?: string
}) {
  if (grupos.length === 0) return null
  const h = hub(chave)
  return (
    <section
      aria-label={`Dados do conector — ${carimbo}`}
      className={`sombra-1 rounded-[var(--raio-cartao)] border bg-panel p-4 ${h.borda} ${h.tinta} ${className}`}
    >
      <div className="flex items-center gap-2">
        {aoVivo && <span aria-hidden="true" className={`size-2 rounded-full ${h.filete}`} />}
        <p className="rotulo-dado text-dim">{carimbo}</p>
      </div>
      {grupos.map((g) => (
        <div key={g.rotulo} className="mt-3 border-t border-line pt-3">
          <p className="titulo-card">{g.rotulo}</p>
          {/* Três colunas fixas mesmo quando o grupo tem dois pares: é o que
              alinha a coluna de números entre um motor e outro — leitura de
              instrumento, não de prosa. */}
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {g.dados.map((d) => (
              <div key={d.rotulo} className="min-w-0">
                <p className="rotulo-dado leading-tight text-dim">{d.rotulo}</p>
                <p className="valor-forte mt-0.5">{d.valor}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
