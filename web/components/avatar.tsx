export function Avatar({
  url,
  nome,
  tamanho = "size-10",
}: {
  url: string | null
  nome: string
  tamanho?: string
}) {
  const iniciais = nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"
  if (url) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do storage */
      <img src={url} alt={`Foto de ${nome}`} className={`${tamanho} shrink-0 rounded-[var(--raio-pilula)] border border-line object-cover`} />
    )
  }
  /* ONDA 57 — as iniciais eram douradas. Dourado no Commander quer dizer
     "aqui se age" ou "isto é a marca" (docs/DESIGN.md §5); inicial de pessoa
     não é nem uma coisa nem outra — era decoração, e decoração distribuída é
     o que fez a tela parecer gerada. `text-texto` e não `text-dim` porque o
     fundo é `bg-panel2`: ali o par texto-dim/superficie-2 reprova AA (4,45:1
     no claro, 4,34:1 no escuro, medidos — é o mesmo motivo que fez nascer o
     token --texto-dim-chip). Com `text-texto` dá 15,1:1 e 12,1:1. */
  return (
    <span className={`${tamanho} flex shrink-0 items-center justify-center rounded-[var(--raio-pilula)] border border-line bg-panel2 font-mono-instr text-sm text-texto`}>
      {iniciais}
    </span>
  )
}
