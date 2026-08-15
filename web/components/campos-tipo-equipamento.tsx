"use client"
import { useState } from "react"
import { CampoSelect } from "@/components/ui/campo"
import { linhaCampos } from "@/lib/ui/form"
import type { TipoBateria } from "@/lib/db/types"

export const ROTULO_TIPO_BATERIA: Record<TipoBateria, string> = {
  chumbo_acido: "Chumbo-ácido",
  agm: "AGM",
  gel: "Gel",
  litio: "Lítio",
  outro: "Outro",
}

/**
 * Tipo + Posição do equipamento e, só quando o tipo é "bateria", o campo
 * "Tipo de bateria" (onda 41, PRD §14).
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
 */
export function CamposTipoEquipamento({
  tipoInicial,
  posicaoInicial = "",
  tipoBateriaInicial = "",
}: {
  tipoInicial: string
  posicaoInicial?: string
  tipoBateriaInicial?: string
}) {
  const [tipo, setTipo] = useState(tipoInicial)

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
