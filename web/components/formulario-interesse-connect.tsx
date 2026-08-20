"use client"
import { useMemo, useState } from "react"
import { Icone } from "@/components/icone"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { Campo, CampoTextarea } from "@/components/ui/campo"
import {
  classificarCompatibilidadeConnect,
  MENSAGEM_CLASSIFICACAO_CONNECT,
  ROTULO_CLASSIFICACAO_CONNECT,
  type RespostaSimNaoNaoSei,
} from "@/lib/domain/connect"
import type { Equipamento } from "@/lib/db/types"

const rotulo = "rotulo mb-1.5 block text-dim"

/** Grupo de radio "Sim / Não / Não sei" — mesmo visual de cartão marcável
 *  usado em `/assinar` (`has-[:checked]:border-accent`), só que com 3
 *  opções lado a lado em vez de cartão cheio (a pergunta já diz tudo). */
function GrupoSimNaoNaoSei({
  nome,
  valor,
  aoMudar,
}: {
  nome: string
  valor: RespostaSimNaoNaoSei | null
  aoMudar: (v: RespostaSimNaoNaoSei) => void
}) {
  const OPCOES: { v: RespostaSimNaoNaoSei; rotulo: string }[] = [
    { v: "sim", rotulo: "Sim" },
    { v: "nao", rotulo: "Não" },
    { v: "nao_sei", rotulo: "Não sei" },
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {OPCOES.map((o) => (
        <label
          key={o.v}
          className="sombra-1 flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--raio-controle)] border border-line bg-panel px-2 text-center has-[:checked]:border-accent has-[:checked]:bg-panel2"
        >
          <input
            type="radio"
            name={nome}
            value={o.v}
            checked={valor === o.v}
            onChange={() => aoMudar(o.v)}
            className="sr-only"
          />
          <span className="corpo">{o.rotulo}</span>
        </label>
      ))}
    </div>
  )
}

/** O questionário curto de triagem (PRD, `docs/prd/commander-connect.txt`,
 *  seção 3) — client porque a pergunta seguinte (e o resultado preliminar)
 *  depende da resposta anterior. A classificação final de verdade é
 *  recalculada no servidor (`registrarInteresseConnect`,
 *  `web/lib/acoes/connect.ts`) a partir das MESMAS respostas — o preview
 *  aqui é só pra a pessoa ver o resultado antes de enviar, nunca a fonte
 *  de verdade gravada. */
export function FormularioInteresseConnect({ motorPrincipal }: { motorPrincipal: Equipamento | null }) {
  const [redeNmea2000, setRedeNmea2000] = useState<RespostaSimNaoNaoSei | null>(null)
  const [dadosMotorNaRede, setDadosMotorNaRede] = useState<RespostaSimNaoNaoSei | null>(null)
  const [motorDigitalConhecido, setMotorDigitalConhecido] = useState<RespostaSimNaoNaoSei | null>(null)

  const perguntaSecundariaRespondida = redeNmea2000 === "sim" ? dadosMotorNaRede != null : motorDigitalConhecido != null

  const classificacao = useMemo(() => {
    if (redeNmea2000 == null || !perguntaSecundariaRespondida) return null
    return classificarCompatibilidadeConnect({
      redeNmea2000,
      dadosMotorNaRede: redeNmea2000 === "sim" ? dadosMotorNaRede : null,
      motorDigitalConhecido: motorDigitalConhecido ?? "nao_sei",
    })
  }, [redeNmea2000, dadosMotorNaRede, motorDigitalConhecido, perguntaSecundariaRespondida])

  return (
    <div className="mt-6 space-y-5">
      <div>
        <p className={rotulo}>Sua embarcação já tem uma rede NMEA 2000 instalada?</p>
        <p className="apoio mb-2 text-dim">A mesma rede que hoje alimenta o chartplotter/MFD, quando existe.</p>
        <GrupoSimNaoNaoSei nome="rede_nmea2000" valor={redeNmea2000} aoMudar={setRedeNmea2000} />
      </div>

      {redeNmea2000 === "sim" && (
        <div>
          <p className={rotulo}>Os dados do motor (RPM, horas, temperatura) já aparecem no chartplotter/MFD?</p>
          <GrupoSimNaoNaoSei nome="dados_motor_na_rede" valor={dadosMotorNaRede} aoMudar={setDadosMotorNaRede} />
        </div>
      )}

      {(redeNmea2000 === "nao" || redeNmea2000 === "nao_sei") && (
        <div>
          <p className={rotulo}>O motor é digital — tem SmartCraft (Mercury), Command Link/Command Link Plus (Yamaha) ou sistema eletrônico equivalente?</p>
          <GrupoSimNaoNaoSei nome="motor_digital_conhecido" valor={motorDigitalConhecido} aoMudar={setMotorDigitalConhecido} />
        </div>
      )}

      {classificacao && (
        <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
          <div className="flex items-center gap-2">
            <Icone nome="escudo" className="size-4 text-dim" />
            <span className="rotulo text-dim">Resultado preliminar</span>
          </div>
          <p className="titulo-card mt-2">{ROTULO_CLASSIFICACAO_CONNECT[classificacao]}</p>
          <p className="apoio mt-1 text-dim">{MENSAGEM_CLASSIFICACAO_CONNECT[classificacao]}</p>
        </div>
      )}

      {classificacao === "consultar" && (
        <div className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
          <p className="rotulo text-dim">Ajude a Commander a analisar (opcional, mas ajuda bastante)</p>
          <Campo label="Marca do motor" id="motor_marca" name="motor_marca" defaultValue={motorPrincipal?.marca ?? ""} placeholder="Ex.: Mercury, Yamaha, Volvo Penta" />
          <Campo label="Modelo" id="motor_modelo" name="motor_modelo" defaultValue={motorPrincipal?.modelo ?? ""} placeholder="Ex.: Verado 350" />
          <Campo label="Ano" id="motor_ano" name="motor_ano" inputMode="numeric" defaultValue={motorPrincipal?.ano ?? ""} placeholder="Ex.: 2021" />
          <Campo
            label={`Fotos do painel (opcional, até 3)`}
            id="fotos"
            name="fotos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="py-2.5 text-sm"
          />
        </div>
      )}

      {classificacao && (
        <CampoTextarea
          label="Observações (opcional)"
          id="observacoes"
          name="observacoes"
          rows={3}
          placeholder="Qualquer detalhe que ajude a entender sua instalação"
        />
      )}

      {/* ONDA 125 — "Registrando interesse…" no lugar do silêncio. */}
      {classificacao && <BotaoEnviar rotulo="Registrar interesse" larguraCheia />}
    </div>
  )
}
