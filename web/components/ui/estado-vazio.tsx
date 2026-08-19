import Link from "next/link"
import { Icone, type NomeIcone } from "@/components/icone"
import { PILULA_ACAO_BLOCO, PILULA_ACAO_PRINCIPAL } from "@/lib/ui/acoes"

/**
 * Estado vazio: ícone + frase na voz do app + caminho. Um cartão vazio sem
 * ação é uma lápide ("nenhum item cadastrado") — este componente sempre
 * tem espaço para dizer o que fazer a seguir, mesmo quando a ação é opcional.
 *
 * Quando usar: qualquer lista/seção sem dado ainda.
 * - `variant="cartao"` (padrão): sozinho na tela, com sombra e borda próprias
 *   (ex.: "Nenhum motor ainda" sem um painel ao redor).
 * - `variant="linha"`: dentro de um painel que já tem borda (mesmo painel
 *   onde `LinhaLista variant="grupo"` mora) — sem sombra/borda repetida.
 *
 * `enfase` — QUANTO PESO A AÇÃO TEM. Numa página inteira vazia, uma ação
 * dourada é a resposta certa: ela É a ação principal daquela tela, e o
 * orçamento de dois dourados por tela (docs/DESIGN.md §5) cabe folgado.
 * O problema aparece ANINHADO: a Início de um barco recém-cadastrado tem
 * quatro cartões vazios ao mesmo tempo (Motores, Gastos, Mar agora,
 * Tripulação) e nenhum deles é a ação principal da tela — quatro dourados
 * de uma vez, mais os que a tela já gasta legitimamente, e o dourado para
 * de significar "aqui se age".
 *
 * Por isso o padrão continua sendo `"acao"`: as ~49 telas que usam este
 * componente como corpo inteiro não mudam nada. Quem está DENTRO de um
 * cartão passa `enfase="discreta"` e a ação vira link sublinhado neutro —
 * mesmo tratamento de link não-dourado que /barco/selos/verified já usa.
 */
export function EstadoVazio({
  icone,
  titulo,
  descricao,
  acao,
  variant = "cartao",
  enfase = "acao",
  className = "",
}: {
  icone: NomeIcone
  titulo: string
  descricao?: string
  acao?: { href: string; rotulo: string }
  variant?: "cartao" | "linha"
  /** Peso visual da ação — ver o cabeçalho. `"discreta"` quando o estado
   *  vazio mora dentro de um cartão que não é a ação principal da tela. */
  enfase?: "acao" | "discreta"
  className?: string
}) {
  // `var(--raio-cartao)` e não `14px` cravado (revisão da onda 57): este
  // componente compõe a Início DENTRO de um `Cartao`, que lê o token. Hoje os
  // dois valem 14px; no dia em que o token mudar, metade dos cartões da mesma
  // tela mudaria e a outra metade não.
  // ONDA 91 (achado 2.4) — `p-3` no lugar de `p-4`: três componentes
  // desenhavam o mesmo gesto "cartão" com 12, 14 e 16px de respiro, e 14 nem
  // degrau da escala base-8 é. O valor que fica é o de `Cartao`, o único dos
  // três com a decisão escrita ("a referência é densa"). O raio continua em
  // `--raio-cartao` e NÃO sobe pra `--raio-painel`: este cartão aparece
  // tipicamente DENTRO de outro (a Início de um barco novo tem quatro ao
  // mesmo tempo), e é o contraste 14/16 que faz o raio significar
  // profundidade — ver o `nivel` de `cartao.tsx`.
  const base = variant === "cartao"
    ? "sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3"
    : "py-6"
  // ONDA 82 — DE TEXTO A FORMA. As duas ênfases eram texto: dourado numa,
  // sublinhado na outra. Num cartão vazio — que é uma caixa com um ícone
  // apagado, uma frase e mais uma frase — a linha de texto que É a saída
  // ficava indistinguível das duas que só explicam. O dono resumiu:
  // "parecendo um texto comum".
  //
  // Agora as duas ênfases são pílulas, e a diferença entre elas passa a ser
  // o PESO da pílula, não a existência dela: cheia (a ação principal de uma
  // tela vazia — o dourado cabe folgado no orçamento de dois por tela) e de
  // contorno (o cartão vazio aninhado, que não é a ação principal de nada).
  // O alvo de 44px continua vindo do `--altura-controle` do link em volta; a
  // pílula desenha 36px dentro dele.
  const estiloDaAcao = enfase === "discreta" ? PILULA_ACAO_BLOCO : PILULA_ACAO_PRINCIPAL
  return (
    <div className={`${base} text-center ${className}`}>
      <Icone nome={icone} className="mx-auto size-6 text-dim" />
      <p className="corpo mt-2 font-medium">{titulo}</p>
      {descricao && <p className="apoio mt-1 text-dim">{descricao}</p>}
      {/* Onda 56 — era `apoio mt-3 inline-block`, que dá 17px de altura de
          alvo. A onda 54 já tinha diagnosticado e consertado exatamente isto,
          mas na CÓPIA à mão deste cartão que existe em /hoje ("Completar em
          Embarcação") — o componente compartilhado, que serve as outras ~48
          telas, ficou pra trás. Por isso "Resolver" (Selos), "Cadastrar item"
          (Segurança), "Cadastrar recorrente" (Financeiro) e companhia
          continuavam sendo linhas de texto de 17px fingindo ser botão.
          Mesma solução de lá: `--altura-controle` (a régua de toque do app,
          token desde a onda 91) com `inline-flex` pra altura valer, e `mt-1`
          no lugar de `mt-3` porque a altura nova já traz o respiro que o
          `mt-3` dava. */}
      {acao && (
        <Link href={acao.href} className="mt-1 inline-flex min-h-[var(--altura-controle)] items-center px-2">
          <span className={estiloDaAcao}>{acao.rotulo}</span>
        </Link>
      )}
    </div>
  )
}
