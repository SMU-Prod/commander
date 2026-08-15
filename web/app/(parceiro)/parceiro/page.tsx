import { redirect } from "next/navigation"
import Link from "next/link"
import { Confirmar } from "@/components/confirmar"
import { Icone, type NomeIcone } from "@/components/icone"
import { EscolherPonto } from "@/components/mapa/escolher-ponto"
import { EscolherPinoParceiro } from "@/components/mapa/escolher-pino-parceiro"
import { excluirFotoParceiro, salvarParceiro, subirFotoParceiro } from "@/lib/acoes/parceiro"
import { campo, numeroParaCampoPtBr, rot } from "@/lib/ui/form"
import { supabaseServer } from "@/lib/supabase/server"
import { COR_PADRAO, ICONE_PADRAO_POR_CATEGORIA } from "@/lib/mapa/pino-parceiro"
import type { CategoriaParceiro, Parceiro } from "@/lib/db/types"

const CATEGORIAS: { valor: CategoriaParceiro; rotulo: string; icone: NomeIcone }[] = [
  { valor: "marina", rotulo: "Marina", icone: "ancora" },
  { valor: "posto", rotulo: "Posto", icone: "oleo" },
  { valor: "pousada", rotulo: "Pousada", icone: "inicio" },
  { valor: "restaurante", rotulo: "Restaurante", icone: "estrela" },
  { valor: "loja_nautica", rotulo: "Loja náutica", icone: "ferramenta" },
  { valor: "outros", rotulo: "Outros", icone: "embarcacao" },
]

/** Centavos (ou null) para o campo de preço em pt-BR, ex.: 15000 → "150,00". */
function precoParaCampo(centavos: number | null): string {
  return centavos == null ? "" : (centavos / 100).toFixed(2).replace(".", ",")
}

