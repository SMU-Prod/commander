"use client"
import { useMemo, useRef, useState } from "react"
import { Icone } from "./icone"
import { buscarModelos, faixaDeAno, nomeCompletoDoModelo, type ModeloCatalogo } from "@/lib/domain/catalogo-motor"
import { campo as classeCampo, rot } from "@/lib/ui/form"

/**
 * ESCOLHER O MOTOR DO CATÁLOGO (onda 64, PRD 3D §16).
 *
 * O campo que dá IDENTIDADE ao motor. Hoje `marca` e `modelo` são texto
 * livre, e "Volvo penta"/"VOLVO PENTA"/"volvo" viram três motores diferentes
 * pro app — é exatamente esse problema que o §16 manda resolver antes de
 * qualquer 3D.
 *
 * ---------------------------------------------------------------------------
 * A DECISÃO DE PRODUTO QUE MOLDA ESTE COMPONENTE
 * ---------------------------------------------------------------------------
 * Escolher do catálogo é OPCIONAL, e tem que continuar sendo. O Commander
 * atende barco de 40 a 60 pés no Rio e boa parte dessa frota tem motor que
 * não vai estar no catálogo tão cedo — um seletor obrigatório transformaria
 * "cadastrar meu motor" em "seu motor não existe".
 *
 * Por isso: os campos Marca e Modelo em texto livre CONTINUAM na tela, logo
 * abaixo, e continuam sendo gravados. Este seletor é um a mais.
 *
 * ---------------------------------------------------------------------------
 * POR QUE A BUSCA É LOCAL
 * ---------------------------------------------------------------------------
 * O catálogo inteiro chega pronto do servidor (23 modelos hoje; o §23 do PRD
 * manda explicitamente não cadastrar centenas). `buscarModelos` é função pura
 * e testada, então a lista responde a cada tecla sem ida ao servidor — nada
 * de rota de API por caractere digitado.
 *
 * A busca tokeniza: "D6-440", "d6 440", "d6440" e "volvo d6" acham a mesma
 * linha. É o mesmo problema de identidade, agora no teclado de quem digita.
 *
 * ---------------------------------------------------------------------------
 * POR QUE NÃO EXISTE FILTRO DE SEGMENTO NESTA TELA
 * ---------------------------------------------------------------------------
 * `SEGMENTOS_MOTOR` e `ROTULO_SEGMENTO` (`lib/domain/catalogo-motor.ts`) foram
 * escritos pensando exatamente neste lugar — o §20 separa popa, centro-rabeta
 * e diesel interno, e quem tem popa não precisa ver MTU rolando na lista. A
 * ideia continua boa; o que não existe é o dado.
 *
 * O segmento é coluna de `motor_fabricantes`, ou seja, sobe pela família até o
 * fabricante. `ModeloCatalogo` não tem esse campo e `carregarModelosDoCatalogo`
 * não pede essa coluna no `.select()` — o que chega aqui, em `modelos`, não
 * carrega segmento nenhum. Uma fila de chips "Popa / Centro-rabeta / Diesel
 * interno" desenhada assim mesmo seria uma tela afirmando o que ela não
 * consultou, que é o defeito mais caro que esta auditoria já pagou (o `/frota`
 * desenhando origem que ninguém preenchia).
 *
 * Então o filtro fica de fora ATÉ o dado subir, e não o contrário. No dia em
 * que subir, ele nasce lendo a ordem de `SEGMENTOS_MOTOR` e o texto de
 * `ROTULO_SEGMENTO` — os rótulos moram no domínio e não se reescrevem aqui,
 * senão a tela e o banco passam a discordar em silêncio.
 */
