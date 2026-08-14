/**
 * Onda 34 — Commander Connect: triagem de compatibilidade (captação de
 * interesse). Dominio puro — sem I/O; a gravação mora em
 * `web/lib/acoes/connect.ts`, a tela em `web/app/(app)/barco/connect/`.
 *
 * As 3 classes comerciais vêm do PRD (`docs/prd/commander-connect.txt`,
 * seção 3):
 *  - CONNECT READY: rede NMEA 2000 existente + dados de motor já
 *    disponíveis nela. Instala, configura, pronto.
 *  - CONNECT COMPATIBLE: motor/sistema digital compatível, mas os dados
 *    ainda não chegam ao NMEA 2000 — pode exigir gateway/interface,
 *    mediante orçamento.
 *  - CONSULTAR COMPATIBILIDADE: sistema diferente ou instalação
 *    desconhecida — cliente envia marca/modelo/ano e fotos do painel.
 *
 * Honestidade obrigatória (mesmo documento): "o mesmo modelo de motor pode
 * estar instalado com arquiteturas eletrônicas diferentes" — a
 * classificação daqui é sempre PRELIMINAR, nunca uma promessa de
 * compatibilidade. Nenhuma resposta "não sei" vira um "sim" otimista: o
 * questionário sempre cai pra CONSULTAR quando falta certeza, nunca
 * adivinha pra cima.
 */

export type RespostaSimNaoNaoSei = "sim" | "nao" | "nao_sei"

export interface RespostasCompatibilidadeConnect {
  /** "A embarcação já tem uma rede NMEA 2000 instalada?" — pergunta base. */
  redeNmea2000: RespostaSimNaoNaoSei
  /** "Os dados do motor já aparecem no chartplotter/MFD, vindos dessa
   *  rede?" — só faz sentido perguntar quando `redeNmea2000 === "sim"`;
   *  `null` quando a pergunta não chegou a ser feita (rede ausente/
   *  desconhecida) OU ainda não foi respondida. */
  dadosMotorNaRede: RespostaSimNaoNaoSei | null
  /** "O motor é digital — SmartCraft (Mercury), Command Link/Command Link
   *  Plus (Yamaha) ou equivalente?" — pergunta de apoio quando NÃO há rede
   *  N2K confirmada (PRD seção 4: mesmo sem rede, um motor digital
   *  conhecido pode virar Connect Compatible com gateway). */
  motorDigitalConhecido: RespostaSimNaoNaoSei
}

export type ClassificacaoConnect = "ready" | "compatible" | "consultar"

/**
 * Classifica a instalação nas 3 classes do PRD. Nunca otimista: qualquer
 * incerteza ("não sei", pergunta de acompanhamento pulada) cai pra
 * `"consultar"` — a classe que pede mais informação em vez de prometer
 * compatibilidade sem ter certeza.
 */
export function classificarCompatibilidadeConnect(r: RespostasCompatibilidadeConnect): ClassificacaoConnect {
  if (r.redeNmea2000 === "nao_sei") return "consultar"

  if (r.redeNmea2000 === "sim") {
    if (r.dadosMotorNaRede === "sim") return "ready"
    if (r.dadosMotorNaRede === "nao") return "compatible"
    return "consultar" // null ou "nao_sei"
  }

  // redeNmea2000 === "nao"
  if (r.motorDigitalConhecido === "sim") return "compatible"
  return "consultar" // "nao" ou "nao_sei"
}

export const ROTULO_CLASSIFICACAO_CONNECT: Record<ClassificacaoConnect, string> = {
  ready: "Connect Ready",
  compatible: "Connect Compatible",
  consultar: "Consultar compatibilidade",
}

/**
 * Texto mostrado à pessoa depois de responder — sempre com a ressalva de
 * "preliminar" (PRD: nunca promessa). Usado tanto pela tela quanto pela
 * mensagem de confirmação do envio (`?ok=`).
 */
export const MENSAGEM_CLASSIFICACAO_CONNECT: Record<ClassificacaoConnect, string> = {
  ready:
    "Pela sua resposta, sua embarcação parece Connect Ready: já tem rede NMEA 2000 com dados do motor disponíveis nela. Classificação preliminar — só vale de verdade depois de conferida na instalação real.",
  compatible:
    "Pela sua resposta, sua embarcação parece Connect Compatible: o sistema é compatível, mas os dados ainda não chegam à rede NMEA 2000 — pode exigir gateway ou interface adicional, mediante orçamento. Classificação preliminar.",
  consultar:
    "Não temos certeza ainda sobre a compatibilidade da sua instalação. Envie marca, modelo, ano do motor e fotos do painel — a Commander analisa e retorna quando houver uma solução viável.",
}
