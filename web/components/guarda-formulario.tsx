"use client"
import { useEffect, useRef } from "react"

/**
 * GUARDA DE FORMULÁRIO (onda 53) — resolve DUAS linhas da tabela do PRD §24
 * com uma peça só, porque as duas são o mesmo problema visto de dois lados:
 *
 *   · "Erro de rede: preservar dados do formulário quando possível e
 *      permitir tentar novamente."
 *   · "Sair sem salvar: confirmar descarte quando houver alterações."
 *
 * O PROBLEMA QUE ELA RESOLVE. Toda action deste app trata falha com
 * `redirect("...?erro=")`. Isso é ótimo pra mensagem e péssimo pro conteúdo:
 * o redirect renderiza a página do servidor de novo, e o formulário volta em
 * branco. Quem preencheu quinze campos de uma proposta do Marketplace e
 * esbarrou num erro de rede perdia tudo — e no caso do paywall de publicar,
 * a própria cópia prometia "o que você preencheu não se perde" enquanto o
 * código apagava.
 *
 * POR QUE NÃO É UM QUARTO PADRÃO VISUAL. Este componente não desenha nada:
 * não tem cartão, ícone nem texto. `EstadoVazio`, `BloqueioPremium` e
 * `Confirmar` continuam sendo os três padrões visuais da casa — e o
 * `Confirmar` continua sendo o jeito de confirmar uma AÇÃO destrutiva
 * (excluir, cancelar), que é coisa diferente de avisar que há rascunho não
 * salvo ao SAIR.
 *
 * COMO FUNCIONA, e por que assim:
 *  · guarda em `sessionStorage`, não no servidor: são dados que a pessoa
 *    acabou de digitar e que podem nunca ser enviados. Mandar rascunho pro
 *    banco a cada tecla seria gravar o que ninguém pediu pra gravar.
 *  · restaura SÓ quando a URL traz `?erro=` — que é exatamente o caminho de
 *    volta de uma action que falhou. Numa visita limpa o rascunho antigo é
 *    descartado, senão o formulário "lembraria" de ontem sem ninguém pedir.
 *  · o aviso de saída usa `beforeunload` (fechar aba, recarregar, sair do
 *    app) e um interceptador de clique em link (navegação interna do
 *    Next, que não dispara `beforeunload`).
 *
 * O "QUANDO POSSÍVEL" DO PRD, LITERAL: campo de arquivo NÃO é restaurado. O
 * navegador proíbe preencher `<input type="file">` por script, e é uma trava
 * de segurança dele, não uma limitação deste código. Por isso todo
 * formulário com anexo diz na tela que o arquivo precisa ser escolhido de
 * novo — melhor avisar que fingir.
 */
export function GuardaFormulario({
  chave,
  /** Aviso do descarte. O PRD pede confirmar, não assustar. */
  mensagem = "Você tem alterações que ainda não foram salvas. Sair mesmo assim?",
}: {
  /** Identificador do formulário no `sessionStorage`. Único por formulário,
   *  não por rota: telas com mais de um formulário (a Carteira tem quatro)
   *  precisam de chaves diferentes ou um sobrescreveria o outro. */
  chave: string
  mensagem?: string
}) {
  const marcador = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const form = marcador.current?.closest("form")
    if (!form) return

    const armazem = `guarda-formulario:${chave}`
    let sujo = false

    // Campo que este componente sabe (e deve) tratar. `file` fica de fora
    // por imposição do navegador; `hidden` fica de fora porque o valor é do
    // servidor (ids, rotas de volta) e restaurar um valor velho por cima
    // seria pior que não restaurar nada.
    const restauravel = (el: Element): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement => {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) {
        return false
      }
      if (el.name === "") return false
      if (el instanceof HTMLInputElement && (el.type === "file" || el.type === "hidden" || el.type === "password")) {
        return false
      }
      return true
    }

    const capturar = (): Record<string, string | boolean> => {
      const dados: Record<string, string | boolean> = {}
      for (const el of Array.from(form.elements)) {
        if (!restauravel(el)) continue
        if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
          // Radio e checkbox com o mesmo `name` precisam do valor na chave,
          // senão o último do grupo apagaria a escolha dos anteriores.
          dados[`${el.name}::${el.value}`] = el.checked
        } else {
          dados[el.name] = el.value
        }
      }
      return dados
    }

    const restaurar = (dados: Record<string, string | boolean>) => {
      for (const el of Array.from(form.elements)) {
        if (!restauravel(el)) continue
        if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
          const v = dados[`${el.name}::${el.value}`]
          if (typeof v === "boolean") el.checked = v
        } else {
          const v = dados[el.name]
          if (typeof v === "string") el.value = v
        }
      }
    }

    const guardado = sessionStorage.getItem(armazem)
    if (new URLSearchParams(window.location.search).has("erro") && guardado != null) {
      try {
        restaurar(JSON.parse(guardado) as Record<string, string | boolean>)
      } catch {
        // Rascunho corrompido (versão antiga do formulário, storage cheio):
        // o formulário em branco é ruim, mas travar a tela seria pior.
        sessionStorage.removeItem(armazem)
      }
    } else {
      sessionStorage.removeItem(armazem)
    }

    const aoMexer = () => {
      sujo = true
      try {
        sessionStorage.setItem(armazem, JSON.stringify(capturar()))
      } catch {
        // Cota de storage estourada: perder o rascunho é aceitável, quebrar
        // a digitação não é.
      }
    }

    // O envio limpa só o "sujo": o rascunho FICA guardado de propósito, pra
    // que o redirect de erro possa restaurá-lo. Uma visita limpa depois o
    // descarta (bloco acima).
    const aoEnviar = () => {
      sujo = false
    }

    const aoSair = (e: BeforeUnloadEvent) => {
      if (!sujo) return
      e.preventDefault()
      // Chrome ignora o texto e mostra o aviso padrão dele; `returnValue`
      // continua sendo o que faz o aviso aparecer nos navegadores antigos.
      e.returnValue = mensagem
    }

    // Navegação interna do Next não recarrega a página, então `beforeunload`
    // não dispara. Fase de captura pra chegar antes do roteador.
    const aoClicar = (e: MouseEvent) => {
      if (!sujo || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
      const alvo = e.target instanceof Element ? e.target.closest("a[href]") : null
      if (!alvo || form.contains(alvo)) return
      if (!window.confirm(mensagem)) {
        e.preventDefault()
        e.stopPropagation()
      } else {
        sujo = false
      }
    }

    form.addEventListener("input", aoMexer)
    form.addEventListener("change", aoMexer)
    form.addEventListener("submit", aoEnviar)
    window.addEventListener("beforeunload", aoSair)
    document.addEventListener("click", aoClicar, true)
    return () => {
      form.removeEventListener("input", aoMexer)
      form.removeEventListener("change", aoMexer)
      form.removeEventListener("submit", aoEnviar)
      window.removeEventListener("beforeunload", aoSair)
      document.removeEventListener("click", aoClicar, true)
    }
  }, [chave, mensagem])

  // Marcador invisível: serve só pra achar o `<form>` que envolve este
  // componente. Sem wrapper, porque um `<div>` a mais mudaria o layout de
  // formulários que já usam `space-y-*` e `grid`.
  return <span ref={marcador} hidden aria-hidden="true" />
}
