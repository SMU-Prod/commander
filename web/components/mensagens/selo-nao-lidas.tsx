import { rotuloNaoLidas } from "@/lib/domain/mensagens"

/**
 * O contador de não lidas em LINHA (na porta do Marketplace, ao lado do nome).
 *
 * Existe separado de `components/ui/contador-avisos.tsx` porque aquele é
 * `absolute` — feito para pousar em cima de um ícone de navegação, na barra de
 * baixo e no trilho. Aqui o número mora no fluxo do texto, e reaproveitar o
 * outro exigiria um `relative` fantasma em volta de cada consumidor.
 *
 * ZERO NÃO DESENHA NADA. `rotuloNaoLidas` devolve `null` e este componente
 * devolve `null` junto — um "0" cinza ao lado de toda conversa em dia é
 * exatamente o zero fabricado que a casa proíbe (`lib/domain/patio.ts`). A
 * decisão mora no domínio, testada; aqui só se veste.
 */
export function SeloNaoLidas({ quantidade }: { quantidade: number }) {
  const rotulo = rotuloNaoLidas(quantidade)
  if (rotulo == null) return null
  return (
    <span
      // A frase por extenso porque o leitor de tela anunciaria só "2" — e "2"
      // ao lado de um nome não diz o que são dois.
      aria-label={`${quantidade} ${quantidade === 1 ? "mensagem não lida" : "mensagens não lidas"}`}
      className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-[var(--raio-pilula)] bg-crit px-1.5 font-mono-instr text-xs font-semibold tabular-nums text-ink"
    >
      {rotulo}
    </span>
  )
}
