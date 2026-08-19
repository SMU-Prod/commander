/** Estilos compartilhados dos formulários da ficha (embarcação, equipamento, item, perfil).
 *
 *  ONDA 62 — o raio do campo desce de 10px pro token de controle (8px): o
 *  canvas do dono desenha todo campo a 8px (tela-3b) e o DESIGN §5 só
 *  conhece TRÊS raios — 10px era um quarto, fora da escala, repetido em
 *  todo formulário do app.
 *
 *  ONDA 94 — A ALTURA DEIXA DE SER SUBPRODUTO E VIRA O TOKEN.
 *
 *  Até aqui esta linha não declarava altura nenhuma: ela CAÍA de `py-3` (12
 *  em cima, 12 embaixo) mais a entrelinha de `text-base` (24px) mais as duas
 *  bordas — 50px. Nenhum desses três números fala de toque, e mesmo assim o
 *  produto deles era a nona altura de alvo do app, a única que ninguém
 *  escreve e por isso a única que revisão nenhuma pega.
 *
 *  Os 50px não eram "quase 48" inofensivos. `--altura-campo` existe (onda 91)
 *  justamente porque o botão que FECHA o formulário herda a altura do campo
 *  que está acima dele — `BotaoEnviar variante="principal"` já lê o token e
 *  sai em 48. Campo a 50 e botão a 48 é a coluna do formulário desalinhada
 *  por 2px em toda tela de ficha: exatamente o defeito que o token foi criado
 *  pra fechar, com o token sem consumidor nenhum do lado do campo.
 *
 *  Agora quem manda na altura é `min-h-[var(--altura-campo)]` e o padding só
 *  precisa não passar dele. `py-2` (8px) e não os 12 de antes: com a altura
 *  vindo do token, o padding vertical vira piso do conteúdo, e 8 é degrau da
 *  escala base-8 (DESIGN §5) enquanto 10 — o valor que fecharia a conta na
 *  bala — seria um número novo fora da escala, que é como o `p-3.5` da onda
 *  91 nasceu. `<input>` e `<select>` centram o texto sozinhos na caixa, então
 *  os dois saem em 48 cravados; o `<textarea>` cresce pelas `rows` e só herda
 *  daqui o piso.
 *
 *  É `min-h` e não `h` porque o mesmo estilo veste os três controles: altura
 *  fixa cortaria o textarea na segunda linha. E `min-h` só levanta piso —
 *  nenhum campo encolhe: 48 está acima dos 44 de `--altura-controle`, que é a
 *  régua que não se negocia (o app é usado com a mão molhada, no barco
 *  balançando). */
export const campo =
  "w-full min-h-[var(--altura-campo)] rounded-[var(--raio-controle)] border border-line bg-campo px-3 py-2 text-base"
export const rot = "rotulo mb-1.5 block text-dim"

/**
 * Linha de dois campos lado a lado (onda 55).
 *
 * POR QUE `items-end` E NÃO SÓ `grid-cols-2`. O app é usado a 390px e o
 * container é limitado a 430px, então cada célula desta linha tem ~173px.
 * Rótulo com mais de ~18 caracteres ("Horas no último serviço",
 * "Identificação interna", "Telefone (com DDD)") quebra em duas linhas em
 * UMA das células — e como o padrão do grid é `stretch` com o conteúdo
 * fluindo do topo, só o campo daquela célula descia. O resultado era a
 * "escadinha": dois controles da mesma linha em alturas diferentes, que é
 * parte do que o dono descreveu como "caixas em cima de outras caixas".
 *
 * `items-end` alinha os controles pela BASE, então o rótulo pode quebrar à
 * vontade que os campos continuam na mesma linha. Vale só quando nenhum dos
 * dois campos tem `dica`/`erro` embaixo — com texto de apoio, quem alinha é
 * a base do texto, e aí o certo é empilhar (uma linha por campo).
 */
export const linhaCampos = "grid grid-cols-2 items-end gap-3"

/** Número (ou null) para o valor inicial de um campo em pt-BR, ex.: 14.6 → "14,6". */
export function numeroParaCampoPtBr(v: number | null): string {
  return v == null ? "" : String(v).replace(".", ",")
}
