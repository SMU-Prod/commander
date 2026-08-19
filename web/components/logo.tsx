/* eslint-disable @next/next/no-img-element */

/**
 * A MARCA DO COMMANDER.
 *
 * ONDA 93 — O ASSET DEFINITIVO CHEGOU. Até aqui este arquivo desenhava um
 * monograma provisório à mão (um "MM espelhado" em dourado cravado), com um
 * comentário pedindo pra ser substituído quando o dono entregasse o arquivo
 * final. Entregou: `public/logo-commander.svg`.
 *
 * O ASSET É UM QUADRADO COM FUNDO PRÓPRIO — navy escuro, com a marca em
 * quase-branco por cima. Isso muda o tratamento, e a decisão merece estar
 * escrita porque o caminho ingênuo produz dois defeitos:
 *
 *   · arrancar o fundo e pintar só o traço com `currentColor` faria a marca
 *     mudar de cor por tela (dourada no menu, cinza no rodapé). Marca que
 *     troca de cor conforme o vizinho não é marca;
 *   · usar o quadrado cru, sem raio, deixa um selo colado no texto — lê como
 *     imagem que alguém esqueceu de recortar.
 *
 * Então ele entra como BADGE: quadrado com raio pequeno, do tamanho da linha
 * de texto ao lado. É o mesmo tratamento que qualquer app dá ao próprio ícone
 * quando ele aparece dentro da interface, e funciona nos dois temas sem
 * exceção — a marca carrega o próprio fundo, então não depende do que está
 * atrás dela. No tema escuro o navy quase some contra o fundo e sobra o traço
 * claro flutuando; no claro, o quadrado se afirma. Os dois estão certos.
 *
 * `<img>` E NÃO SVG INLINE, de propósito: o traço tem ~9 KB de dados de
 * caminho, e ele aparece em 15 telas. Inline, esses 9 KB entrariam no HTML de
 * cada uma delas; como arquivo, o navegador baixa uma vez e reusa em todas.
 * Por isso o `eslint-disable` do `next/image` no topo: `next/image` existe pra
 * otimizar bitmap (redimensionar, converter formato, servir por tamanho de
 * tela), e um SVG vetorial não ganha nada disso — ganharia só uma volta a mais
 * pelo otimizador.
 *
 * `aria-hidden` porque o wordmark ao lado já diz "Commander" em texto; no modo
 * compacto o `alt` assume, senão a marca ficaria muda pra quem usa leitor de
 * tela.
 */
export function Logo({ compacto = false }: { compacto?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <img
        src="/logo-commander.svg"
        alt={compacto ? "Commander" : ""}
        aria-hidden={compacto ? undefined : true}
        width={40}
        height={40}
        className="h-[1.6em] w-[1.6em] shrink-0 rounded-[var(--raio-controle)]"
      />
      {/* ONDA 95 (achado 5.12) — O `.28em` ERA O MAIOR DOS ONZE, E MORREU.
          A auditoria mediu 11 valores de `tracking-[…]` para um gesto só
          ("palavra em caixa alta, rastreada") e apontou este como o primeiro
          a cair: `.28em` não era degrau de nada, era o dobro do que a régua
          declara. O valor passa a ser o `.16em` de `.rotulo`.
          NÃO virou a classe `.rotulo`, e a razão é medível: `.rotulo` crava
          `font-size: 11px` e a família mono, e este wordmark é dimensionado
          POR QUEM CHAMA — `text-lg` no painel do parceiro, `text-base` nas
          telas de convite, `text-sm` no login do celular, `text-[11px]` no
          onboarding — com o `<img>` ao lado medindo `1.6em` do mesmo corpo.
          Com a classe, a palavra congelaria em 11px, o símbolo continuaria
          escalando, e a marca sairia desalinhada em cinco telas. Aqui a
          escala é a informação; o que estava errado era só o rastreio. */}
      {!compacto && (
        <span className="font-semibold uppercase tracking-[.16em] text-texto">Commander</span>
      )}
    </span>
  )
}
