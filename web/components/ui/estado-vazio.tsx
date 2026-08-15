import Link from "next/link"
import { Icone, type NomeIcone } from "@/components/icone"

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
  const base = variant === "cartao" ? "sombra-1 rounded-[14px] border border-line bg-panel p-4" : "py-6"
  const corDaAcao = enfase === "discreta"
    ? "text-texto underline underline-offset-2"
    : "text-accent-forte"
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
          Mesma solução de lá: `min-h-11` (a régua de toque do app) com
          `inline-flex` pra altura valer, e `mt-1` no lugar de `mt-3` porque a
          altura nova já traz o respiro que o `mt-3` dava. */}
      {acao && (
        <Link
          href={acao.href}
          className={`apoio mt-1 inline-flex min-h-11 items-center px-2 ${corDaAcao}`}
        >
          {acao.rotulo}
        </Link>
      )}
    </div>
  )
}
