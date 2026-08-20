import { Icone } from "@/components/icone"
import { hub, type ChaveHub } from "@/lib/ui/hubs"

/**
 * O OBJETO GRANDE DO TOPO DAS TELAS DE HUB.
 * ===========================================================================
 * As oito imagens normativas do Guia de Design v1 abrem toda tela de hub com
 * um objeto técnico grande em perspectiva, sobre uma base circular que emite
 * luz na cor do hub. É a coisa que mais separa aquelas telas das nossas: sem
 * ela, uma tela de hub é um título e uma lista.
 *
 * ---------------------------------------------------------------------------
 * O QUE ISTO NÃO É, E POR QUE NÃO PODE SER
 * ---------------------------------------------------------------------------
 * Não é o render 3D das imagens. O §6 do guia é explícito: *"os renders
 * presentes nas imagens são EXEMPLOS DE LINGUAGEM, não o pacote final de
 * assets. A biblioteca definitiva deve ser exportada em tamanhos e ângulos
 * padronizados"* — essa biblioteca não existe ainda, e está anotada como
 * dívida em `docs/DESIGN-SYSTEM.md`.
 *
 * O que existe é a regra que vale ENQUANTO ela não existe, e ela é do §5 do
 * PRD e do §1 deste sistema: **antes do upload, ícone ou ilustração técnica
 * neutra** — e nunca uma fotografia que pareça ser o equipamento da pessoa.
 * Então isto desenha ILUSTRAÇÃO, e desenha assumindo que é ilustração: o traço
 * do ícone da casa, ampliado, sobre a base de luz que as imagens usam. No dia
 * em que os renders chegarem, o `<Icone>` aqui vira um `<img>` e mais nada
 * nesta árvore muda.
 *
 * ---------------------------------------------------------------------------
 * A BASE DE LUZ — três anéis, e o porquê de serem elipses
 * ---------------------------------------------------------------------------
 * Nas imagens o objeto flutua sobre anéis concêntricos vistos em perspectiva,
 * o que os achata em elipses. Desenhar círculos daria um alvo de tiro; a
 * elipse é o que faz o objeto parecer POUSADO em vez de colado. A opacidade
 * cai de 30% para 10% de dentro para fora — é gradiente de atenção, não
 * decoração: o olho entra pelo objeto e sai pela borda.
 *
 * `currentColor` no SVG e `text-hub-*` no pai: é o que amarra os anéis ao
 * token do hub sem escrever cor nenhuma à mão (o teto de `tokens.test.ts`
 * conta cor literal por arquivo, e este arquivo nasce com zero).
 *
 * ---------------------------------------------------------------------------
 * ALTURA, E POR QUE ELA É MENOR NO CELULAR
 * ---------------------------------------------------------------------------
 * §13: *"herói ~16:7 no desktop e ~16:9 no mobile, altura LIMITADA para os
 * hubs continuarem alcançáveis"*. Aqui não há grade de hub abaixo, mas há a
 * mesma preocupação: o que vem depois do herói é o conteúdo da tela, e um
 * herói que empurra a primeira linha de dado para fora da dobra transforma
 * atmosfera em obstáculo. 160px no celular, 200px a partir de `sm`.
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
      className={`raio-painel relative flex h-40 items-center justify-center overflow-hidden border bg-panel sm:h-50 ${h.borda} ${h.tom} ${className}`}
    >
      {/* O VÉU DE LUZ. `absolute inset-0` com o tom a 8%: é o "objeto com luz de
          recorte na cor do hub" do §2, resolvido como atmosfera do painel em
          vez de brilho no traço — brilho no traço a esta escala vira o "neon
          sem significado" que o §1 proíbe. */}
      <span className={`absolute inset-0 ${h.halo}`} />

      {/* OS ANÉIS. `viewBox` fixo e `preserveAspectRatio="none"` NÃO: as elipses
          precisam manter a proporção para continuarem parecendo perspectiva —
          esticadas, viram ovais tortas em telas largas. Ficam centradas e
          transbordam, que é o que o `overflow-hidden` do pai resolve. */}
      <svg
        viewBox="0 0 320 120"
        className="absolute bottom-6 h-24 w-80"
        fill="none"
        stroke="currentColor"
      >
        <ellipse cx="160" cy="60" rx="150" ry="34" strokeOpacity=".10" />
        <ellipse cx="160" cy="60" rx="108" ry="24" strokeOpacity=".18" />
        <ellipse cx="160" cy="60" rx="66" ry="15" strokeOpacity=".30" />
      </svg>

      {/* O OBJETO. `relative` para ficar acima do véu e dos anéis sem z-index
          inventado — ordem de pintura basta quando os irmãos anteriores são
          `absolute`. */}
      <Icone nome={h.icone} className="relative size-20 sm:size-24" />
    </div>
  )
}
