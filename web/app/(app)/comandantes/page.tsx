import Link from "next/link"
import { CartaoProfissional } from "@/components/captain/cartao-profissional"
import { Icone } from "@/components/icone"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { RedeNav } from "@/components/ui/rede-nav"
import { carregarReputacoes } from "@/lib/consultas-avaliacoes"
import { resolvedorDeFotoDePerfil } from "@/lib/consultas-captain"
import { carregarMapaTaxonomia } from "@/lib/consultas-marketplace"
import { PLANOS } from "@/lib/domain/planos"
import { supabaseServer } from "@/lib/supabase/server"
import type { PerfilComandante } from "@/lib/db/types"

// Onda 39 — renomeada de /marketplace pra /comandantes (a URL não tinha
// acompanhado o rótulo do bottom-nav, já trocado numa auditoria de
// usabilidade anterior). Ver docs/CONTRIBUTING.md, Glossário: "Comandantes" é
// o nome final desta VITRINE DE PERFIS, e ela nunca volta a se chamar
// Marketplace — esse nome é da área de DEMANDAS (/marketplace, onda 45).
//
// ONDA 50 (§12) — a lista passou a mostrar o perfil profissional do PRD
// (foto, função e região padronizadas, experiência, certificações, porte) e
// só devolve quem tem Captain Pro: a RLS da migration 051 aplica o "perfil
// ativo" do §12. Esta página NÃO filtra plano na query de propósito — se o
// filtro vivesse aqui, um cliente que chamasse o PostgREST direto veria
// todo mundo. Ver `perfil_profissional_ativo()`.
export default async function ComandantesPage() {
  const supabase = await supabaseServer()
  const { data: perfis, error } = await supabase
    .from("perfis_comandante").select("*").eq("tipo", "comandante").eq("visivel", true).order("created_at")
  if (error) throw new Error("Não foi possível carregar os comandantes. Recarregue a página.")

  // §14: "Perfil mostra média, quantidade". Uma consulta só pra todos os
  // perfis da lista — nota no cartão é o que ajuda a escolher antes de abrir.
  const lista = (perfis ?? []) as PerfilComandante[]
  const [reputacoes, mapa, foto] = await Promise.all([
    carregarReputacoes(lista.map((p) => p.usuario_id)),
    carregarMapaTaxonomia(),
    resolvedorDeFotoDePerfil(),
  ])

  return (
    <main>
      {/* Canvas tela-3l — o subtítulo diz o que a vitrine é: disponibilidade
          + histórico DENTRO do app, contratação direta. */}
      <h1 className="titulo-pagina">Comandantes</h1>
      <p className="apoio mt-1 text-dim">
        {/* Sem "na sua região" e sem "com histórico": a consulta filtra
            `tipo` e `visivel`, região nenhuma, e o cartão mostra "Sem
            avaliações" pra quem ainda não tem histórico. O texto prometia
            dois filtros que não existem. */}
        Comandantes que publicaram o perfil — contrato direto pelo WhatsApp.
      </p>
      <RedeNav atual="comandantes" className="mt-4" />

      {/* Cartões soltos com respiro (anatomia do canvas), não mais linhas num
          painel único — o cartão de pessoa tem chips e ação próprios. */}
      <div className="mt-4 flex flex-col gap-2">
        {lista.length === 0 && (
          <EstadoVazio
            icone="pessoas"
            titulo="Ainda não há comandantes cadastrados na sua região"
            descricao="Assim que houver, eles aparecem aqui."
          />
        )}
        {lista.map((p) => (
          <CartaoProfissional
            key={p.usuario_id}
            perfil={p}
            reputacao={reputacoes.get(p.usuario_id)}
            mapa={mapa}
            fotoUrl={foto(p.foto_path)}
          />
        ))}
      </div>

      {/* A frase honesta do canvas, curta: declarado ≠ verificado. */}
      <p className="apoio mt-4 leading-relaxed text-dim">
        &quot;Documentação declarada&quot; é o que a própria pessoa informou — o Commander não verifica
        habilitação. A contratação é combinada diretamente entre as partes.
      </p>

      <Link href="/comandantes/perfil" className="mt-6 inline-flex items-center gap-1 apoio text-dim">
        <Icone nome="pessoas" className="size-3.5" /> É comandante? Toque aqui para criar seu perfil
        {" "}— o {PLANOS.captain_pro.rotulo} coloca você nesta lista.
      </Link>
    </main>
  )
}
