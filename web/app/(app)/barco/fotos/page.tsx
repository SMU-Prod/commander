import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { definirCapa, excluirFoto, subirFoto } from "@/lib/acoes/fotos"
import { carregarPainel } from "@/lib/consultas"
import { formatarBytes, usoDaCota } from "@/lib/domain/cota"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { Foto } from "@/lib/db/types"
import { ALBUNS, ROTULO_ALBUM } from "./albuns"

export default async function FotosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; album?: string }>
}) {
  const { erro, album: albumBruto } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "fotos")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui as fotos.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "fotos")
  const albumAtivo = ALBUNS.find((a) => a === albumBruto) ?? "exterior"

  const supabase = await supabaseServer()
  const { data: fotos, error } = await supabase
    .from("fotos").select("*").eq("embarcacao_id", painel.embarcacao.id)
    .order("created_at", { ascending: false })
  if (error) throw new Error("Não foi possível carregar as fotos. Recarregue a página.")

  const todas = (fotos ?? []) as Foto[]
  const uso = usoDaCota(todas.reduce((s, f) => s + f.bytes, 0))
  const doAlbum = todas.filter((f) => f.album === albumAtivo)
  const urls = doAlbum.length
    ? (await supabase.storage.from("acervo").createSignedUrls(doAlbum.map((f) => f.arquivo_path), 3600)).data ?? []
    : []
  const urlPorPath = new Map(urls.map((u) => [u.path, u.signedUrl]))

  return (
    <main>
      <Link href="/barco" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Embarcação
      </Link>
      <h1 className="titulo-pagina mt-3">Fotos</h1>
      <p className="apoio mt-1 text-dim">O álbum do barco — e o dossiê que vale na hora de vender.</p>
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erro}</p>}

      <div className="mt-4 rounded-[14px] border border-line bg-panel p-4 sombra-1">
        <div className="flex items-baseline justify-between">
          <p className="rotulo text-dim">Cota de nuvem</p>
          <p className="font-mono-instr text-xs tabular-nums text-dim">
            {formatarBytes(uso.usadoBytes)} de {formatarBytes(uso.limiteBytes)}
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel2">
          <div
            className={`h-full rounded-full ${uso.percentual > 90 ? "bg-crit" : "bg-accent"}`}
            style={{ width: `${Math.max(2, uso.percentual)}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {ALBUNS.map((a) => (
          <Link
            key={a}
            href={a === "exterior" ? "/barco/fotos" : `/barco/fotos?album=${a}`}
            className={`whitespace-nowrap rounded-full border px-3.5 py-2 font-mono-instr text-[11px] ${
              a === albumAtivo
                ? "border-accent bg-accent font-semibold text-acao-texto"
                : "border-line bg-panel text-dim"
            }`}
          >
            {ROTULO_ALBUM[a]}
          </Link>
        ))}
      </div>

      {doAlbum.length === 0 ? (
        <div className="mt-4 rounded-[14px] border border-line bg-panel p-6 text-center sombra-1">
          <Icone nome="camera" className="mx-auto size-7 text-dim" />
          <p className="corpo mt-2 font-medium">Nenhuma foto em {ROTULO_ALBUM[albumAtivo]}</p>
          <p className="apoio mt-1 text-dim">Fotos boas valorizam o barco e contam a história dele.</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {doAlbum.map((f) => {
            const url = urlPorPath.get(f.arquivo_path)
            const ehCapa = painel.embarcacao.foto_capa_path === f.arquivo_path
            return (
              <div key={f.id} className="overflow-hidden rounded-[12px] border border-line bg-panel sombra-1">
                {url && (
                  /* eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do storage */
                  <img src={url} alt={f.legenda ?? "Foto da embarcação"} className="aspect-square w-full object-cover" />
                )}
                {editavel && (
                  <div className="flex items-center justify-between px-1.5 py-1">
                    <form action={definirCapa}>
                      <input type="hidden" name="foto_id" value={f.id} />
                      <button
                        className={`flex size-11 items-center justify-center ${ehCapa ? "text-accent-forte" : "text-dim"}`}
                        aria-label={ehCapa ? "Foto de capa" : "Usar como capa"}
                      >
                        <Icone nome="estrela" className="size-4" />
                      </button>
                    </form>
                    <form action={excluirFoto}>
                      <input type="hidden" name="foto_id" value={f.id} />
                      <button className="flex size-11 items-center justify-center text-crit" aria-label="Excluir foto">
                        <Icone nome="mais" className="size-4 rotate-45" />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {editavel && (
        <>
          <p className="rotulo mt-6 mb-2 text-dim">Adicionar foto</p>
          <form action={subirFoto} className="space-y-3 rounded-[14px] border border-line bg-panel p-4 sombra-1">
            <input type="hidden" name="album" value={albumAtivo} />
            <div>
              <label htmlFor="arquivo" className="rotulo mb-1.5 block text-dim">
                Foto para {ROTULO_ALBUM[albumAtivo]} — JPG, PNG ou WebP, até 10 MB
              </label>
              <input id="arquivo" name="arquivo" type="file" accept="image/jpeg,image/png,image/webp"
                className="w-full rounded-[10px] border border-line bg-campo px-3 py-2.5 corpo" />
            </div>
            <div>
              <label htmlFor="legenda" className="rotulo mb-1.5 block text-dim">Legenda — opcional</label>
              <input id="legenda" name="legenda" placeholder="Ex.: convés após a última lavagem"
                className="w-full rounded-[10px] border border-line bg-campo px-3 py-3 corpo" />
            </div>
            <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">Enviar foto</button>
          </form>
        </>
      )}
    </main>
  )
}
