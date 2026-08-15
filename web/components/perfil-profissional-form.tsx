import { Avatar } from "@/components/avatar"
import { removerFotoDePerfil, salvarPerfilComandante } from "@/lib/acoes/perfil-comandante"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { Confirmar } from "@/components/confirmar"
import type { ItemTaxonomiaDb, PerfilComandante, TipoPerfilComandante } from "@/lib/db/types"

/**
 * Formulário de perfil profissional — compartilhado por /comandantes/perfil
 * e /prestadores/perfil (onda 39). Mesma tabela (`perfis_comandante`), mesma
 * ação (`salvarPerfilComandante`), só o `tipo` (hidden input) e as
 * sugestões de categoria mudam — evita duas cópias quase idênticas do
 * mesmo form, que era exatamente o formulário original de /marketplace/perfil.
 *
 * ONDA 50 (§12) — os campos do perfil profissional do PRD entraram aqui:
 * foto, função, região, experiência, certificações e porte. Função e região
 * são `<select>` da TAXONOMIA (§11.2/§21.2: "categorias, funções, regiões e
 * campos padronizados"; "texto livre é apenas observação complementar") — sem
 * isso o matching do §11.4 nunca casaria "Comandante" com "comandante".
 *
 * Os campos antigos de texto livre (habilitação/especialidade e cidade)
 * CONTINUAM no formulário, embaixo, marcados como complemento: §23 não deixa
 * apagar o que a pessoa já escreveu, e a habilitação ("Capitão Amador") é uma
 * informação real que a taxonomia de FUNÇÃO não cobre.
 */
export function PerfilProfissionalForm({
  tipo,
  perfil,
  funcoes,
  regioes,
  fotoUrl,
  categoriasSugeridas,
  categoriaLabel,
  categoriaPlaceholder,
}: {
  tipo: TipoPerfilComandante
  /** `null` quando a pessoa ainda não tem perfil DESTE tipo — ver aviso de
   *  troca de tipo na página, que decide isso antes de passar aqui. */
  perfil: PerfilComandante | null
  funcoes: readonly ItemTaxonomiaDb[]
  regioes: readonly ItemTaxonomiaDb[]
  /** URL pública da foto atual, `null` quando não há. */
  fotoUrl: string | null
  categoriasSugeridas: readonly string[]
  categoriaLabel: string
  categoriaPlaceholder: string
}) {
  const rotuloLista = tipo === "comandante" ? "comandantes" : "prestadores"
  return (
    <>
      <form action={salvarPerfilComandante} className="mt-5 space-y-4">
        <input type="hidden" name="tipo" value={tipo} />

        <Campo
          label="Nome profissional" id="nome_publico" name="nome_publico" required
          defaultValue={perfil?.nome_publico ?? ""}
        />

        {/* §12, primeiro item do perfil profissional: foto. */}
        <div className="flex items-center gap-3">
          <Avatar url={fotoUrl} nome={perfil?.nome_publico ?? ""} tamanho="size-16" />
          <Campo
            label="Foto" id="foto" name="foto" type="file" accept="image/jpeg,image/png,image/webp"
            wrapperClassName="min-w-0 flex-1"
            dica={fotoUrl ? "Escolher outra substitui a atual." : "JPG, PNG ou WebP, até 4 MB."}
          />
        </div>

        <CampoSelect
          label="Função" id="funcao_id" name="funcao_id" defaultValue={perfil?.funcao_id ?? ""}
          dica="É por aqui que o proprietário encontra você no Marketplace."
        >
          <option value="">Não informar</option>
          {funcoes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </CampoSelect>

        <CampoSelect
          label="Região onde atua" id="regiao_id" name="regiao_id" defaultValue={perfil?.regiao_id ?? ""}
        >
          <option value="">Não informar</option>
          {regioes.map((r) => (
            <option key={r.id} value={r.id}>{r.uf ? `${r.nome} — ${r.uf}` : r.nome}</option>
          ))}
        </CampoSelect>

        <div className="grid grid-cols-2 gap-3">
          <Campo
            label="Experiência (anos)" id="experiencia_anos" name="experiencia_anos" inputMode="numeric"
            defaultValue={perfil?.experiencia_anos ?? ""} placeholder="8"
          />
          <Campo
            label="Porte máximo (pés)" id="porte_max_pes" name="porte_max_pes" inputMode="numeric"
            defaultValue={perfil?.porte_max_pes ?? ""} placeholder="60"
          />
        </div>

        <Campo
          label="Certificações" id="certificacoes" name="certificacoes"
          defaultValue={perfil?.certificacoes ?? ""}
          placeholder="Capitão Amador, STCW, NR-13…"
        />

        <Campo
          label="Disponibilidade (em uma linha)" id="disponibilidade" name="disponibilidade"
          defaultValue={perfil?.disponibilidade ?? ""} placeholder="Fins de semana e feriados"
          dica="Para períodos com data, publique em Marketplace › Estou disponível."
        />

        <Campo
          label="WhatsApp (com DDD)" id="telefone" name="telefone" inputMode="tel"
          defaultValue={perfil?.telefone ?? ""} placeholder="21 99999-0000"
        />

        <CampoTextarea
          label="Apresentação" id="bio" name="bio" rows={3}
          defaultValue={perfil?.bio ?? ""} placeholder="Experiência, o que já resolveu…"
        />

        {/* Complemento de texto livre — herdado da onda 39 e mantido (§23).
            Fica no fim porque o padronizado é que manda no matching. */}
        <div className="grid grid-cols-2 gap-3">
          <Campo
            label={categoriaLabel} id="categoria" name="categoria" list="categorias-sugeridas"
            defaultValue={perfil?.categoria ?? ""} placeholder={categoriaPlaceholder}
          >
            <datalist id="categorias-sugeridas">
              {categoriasSugeridas.map((c) => <option key={c} value={c} />)}
            </datalist>
          </Campo>
          <Campo label="Cidade" id="cidade" name="cidade" defaultValue={perfil?.cidade ?? ""} placeholder="Rio de Janeiro" />
        </div>

        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" name="visivel" defaultChecked={perfil?.visivel ?? true} className="size-5 accent-[#d4af37]" />
          Aparecer na lista de {rotuloLista} disponíveis
        </label>

        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">Salvar perfil</button>
      </form>

      {fotoUrl && (
        <form action={removerFotoDePerfil} className="mt-3">
          <input type="hidden" name="tipo" value={tipo} />
          <Confirmar mensagem="Remover a foto do perfil?" rotulo="Remover foto" />
        </form>
      )}
    </>
  )
}
