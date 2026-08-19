/**
 * O NÚMERO VERMELHO EM CIMA DO ÍCONE DE AVISOS.
 *
 * Existe como componente porque ele tem DOIS lugares — a barra de baixo
 * (celular) e o trilho lateral (desktop) — e as duas cópias precisam ser a
 * mesma coisa, não parecidas. Enquanto o badge era um `<span>` escrito à mão
 * dentro da `BottomNav`, o trilho nasceu sem ele: a partir de 1024px o ícone
 * "Avisos" existia e o número não, e o aviso de seguro vencido sumia de todo
 * o app fora da Início (o sino de `SinoNotificacoes` tem um consumidor só).
 * Estilo escrito à mão em dois lugares é como a próxima divergência nasce
 * (docs/DESIGN.md §6, regra 6).
 *
 * Acima de 9 vira "9+", como no sino: o badge é um sinal de "tem coisa te
 * esperando", não um relatório — e três dígitos deformam o círculo.
 *
 * O `aria-label` mora aqui e não em quem chama justamente para que a frase
 * seja UMA. O `<span>` continua sem `role` porque é o que a barra de baixo
 * já fazia e o nome do link vizinho ("Avisos") continua sendo o alvo
 * anunciado; este texto é o complemento, não o substituto.
 *
 * `font-mono-instr tabular-nums`: é número de instrumento, e "9+" ao lado de
 * "3" precisa ter a mesma largura de dígito (docs/DESIGN.md §5, tipografia).
 */
/**
 * ONDA 63, auditoria visual §9 — DUAS ÂNCORAS, PORQUE SÃO DUAS CAIXAS.
 *
 * O badge nasceu ancorado no ÍCONE (`-right-2 -top-1`), que é o certo na
 * barra de baixo: lá o ícone de 21px tem ar em volta e o número sobe pra
 * fora dele. No trilho de desktop a caixa é outra — o mesmo ícone mora
 * centrado num alvo de 44px —, e ancorar no ícone joga o número EM CIMA do
 * desenho do sino. A auditoria mediu isso em ~70 telas: o único indicador
 * de alerta crítico do desktop, ilegível.
 *
 * `canto` ancora no alvo, não no glifo: o número vai pro canto superior
 * direito dos 44px e o sino fica inteiro. Mesma cor, mesmo tamanho, mesma
 * frase — só o ponto de origem muda.
 */
const POSICAO = {
  icone: "-right-2 -top-1",
  canto: "right-0.5 top-0.5",
} as const

export function ContadorAvisos({
  avisos,
  posicao = "icone",
}: {
  avisos: number
  posicao?: keyof typeof POSICAO
}) {
  if (avisos <= 0) return null
  return (
    /* ONDA 62 — o número sobe de 9px pra 11px: o canvas do dono
       (nav-inferior.dc.html) escreve o badge a 11px mono 600, e 11px é o
       PISO tipográfico do app (globals.css) — este era o último texto
       abaixo dele. `text-ink` no lugar de branco fixo: no escuro é o
       quase-preto do canvas sobre o vermelho; no claro, um quase-branco —
       legível nos dois sem cor literal nova. */
    <span
      aria-label={`${avisos} avisos que pedem atenção`}
      className={`absolute ${POSICAO[posicao]} flex h-4 min-w-4 items-center justify-center rounded-[var(--raio-pilula)] bg-crit px-1 font-mono-instr text-[11px] font-semibold leading-4 tabular-nums text-ink`}
    >
      {avisos > 9 ? "9+" : avisos}
    </span>
  )
}
