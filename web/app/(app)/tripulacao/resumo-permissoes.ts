/**
 * O QUE UM ACESSO CONCEDE, DITO EM PALAVRAS.
 *
 * Módulo puro: nada aqui toca React, banco ou `formData`. E ele NÃO DECIDE
 * permissão nenhuma — a decisão de qual área cada perfil recebe mora em
 * `PRESET_ENTERPRISE` (`lib/domain/enterprise.ts`), com teste, e é de lá que a
 * tela lê. O que este arquivo faz é traduzir uma matriz de 15 áreas em três
 * frases que uma pessoa consegue CONFERIR antes de tocar em "Salvar".
 *
 * Por que isso precisa existir: a matriz crua são trinta caixinhas, e numa
 * grade de trinta o erro de uma é visualmente idêntico ao acerto das outras
 * vinte e nove. Quem concede acesso olha a grade, não vê nada de errado, e
 * salva — que é exatamente o "conceder às cegas" que esta tela existe pra
 * evitar. Três listas nomeadas ("altera isto, só vê aquilo, não enxerga o
 * resto") a pessoa lê em dois segundos e discorda quando for o caso.
 *
 * POR QUE MORA AQUI E NÃO EM `lib/domain/`. Isto é derivação de
 * APRESENTAÇÃO — agrupar e nomear o que já está decidido —, e a régua da casa
 * manda pro domínio o que DECIDE. Se um dia uma segunda tela precisar do
 * mesmo resumo, este arquivo sobe inteiro, sem uma linha reescrita.
 */

import { ABAS, ROTULO_ABA, type Permissoes } from "@/lib/domain/permissoes"

export interface ResumoDeAcesso {
  /** As áreas que a pessoa ALTERA — a lista que mais importa das três, porque
   *  é a única onde um engano muda o dado do barco e não só o que se enxerga. */
  altera: string[]
  /** As áreas que ela abre e não muda. */
  soVe: string[]
  /** As áreas que ela não enxerga. Vem por último e é a que mais tranquiliza
   *  quem concede: ver "Financeiro" nesta lista responde a pergunta que
   *  ninguém faz em voz alta antes de dar acesso a um mecânico. */
  semAcesso: string[]
}

/**
 * A matriz em três listas de rótulos, na ordem de `ABAS` — a MESMA ordem em
 * que a grade desenha as linhas, pra conferir uma contra a outra não exigir
 * procurar.
 */
export function resumirAcesso(permissoes: Permissoes): ResumoDeAcesso {
  const resumo: ResumoDeAcesso = { altera: [], soVe: [], semAcesso: [] }
  for (const aba of ABAS) {
    // A ordem dos testes segue `normalizarPermissoes`: quem edita vê, sempre.
    // Por isso "altera" ganha primeiro e não precisa de um `&& !ver` que
    // repetiria aqui uma regra que já é do domínio.
    if (permissoes[aba].editar) resumo.altera.push(ROTULO_ABA[aba])
    else if (permissoes[aba].ver) resumo.soVe.push(ROTULO_ABA[aba])
    else resumo.semAcesso.push(ROTULO_ABA[aba])
  }
  return resumo
}

/**
 * Duas matrizes concedem exatamente a mesma coisa?
 *
 * Serve pra tela responder duas perguntas sem inventar estado nenhum: "isto
 * ainda é o perfil que eu escolhi, ou eu já mexi à mão?" e, na lista, "este
 * acesso é o padrão do papel desta pessoa, ou alguém ajustou?". Comparar por
 * `JSON.stringify` daria o mesmo resultado hoje e passaria a mentir no dia em
 * que a ordem das chaves mudar; percorrer `ABAS` não tem esse dia.
 */
export function mesmoAcesso(a: Permissoes, b: Permissoes): boolean {
  return ABAS.every((aba) => a[aba].ver === b[aba].ver && a[aba].editar === b[aba].editar)
}
