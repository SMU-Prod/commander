import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { TOQUE } from "@/lib/ui/acoes"
import { exigirAreaAdmin } from "@/lib/admin"
import { buscarUsuarios } from "@/lib/consultas-suporte"

/**
 * Admin > Usuários (PRD §21, escopo Suporte: "Usuários, embarcações,
 * planos/status, chamados e operação de suporte").
 *
 * Busca por NOME. O e-mail vive em `auth.users`, schema do Supabase Auth que
 * nenhum cliente alcança nem com papel de Suporte — ler de lá exigiria
 * service role no servidor, o que é uma decisão de segurança com peso
 * próprio e não um atalho pra uma caixa de busca. A limitação está dita aqui
 * e na tela, em vez de virar um campo que não encontra ninguém.
 *
 * Sem termo, mostra os últimos cadastrados: uma tela de atendimento que abre
 * vazia obriga a pessoa a adivinhar o que digitar (§24 — estado vazio
 * explica e oferece o caminho).
 */
export default async function AdminUsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await exigirAreaAdmin("usuarios")
  const { q } = await searchParams
  const termo = (q ?? "").trim()
  const usuarios = await buscarUsuarios(termo)

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/admin"
        voltarRotulo="Admin Commander"
        titulo="Usuários"
        descricao="Busca por nome. Abrir uma ficha mostra plano, status de assinatura e as embarcações vinculadas — o dossiê técnico e financeiro do barco continua fechado."
      />

      {/* Campo e botão mediam ~42px: dois pixels abaixo da régua, o que é o
          jeito mais fácil de errar o alvo com o dedo. `h-11` nos dois.
          Aqui NÃO entra `BotaoEnviar`: este formulário não tem action de
          servidor — é um GET que navega —, então `useFormStatus` nunca
          reportaria pendência e o aviso de envio seria um enfeite mudo. */}
      <form className="mt-4 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={termo}
          placeholder="Nome do usuário"
          aria-label="Buscar usuário pelo nome"
          className="corpo h-11 min-w-0 flex-1 rounded-[var(--raio-controle)] border border-line bg-panel2 px-3"
        />
        <button className={`h-11 shrink-0 rounded-full border border-line bg-panel2 px-5 text-sm font-medium ${TOQUE}`}>
          Buscar
        </button>
      </form>

      <SecaoPagina>{termo === "" ? "Últimos cadastrados" : `Resultados para "${termo}"`}</SecaoPagina>

      {usuarios.length === 0 ? (
        <EstadoVazio
          icone="pessoas"
          titulo={termo === "" ? "Nenhum usuário cadastrado ainda" : "Ninguém encontrado com esse nome"}
          descricao={
            termo === ""
              ? "Assim que alguém criar conta, aparece aqui."
              : "A busca é por nome do perfil. Se o cliente informou só o e-mail, peça o nome cadastrado — o e-mail fica no sistema de autenticação, fora do alcance desta tela."
          }
        />
      ) : (
        <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
          {usuarios.map((u) => (
            <LinhaLista
              key={u.id}
              href={`/admin/usuarios/${u.id}`}
              titulo={u.nome}
              subtitulo={`${u.embarcacoes === 0 ? "Sem embarcação" : `${u.embarcacoes} embarcação${u.embarcacoes > 1 ? "ões" : ""}`} · desde ${formatarData(u.criadoEm)}`}
            />
          ))}
        </div>
      )}
    </main>
  )
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}
