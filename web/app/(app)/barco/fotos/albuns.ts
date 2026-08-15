import type { AlbumFoto } from "@/lib/db/types"

export const ALBUNS: AlbumFoto[] = ["exterior", "interior", "conves", "documentacao", "outros"]

export const ROTULO_ALBUM: Record<AlbumFoto, string> = {
  exterior: "Exterior",
  interior: "Interior",
  conves: "Convés",
  documentacao: "Documentação visual",
  // "Outros" fica por último de propósito: é o balde de quem não achou onde
  // encaixar (motor no cavalete, guincho, reboque), não uma quinta categoria
  // no mesmo pé das outras.
  outros: "Outros",
}
