import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { BloqueioPremium } from "@/components/ui/bloqueio-premium"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { definirCapa, excluirFoto, subirFoto } from "@/lib/acoes/fotos"
import { carregarNivelPlano, carregarPainel } from "@/lib/consultas"
import { formatarBytes, usoDaCota } from "@/lib/domain/cota"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import { avisoAcervoAcimaDoTeto, mensagemBloqueio, recursoLiberado } from "@/lib/domain/plano-acesso"
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
  const [{ data: fotos, error }, nivel] = await Promise.all([
    supabase.from("fotos").select("*").eq("embarcacao_id", painel.embarcacao.id)
      .order("created_at", { ascending: false }),
    carregarNivelPlano(),
  ])
  if (error) throw new Error("Não foi possível carregar as fotos. Recarregue a página.")

  const todas = (fotos ?? []) as Foto[]
  // Contagem do gate do plano Free (onda 38) — total real do barco, não só
  // do álbum aberto: o limite é da embarcação inteira, cruzando álbuns.
  const usoFotos = todas.length
  const liberadoParaSubir = recursoLiberado("fotos", nivel, usoFotos)
  const uso = usoDaCota(todas.reduce((s, f) => s + f.bytes, 0))
  const doAlbum = todas.filter((f) => f.album === albumAtivo)
  const urls = doAlbum.length
    ? (await supabase.storage.from("acervo").createSignedUrls(doAlbum.map((f) => f.arquivo_path), 3600)).data ?? []
    : []
  const urlPorPath = new Map(urls.map((u) => [u.path, u.signedUrl]))

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/barco"
        voltarRotulo="Barco"
        titulo="Fotos"
        descricao="O álbum do barco — e o dossiê que vale na hora de vender."
      />
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erro}</p>}

      <div className="mt-4 rounded-[14px] border border-line bg-panel p-4 sombra-1">
        <div className="flex items-baseline justify-between">
          <p className="rotulo text-dim">Espaço de fotos</p>
          <p className="font-mono-instr text-xs tabular-nums text-dim">
            {formatarBytes(uso.usadoBytes)} de {formatarBytes(uso.limiteBytes)}
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel2">
          <div
            className={`h-full rounded-full ${uso.percentual > 90 ? "bg-crit" : "bg-accent-forte"}`}
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
        <EstadoVazio
          icone="camera"
          titulo={`Nenhuma foto em ${ROTULO_ALBUM[albumAtivo]}`}
          descricao="Fotos boas valorizam o barco e contam a história dele."
          className="mt-4"
        />
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {doAlbum.map((f) => {
            const url = urlPorPath.get(f.arquivo_path)
            const ehCapa = painel.embarcacao.foto_capa_path === f.arquivo_path
            return (
              <div key={f.id} className="overflow-hidden rounded-[12px] border border-line bg-panel sombra-1">
                {url && (
                  /* eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do storage */
                  <img src={url} alt={f.legenda ?? "Foto da embarcação"} className="aspect-square w-full object-cover" loading="lazy" />
                )}
                {f.legenda && <p className={`apoio truncate px-2 pt-1.5 text-dim ${editavel ? "" : "pb-1.5"}`}>{f.legenda}</p>}
                {editavel && (
                  <div className="flex items-center justify-between px-1.5 py-1">
                    <form action={definirCapa}>
                      <input type="hidden" name="foto_id" value={f.id} />
                      <input type="hidden" name="album" value={albumAtivo} />
                      <button
                        className={`flex size-11 items-center justify-center ${ehCapa ? "text-accent-forte" : "text-dim"}`}
                        aria-label={ehCapa ? "Foto de capa" : "Usar como capa"}
                      >
                        <Icone nome="estrela" className="size-4" />
                      </button>
                    </form>
                    <form action={excluirFoto}>
                      <input type="hidden" name="foto_id" value={f.id} />
                      <input type="hidden" name="album" value={albumAtivo} />
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
          <SecaoPagina>Adicionar foto</SecaoPagina>
          {liberadoParaSubir ? (
            <form action={subirFoto} className="space-y-3 rounded-[14px] border border-line bg-panel p-4 sombra-1">
              <input type="hidden" name="album" value={albumAtivo} />
              <Campo
                label={`Foto para ${ROTULO_ALBUM[albumAtivo]} — JPG, PNG ou WebP, até 10 MB`}
                id="arquivo"
                name="arquivo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="py-2.5 text-sm"
              />
              <Campo label="Legenda — opcional" id="legenda" name="legenda" placeholder="Ex.: convés após a última lavagem" />
              <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">Enviar foto</button>
            </form>
          ) : (
            <>
              {/* §23 — nada do acervo é apagado quando o teto muda; o aviso
                  diz isso antes do cadeado. `null` quando não há excedente. */}
              {avisoAcervoAcimaDoTeto("fotos", nivel, usoFotos) && (
                <p className="corpo mb-3 rounded-lg border border-line bg-panel2 px-3 py-2 text-dim">
                  {avisoAcervoAcimaDoTeto("fotos", nivel, usoFotos)}
                </p>
              )}
              <BloqueioPremium {...mensagemBloqueio("fotos", usoFotos)} />
            </>
          )}
        </>
      )}
    </main>
  )
}
