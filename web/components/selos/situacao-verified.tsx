import { ROTULO_SITUACAO_VERIFIED, textoPrazoVerified, type SeloVerifiedAvaliado } from "@/lib/domain/verified"

/**
 * Chip de situação do Commander Verified (onda 44, PRD §15) — o mesmo texto
 * em toda tela que mostra o selo, pra ninguém ler "ativo" num lugar e
 * "suspenso" no outro.
 *
 * Paleta: prata/neutro pro selo de pé — o escudo prateado já é o sinal
 * positivo, um chip verde ao lado só faria barulho. NENHUMA das variantes
 * usa `accent`/`accent-forte`: esse é o dourado, e dourado no Commander é
 * exclusivo do Gold (PRD §15: "sem dourado"). Atenção e crítico usam as
 * cores semânticas de status do app (`warn`/`crit`, as mesmas do farol),
 * que não são o dourado da marca.
 *
 * E não existe porcentagem em lugar nenhum daqui — o PRD proíbe no selo.
 */
const ESTILO: Record<SeloVerifiedAvaliado["situacao"], string> = {
  ativo: "border-dim/50 text-texto",
  regularizacao: "border-warn/50 text-warn",
  suspenso: "border-crit/50 text-crit",
  nao_conquistado: "border-line text-dim",
}

export function SituacaoVerified({
  selo,
  className = "",
}: {
  selo: SeloVerifiedAvaliado
  className?: string
}) {
  // Em regularização o rótulo já traz o prazo do PRD ("Atualização
  // necessária — 15 dias"); nos outros estados, o nome da situação basta.
  const texto = textoPrazoVerified(selo) ?? ROTULO_SITUACAO_VERIFIED[selo.situacao]
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-[var(--raio-pilula)] border px-2.5 py-0.5 font-mono-instr text-[11px] tracking-wide ${ESTILO[selo.situacao]} ${className}`}
    >
      {texto}
    </span>
  )
}
