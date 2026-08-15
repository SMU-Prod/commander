import { redirect } from "next/navigation"
import { PainelCarreira } from "@/components/captain/painel-carreira"
import { PerfilProfissionalForm } from "@/components/perfil-profissional-form"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { carregarTrilha, urlDaFotoDePerfil } from "@/lib/consultas-captain"
import { carregarTaxonomia, itensDoTipo } from "@/lib/consultas-marketplace"
import { supabaseServer } from "@/lib/supabase/server"
import type { PerfilComandante } from "@/lib/db/types"

const HABILITACOES = ["Arrais Amador", "Mestre Amador", "Capitão Amador", "Marinheiro Profissional"]

/**
 * ONDA 50 (PRD §12) — esta tela deixou de ser só um formulário.
 *
 * O §12 descreve o perfil profissional como um conjunto de coisas que a
 * pessoa PREENCHE (foto, função, região, experiência, certificações, portes)
 * e coisas que ela CONQUISTA (disponibilidade publicada, avaliações,
 * trabalhos confirmados). As segundas vêm primeiro na página, no
 * `PainelCarreira`, junto com a resposta que importa mais: o perfil está no
 * ar ou não, e por quê.
 *
 * Função e região agora saem da `taxonomia` (§11.2/§21.2), então a página
 * carrega as listas e passa pro formulário — texto livre continua existindo
 * só como complemento.
 */
export default async function PerfilComandantePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [{ data }, taxonomia, { planoCarreira }] = await Promise.all([
    supabase.from("perfis_comandante").select("*").eq("usuario_id", user.id).maybeSingle(),
    carregarTaxonomia(),
    carregarTrilha(),
  ])
  const existente = data as PerfilComandante | null
  // Onda 39 — mesma linha (usuario_id é PK) serve os dois tipos: quem já tem
  // perfil de Prestador e abre este form vê um aviso ANTES de digitar nada
  // de novo, porque salvar aqui substitui o perfil existente (não dá pra ter
  // os dois tipos ao mesmo tempo hoje — ver limitação anotada no relatório
  // da onda). `perfil` só entra pré-preenchido quando já é do tipo certo.
  const trocandoDeTipo = existente != null && existente.tipo !== "comandante"
  const perfil = trocandoDeTipo ? null : existente
  const fotoUrl = await urlDaFotoDePerfil(perfil?.foto_path ?? null)

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

      <PainelCarreira
        usuarioId={user.id}
        tipo="comandante"
        visivel={perfil?.visivel ?? false}
        plano={planoCarreira}
      />

      <PerfilProfissionalForm
        tipo="comandante"
        perfil={perfil}
        funcoes={itensDoTipo(taxonomia, "funcao")}
        regioes={itensDoTipo(taxonomia, "regiao")}
        fotoUrl={fotoUrl}
        categoriasSugeridas={HABILITACOES}
        categoriaLabel="Habilitação"
        categoriaPlaceholder="Capitão Amador"
      />
    </main>
  )
}
