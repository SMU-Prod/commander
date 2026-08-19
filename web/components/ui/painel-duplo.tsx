import type { ReactNode } from "react"
import type { NomeIcone } from "@/components/icone"
import { EstadoVazio } from "./estado-vazio"

/**
 * CASCA DE DUAS COLUNAS DO DESKTOP (onda 64).
 *
 * A referência que o dono trouxe (dashboard logístico) não é celular
 * esticado: no desktop a lista e o item selecionado aparecem AO MESMO
 * TEMPO, lado a lado — é isso que faz a tela parecer produto de verdade em
 * vez de "coluna de app de bolso esticada até 1440px" (docs/DESIGN.md §1).
 * É a peça que faltava depois do trilho lateral (onda 57) e da régua de
 * larguras (onda 63): os dois já existiam, mas toda tela continuava sendo
 * uma coluna só, só que mais larga.
 *
 * NO CELULAR ISTO NÃO EXISTE — SÓ A LISTA APARECE, IGUAL A QUALQUER OUTRA
 * TELA DO APP. `detalhe` é conteúdo de DESKTOP: fica escondido abaixo de
 * `lg`, e nada aqui garante que ele apareça no aparelho. O caminho até o
 * detalhe no celular continua sendo o de sempre — navegação, que é o que já
 * funciona a bordo com o polegar — e é responsabilidade de quem monta
 * `lista`, não deste componente, oferecer esse caminho (ex.: cada item da
 * lista já sendo o cartão completo no celular, como a Mecânica faz). Duas
 * colunas espremidas a 390px não é layout responsivo: é o mesmo defeito que
 * o app inteiro tinha antes da onda 57, só que reintroduzido aqui.
 *
 * O PAINEL DA DIREITA É `sticky` COM ROLAGEM PRÓPRIA. Numa lista comprida, o
 * item selecionado precisa continuar visível enquanto a ESQUERDA rola por
 * baixo dele — sem isso, escolher o vigésimo item da lista jogaria o
 * detalhe pra fora da viewport, e a pessoa rolaria pra cima só pra ver o que
 * acabou de clicar. `top-5` repete o `pt-5` que a `MolduraApp` já usa no
 * topo do conteúdo (`lib/ui/superficies.ts`), pra o painel não flutuar mais
 * alto do que o resto da página nasce; a altura máxima com `overflow-y-auto`
 * impede que um detalhe mais alto que a tela empurre o rodapé do navegador
 * pra fora — quem rola é o painel, não a janela inteira.
 *
 * `data-painel-lista` / `data-painel-detalhe` são o mesmo tipo de gancho que
 * `[data-moldura]` já é em `moldura-app.tsx`: nome estável pra quem precisa
 * achar as duas colunas de fora (varredura, e2e) sem depender de classe
 * Tailwind, que muda com o tempo.
 */
export function PainelDuplo({
  lista,
  detalhe,
  vazioIcone = "chevron",
  vazioTitulo = "Selecione um item da lista",
  vazioDescricao,
  className = "",
}: {
  /** A coluna principal (~2/3) — em qualquer largura, é o que sempre aparece. */
  lista: ReactNode
  /**
   * A coluna de detalhe (~1/3), só a partir de `lg`. `null`/`undefined` =
   * nada selecionado ainda — o painel mostra o estado vazio abaixo em vez de
   * ficar em branco (docs/DESIGN.md §6, regra 4: nunca decorar o vazio, mas
   * também nunca deixar de explicar — um retângulo sem texto é lápide do
   * mesmo jeito que um cartão vazio sem ação).
   */
  detalhe?: ReactNode | null
  /** Ícone do estado vazio padrão quando `detalhe` não vem — troque pelo
   *  ícone do domínio de quem consome (ex.: "ferramenta" na Mecânica). */
  vazioIcone?: NomeIcone
  vazioTitulo?: string
  vazioDescricao?: string
  className?: string
}) {
  return (
    <div className={`lg:grid lg:grid-cols-[2fr_1fr] lg:items-start lg:gap-6 ${className}`}>
      <div data-painel-lista className="min-w-0">
        {lista}
      </div>
      <div
        data-painel-detalhe
        className="hidden lg:sticky lg:top-5 lg:block lg:max-h-[calc(100dvh-2.5rem)] lg:min-w-0 lg:overflow-y-auto"
      >
        {detalhe ?? (
          <EstadoVazio
            variant="cartao"
            icone={vazioIcone}
            titulo={vazioTitulo}
            descricao={vazioDescricao}
            enfase="discreta"
          />
        )}
      </div>
    </div>
  )
}
