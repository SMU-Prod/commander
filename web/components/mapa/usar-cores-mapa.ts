"use client"
import { useEffect, useState } from "react"
import { CORES_MAPA_PADRAO, lerCoresMapa, mesmasCores, observarTema, type CoresMapa } from "@/lib/mapa/cores-tema"

/**
 * ONDA 89 (achado 4.1) — os tokens de cor do documento, prontos pro `paint`
 * de uma camada do Mapbox, reagindo à troca de tema em tempo de execução.
 *
 * Mora em `components/mapa/` (e não em `lib/mapa/`, ao lado da leitura em si)
 * pelo mesmo critério do `usar-pernas-viagem.ts`: `lib/` guarda o que é puro
 * e testável sem navegador; hook é interface.
 *
 * COMO USAR: chame no componente e ponha o resultado nas DEPENDÊNCIAS do
 * efeito que cria/pinta camada. A identidade do objeto só muda quando algum
 * token muda de verdade (ver `mesmasCores`) — sem isso, cada disparo do
 * observador de tema repintaria o mapa inteiro à toa.
 */
export function useCoresMapa(): CoresMapa {
  // Nasce com os valores de emergência porque o primeiro render (servidor e
  // hidratação) não tem documento pra consultar. A correção vem no efeito
  // abaixo, que roda antes de qualquer camada existir — o mapa só é criado
  // depois de um `import()` assíncrono do mapbox-gl.
  const [cores, setCores] = useState<CoresMapa>(CORES_MAPA_PADRAO)

  useEffect(() => {
    function reler() {
      setCores((atual) => {
        const novas = lerCoresMapa()
        return mesmasCores(atual, novas) ? atual : novas
      })
    }
     
    reler()
    return observarTema(reler)
  }, [])

  return cores
}
