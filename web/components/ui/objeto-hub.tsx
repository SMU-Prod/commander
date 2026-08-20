/* eslint-disable @next/next/no-img-element */
import type { ChaveHub } from "@/lib/ui/hubs"

/**
 * OS OBJETOS 3D DOS HUBS — RECORTADOS DAS IMAGENS NORMATIVAS DO GUIA.
 * ===========================================================================
 * ONDA 119. O dono pôs a imagem 1 do guia ao lado da captura do app e cobrou:
 * *"você está me dizendo que isso aí é igual a isso?"*. Não era — a diferença
 * eram os RENDERS. As cenas isométricas desenhadas em código (ondas 108–118)
 * tinham a composição certa e o realismo errado, e realismo não se desenha em
 * SVG à mão.
 *
 * A SOLUÇÃO ESTAVA DENTRO DO PRÓPRIO GUIA: as oito imagens normativas contêm
 * os renders de todos os hubs. Os arquivos de `public/imagens/hubs/` são
 * recortes diretos da imagem 1 (a grade 4×2 do desktop), um por card, com o
 * chevron do canto carimbado para fora. Mais o iate holográfico do herói, que
 * é o estado "sem foto" que a própria imagem desenha.
 *
 * PROCEDÊNCIA E LICENÇA, para ninguém tropeçar depois: os recortes vêm do
 * `Guia_de_Design_Commander_v1.docx` do dono — material dele, produzido para
 * este produto. O §1 do guia declara as imagens normativas para "hierarquia,
 * atmosfera, composição, CORES e comportamento"; o §6 avisa que os renders são
 * "exemplos de linguagem, não o pacote final de assets". Ou seja: estes
 * recortes são o placeholder OFICIAL até o pacote final ser produzido — quando
 * ele chegar, troca-se os arquivos desta pasta e nenhuma linha de código muda.
 *
 * O QUE ISTO NÃO É: fotografia fictícia do ativo do usuário. O §3.5 do PRD
 * proíbe imagem que PAREÇA ser o motor/barco real da pessoa; estes são renders
 * estilizados de equipamento genérico — exatamente a "ilustração técnica
 * neutra" que o mesmo parágrafo manda usar antes do upload da foto real.
 *
 * AS CENAS ISOMÉTRICAS DESENHADAS foram removidas deste arquivo (estão no git,
 * ondas 108–113) — mantê-las como código morto ao lado dos renders seria a
 * segunda linguagem visual que o §6 proíbe.
 *
 * `<img>` E NÃO `next/image`: mesmos motivos de `components/logo.tsx` — asset
 * estático nosso, tamanho conhecido, sem otimização remota a ganhar.
 */
export function ObjetoHub({
  chave,
  className = "",
}: {
  /** Um dos oito hubs, ou o iate holográfico do herói (Diário, estado sem foto). */
  chave: ChaveHub | "iate"
  className?: string
}) {
  return (
    <img
      /* ONDA 120 — .jpg: as três imagens em alta que o dono mandou (motor,
         casco, elétrica) entraram em 720px, e PNG fotográfico nesse tamanho
         custa ~600KB por card. JPEG a 85 entrega o mesmo olho a ~70KB. Os
         recortes menores foram convertidos junto — uma extensão só. */
      src={`/imagens/hubs/${chave}.jpg`}
      alt=""
      aria-hidden="true"
      draggable={false}
      /* `object-cover` + raio de controle: o recorte traz o próprio fundo navy
         do guia (quase o tom do cartão — a emenda some), e as pontas
         arredondadas evitam um retângulo duro dentro do card. */
      className={`rounded-[var(--raio-controle)] object-cover ${className}`}
    />
  )
}
