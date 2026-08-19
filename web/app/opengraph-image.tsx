import { readFileSync } from "node:fs"
import path from "node:path"
import { ImageResponse } from "next/og"

// Onda 25 (auditoria CMO P0) — card de compartilhamento pro WhatsApp/redes.
// Sem isso, o link do Commander chegava só com título+descrição em texto —
// no canal onde a audiência mais confia (indicação de amigo), a primeira
// impressão era a mais fraca possível tecnicamente.
//
// Gerada via `ImageResponse` (Next nativo) pra nunca dessincronizar de um PNG
// estático esquecido no /public. Composição sóbria de propósito — sem foto
// fabricada de barco nenhum (regra do produto: zero prova inventada): navy da
// marca, a marca, nome e tagline.
//
// ONDA 93 — A MARCA DEFINITIVA ENTRA AQUI TAMBÉM.
// Antes este arquivo redesenhava à mão o monograma provisório, com o mesmo
// `<path>` copiado de `components/logo.tsx`. Dois lugares desenhando a mesma
// marca é exatamente como uma delas fica pra trás — e ficaria: o dono
// entregou o SVG final e este card continuaria mostrando o rascunho dourado
// em todo link compartilhado no WhatsApp.
//
// Agora ele LÊ o mesmo arquivo que o app inteiro usa. `readFileSync` na
// renderização (esta rota roda no Node, não no edge) e o SVG vira data URI,
// que é a única forma que o Satori — o motor do `ImageResponse` — aceita
// para desenho vetorial. Trocar o logo passa a ser trocar UM arquivo.
// ONDA 103 — A LINHA DO CARD SAI DE "O DOSSIÊ DO SEU BARCO".
// A auditoria de 19/08 (`produto-promessa-x-entrega.md` §2.1) mediu: `grep
// dossi` em todo o `web/` devolve zero rota, zero botão e zero action. O PDF
// que existe (`/barco/resumos`) é custo e uso do período — não sai nele nem o
// nome do estaleiro. A palavra prometia um documento que o app não entrega, e
// este card é justamente onde a promessa chega primeiro: é o que aparece
// quando alguém manda o link no WhatsApp.
// A linha nova é a mesma do H1 da landing, e ela é conferível: a rota pela
// água com restrição de calado roda em `lib/domain/rota.ts` e está
// demonstrada, funcionando, no herói da página.
export const alt = "Commander — a rota passa onde o seu barco passa"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// O navy do próprio asset, para o fundo do card e o quadrado da marca serem a
// mesma cor e a marca não parecer um selo colado.
const NAVY = "#051A33"
const CLARO = "#E8E9EC"

export default function Image() {
  const svg = readFileSync(path.join(process.cwd(), "public", "logo-commander.svg"), "utf8")
  const marca = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: NAVY,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={marca} width={148} height={148} alt="" />
        <div
          style={{
            display: "flex",
            marginTop: 36,
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: CLARO,
          }}
        >
          COMMANDER
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 20,
            fontSize: 32,
            color: CLARO,
            opacity: 0.72,
            letterSpacing: "0.02em",
          }}
        >
          A rota passa onde o seu barco passa
        </div>
      </div>
    ),
    { ...size },
  )
}
