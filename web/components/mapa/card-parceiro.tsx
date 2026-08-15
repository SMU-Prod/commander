"use client"
import { useEffect, useState } from "react"
import { Icone } from "@/components/icone"
import { formatarReais } from "@/lib/domain/gastos"
import { tempoDesde } from "@/lib/domain/navegacao"
import { supabaseBrowser } from "@/lib/supabase/client"
import type { CategoriaParceiro, Parceiro } from "@/lib/db/types"

const CATEGORIA_ROTULO: Record<CategoriaParceiro, string> = {
  marina: "Marina",
  posto: "Posto de combustível",
  pousada: "Pousada",
  restaurante: "Restaurante",
  loja_nautica: "Loja náutica",
  outros: "Outros",
}

const DIAS_DESATUALIZADO = 30

/** Bottom-sheet do parceiro comercial — todo o conteúdo vem de `parceiro` e é
 *  renderizado só via JSX (escape automático do React); nunca setHTML/
 *  dangerouslySetInnerHTML com dado de parceiro aqui. */
export function CardParceiro({
  parceiro,
  aoFechar,
  aoTracarRumo,
}: {
  parceiro: Parceiro
  aoFechar: () => void
  aoTracarRumo?: (parceiro: Parceiro) => void
}) {
  const [supabase] = useState(() => supabaseBrowser())

  useEffect(() => {
    // fire-and-forget — métrica de renovação do parceiro, não bloqueia a UI
    // nem precisa tratar erro (RPC é security definer e some se a linha sumir)
    void supabase.rpc("registrar_visualizacao", { p_parceiro_id: parceiro.id }).then(() => {})
  }, [supabase, parceiro.id])

  const fotosUrl = parceiro.fotos.map((path) => supabase.storage.from("parceiros").getPublicUrl(path).data.publicUrl)

  const agoraIso = new Date().toISOString()
  const atualizado = tempoDesde(parceiro.atualizado_em, agoraIso)

  // A frescura que importa é a do PREÇO (PRD §61), não a do cadastro:
  // `atualizado_em` sobe a cada edição — trocar uma foto ou o texto do
  // "sobre" fazia um diesel de três meses atrás parecer de ontem. Quem só
  // sobe quando um preço/disponibilidade muda é `precos_atualizados_em`
  // (trigger `parceiro_regras`, migration 020).
  const temPreco =
    parceiro.preco_diaria_centavos != null ||
    parceiro.preco_diesel_centavos != null ||
    parceiro.qtd_poitas != null
  const precoAtualizado = parceiro.precos_atualizados_em
    ? tempoDesde(parceiro.precos_atualizados_em, agoraIso)
    : null
  const diasDesdePreco = parceiro.precos_atualizados_em
    ? (new Date(agoraIso).getTime() - new Date(parceiro.precos_atualizados_em).getTime()) / 86_400_000
    : null
  const precoDesatualizado = temPreco && (diasDesdePreco == null || diasDesdePreco > DIAS_DESATUALIZADO)

  const telefoneLimpo = parceiro.telefone?.replace(/\D/g, "") ?? ""

  return (
    <>
      <div className="fixed inset-0 z-20 bg-[#0B1D2D]/40" onClick={aoFechar} />
      <div className="sombra-2 fixed inset-x-0 bottom-0 z-30 rounded-t-[20px] border-t border-line bg-panel">
        <div className="mx-auto max-h-[75dvh] max-w-[430px] overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="flex justify-center">
            <span className="h-1 w-10 rounded-full bg-line" />
          </div>

          <div className="mt-2 flex items-start gap-3">
            {/* Mesmo ícone/cor escolhidos pelo parceiro (onda 10, Pedido 2) —
                mesma receita visual do pino no mapa: fundo colorido + ícone
                branco + anel branco (dourado se "destaque"), pra legibilidade
                sobre qualquer cor da paleta. */}
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                parceiro.plano === "destaque" ? "ring-2 ring-[#D4AF37]" : "ring-2 ring-white"
              }`}
              style={{ backgroundColor: parceiro.cor }}
            >
              <Icone nome={parceiro.icone} className="size-4 text-white" />
            </div>
            <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="titulo-card">{parceiro.nome}</p>
                <p className="apoio mt-0.5 text-dim">{CATEGORIA_ROTULO[parceiro.categoria]}</p>
              </div>
              <button
                type="button"
                onClick={aoFechar}
                aria-label="Fechar"
                className="flex size-11 shrink-0 items-center justify-center text-dim"
              >
                <Icone nome="mais" className="size-5 rotate-45" />
              </button>
            </div>
          </div>

          {(parceiro.plano === "destaque" || parceiro.tem_poita) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {parceiro.plano === "destaque" && (
                <span className="apoio rounded-full border border-accent/50 bg-accent/10 px-2 py-0.5 text-accent-forte">
                  Destaque
                </span>
              )}
              {parceiro.tem_poita && (
                <span className="apoio rounded-full border border-line px-2 py-0.5 text-dim">
                  Poita{parceiro.qtd_poitas ? ` (${parceiro.qtd_poitas})` : ""}
                </span>
              )}
            </div>
          )}

          {fotosUrl.length > 0 && (
            <div className="mt-3 flex gap-2">
              {fotosUrl.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element -- URL pública do bucket parceiros
                <img key={url} src={url} alt={parceiro.nome} className="h-20 flex-1 rounded-[10px] object-cover" loading="lazy" />
              ))}
            </div>
          )}

          {parceiro.sobre && <p className="corpo mt-3 text-dim">{parceiro.sobre}</p>}

          <div className="corpo mt-3 space-y-1">
            {parceiro.preco_diaria_centavos != null && (
              <p>
                Diária: <span className="font-mono-instr tabular-nums">{formatarReais(parceiro.preco_diaria_centavos)}</span>
              </p>
            )}
            {parceiro.categoria === "posto" && parceiro.preco_diesel_centavos != null && (
              <p>
                Diesel: <span className="font-mono-instr tabular-nums">{formatarReais(parceiro.preco_diesel_centavos)}</span>/L
              </p>
            )}
            {parceiro.calado_max_m != null && (
              <p>
                Calado máximo: <span className="font-mono-instr tabular-nums">{parceiro.calado_max_m.toLocaleString("pt-BR")} m</span>
              </p>
            )}
            {parceiro.categoria === "pousada" && parceiro.traslado_incluso && <p>Traslado incluso</p>}
            {parceiro.categoria === "restaurante" && parceiro.vaga_cortesia && <p>Vaga de carro cortesia</p>}
            {/* culinária, horário e e-mail eram preenchidos no painel do
                parceiro e não apareciam em lugar nenhum — quem paga o plano
                precisa ver o que cadastrou chegando no dono do barco */}
            {parceiro.categoria === "restaurante" && parceiro.culinaria && (
              <p>Cozinha: {parceiro.culinaria}</p>
            )}
            {parceiro.horario && <p>Horário: {parceiro.horario}</p>}
          </div>

          {temPreco && (
            <p className="apoio mt-1.5 text-dim">
              {precoAtualizado ? `Preços atualizados ${precoAtualizado}` : "Preços nunca atualizados desde o cadastro"}
            </p>
          )}

          {parceiro.email && (
            <a href={`mailto:${parceiro.email}`} className="corpo mt-2 block break-all text-accent-forte">
              {parceiro.email}
            </a>
          )}

          <p className="apoio mt-2 text-dim">Cadastro atualizado {atualizado}</p>
          {precoDesatualizado && (
            <p className="apoio mt-1 rounded-lg border border-warn/40 bg-warn/10 px-2.5 py-1.5 text-warn">
              Os preços não são atualizados há mais de {DIAS_DESATUALIZADO} dias. Confirme por telefone
              antes de contar com eles.
            </p>
          )}

          <div className="mt-4 flex gap-2">
            {parceiro.telefone && (
              <a
                href={`tel:${telefoneLimpo}`}
                className="corpo flex h-11 flex-1 items-center justify-center rounded-lg border border-line"
              >
                Ligar
              </a>
            )}
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${parceiro.lat},${parceiro.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="corpo flex h-11 flex-1 items-center justify-center rounded-lg border border-line"
            >
              Como chegar
            </a>
            <button
              type="button"
              onClick={() => aoTracarRumo?.(parceiro)}
              className="flex h-11 flex-1 items-center justify-center rounded-lg bg-accent font-semibold text-acao-texto"
            >
              Traçar rumo
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
