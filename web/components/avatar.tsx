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
      <img src={url} alt={`Foto de ${nome}`} className={`${tamanho} shrink-0 rounded-full border border-line object-cover`} />
    )
  }
  return (
    <span className={`${tamanho} flex shrink-0 items-center justify-center rounded-full border border-line bg-panel2 font-mono-instr text-sm text-accent-forte`}>
      {iniciais}
    </span>
  )
}
