/**
 * PLANO INDIVIDUAL DO COTISTA (onda 75).
 * PRD-UPGRADE-3-COTAS §14 e §15.
 *
 * R$ 24,90/mês, produto PESSOAL do cotista. O §14 abre dizendo o que ele NÃO
 * é: *"Não substitui o acesso básico fornecido pela empresa."* O cotista já
 * enxerga a unidade dele de graça, pela licença Enterprise da administradora
 * (§13) — este plano é o registro do uso DELE.
 *
 * Módulo puro.
 */

// ---------------------------------------------------------------------------
// §14 — O BLOCO DE VENDA FOI APAGADO. AUDITORIA 19/08, A8.
// ---------------------------------------------------------------------------
/*
 * Este arquivo trazia a oferta inteira do plano de R$ 24,90: headline,
 * mensagem, `precoCotistaEmTexto`, os nove `RECURSOS_COTISTA_PAGO`, a lista
 * de `PALAVRAS_PROIBIDAS_COTISTA` e `cotistaPodeGerarRelatorioPessoal`. Sete
 * exports, todos escritos, todos testados, e nenhum com um único consumidor
 * fora do `.test.ts` irmão.
 *
 * Não era só falta de tela: NÃO EXISTE COMO COBRAR. O plano
 * `cotista_individual` não aparece em `PLANOS_COBRAVEIS`, não tem caminho de
 * assinatura, e a única coisa que sobreviveu do §14 no banco é a constante de
 * preço em `planos.ts`. Uma tela de oferta em cima disso seria o defeito que
 * esta auditoria veio consertar, na versão cara: o app anunciando um produto
 * que ele não sabe vender.
 *
 * A alternativa considerada foi construir a tela mesmo assim, com um "fale
 * com a administradora" no lugar do botão. Descartada: quem fala com a
 * administradora sobre um plano PESSOAL do cotista não compra nada — a
 * administradora não vende Commander. Seria mandar o cliente para uma porta
 * que não abre.
 *
 * Copy de produto não vendido é conteúdo de PRD, não código: o §14 do
 * PRD-UPGRADE-3-COTAS continua com as palavras exatas, inclusive as duas
 * proibições ("nada de linguagem de prova jurídica"; "deixar explícito que o
 * acesso básico continua"). No dia em que houver checkout, ela volta com o
 * checkout junto — e aí ela terá quem a consuma.
 *
 * O que ficou é o que a tela usa hoje: a ressalva do acesso básico e o hub de
 * §15 daqui pra baixo.
 */

/**
 * §14, a trava de copy que sobreviveu porque a tela a mostra: o cotista
 * precisa ler, no rodapé de /atualizacoes, que o acesso dado pela
 * administradora não depende de assinar nada.
 *
 * A segunda frase ("Este plano é o seu registro pessoal de uso") saiu junto
 * com o bloco de venda — ela apontava para um plano que a tela não oferece e
 * que o app não sabe cobrar. Um rodapé que fala de "este plano" sem plano
 * nenhum à vista é a mesma categoria de defeito do resto desta auditoria:
 * afirmar o que não se sustenta.
 */
export const RESSALVA_ACESSO_BASICO =
  "O acesso que a administradora te dá para ver esta unidade continua funcionando sem assinar nada."

// ---------------------------------------------------------------------------
// §15 — Atualizações dos Cotistas
// ---------------------------------------------------------------------------
//
// As três colunas de vocabulário de `envios_cotista` (`tipo`, `estado`, `acao`)
// têm o mapa de rótulos AQUI, e não na tela, pelo mesmo motivo: cada uma tem um
// `check` no banco, e um `check` sem mapa do lado do app é um valor que alguma
// tela vai acabar imprimindo cru. Estando juntos, dá pra ver de um golpe que os
// três estão cobertos — que foi como se descobriu que `tipo` não estava.

/**
 * §15 — "O que é", o primeiro campo do formulário de envio.
 *
 * Espelha o `check` vivo de `envios_cotista.tipo`, conferido no catálogo do
 * banco em 19/08/2026. NOT NULL, sem default: não existe envio sem
 * classificação, então nenhuma tela precisa de um ramo de "sem tipo".
 */
export const TIPOS_ENVIO = ["uso", "ocorrencia", "observacao"] as const

export type TipoEnvio = (typeof TIPOS_ENVIO)[number]

