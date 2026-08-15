"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

/**
 * ONDA 54 — A TELA SEM SAÍDA.
 *
 * Até aqui o app NÃO tinha `not-found.tsx`. Qualquer URL que não casasse
 * com uma rota caía no 404 padrão do Next: fundo branco, "404 — This page
 * could not be found" em inglês, sem cabeçalho, sem bottom-nav e sem UM
 * link sequer. Num navegador de mesa a pessoa aperta "voltar" e segue a
 * vida; no app instalado (PWA/Capacitor, que é como o dono usa) não há
 * botão de voltar do navegador — a tela é literalmente sem saída. Era o
 * "telas que ficamos travados sem conseguir voltar" do relato.
 *
 * A varredura pegou isso por acidente e por sorte: a lista de rotas do
 * `e2e/varredura-mobile.spec.ts` tinha `/financeiro/nova` (a rota real é
 * `/financeiro/novo`), e o que apareceu na medição foi "SEM SAÍDA" + 404 de
 * recurso. O erro de digitação virou a prova de que o beco existe — e o
 * conserto não é a rota, é o beco: agora TODA URL morta (link velho,
 * favorito antigo, erro de digitação, push notification desatualizada) cai
 * numa tela em português, com a cara do app e com dois caminhos de volta.
 *
 * Client component porque o "Voltar" usa o histórico de verdade
 * (`router.back()`) — é a saída que a pessoa espera. O link para a Início é
 * o plano B para quando não há histórico (entrou direto pela URL), e é
 * também o que a varredura procura para dizer que a tela tem saída.
 */
export default function NaoEncontrada() {
  const router = useRouter()

  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center px-6 text-center">
      <p className="font-mono-instr text-[11px] uppercase tracking-[.2em] text-dim">Commander</p>
      <h1 className="titulo-pagina mt-3">Esta página não existe</h1>
      <p className="mt-2 text-sm text-dim">
        O endereço pode ter mudado de lugar ou o link estar velho. Nada foi perdido — seu barco e
        seu histórico continuam onde estavam.
      </p>
      <div className="mt-6 flex w-full flex-col gap-2">
        <button
          onClick={() => router.back()}
          className="flex min-h-11 w-full items-center justify-center rounded-xl bg-accent px-6 font-semibold text-acao-texto"
        >
          Voltar
        </button>
        <Link
          href="/hoje"
          className="flex min-h-11 w-full items-center justify-center rounded-xl border border-line px-6 font-semibold text-dim"
        >
          Ir para a Início
        </Link>
      </div>
    </main>
  )
}
