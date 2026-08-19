import Link from "next/link"
import { Icone } from "@/components/icone"

/**
 * Componente de bloqueio (onda 38) — cadeado + o que o Premium libera +
 * caminho pra assinar. É o cartão que aparece NO LUGAR de um formulário/ação
 * quando `recursoLiberado()` (`lib/domain/plano-acesso.ts`) diz não — nunca
 * esconde a entrada da funcionalidade (PRD §43: "recursos Premium aparecem,
 * porém bloqueados"), só troca o que tem dentro dela.
 *
 * Mesmo padrão visual de `EstadoVazio` (ícone + título + descrição + ação)
 * de propósito — este bloqueio não é um estado de erro, é um convite, e a
 * linguagem visual deixa isso claro por já ser familiar.
 */
export function BloqueioPremium({
  titulo,
  descricao,
  className = "",
  href = "/menu/assinatura",
  rotuloAcao = "Ver o Premium",
}: {
  titulo: string
  descricao: string
  className?: string
  /** Onda 50 — o destino deixou de ser sempre a assinatura DO BARCO. O §12
   *  separa a assinatura da carreira (Captain Pro) da assinatura da
   *  embarcação, e mandar um comandante contratado pra tela de cobrança do
   *  proprietário era mandá-lo pro lugar errado. Padrão inalterado pros
   *  bloqueios do §2.3, que continuam sendo de gestão de barco. */
  href?: string
  rotuloAcao?: string
}) {
  return (
    // ONDA 91 — quatro correções da mesma família (achados 2.4, 5.9 e 5.10),
    // e nenhuma inventa valor: `rounded-[14px]` era o valor de `--raio-cartao`
    // escrito à mão; `p-4` era o terceiro respiro de cartão do app e vira o
    // `p-3` de `Cartao`; o `rounded-xl` (12px, que não é token nenhum) do
    // botão vira `--raio-controle` (8px) pelo critério desta onda — quem se
    // TOCA é controle, quem CONTÉM conteúdo é cartão.
    // A quarta é a que mais importava: o botão era `inline-block py-2.5` com
    // `text-sm`, ou seja 20 + 10 + 10 = 40px de alvo — uma das nove alturas
    // que a auditoria mediu, e abaixo da régua de 44px que não se negocia.
    // `min-h` e não `h` porque o rótulo é livre e pode quebrar em duas linhas
    // num aparelho estreito; travar a altura cortaria a segunda.
    <div className={`sombra-1 rounded-[var(--raio-cartao)] border border-accent/30 bg-panel p-3 text-center ${className}`}>
      <Icone nome="cadeado" className="mx-auto size-6 text-accent-forte" />
      <p className="corpo mt-2 font-medium">{titulo}</p>
      <p className="apoio mt-1 text-dim">{descricao}</p>
      <Link
        href={href}
        className="mt-3 inline-flex min-h-[var(--altura-controle)] items-center rounded-[var(--raio-controle)] bg-accent px-4 text-sm font-semibold text-acao-texto"
      >
        {rotuloAcao}
      </Link>
    </div>
  )
}
