import { ObjetoHub } from "@/components/ui/objeto-hub"
import { hub, type ChaveHub } from "@/lib/ui/hubs"

/**
 * O OBJETO GRANDE DO TOPO DAS TELAS DE HUB.
 * ===========================================================================
 * As oito imagens normativas do Guia de Design v1 abrem toda tela de hub com
 * um objeto técnico grande em perspectiva, sobre uma base circular que emite
 * luz na cor do hub, com HUD discreto em volta. É a coisa que mais separa
 * aquelas telas das nossas: sem ela, uma tela de hub é um título e uma lista.
 *
 * ---------------------------------------------------------------------------
 * O QUE ISTO NÃO É, E POR QUE NÃO PODE SER (ainda)
 * ---------------------------------------------------------------------------
 * Não é o render 3D das imagens. O §6 do guia é explícito: *"os renders
 * presentes nas imagens são EXEMPLOS DE LINGUAGEM, não o pacote final de
 * assets. A biblioteca definitiva deve ser exportada em tamanhos e ângulos
 * padronizados"* — essa biblioteca não existe, e a busca por uma pronta e
 * gratuita foi feita em 19/08 com resultado negativo, registrado em
 * `docs/DESIGN-SYSTEM.md` §15.4: as bibliotecas CC0 de verdade (3dicons,
 * Kenney, Poly Haven) não têm NENHUM dos oito objetos náuticos — não há motor
 * marítimo, casco, bomba nem balsa em lugar nenhum delas.
 *
 * O que existe é a regra que vale ENQUANTO ela não existe, e ela é do §5 do
 * PRD e do §1 deste sistema: **antes do upload, ícone ou ilustração técnica
 * neutra** — e nunca uma fotografia que pareça ser o equipamento da pessoa.
 * Então isto desenha ILUSTRAÇÃO e assume que é. No dia em que os renders
 * chegarem, o `<Icone>` daqui vira um `<img>` e mais nada nesta árvore muda:
 * é por isso que a peça existe separada, e não desenhada dentro de cada tela.
 *
 * ---------------------------------------------------------------------------
 * AS QUATRO CAMADAS, DE TRÁS PARA FRENTE
 * ---------------------------------------------------------------------------
 * 1. VÉU — o tom do hub a 8% cobrindo o painel. É o "objeto com luz de recorte
 *    na cor do hub" do §2 resolvido como atmosfera, e não como brilho no
 *    traço: brilho no traço nesta escala vira o "neon sem significado" que o
 *    §1 proíbe.
 * 2. GRADE EM PERSPECTIVA — cinco linhas que se aproximam à medida que sobem.
 *    É o que dá CHÃO à cena. Sem ela, os anéis flutuam num retângulo e a
 *    ilustração lê como ícone dentro de caixa; com ela, lê como objeto sobre
 *    superfície, que é a diferença que as imagens têm e o ícone solto não tem.
 * 3. ANÉIS — três elipses concêntricas. Elipse e não círculo: nas imagens a
 *    base é vista em perspectiva, e círculo concêntrico dá alvo de tiro. A
 *    opacidade cai de 30% para 10% de dentro para fora — gradiente de atenção,
 *    não decoração: o olho entra pelo objeto e sai pela borda.
 * 4. HUD — quatro cantos e dois traços de escala, a 25%. É o *"HUD e telemetria
 *    discretos, coerentes e informativos"* do §2, com a segunda metade da
 *    frase respeitada: *"não inserir microdados aleatórios"*. Por isso são
 *    marcas de enquadramento e não números inventados — número falso numa tela
 *    de manutenção é a mesma família de mentira que a foto fictícia.
 *
 * `currentColor` em todo o SVG e `text-hub-*` no pai: é o que amarra as quatro
 * camadas ao token do hub sem escrever cor nenhuma à mão (o teto de
 * `tokens.test.ts` conta cor literal por arquivo, e este arquivo tem zero).
 *
 * ---------------------------------------------------------------------------
 * ALTURA, E POR QUE ELA É MENOR NO CELULAR
 * ---------------------------------------------------------------------------
 * §13: *"herói ~16:7 no desktop e ~16:9 no mobile, altura LIMITADA para os
 * hubs continuarem alcançáveis"*. Aqui não há grade de hub abaixo, mas há a
 * mesma preocupação: o que vem depois é o conteúdo da tela, e um herói que
 * empurra a primeira linha de dado para fora da dobra troca atmosfera por
 * obstáculo. 176px no celular, 208px a partir de `sm`.
 */