export default async function ParceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>
}) {
  const { erro, ok } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?volta=/parceiro")

  const { data, error } = await supabase
    .from("parceiros").select("*").eq("usuario_id", user.id).maybeSingle()
  if (error) throw new Error("Não foi possível carregar seu perfil. Recarregue a página.")
  const p = data as Parceiro | null

  const fotos = (p?.fotos ?? []).map((path) => ({
    path,
    url: supabase.storage.from("parceiros").getPublicUrl(path).data.publicUrl,
  }))

  return (
    <main>
      {/* Onda 25 — link de volta pra página pública de vendas (/parceiros),
          pro parceiro que caiu direto aqui (ex.: link salvo, favorito). */}
      <Link href="/parceiros" className="apoio inline-flex items-center gap-1 text-dim hover:text-texto">
        <Icone nome="voltar" className="size-3.5" /> Ver a página pública de apresentação
      </Link>
      <h1 className="titulo-pagina mt-3">Seu perfil no mapa</h1>
      <p className="apoio mt-1 text-dim">
        O que estiver aqui aparece pra quem navega perto — vocês mesmos atualizam, sem chamar ninguém.
      </p>

      {ok && <p className="corpo mt-4 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-4 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {p && (
        <div className="sombra-1 mt-4 flex items-center gap-3 rounded-[14px] border border-line bg-panel p-4">
          <Icone nome="grafico" className="size-6 shrink-0 text-accent-forte" />
          <p className="corpo">
            <span className="text-lg font-semibold tabular-nums">{p.visualizacoes}</span>{" "}
            {p.visualizacoes === 1 ? "proprietário viu" : "proprietários viram"} seu perfil
          </p>
        </div>
      )}

      <form action={salvarParceiro} className="group mt-5 space-y-5">
        <section className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo text-dim">Categoria</p>
          <div className="grid grid-cols-2 gap-2.5">
            {CATEGORIAS.map((c) => (
              <label
                key={c.valor}
                htmlFor={`cat-${c.valor}`}
                className="sombra-1 flex cursor-pointer flex-col items-center gap-1.5 rounded-[14px] border border-line bg-panel px-3 py-4 text-center has-[:checked]:border-accent"
              >
                <Icone nome={c.icone} className="size-6 text-accent-forte" />
                <span className="titulo-card">{c.rotulo}</span>
                <input
                  id={`cat-${c.valor}`}
                  type="radio"
                  name="categoria"
                  value={c.valor}
                  defaultChecked={p ? p.categoria === c.valor : c.valor === "marina"}
                  className="sr-only"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo text-dim">Identificação</p>
          <div>
            <label className={rot} htmlFor="nome">Nome</label>
            <input id="nome" name="nome" required minLength={3} defaultValue={p?.nome ?? ""} className={campo} />
          </div>
          <div>
            <p className={rot}>Ponto no mapa</p>
            <EscolherPonto lat={p?.lat ?? null} lng={p?.lng ?? null} />
          </div>
        </section>

        <section className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo text-dim">Pino no mapa</p>
          <EscolherPinoParceiro
            iconeInicial={p?.icone ?? ICONE_PADRAO_POR_CATEGORIA[p?.categoria ?? "marina"]}
            corInicial={p?.cor ?? COR_PADRAO}
            destaque={p?.plano === "destaque"}
          />
        </section>

        <section className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo text-dim">Preço</p>
          <div>
            <label className={rot} htmlFor="preco_diaria">Diária (vaga/poita)</label>
            <input
              id="preco_diaria" name="preco_diaria" inputMode="decimal" required placeholder="150,00"
              defaultValue={precoParaCampo(p?.preco_diaria_centavos ?? null)}
              className={`${campo} font-mono-instr tabular-nums`}
            />
          </div>
          <div className="hidden group-has-[#cat-posto:checked]:block">
            <label className={rot} htmlFor="preco_diesel">Diesel (por litro)</label>
            <input
              id="preco_diesel" name="preco_diesel" inputMode="decimal" placeholder="6,20"
              defaultValue={precoParaCampo(p?.preco_diesel_centavos ?? null)}
              className={`${campo} font-mono-instr tabular-nums`}
            />
          </div>
          <p className="apoio text-dim">
            Preço e disponibilidade de poita mudam no máximo 1× por dia.
          </p>
        </section>

        <div className="hidden group-has-[#cat-pousada:checked]:block group-has-[#cat-restaurante:checked]:block">
          <label className={rot} htmlFor="calado_max_m">Calado máximo (m)</label>
          <input
            id="calado_max_m" name="calado_max_m" inputMode="decimal" placeholder="1,80"
            defaultValue={numeroParaCampoPtBr(p?.calado_max_m ?? null)}
            className={`${campo} font-mono-instr tabular-nums`}
          />
        </div>

        <div className="hidden group-has-[#cat-pousada:checked]:block">
          <label className="flex items-center gap-2.5 corpo">
            <input type="checkbox" name="traslado_incluso" defaultChecked={p?.traslado_incluso ?? false} className="size-5 accent-[var(--acao)]" />
            Traslado incluso
          </label>
        </div>

        <div className="hidden space-y-3 group-has-[#cat-restaurante:checked]:block">
          <label className="flex items-center gap-2.5 corpo">
            <input type="checkbox" name="vaga_cortesia" defaultChecked={p?.vaga_cortesia ?? false} className="size-5 accent-[var(--acao)]" />
            Vaga de carro cortesia
          </label>
          <div>
            <label className={rot} htmlFor="culinaria">Culinária</label>
            <input id="culinaria" name="culinaria" placeholder="Frutos do mar, brasileira…" defaultValue={p?.culinaria ?? ""} className={campo} />
          </div>
        </div>

        <section className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo text-dim">Poita</p>
          <label className="flex items-center gap-2.5 corpo">
            <input id="tem_poita" type="checkbox" name="tem_poita" defaultChecked={p?.tem_poita ?? false} className="size-5 accent-[var(--acao)]" />
            Tem poita disponível
          </label>
          <div className="hidden group-has-[#tem_poita:checked]:block">
            <label className={rot} htmlFor="qtd_poitas">Quantas poitas</label>
            <input
              id="qtd_poitas" name="qtd_poitas" inputMode="numeric" placeholder="4"
              defaultValue={p?.qtd_poitas ?? ""} className={`${campo} font-mono-instr tabular-nums`}
            />
          </div>
        </section>

        <section className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo text-dim">Contato</p>
          <div>
            <label className={rot} htmlFor="horario">Horário de funcionamento</label>
            <input id="horario" name="horario" placeholder="Todos os dias, 8h às 22h" defaultValue={p?.horario ?? ""} className={campo} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="telefone">Telefone / WhatsApp</label>
              <input id="telefone" name="telefone" inputMode="tel" placeholder="21 99999-0000" defaultValue={p?.telefone ?? ""} className={campo} />
            </div>
            <div>
              <label className={rot} htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" placeholder="contato@exemplo.com" defaultValue={p?.email ?? ""} className={campo} />
            </div>
          </div>
          <div>
            <label className={rot} htmlFor="sobre">Sobre</label>
            <textarea id="sobre" name="sobre" rows={3} placeholder="O que faz o seu lugar ser a parada certa…" defaultValue={p?.sobre ?? ""} className={campo} />
          </div>
        </section>

        <label className="flex items-center gap-2.5 corpo">
          <input type="checkbox" name="visivel" defaultChecked={p?.visivel ?? true} className="size-5 accent-[var(--acao)]" />
          Visível no mapa dos proprietários
        </label>

        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">
          {p ? "Salvar alterações" : "Publicar perfil"}
        </button>
      </form>

      {p && (
        <section className="mt-6">
          <p className={rot}>Fotos ({fotos.length}/3)</p>
          {fotos.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {fotos.map((f) => (
                <div key={f.path} className="overflow-hidden rounded-[12px] border border-line bg-panel sombra-1">
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL pública do bucket parceiros */}
                  <img src={f.url} alt={p.nome} className="aspect-square w-full object-cover" loading="lazy" />
                  <form action={excluirFotoParceiro} className="p-1.5">
                    <input type="hidden" name="path" value={f.path} />
                    <Confirmar mensagem="Excluir foto?" rotulo="Excluir" className="apoio flex h-11 w-full items-center justify-center text-crit" />
                  </form>
                </div>
              ))}
            </div>
          )}
          {fotos.length < 3 && (
            <form action={subirFotoParceiro} className="sombra-1 mt-3 flex items-center gap-2 rounded-[14px] border border-line bg-panel p-3">
              <input name="foto" type="file" accept="image/jpeg,image/png,image/webp" required className="corpo min-w-0 flex-1" />
              <button className="shrink-0 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-acao-texto">Enviar</button>
            </form>
          )}
        </section>
      )}
    </main>
  )
}
