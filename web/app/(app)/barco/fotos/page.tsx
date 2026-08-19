import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { BarraCapacidade } from "@/components/ui/barra-capacidade"
import { BloqueioPremium } from "@/components/ui/bloqueio-premium"
import { Chip, ChipLinha } from "@/components/ui/chip"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo } from "@/components/ui/campo"
import { CampoArquivo } from "@/components/ui/campo-arquivo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { definirCapa, excluirFoto, subirFoto } from "@/lib/acoes/fotos"
import { carregarNivelPlano, carregarPainel } from "@/lib/consultas"
import { cotaDoPlano } from "@/lib/domain/cota"
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
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso nÃ£o inclui as fotos.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "fotos")
  const albumAtivo = ALBUNS.find((a) => a === albumBruto) ?? "exterior"

  const supabase = await supabaseServer()
  const [{ data: fotos, error }, nivel] = await Promise.all([
    supabase.from("fotos").select("*").eq("embarcacao_id", painel.embarcacao.id)
      .order("created_at", { ascending: false }),
    carregarNivelPlano(),
  ])
  if (error) throw new Error("NÃ£o foi possÃ­vel carregar as fotos. Recarregue a pÃ¡gina.")

  const todas = (fotos ?? []) as Foto[]
  // Contagem do gate do plano Free (onda 38) â€” total real do barco, nÃ£o sÃ³
  // do Ã¡lbum aberto: o limite Ã© da embarcaÃ§Ã£o inteira, cruzando Ã¡lbuns.
  const usoFotos = todas.length
  const liberadoParaSubir = recursoLiberado("fotos", nivel, usoFotos)
  // Canvas tela-4a: o "18 / 40" mono do cartÃ£o Ã© a cota REAL â€” a que aperta
  // primeiro neste plano (contagem no Free, espaÃ§o em MB no pago). A escolha
  // mora no domÃ­nio (`cotaDoPlano`), com teste.
  const cota = cotaDoPlano(nivel, usoFotos, todas.reduce((s, f) => s + f.bytes, 0))
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
        descricao="O Ã¡lbum do barco â€” e o dossiÃª que vale na hora de vender."
        // O "+ Adicionar" do canvas (tela-4a): pÃ­lula dourada ao lado do
        // tÃ­tulo, levando Ã  MESMA seÃ§Ã£o de envio no fim da pÃ¡gina â€” uma aÃ§Ã£o,
        // dois pontos de entrada, nunca um segundo formulÃ¡rio.
        acao={
          editavel && liberadoParaSubir ? (
            <Link
              href="#adicionar"
              className="flex h-11 shrink-0 items-center rounded-full bg-accent px-4 text-sm font-semibold text-acao-texto"
            >
              + Adicionar
            </Link>
          ) : undefined
        }
      />
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erro}</p>}

      <ChipLinha className="mt-4">
        {ALBUNS.map((a) => (
          <Chip
            key={a}
            href={a === "exterior" ? "/barco/fotos" : `/barco/fotos?album=${a}`}
            ativo={a === albumAtivo}
          >
            {ROTULO_ALBUM[a]}
            {/* O contador mono do chip ativo (canvas: "Todas 18") â€” sÃ³ no
                ativo, que Ã© o recorte que a grade abaixo estÃ¡ mostrando. */}
            {a === albumAtivo && doAlbum.length > 0 && (
              <span className="ml-1.5 font-mono-instr tabular-nums">{doAlbum.length}</span>
            )}
          </Chip>
        ))}
      </ChipLinha>

      {doAlbum.length === 0 ? (
        <EstadoVazio
          icone="camera"
          titulo={`Nenhuma foto em ${ROTULO_ALBUM[albumAtivo]}`}
          descricao="Fotos boas valorizam o barco e contam a histÃ³ria dele."
          className="mt-4"
        />
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-1.5">
          {doAlbum.map((f) => {
            const url = urlPorPath.get(f.arquivo_path)
            const ehCapa = painel.embarcacao.foto_capa_path === f.arquivo_path
            return (
              <div key={f.id} className="overflow-hidden rounded-[10px] border border-line bg-panel sombra-1">
                <div className="relative">
                  {url && (
                    /* eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporÃ¡ria do storage */
                    <img src={url} alt={f.legenda ?? "Foto da embarcaÃ§Ã£o"} className="aspect-square w-full object-cover" loading="lazy" />
                  )}
                  {/* O selo "Capa" do canvas â€” sobre a prÃ³pria foto, navy fixo
                      nos dois temas (a foto nÃ£o segue o tema; mesmo raciocÃ­nio
                      de --mapa-instrumento em globals.css). */}
                  {ehCapa && (
                    <span className="absolute bottom-1.5 left-1.5 rounded-full border border-meter-texto/30 bg-mapa-instrumento px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[.06em] text-meter-texto">
                      Capa
                    </span>
                  )}
                </div>
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
          {/* O convite "+ foto" do canvas: Ãºltimo quadrado da grade, tracejado,
              levando Ã  mesma seÃ§Ã£o de envio. SÃ³ existe quando dÃ¡ pra enviar â€”
              convite pra porta fechada seria mentira. */}
          {editavel && liberadoParaSubir && (
            <Link
              href="#adicionar"
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-line text-dim"
            >
              <Icone nome="camera" className="size-5" />
              <span className="font-mono-instr text-[11px]">+ foto</span>
            </Link>
          )}
        </div>
      )}

      {/* O cartão de cota, agora com o instrumento da referência (spec §2
          item 3, "Weight capacity 28 700/44 000 lbs 65%") no lugar da barra
          desenhada à mão — é o mesmo formato: usado, teto, chip de %, barra
          por faixa. `cota.usado`/`cota.total` já vêm do domínio
          (`cotaDoPlano`), na mesma unidade que `cota.valor` mostrava em
          texto. Fica DEPOIS da grade, como antes: primeiro o álbum, depois
          o quanto ainda cabe. */}
      <div className="sombra-1 mt-4 rounded-[var(--raio-cartao)] border border-line bg-panel p-3">
        <BarraCapacidade
          usado={cota.usado}
          total={cota.total}
          unidade={cota.unidade}
          rotulo="Cota do plano"
        />
        <p className="apoio mt-2 text-dim">A foto marcada como capa é a que abre o seu Commander.</p>
      </div>

      {editavel && (
        <>
          <SecaoPagina className="scroll-mt-4" id="adicionar">Adicionar foto</SecaoPagina>
          {liberadoParaSubir ? (
            <form action={subirFoto} className="space-y-3 rounded-[14px] border border-line bg-panel p-4 sombra-1">
              <input type="hidden" name="album" value={albumAtivo} />
              {/* `CampoArquivo` e nÃ£o `Campo type="file"`: o input nativo
                  desenha o prÃ³prio botÃ£o em inglÃªs ("Choose File Â· No file
                  chosen") no meio de uma tela toda em portuguÃªs â€” onda 63,
                  auditoria visual Â§8. */}
              <CampoArquivo
                label={`Foto para ${ROTULO_ALBUM[albumAtivo]}`}
                name="arquivo"
                accept="image/jpeg,image/png,image/webp"
                ajuda="JPG, PNG ou WebP, atÃ© 10 MB"
              />
              <Campo label="Legenda â€” opcional" id="legenda" name="legenda" placeholder="Ex.: convÃ©s apÃ³s a Ãºltima lavagem" />
              <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">Enviar foto</button>
            </form>
          ) : (
            <>
              {/* Â§23 â€” nada do acervo Ã© apagado quando o teto muda; o aviso
                  diz isso antes do cadeado. `null` quando nÃ£o hÃ¡ excedente. */}
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
