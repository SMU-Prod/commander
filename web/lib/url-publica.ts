import { headers } from "next/headers"

/**
 * O ENDEREÇO PÚBLICO DO APP — a origem dos links que o dono manda para fora.
 *
 * POR QUE ESTE ARQUIVO EXISTE (auditoria de produto de 19/08/2026, achado 1.3).
 * Três telas montavam à mão o link que o dono compartilha com um terceiro:
 *   · `/barco/transferir`  — o link que entrega a propriedade do barco;
 *   · `/tripulacao`        — o convite de comandante;
 *   · `/cotistas`          — o convite de cotista.
 * As três escreviam `process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3010"`.
 * Se a variável não estiver no ambiente, o app renderiza — em fonte de
 * instrumento, dentro de uma caixa, com cara de link bom, e com um botão de
 * WhatsApp ao lado que já o empacota numa mensagem pronta — um endereço da
 * máquina de quem programou. Nada quebra na tela; o link só não abre do outro
 * lado. É falha silenciosa e total dos três caminhos de entrada de gente nova
 * no produto.
 *
 * O sinal de que ninguém tinha consolidado isso: o MESMO fallback aparecia com
 * duas portas diferentes no repositório — `3010` nas três telas de link e
 * `3000` em `lib/acoes/auth.ts`, `lib/acoes/gold.ts`, `lib/acoes/assinatura.ts`,
 * `app/sitemap.ts`, `app/robots.ts` e `app/layout.tsx`.
 *
 * POR QUE DERIVAR DO PEDIDO, E NÃO EXPLODIR (alternativa descartada).
 * A auditoria sugeriu "falhar alto em produção quando a variável não existir".
 * Falhar alto aqui significa derrubar a tela inteira de transferência na cara
 * de quem está vendendo o barco — troca um link quebrado por uma página de erro,
 * e nenhuma das duas entrega o link. O pedido HTTP que renderiza a tela SABE em
 * que endereço o app está sendo servido; usar essa resposta é o único caminho
 * que sempre produz um link que abre. `localhost` deixa de ser inventado: ou
 * vem da variável, ou vem do host real, e num ambiente de desenvolvimento o
 * host real É localhost — verdadeiro por acidente feliz, não por chute.
 *
 * A VARIÁVEL VEM PRIMEIRO, e é decisão. O host do pedido, num deploy de
 * preview da Vercel, é o endereço efêmero daquele build; um link de
 * transferência vale 7 dias (`transferencias.expira_em`) e pode sobreviver ao
 * deploy que o gerou. `NEXT_PUBLIC_APP_URL` é o domínio que o dono declarou
 * como canônico — quando ele existe, é ele que manda. O host do pedido é a
 * rede de segurança para o dia em que a variável não estiver lá.
 *
 * PENDÊNCIA DO DONO, registrada e não resolvida aqui: `web/.env.example:18`
 * aponta para `commander.soumardivers.com` enquanto a produção roda em
 * `commander-tau.vercel.app`. Se a variável estiver setada com o domínio
 * errado, esta função obedece ao valor errado — ela conserta a AUSÊNCIA da
 * variável, não a escolha de domínio, que é decisão de produto.
 */
export async function urlPublica(): Promise<string> {
  const declarada = process.env.NEXT_PUBLIC_APP_URL?.trim()
  // Barra no fim vira `//convite/...` na concatenação — inofensivo na maioria
  // dos servidores e feio em todos, e já basta o link ser lido em voz alta por
  // telefone algum dia.
  if (declarada) return declarada.replace(/\/+$/, "")

  const cabecalhos = await headers()
  // `x-forwarded-host` é o que a Vercel preenche quando há proxy na frente;
  // `host` é o que sobra em `next dev` e em servidor próprio.
  const host = cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host")
  if (host) {
    const protocolo =
      cabecalhos.get("x-forwarded-proto") ??
      (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https")
    return `${protocolo}://${host}`
  }

  // Sem variável E sem cabeçalho de host quer dizer que isto foi chamado fora
  // de um pedido HTTP — geração estática, script, teste. Não existe resposta
  // certa nesse contexto, e devolver `localhost` seria exatamente o defeito
  // que este arquivo veio fechar. Quebrar aqui quebra o build de quem chamou
  // no lugar errado, que é quem tem como consertar.
  throw new Error(
    "urlPublica() foi chamada fora de um pedido HTTP e NEXT_PUBLIC_APP_URL não está definida — não há como saber o endereço público do app.",
  )
}