export function SeletorModeloMotor({
  modelos,
  inicial,
}: {
  modelos: readonly ModeloCatalogo[]
  /** Modelo já vinculado (tela de editar). `null` no cadastro novo. */
  inicial?: ModeloCatalogo | null
}) {
  const [escolhido, setEscolhido] = useState<ModeloCatalogo | null>(inicial ?? null)
  const [termo, setTermo] = useState("")
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  const achados = useMemo(() => buscarModelos(termo, modelos), [termo, modelos])

  // Catálogo vazio (consulta falhou, ou banco sem semente): o componente
  // some inteiro em vez de mostrar uma busca que nunca acha nada. Marca e
  // Modelo em texto livre seguem na tela e o cadastro funciona igual.
  if (modelos.length === 0) return null

  return (
    <div ref={caixa}>
      {/* O `name` viaja no FormData mesmo quando ninguém escolhe nada: string
          vazia, que a action converte pra null. */}
      <input type="hidden" name="motor_modelo_id" value={escolhido?.id ?? ""} />

      {escolhido ? (
        <>
          <p className={rot}>Motor do catálogo</p>
          <div className="flex min-h-11 items-center gap-2.5 rounded-[var(--raio-controle)] border border-line bg-campo px-3.5 py-2">
            {/* `.valor` e não `text-sm`: o nome do modelo é DADO, não título.
                É a identidade que a pessoa acabou de escolher, cheia de dígito
                ("D6-440", "Verado 400", "F300"), e a lista logo abaixo empilha
                vários deles — o tabular de `.valor` é o que faz os números
                caírem na mesma coluna em vez de dançarem linha a linha. Título
                neste app tem outra voz (`.titulo-card`, 15px, na fonte do
                corpo) e ela brigaria com o mono de instrumento, que é
                justamente o vestido de quem mostra leitura de aparelho.
                Mesmos 14px de antes: muda a voz declarada, não o tamanho. */}
            <span className="min-w-0 flex-1">
              <span className="valor block truncate font-mono-instr">{nomeCompletoDoModelo(escolhido)}</span>
              <span className="apoio block truncate text-dim">{detalhe(escolhido)}</span>
            </span>
            <button
              type="button"
              onClick={() => { setEscolhido(null); setTermo(""); setAberto(false) }}
              className="flex size-11 shrink-0 items-center justify-center text-dim"
              aria-label="Desvincular do catálogo"
            >
              <Icone nome="mais" className="size-4 rotate-45" />
            </button>
          </div>
          <p className="apoio mt-1 text-dim">
            O catálogo dá identidade ao motor — é o que liga a peça ao plano de manutenção.
          </p>
        </>
      ) : (
        <>
          <label className={rot} htmlFor="busca-modelo-motor">Motor do catálogo — opcional</label>
          <input
            id="busca-modelo-motor"
            type="text"
            value={termo}
            onChange={(e) => { setTermo(e.target.value); setAberto(true) }}
            onFocus={() => setAberto(true)}
            // `onBlur` com atraso: sem ele, o blur do input fecha a lista
            // antes do clique no item chegar, e escolher fica impossível no
            // toque. O atraso é curto o bastante pra não piscar na tela.
            onBlur={() => setTimeout(() => setAberto(false), 120)}
            placeholder="D6-440, Verado 400, F300…"
            autoComplete="off"
            className={classeCampo}
          />
          {aberto && termo.trim() !== "" && (
            <div className="mt-1 overflow-hidden rounded-[var(--raio-controle)] border border-line bg-panel">
              {achados.length === 0 ? (
                // Nada achado NÃO é erro: é o caso comum de quem tem motor
                // fora do catálogo. A frase manda a pessoa pro texto livre
                // em vez de deixá-la travada procurando.
                <p className="apoio px-3.5 py-3 text-dim">
                  Não achei esse motor no catálogo. Sem problema: preencha Marca e Modelo abaixo.
                </p>
              ) : (
                achados.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setEscolhido(m); setAberto(false); setTermo("") }}
                    className="flex min-h-11 w-full items-center gap-2 border-b border-line px-3.5 py-2 text-left last:border-0"
                  >
                    {/* Mesma voz de dado da linha escolhida, acima — a lista e
                        o resultado dela têm que ler igual, senão escolher um
                        item parece trocar de tipografia. */}
                    <span className="min-w-0 flex-1">
                      <span className="valor block truncate font-mono-instr">{nomeCompletoDoModelo(m)}</span>
                      <span className="apoio block truncate text-dim">{detalhe(m)}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
          <p className="apoio mt-1 text-dim">
            Opcional. Não achou o seu? Preencha Marca e Modelo abaixo, como sempre.
          </p>
        </>
      )}
    </div>
  )
}

/** "440 hp · desde 2015" — só o que existe. Sem potência e sem faixa de ano,
 *  devolve a família, que é a única coisa verdadeira que sobra. */
function detalhe(m: ModeloCatalogo): string {
  const faixa = faixaDeAno(m)
  const partes = [m.potenciaHp != null ? `${m.potenciaHp} hp` : null, faixa].filter(Boolean)
  return partes.length > 0 ? partes.join(" · ") : `Família ${m.familia}`
}
