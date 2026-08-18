import { Avatar } from "@/components/avatar"
import { SeloReputacao } from "@/components/avaliacoes/reputacao"
import { calcularReputacao, type Reputacao } from "@/lib/domain/avaliacoes"
import { microKpisDoPerfil } from "@/lib/domain/captain"
import { nomeDaRegiao, nomeDe, type MapaTaxonomia } from "@/lib/consultas-marketplace"
import type { PerfilComandante } from "@/lib/db/types"

/**
 * O cartão de um profissional nas vitrines /comandantes e /prestadores
 * (onda 50, PRD §12; anatomia da onda 62, canvas tela-3l).
 *
 * As duas telas mostravam o MESMO cartão escrito duas vezes desde a onda 39,
 * e a onda 49 acabou colocando o selo de reputação só em uma delas —
 * exatamente o tipo de divergência que duas cópias produzem. Agora é um
 * componente só: acrescentar um campo do §12 aparece nos dois lugares no
 * mesmo commit, ou em nenhum.
 *
 * CANVAS TELA-3L — "mesmo cartão de pessoa da Tripulação, com disponibilidade
 * no lugar do estado de bordo": avatar de 48px, nome + função · região, a
 * disponibilidade como pílula à direita, micro-KPIs em chips mono
 * (`microKpisDoPerfil` — só o que a pessoa declarou) e "quem não tem
 * histórico recebe 'Sem dados' em vez de estrelas vazias". A ação real do
 * cartão é o WhatsApp (§47) — verde semântico do contato, nunca o dourado,
 * que num cartão repetido viraria confete (DESIGN §5).
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
  /** `undefined` vira "sem avaliação" — o chip diz isso em voz alta. */
  reputacao: Reputacao | undefined
  mapa: MapaTaxonomia
  fotoUrl: string | null
}) {
  const funcao = nomeDe(mapa, perfil.funcao_id) ?? perfil.categoria
  const regiao = perfil.regiao_id ? nomeDaRegiao(mapa, perfil.regiao_id) : perfil.cidade
  const identificacao = [funcao, regiao].filter(Boolean).join(" · ")
  const kpis = microKpisDoPerfil(perfil)
  const rep = reputacao ?? calcularReputacao([])

  return (
    <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3">
      <div className="flex items-center gap-3">
        <Avatar url={fotoUrl} nome={perfil.nome_publico} tamanho="size-12" />
        <div className="min-w-0 flex-1">
          <p className="titulo-card">{perfil.nome_publico}</p>
          {identificacao && <p className="apoio mt-0.5 text-dim">{identificacao}</p>}
        </div>
        {/* A pílula de disponibilidade do canvas. Texto livre declarado pela
            própria pessoa — quando declarou, o verde de "dá pra chamar";
            quando não, "Sem dados" neutro, nunca inventado. */}
        <span
          className={`max-w-[40%] shrink-0 truncate rounded-full border px-2 py-1 font-mono-instr text-[11px] tracking-wide ${
            perfil.disponibilidade ? "border-ok/40 text-ok" : "border-line text-dim"
          }`}
        >
          {perfil.disponibilidade ?? "Sem dados"}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {kpis.map((k) => (
          <span key={k.rotulo} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1">
            <span className="font-mono-instr text-[11px] uppercase tracking-[.12em] text-dim">{k.rotulo}</span>
            <span className="font-mono-instr text-xs font-semibold tabular-nums">{k.valor}</span>
          </span>
        ))}
        {rep.quantidade > 0 ? (
          <SeloReputacao reputacao={rep} href={`/avaliacoes/${perfil.usuario_id}`} />
        ) : (
          <span className="rounded-full border border-line px-2.5 py-1 font-mono-instr text-[11px] tracking-wide text-dim">
            Sem avaliações
          </span>
        )}
        <span className="rounded-full border border-line px-2.5 py-1 font-mono-instr text-[11px] uppercase tracking-[.1em] text-dim">
          {perfil.verificado ? "Verificado" : "Documentação declarada"}
        </span>
      </div>

      {perfil.certificacoes && <p className="apoio mt-2 text-dim">{perfil.certificacoes}</p>}
      {perfil.bio && <p className="apoio mt-1 text-dim">{perfil.bio}</p>}

      {perfil.telefone && (
        <a
          href={`https://wa.me/55${perfil.telefone.replace(/\D/g, "")}`}
          target="_blank" rel="noopener noreferrer"
          className="mt-3 flex h-11 w-full items-center justify-center rounded-lg border border-ok/40 text-sm font-medium text-ok"
        >
          Chamar no WhatsApp
        </a>
      )}
    </div>
  )
}
