/**
 * O REMETENTE DOS E-MAILS TRANSACIONAIS — e por que ele não tem mais valor
 * padrão.
 *
 * ACHADO 3.1 DA AUDITORIA DE PRODUTO DE 19/08/2026. Os dois únicos pontos de
 * envio do app — `app/api/relatorio/mensal/route.ts` e
 * `app/api/alertas/disparar/route.ts` — mandavam de
 * `Commander <onboarding@resend.dev>`, cravado no código.
 *
 * `onboarding@resend.dev` é o remetente COMPARTILHADO DE SANDBOX do Resend:
 * ele só entrega para o endereço verificado da própria conta. Ligar
 * `RESEND_API_KEY` em produção com esse `from` faria o e-mail chegar ao dono
 * do Commander e a mais ninguém — e o log diria `enviadas: 1` sem que um único
 * cliente tivesse sido avisado. São dois consertos, não um: a chave e o
 * remetente.
 *
 * POR QUE FALHAR EM VOZ ALTA EM VEZ DE MANTER O PADRÃO DE SANDBOX.
 * Um envio que "funciona" para uma caixa de entrada só é pior do que um envio
 * que não acontece: ele produz métrica de sucesso e nenhuma entrega. Sem
 * `RESEND_FROM` no ambiente, o app deixa de tentar e registra o motivo — e
 * quem lê o log descobre em uma linha o que a auditoria levou uma sessão para
 * concluir.
 *
 * PENDÊNCIA DO DONO, e ela é de OPERAÇÃO, não de código: verificar um domínio
 * no Resend e pôr o endereço em `RESEND_FROM`. Enquanto isso não acontecer,
 * nenhum e-mail transacional sai — que é exatamente o que já acontece hoje,
 * só que agora dito em voz alta em vez de descoberto por auditoria.
 */
export function remetenteDeEmail(): string | null {
  const configurado = process.env.RESEND_FROM?.trim()
  return configurado ? configurado : null
}

/**
 * Envia um e-mail pelo Resend e devolve o que aconteceu, com o corpo da recusa
 * quando houver.
 *
 * O SEGUNDO DEFEITO DO ACHADO 3.1: os dois pontos de envio faziam
 * `if (resposta.ok) enviadas++` e jogavam fora o corpo do erro. O log final
 * reportava `enviadas: 0` sem dizer por quê — "ninguém é avisado de que
 * ninguém foi avisado". O Resend recusa com um JSON que nomeia a causa
 * (domínio não verificado, destinatário fora do sandbox, chave inválida), e
 * essa é a informação que transforma meia hora de investigação em uma linha
 * de log.
 *
 * Nunca lança: uma falha de e-mail não pode derrubar o lote nem a rota. Quem
 * chama decide o que fazer com o motivo — hoje, registrar.
 */
export async function enviarEmail(opcoes: {
  chave: string
  remetente: string
  para: string
  assunto: string
  texto: string
}): Promise<{ ok: true } | { ok: false; motivo: string }> {
  try {
    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opcoes.chave}`,
      },
      body: JSON.stringify({
        from: opcoes.remetente,
        to: opcoes.para,
        subject: opcoes.assunto,
        text: opcoes.texto,
      }),
    })
    if (resposta.ok) return { ok: true }
    // O corpo vem uma vez só (o stream não rebobina), então ele é lido aqui e
    // entregue pronto a quem chamou. `.catch` porque uma recusa de rede pode
    // não ter corpo nenhum, e perder o status por causa disso seria repetir o
    // defeito em escala menor.
    const corpo = await resposta.text().catch(() => "")
    return { ok: false, motivo: `HTTP ${resposta.status} ${corpo}`.trim() }
  } catch (erro) {
    return { ok: false, motivo: erro instanceof Error ? erro.message : String(erro) }
  }
}
