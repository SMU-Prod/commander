import { redirect } from "next/navigation"
import { PainelCarreira } from "@/components/captain/painel-carreira"
import { PerfilProfissionalForm } from "@/components/perfil-profissional-form"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { carregarTrilha, urlDaFotoDePerfil } from "@/lib/consultas-captain"
import { carregarTaxonomia, itensDoTipo } from "@/lib/consultas-marketplace"
import { ESPECIALIDADES_PRESTADOR } from "@/lib/domain/prestadores"
import { supabaseServer } from "@/lib/supabase/server"
import type { PerfilComandante } from "@/lib/db/types"

// Onda 50 — mesma estrutura de /comandantes/perfil (ver o cabeçalho de lá):
// painel do que foi conquistado em cima, formulário embaixo, função e região
// vindas da taxonomia. O plano que ativa a vitrine aqui é o Partner Prestador
// (§13.1), não o Captain Pro — quem decide isso é `PLANO_QUE_ATIVA_PERFIL`.
export default async function PerfilPrestadorPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [{ data }, taxonomia, { plano }] = await Promise.all([
    supabase.from("perfis_comandante").select("*").eq("usuario_id", user.id).maybeSingle(),
    carregarTaxonomia(),
    carregarTrilha(),
  ])
  const existente = data as PerfilComandante | null
  // Ver comentário equivalente em comandantes/perfil/page.tsx — mesma
  // limitação (usuario_id é PK única, um perfil por vez).
  const trocandoDeTipo = existente != null && existente.tipo !== "prestador"
  const perfil = trocandoDeTipo ? null : existente
  const fotoUrl = await urlDaFotoDePerfil(perfil?.foto_path ?? null)

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/prestadores"
        voltarRotulo="Prestadores"
        titulo="Meu perfil de prestador"
        descricao="O que o dono do barco vê quando procura quem resolve um problema."
      />
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}
      {trocandoDeTipo && (
        <p className="apoio mt-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-warn">
          Você tem um perfil de Comandante (&quot;{existente.nome_publico}&quot;). Um perfil por vez — salvar
          aqui substitui esse perfil pelo de Prestador.
        </p>
      )}

      <PainelCarreira
        usuarioId={user.id}
        tipo="prestador"
        visivel={perfil?.visivel ?? false}
        plano={plano}
      />

      <PerfilProfissionalForm
        tipo="prestador"
        perfil={perfil}
        funcoes={itensDoTipo(taxonomia, "funcao")}
        regioes={itensDoTipo(taxonomia, "regiao")}
        fotoUrl={fotoUrl}
        categoriasSugeridas={ESPECIALIDADES_PRESTADOR}
        categoriaLabel="Especialidade"
        categoriaPlaceholder="Mecânica"
      />
    </main>
  )
}
