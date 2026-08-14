"use client"
import { useState, type ReactNode } from "react"
import { Icone } from "@/components/icone"
import { SeloGold } from "@/components/selos/selo-gold"

/**
 * Modal do Commander Gold (Correção 12 do PRD de Correções) — abre ao tocar
 * no selo. Componente só cuida de abrir/fechar; o conteúdo (texto oficial,
 * hubs, dados, CTA "Ver relatório") é montado no server component chamador
 * e passado como `children`, pra manter a leitura do banco no servidor.
 */
export function ModalGold({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="block w-full text-left">
        {trigger}
      </button>
      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setAberto(false)}
          role="dialog" aria-modal="true"
        >
          <div
            className="sombra-1 max-h-[85vh] w-full max-w-[430px] overflow-y-auto rounded-t-[20px] border border-line bg-panel p-5 sm:rounded-[20px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="titulo-card inline-flex items-center gap-1.5">
                <SeloGold size={18} variant="ativo" /> Commander Gold
              </p>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="p-1 text-dim">
                <Icone nome="mais" className="size-5 rotate-45" />
              </button>
            </div>
            <div className="mt-3">{children}</div>
          </div>
        </div>
      )}
    </>
  )
}
