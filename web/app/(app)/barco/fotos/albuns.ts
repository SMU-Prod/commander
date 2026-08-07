import type { AlbumFoto } from "@/lib/db/types"

export const ALBUNS: AlbumFoto[] = ["exterior", "interior", "conves", "documentacao"]

export const ROTULO_ALBUM: Record<AlbumFoto, string> = {
  exterior: "Exterior",
  interior: "Interior",
  conves: "Convés",
  documentacao: "Documentação visual",
}