/**
 * O rótulo de cada um.
 *
 * VEIO DA TELA (auditoria 19/08, A15). Morava dentro de
 * `app/(app)/atualizacoes/page.tsx` porque o passe que descobriu o problema não
 * era dono deste arquivo. O defeito que ele consertou vale registrar: a coluna
 * era gravada por `enviarAoAdm` e nenhuma tela a mostrava, então na fila do ADM
 * "devolvi com o tanque cheio" e "bati o casco na rampa" chegavam como dois
 * cartões idênticos — e a diferença entre uma observação e uma OCORRÊNCIA é a
 * diferença entre ler amanhã e ligar agora.
 *
 * `Record<string, string>` DE PROPÓSITO, e não `Record<TipoEnvio, string>` como
 * os dois mapas abaixo: `tipo` chega do PostgREST como `string`, e no dia em que
 * o `check` do banco ganhar um quarto valor a tela imprime o valor cru (`??
 * e.tipo`, no cartão) em vez de escrever "undefined" na cara do ADM. É a mesma
 * escolha de sempre — mostrar o que se sabe, nunca inventar o que falta.
 */
export const ROTULO_TIPO_ENVIO: Record<string, string> = {
  uso: "Uso da unidade",
  ocorrencia: "Ocorrência",
  observacao: "Observação",
}

/** O que o ADM pode fazer com o que o cotista enviou (§15). */
export const ACOES_SOBRE_ENVIO = [
  "adicionar_a_unidade", "atualizar_horas", "criar_avaria",
  "adicionar_observacao", "incorporar_ao_historico", "arquivar",
] as const

export type AcaoSobreEnvio = (typeof ACOES_SOBRE_ENVIO)[number]

export const ROTULO_ACAO_ENVIO: Record<AcaoSobreEnvio, string> = {
  adicionar_a_unidade: "Adicionar à unidade",
  atualizar_horas: "Atualizar horas",
  criar_avaria: "Criar avaria",
  adicionar_observacao: "Adicionar observação",
  incorporar_ao_historico: "Incorporar ao histórico",
  arquivar: "Arquivar",
}

export type EstadoEnvio = "aguardando" | "incorporado" | "arquivado"

export const ROTULO_ESTADO_ENVIO: Record<EstadoEnvio, string> = {
  aguardando: "Aguardando análise",
  incorporado: "Incorporado",
  arquivado: "Arquivado",
}

/*
 * §15, a regra que sustenta o hub inteiro: *"NADA enviado pelo cotista altera
 * automaticamente o registro oficial."* O envio é sempre um pedido, nunca um
 * fato do barco — sem isso, dez cotistas com opiniões diferentes sobre o
 * horímetro escreveriam por cima uns dos outros na ficha da unidade, e a
 * administradora perderia a única versão que ela responde por.
 *
 * AUDITORIA 19/08 (B9): aqui morava `envioAlteraRegistroOficial(): false`, que
 * a auditoria apontou como a função que /atualizacoes deveria chamar em vez de
 * ter o aviso fixo no JSX. Conferido de perto, ela não podia cumprir esse
 * papel: o tipo de retorno é o literal `false`, então a regra não é aplicada
 * por ela — é aplicada por `enviarAoAdm` escrever SÓ em `envios_cotista`, e
 * por `decidirEnvio` ser a única porta que toca no registro. A função era um
 * espelho da regra, e o teste dela media a si mesmo.
 *
 * É o mesmo diagnóstico que a onda 57 escreveu ao apagar `rotuloDoSelo`
 * (components/ui/selo.tsx): "existia só para o teste chamar — nenhuma tela
 * usava — e é por isso que a garantia estava sendo medida num galho que não
 * roda". Apagada pelo mesmo motivo; a regra fica como está escrita aqui e como
 * o código de fato se comporta.
 */

/**
 * §15: *"Manter procedência: informado por cotista X; incorporado por ADM Y."*
 *
 * A frase é montada num lugar só porque ela é o produto do hub: o valor não
 * está no dado enviado, está em saber de quem veio e quem decidiu aceitar.
 */
export function linhaDeProcedencia(
  cotista: string,
  estado: EstadoEnvio,
  adm: string | null,
): string {
  const origem = `Informado por ${cotista}`
  if (estado === "aguardando") return `${origem} · aguardando análise`
  const quem = adm?.trim() || "a administradora"
  return estado === "incorporado"
    ? `${origem} · incorporado por ${quem}`
    : `${origem} · arquivado por ${quem}`
}

/*
 * `cotistaPodeGerarRelatorioPessoal(assinantePago) => assinantePago` foi
 * apagada junto com o bloco de venda (A8): sem plano pago não existe
 * `assinantePago`, e a função era a identidade com nome bonito. O relatório
 * OFICIAL da unidade continua sendo do ADM — a régua desse está em
 * `cotistaPodeGerarRelatorioOficial` (cotistas.ts), essa sim com consumidor.
 */
