"use client"
import { Icone } from "@/components/icone"

/**
 * Aviso "não é auxílio à navegação" — onda 80.
 *
 * Antes disto, o aviso morava dentro do painel de Trilha e reaparecia toda
 * vez que a pessoa expandia o cartão: uma nagging box em cima do mapa, todo
 * dia de passeio. O dono foi claro que o aviso é IMPORTANTE e não pode
 * desaparecer do produto — só não pode ser lido a cada sessão. A troca:
 * este mesmo texto agora aparece em bottom-sheet, DUAS entradas —
 *
 * 1. Automático na primeira visita a /navegar (uma vez por aparelho, ver
 *    `lerAvisoNavegarVisto`/`marcarAvisoNavegarVisto` em
 *    lib/preferencias-navegacao.ts);
 * 2. Sob demanda, pelo botão "?" que fica sempre no cartão de instrumentos
 *    (ver navegar-mapa.tsx) — pra quem quiser reler.
 *
 * Mesmo padrão visual de bottom-sheet do `CardParceiro`
 * (components/mapa/card-parceiro.tsx): fundo + folha subindo do rodapé,
 * cores de tema normal (`bg-panel`/`text-texto`) porque este cartão não
 * fica em cima do MAPA propriamente — é uma folha que cobre a tela inteira
 * por cima de tudo, então não precisa da paleta fixa "instrumento de
 * ponte" dos cartões flutuantes.
 */
export function AvisoNavegar({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  if (!aberto) return null

  return (
    <>
      {/* bg-black (não o hex do navy da marca): este arquivo nasce sem
          direito a cor literal na catraca de app/lib/ui/tokens.test.ts —
          um preto translúcido comum já cumpre o papel de véu por trás da
          folha. */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={aoFechar} />
      <div className="sombra-2 fixed inset-x-0 bottom-0 z-50 rounded-t-[20px] border-t border-line bg-panel">
        <div className="mx-auto max-w-[430px] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          <div className="flex justify-center">
            <span className="h-1 w-10 rounded-[var(--raio-pilula)] bg-line" />
          </div>
          <div className="mt-3 flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--raio-pilula)] bg-warn/15 text-warn">
              <Icone nome="alerta" className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="titulo-card">Antes de sair com o Commander</p>
              <p className="corpo mt-1.5 text-dim">
                Mantenha o app aberto durante o passeio — a trilha vira um evento no Diário de Bordo.
              </p>
              <p className="corpo mt-2 font-semibold text-warn">
                O Commander NÃO é auxílio à navegação: serve para estimar sua posição e registrar o passeio.
                Navegue pela carta náutica oficial.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            className="mt-6 flex h-11 w-full items-center justify-center rounded-[var(--raio-controle)] bg-accent text-sm font-semibold text-acao-texto"
          >
            Entendi
          </button>
        </div>
      </div>
    </>
  )
}
