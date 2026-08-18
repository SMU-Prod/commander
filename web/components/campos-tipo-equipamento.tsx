"use client"
import { useState } from "react"
import { CampoSelect } from "@/components/ui/campo"
import { linhaCampos } from "@/lib/ui/form"
import type { Equipamento, TipoBateria } from "@/lib/db/types"
import { ROTULO_ZONA, sugestaoDeZona, ZONAS, type ZonaEmbarcacao } from "@/lib/domain/mapa-embarcacao"

export const ROTULO_TIPO_BATERIA: Record<TipoBateria, string> = {
  chumbo_acido: "Chumbo-ácido",
  agm: "AGM",
  gel: "Gel",
  litio: "Lítio",
  outro: "Outro",
}

/**
 * Tipo + Posição do equipamento, o campo "Onde fica no barco" (zona física,
 * onda 61) e, só quando o tipo é "bateria", o campo "Tipo de bateria" (onda
 * 41, PRD §14).
 *
 * É cliente por causa desse "só quando": o tipo de bateria não faz sentido
 * num gerador, e deixar o campo sempre visível convida a preencher errado.
 * O servidor não confia nisso — `lib/acoes/equipamentos.ts` descarta o valor
 * quando o tipo não é bateria, porque o campo continua no FormData se a
 * pessoa escolher AGM e depois trocar o tipo.
 *
 * Usado nos dois formulários (novo e editar) pra não haver duas listas de
 * tipo divergindo com o tempo — foi exatamente o que aconteceu quando
 * "painel" entrou e só um dos dois arquivos sabia dele.
 *
 * `zonaInicial` distingue os dois modos (spec §2.1 / §4, "fica como sugestão
 * pré-preenchida no select, nunca gravada sem confirmação"):
 *   - `undefined` (não passado, form NOVO): pré-preenche com
 *     `sugestaoDeZona(tipoInicial)` — um palpite, não um dado gravado;
 *   - qualquer outra coisa, incluindo `null` (form EDITAR): mostra
 *     exatamente o que está gravado, mesmo que seja "nenhuma zona ainda".
 */
export function CamposTipoEquipamento({
  tipoInicial,
  posicaoInicial = "",
  tipoBateriaInicial = "",
  zonaInicial,
}: {
  tipoInicial: string
  posicaoInicial?: string
  tipoBateriaInicial?: string
  zonaInicial?: ZonaEmbarcacao | null
}) {
  const [tipo, setTipo] = useState(tipoInicial)
  const zonaPadrao =
    zonaInicial !== undefined ? (zonaInicial ?? "") : (sugestaoDeZona(tipoInicial as Equipamento["tipo"]) ?? "")

  return (
    <>
      <div className={linhaCampos}>
        <CampoSelect
          label="Tipo"
          id="tipo"
          name="tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          <option value="gerador">Gerador</option>
          <option value="bateria">Baterias</option>
          {/* PRD §14: "Sistema/painel de bordo — cadastro das informações
              pertinentes". Cai em Elétrica pela mesma regra de gerador e
              bateria (`abaDoEquipamento`), sem linha nova na matriz. */}
          <option value="painel">Painel de bordo</option>
          <option value="motor">Motor</option>
          <option value="outro">Outro</option>
        </CampoSelect>
        <CampoSelect label="Posição" id="posicao" name="posicao" defaultValue={posicaoInicial}>
          <option value="">Sem posição</option>
          <option value="BB">Bombordo (BB)</option>
          <option value="BE">Boreste (BE)</option>
          <option value="central">Central</option>
        </CampoSelect>
      </div>

      <CampoSelect
        label="Onde fica no barco"
        id="zona"
        name="zona"
        defaultValue={zonaPadrao}
        dica="Ajuda a achar o equipamento no Mapa da embarcação — pode mudar depois."
      >
        <option value="">Ainda não sei</option>
        {ZONAS.map((z) => (
          <option key={z} value={z}>{ROTULO_ZONA[z]}</option>
        ))}
      </CampoSelect>

      {tipo === "bateria" && (
        <CampoSelect
          label="Tipo de bateria"
          id="tipo_bateria"
          name="tipo_bateria"
          defaultValue={tipoBateriaInicial}
          dica="Muda o regime de carga e a vida útil esperada."
        >
          <option value="">Não informado</option>
          {(Object.keys(ROTULO_TIPO_BATERIA) as TipoBateria[]).map((t) => (
            <option key={t} value={t}>{ROTULO_TIPO_BATERIA[t]}</option>
          ))}
        </CampoSelect>
      )}
    </>
  )
}
