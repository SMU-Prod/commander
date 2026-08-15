import { Avatar } from "@/components/avatar"
import { SeloReputacao } from "@/components/avaliacoes/reputacao"
import { calcularReputacao, type Reputacao } from "@/lib/domain/avaliacoes"
import { nomeDaRegiao, nomeDe, type MapaTaxonomia } from "@/lib/consultas-marketplace"
import type { PerfilComandante } from "@/lib/db/types"

/**
 * O cartão de um profissional nas vitrines /comandantes e /prestadores
 * (onda 50, PRD §12).
 *
 * As duas telas mostravam o MESMO cartão escrito duas vezes desde a onda 39,
 * e a onda 49 acabou colocando o selo de reputação só em uma delas —
 * exatamente o tipo de divergência que duas cópias produzem. Agora é um
 * componente só: acrescentar um campo do §12 aparece nos dois lugares no
 * mesmo commit, ou em nenhum.
 *
 * A linha de identificação prefere os campos PADRONIZADOS (função e região da
 * `taxonomia`, migration 046/051) e cai nos campos de texto livre da onda 39
 * (`categoria`/`cidade`) quando os novos ainda estão vazios — §23, nada do
 * que a pessoa já escreveu deixa de aparecer por causa da mudança de modelo.
 */
export function CartaoProfissional({
  perfil,
  reputacao,
  mapa,
  fotoUrl,
}: {
  perfil: PerfilComandante
  /** `undefined` vira "sem avaliação" — o selo some sozinho nesse caso. */
  reputacao: Reputacao | undefined
  mapa: MapaTaxonomia
  fotoUrl: string | null
}) {
  const funcao = nomeDe(mapa, perfil.funcao_id) ?? perfil.categoria
  const regiao = perfil.regiao_id ? nomeDaRegiao(mapa, perfil.regiao_id) : perfil.cidade
  const identificacao = [funcao, regiao, perfil.disponibilidade].filter(Boolean).join(" · ")

  // §12: "experiência, certificações, embarcações/portes". Só entram quando
  // existem — linha vazia com separadores soltos é pior que ausência.
  const credenciais = [
    perfil.experiencia_anos != null
      ? `${perfil.experiencia_anos} ano${perfil.experiencia_anos === 1 ? "" : "s"} de experiência`
      : null,
    perfil.porte_max_pes != null ? `até ${perfil.porte_max_pes} pés` : null,
    perfil.certificacoes,
  ].filter(Boolean).join(" · ")

  return (
    <div className="border-b border-line py-3.5 last:border-0">
      <div className="flex items-center gap-3">
        <Avatar url={fotoUrl} nome={perfil.nome_publico} />
        <div className="min-w-0 flex-1">
          <p className="titulo-card">{perfil.nome_publico}</p>
          {identificacao && <p className="apoio mt-0.5 text-dim">{identificacao}</p>}
        </div>
        {perfil.telefone && (
          <a
            href={`https://wa.me/55${perfil.telefone.replace(/\D/g, "")}`}
            target="_blank" rel="noopener noreferrer"
            className="rounded-lg border border-ok/40 px-2.5 py-1.5 text-xs text-ok"
          >
            WhatsApp
          </a>
        )}
      </div>
      {credenciais && <p className="apoio mt-1.5 text-dim">{credenciais}</p>}
      {perfil.bio && <p className="apoio mt-2 text-dim">{perfil.bio}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="inline-block rounded border border-line px-1.5 py-0.5 font-mono-instr text-[11px] uppercase tracking-[.1em] text-dim">
          {perfil.verificado ? "Verificado" : "Documentação declarada"}
        </span>
        <SeloReputacao
          reputacao={reputacao ?? calcularReputacao([])}
          href={`/avaliacoes/${perfil.usuario_id}`}
        />
      </div>
    </div>
  )
}
