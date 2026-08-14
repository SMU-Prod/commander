import { redirect } from "next/navigation"
import { PerfilProfissionalForm } from "@/components/perfil-profissional-form"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { supabaseServer } from "@/lib/supabase/server"
import type { PerfilComandante } from "@/lib/db/types"

const HABILITACOES = ["Arrais Amador", "Mestre Amador", "Capitão Amador", "Marinheiro Profissional"]

export default async function PerfilComandantePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data } = await supabase
    .from("perfis_comandante").select("*").eq("usuario_id", user.id).maybeSingle()
  const existente = data as PerfilComandante | null
  // Onda 39 — mesma linha (usuario_id é PK) serve os dois tipos: quem já tem
  // perfil de Prestador e abre este form vê um aviso ANTES de digitar nada
  // de novo, porque salvar aqui substitui o perfil existente (não dá pra ter
  // os dois tipos ao mesmo tempo hoje — ver limitação anotada no relatório
  // da onda). `perfil` só entra pré-preenchido quando já é do tipo certo.
  const trocandoDeTipo = existente != null && existente.tipo !== "comandante"
  const perfil = trocandoDeTipo ? null : existente

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/comandantes"
        voltarRotulo="Comandantes"
        titulo="Meu perfil de comandante"
        descricao="O que o dono do barco vê quando procura um comandante para contratar."
      />
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}
      {trocandoDeTipo && (
        <p className="apoio mt-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-warn">
          Você tem um perfil de Prestador (&quot;{existente.nome_publico}&quot;). Um perfil por vez — salvar
          aqui substitui esse perfil pelo de Comandante.
        </p>
      )}
      <PerfilProfissionalForm
        tipo="comandante"
        perfil={perfil}
        categoriasSugeridas={HABILITACOES}
        categoriaLabel="Habilitação"
        categoriaPlaceholder="Capitão Amador"
      />
    </main>
  )
}
