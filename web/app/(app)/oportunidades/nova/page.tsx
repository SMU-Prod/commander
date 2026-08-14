import { redirect } from "next/navigation"
import { criarOportunidade } from "@/lib/acoes/oportunidades"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoTextarea } from "@/components/ui/campo"
import { ESPECIALIDADES_PRESTADOR } from "@/lib/domain/prestadores"
import { supabaseServer } from "@/lib/supabase/server"

const TIPOS = [
  { valor: "vaga", rotulo: "Vaga", exemplo: "Trabalho fixo ou de temporada — ex.: comandante para a temporada" },
  { valor: "diaria", rotulo: "Diária", exemplo: "Trabalho pontual — ex.: comandante para um fim de semana" },
  { valor: "peca_servico", rotulo: "Peça ou serviço", exemplo: "Ex.: \"COMPRO — Rádio VHF\", ou um serviço específico" },
] as const

export default async function NovaOportunidadePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/oportunidades"
        voltarRotulo="Oportunidades"
        titulo="Publicar oportunidade"
        descricao="Descreva o que precisa — prestadores e comandantes veem e respondem por aqui."
      />
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      <form action={criarOportunidade} className="mt-5 space-y-4">
        <fieldset>
          <legend className="rotulo mb-1.5 text-dim">Tipo</legend>
          <div className="space-y-2">
            {TIPOS.map((t, i) => (
              <label
                key={t.valor}
                className="flex cursor-pointer items-start gap-2.5 rounded-[12px] border border-line bg-panel p-3 has-[:checked]:border-accent"
              >
                <input type="radio" name="tipo" value={t.valor} defaultChecked={i === 0} required className="mt-1 size-4 accent-[#d4af37]" />
                <span>
                  <span className="corpo block font-medium">{t.rotulo}</span>
                  <span className="apoio block text-dim">{t.exemplo}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Campo
          label="Título" id="titulo" name="titulo" required maxLength={80}
          placeholder="Ex.: Preciso de mecânico Volvo em Angra"
        />

        <Campo
          label="Categoria (opcional)" id="categoria" name="categoria" list="categorias-oportunidade"
          placeholder="Mecânica"
        >
          <datalist id="categorias-oportunidade">
            {ESPECIALIDADES_PRESTADOR.map((c) => <option key={c} value={c} />)}
          </datalist>
        </Campo>

        <Campo label="Local (opcional)" id="local" name="local" placeholder="Angra dos Reis, RJ" />

        <CampoTextarea
          label="Descrição (opcional)" id="descricao" name="descricao" rows={4}
          placeholder="Detalhes que ajudam quem vai responder — urgência, orçamento estimado, especificações…"
        />

        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">Publicar</button>
      </form>
    </main>
  )
}
