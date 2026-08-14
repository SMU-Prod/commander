import { salvarPerfilComandante } from "@/lib/acoes/perfil-comandante"
import { Campo, CampoTextarea } from "@/components/ui/campo"
import type { PerfilComandante, TipoPerfilComandante } from "@/lib/db/types"

/**
 * Formulário de perfil profissional — compartilhado por /comandantes/perfil
 * e /prestadores/perfil (onda 39). Mesma tabela (`perfis_comandante`), mesma
 * ação (`salvarPerfilComandante`), só o `tipo` (hidden input) e as
 * sugestões de categoria mudam — evita duas cópias quase idênticas do
 * mesmo form, que era exatamente o formulário original de /marketplace/perfil.
 */
export function PerfilProfissionalForm({
  tipo,
  perfil,
  categoriasSugeridas,
  categoriaLabel,
  categoriaPlaceholder,
}: {
  tipo: TipoPerfilComandante
  /** `null` quando a pessoa ainda não tem perfil DESTE tipo — ver aviso de
   *  troca de tipo na página, que decide isso antes de passar aqui. */
  perfil: PerfilComandante | null
  categoriasSugeridas: readonly string[]
  categoriaLabel: string
  categoriaPlaceholder: string
}) {
  const rotuloLista = tipo === "comandante" ? "comandantes" : "prestadores"
  return (
    <form action={salvarPerfilComandante} className="mt-5 space-y-4">
      <input type="hidden" name="tipo" value={tipo} />
      <Campo
        label="Nome profissional" id="nome_publico" name="nome_publico" required
        defaultValue={perfil?.nome_publico ?? ""}
      />
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
      <Campo
        label="Disponibilidade" id="disponibilidade" name="disponibilidade"
        defaultValue={perfil?.disponibilidade ?? ""} placeholder="Fins de semana e feriados"
      />
      <Campo
        label="WhatsApp (com DDD)" id="telefone" name="telefone" inputMode="tel"
        defaultValue={perfil?.telefone ?? ""} placeholder="21 99999-0000"
      />
      <CampoTextarea
        label="Apresentação" id="bio" name="bio" rows={3}
        defaultValue={perfil?.bio ?? ""} placeholder="Experiência, o que já resolveu…"
      />
      <label className="flex items-center gap-2.5 text-sm">
        <input type="checkbox" name="visivel" defaultChecked={perfil?.visivel ?? true} className="size-5 accent-[#d4af37]" />
        Aparecer na lista de {rotuloLista} disponíveis
      </label>
      <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">Salvar perfil</button>
    </form>
  )
}
