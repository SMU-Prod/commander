"use client"
import { useEffect, useState } from "react"
import { transporteAtivoNome } from "@/lib/nmea/selecionar"
import { lerUrlSignalKSalva, salvarUrlSignalK, URL_SIGNALK_PADRAO } from "@/lib/nmea/signalk"
import {
  lerConsentimentoCorredor,
  lerConsentimentoSondagem,
  salvarConsentimentoCorredor,
  salvarConsentimentoSondagem,
} from "@/lib/preferencias-navegacao"

/**
 * Bloco "Navegação" de `/menu/ajustes` (onda 80) — onde os dois
 * consentimentos de `/navegar` e a URL do servidor Signal K passaram a
 * morar. Antes, os três viviam em CIMA DO MAPA: dois checkboxes dentro dos
 * painéis de Trilha e Sondagem, e um campo de texto dentro do painel de
 * Sondagem — exatamente o tipo de "prosa e controle em cima do mapa" que o
 * dono pediu pra tirar.
 *
 * O argumento por trás de mover justamente ESTES três — não só o texto, o
 * CONTROLE inteiro — é duplo: consentimento é decisão deliberada (não
 * coisa pra tocar com o barco andando) e URL de servidor é configuração
 * (não operação). A tela `/navegar` continua lendo os MESMOS valores
 * (localStorage — preferência de aparelho, não de conta, ver
 * `lib/preferencias-navegacao.ts` e `lib/nmea/signalk.ts`); só não deixa
 * mais decidir por cima do mapa.
 */
export function AjustesNavegacao() {
  const [corredor, setCorredor] = useState(false)
  const [sondagem, setSondagem] = useState(false)
  const [urlSignalK, setUrlSignalK] = useState(URL_SIGNALK_PADRAO)
  const [usaNativo, setUsaNativo] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- so existe localStorage no cliente, le uma vez apos montar
    setCorredor(lerConsentimentoCorredor())
    setSondagem(lerConsentimentoSondagem())
    setUrlSignalK(lerUrlSignalKSalva())
    setUsaNativo(transporteAtivoNome() === "nativo")
  }, [])

  function alternarCorredor(valor: boolean) {
    setCorredor(valor)
    salvarConsentimentoCorredor(valor)
  }
  function alternarSondagem(valor: boolean) {
    setSondagem(valor)
    salvarConsentimentoSondagem(valor)
  }
  function aoSairDoCampoUrl() {
    salvarUrlSignalK(urlSignalK.trim() || URL_SIGNALK_PADRAO)
  }

  return (
    <div className="space-y-3">
      <label className="sombra-1 flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--raio-cartao)] border border-line bg-panel px-4 py-3.5 text-sm">
        <input
          type="checkbox"
          checked={corredor}
          onChange={(e) => alternarCorredor(e.target.checked)}
          className="mt-0.5 size-5 shrink-0"
        />
        <span>
          <span className="block font-medium">Contribuir com o mapa de corredores</span>
          <span className="apoio mt-0.5 block text-dim">
            Ao salvar uma saída, a trilha vira passagens anônimas, agregadas por área — nunca sua rota individual.
            Ajuda outros barcos a encontrar caminho.
          </span>
        </span>
      </label>

      <label className="sombra-1 flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--raio-cartao)] border border-line bg-panel px-4 py-3.5 text-sm">
        <input
          type="checkbox"
          checked={sondagem}
          onChange={(e) => alternarSondagem(e.target.checked)}
          className="mt-0.5 size-5 shrink-0"
        />
        <span>
          <span className="block font-medium">Contribuir com a sondagem colaborativa</span>
          <span className="apoio mt-0.5 block text-dim">
            Cada leitura do seu ecobatímetro, com a posição do GPS, ajuda a completar o mapa colaborativo — como o
            SonarChart do Navionics. É dado colaborativo bruto: melhora com o tempo e nunca substitui a carta
            náutica oficial. Sem sinal de celular no mar, cada leitura fica guardada no aparelho e sobe sozinha
            quando o sinal voltar — nada se perde.
          </span>
        </span>
      </label>

      {/* Campo só existe quando a coleta depende do Signal K — com o
          transporte nativo (futuro), não há servidor pra apontar. Mesma
          checagem que já valia dentro do painel de sondagem. */}
      {!usaNativo && (
        <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4 py-3.5">
          <label htmlFor="signalk-url" className="block text-sm font-medium">
            Servidor Signal K
          </label>
          <p className="apoio mt-0.5 text-dim">
            Endereço do servidor a bordo (Signal K Server, OpenPlotter) que alimenta a sondagem colaborativa.
          </p>
          <input
            id="signalk-url"
            value={urlSignalK}
            onChange={(e) => setUrlSignalK(e.target.value)}
            onBlur={aoSairDoCampoUrl}
            placeholder={URL_SIGNALK_PADRAO}
            className="mt-2 w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base text-texto"
          />
        </div>
      )}
    </div>
  )
}
