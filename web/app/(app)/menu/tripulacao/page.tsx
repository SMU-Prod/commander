import { permanentRedirect } from "next/navigation"

/**
 * Tripulação mudou de casa: `/menu/tripulacao` → `/tripulacao` (onda 58,
 * spec de arquitetura §4.1 — endereço é arquitetura escrita: convidar
 * comandante e ajustar permissão é área do produto, não ajuste do menu, e
 * enquanto a URL dizia o contrário alguém sempre ia tratar a tela como
 * ajuste). Alias de compatibilidade pelo mesmo motivo de `/barco/gastos` e
 * `/rede`: o link antigo pode estar salvo num atalho ou no histórico.
 */
export default function TripulacaoAntigaPage() {
  permanentRedirect("/tripulacao")
}