export function HeroiTecnico({
  chave,
  className = "",
}: {
  chave: ChaveHub
  className?: string
}) {
  const h = hub(chave)
  return (
    <div
      /* `aria-hidden` no conjunto: é ILUSTRAÇÃO, e o nome do hub já foi dito
         pelo `<h1>` do cabeçalho logo acima. Um leitor de tela que anunciasse
         "imagem: motor" aqui repetiria a palavra anterior — e o §14 é explícito
         em que asset decorativo usa alternativo vazio. */
      aria-hidden="true"
      className={`raio-painel relative flex h-44 items-center justify-center overflow-hidden border bg-panel sm:h-52 ${h.borda} ${h.tom} ${className}`}
    >
      <span className={`absolute inset-0 ${h.halo}`} />

      {/* CAMADAS 2, 3 e 4 num SVG só: elas compartilham o mesmo espaço de
          coordenadas e desenhar em três SVGs faria três sistemas de perspectiva
          que precisariam concordar à mão.
          `preserveAspectRatio="xMidYMid slice"` para a cena cobrir a caixa em
          qualquer largura sem esticar as elipses — elipse esticada deixa de
          parecer perspectiva e vira oval torta. */}
      <svg
        viewBox="0 0 360 200"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        fill="none"
        stroke="currentColor"
      >
        {/* 2 — a grade. As linhas se aproximam subindo (y: 200, 186, 175, 167,
            161), que é o que faz o plano recuar. */}
        <g strokeOpacity=".07">
          <line x1="-40" y1="200" x2="400" y2="200" />
          <line x1="-40" y1="186" x2="400" y2="186" />
          <line x1="-40" y1="175" x2="400" y2="175" />
          <line x1="-40" y1="167" x2="400" y2="167" />
          <line x1="-40" y1="161" x2="400" y2="161" />
          {/* As verticais convergem para o ponto de fuga em (180, 150). */}
          <line x1="-60" y1="200" x2="140" y2="150" />
          <line x1="60" y1="200" x2="160" y2="150" />
          <line x1="300" y1="200" x2="200" y2="150" />
          <line x1="420" y1="200" x2="220" y2="150" />
        </g>

        {/* 3 — os anéis da base, centrados no objeto. */}
        <ellipse cx="180" cy="132" rx="132" ry="27" strokeOpacity=".10" />
        <ellipse cx="180" cy="132" rx="94" ry="19" strokeOpacity=".18" />
        <ellipse cx="180" cy="132" rx="56" ry="11" strokeOpacity=".30" />

        {/* 4 — o HUD: quatro cantos de enquadramento e dois traços de escala. */}
        <g strokeOpacity=".25" strokeWidth="1.5">
          <path d="M14 34 v-12 h12" />
          <path d="M346 34 v-12 h-12" />
          <path d="M14 166 v12 h12" />
          <path d="M346 166 v12 h-12" />
        </g>
        <g strokeOpacity=".18">
          <line x1="14" y1="92" x2="24" y2="92" />
          <line x1="14" y1="104" x2="20" y2="104" />
          <line x1="346" y1="92" x2="336" y2="92" />
          <line x1="346" y1="104" x2="340" y2="104" />
        </g>
      </svg>

      {/* O OBJETO — agora é `ObjetoHub`, ilustração isométrica desenhada peça a
          peça (motor com bloco e coletor, casco com convés e costados, banco de
          baterias, tanque e bomba...), e não mais o traço do ícone ampliado.
          A troca é de VOLUME: o ícone é uma linha, o objeto tem três faces com
          luz diferente — e é o que faz a cena ler como render em vez de
          símbolo grande. Ver o cabeçalho de `objeto-hub.tsx`.
          `-mt-3` o levanta para pousar sobre o anel de dentro em vez de ficar
          no meio geométrico da caixa: objeto centrado numa cena que tem chão
          parece colado; levantado, parece pousado.
          `relative` para ficar acima do véu e do SVG de fundo sem z-index
          inventado — ordem de pintura basta quando os irmãos anteriores são
          `absolute`. */}
      <ObjetoHub chave={chave} className="relative -mt-3 h-32 w-52 sm:h-36 sm:w-60" />
    </div>
  )
}
