"use client"
import { useMemo, useRef, useState } from "react"
import { Icone } from "./icone"
import {
  buscarModelos,
  faixaDeAno,
  filtrarPorSegmento,
  nomeCompletoDoModelo,
  podeFiltrarPorSegmento,
  ROTULO_SEGMENTO,
  segmentosPresentes,
  type ModeloCatalogo,
  type SegmentoMotor,
} from "@/lib/domain/catalogo-motor"
import { ChipLinha } from "./ui/chip"
import { TOQUE } from "@/lib/ui/acoes"
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
 * O FILTRO DE SEGMENTO (§20) — O DADO SUBIU, E AÍ ELE LIGOU
 * ---------------------------------------------------------------------------
 * `SEGMENTOS_MOTOR` e `ROTULO_SEGMENTO` (`lib/domain/catalogo-motor.ts`) foram
 * escritos pensando exatamente neste lugar: o §20 separa popa, centro-rabeta e
 * diesel interno, e quem tem popa não precisa ver MTU rolando na lista. Até
 * 19/08/2026 o filtro não existia por falta de DADO, não de vontade — o
 * segmento é coluna de `motor_fabricantes` e não subia no `.select()`, então
 * desenhar os chips teria sido afirmar o que a tela não consultou.
 *
 * Duas linhas fecharam o caminho: o campo em `ModeloCatalogo` e o `segmento`
 * dentro do `motor_fabricantes!inner(...)` da consulta.
 *
 * E A CONFERÊNCIA VEIO ANTES DE LIGAR, porque a mesma auditoria acabava de
 * achar uma tela prometendo "part number OEM" com a coluna nula em 144 de 144
 * linhas. Medido no banco remoto: 12 fabricantes, 12 com segmento, ZERO nulos,
 * três valores distintos e os três dentro do vocabulário. Um filtro sobre
 * coluna vazia esconderia modelos sem dizer por quê; sobre esta, não esconde.
 *
 * QUEM DECIDE SE O FILTRO APARECE NÃO É ESTA TELA. `podeFiltrarPorSegmento` e
 * `segmentosPresentes` moram no domínio, com teste, e é lá que está escrito
 * por que um segmento sem modelo nenhum (centro-rabeta, hoje) não vira chip e
 * por que um único modelo de segmento desconhecido desliga o filtro inteiro.
 * Os rótulos saem de `ROTULO_SEGMENTO` e a ordem de `SEGMENTOS_MOTOR` — não se
 * reescrevem aqui, senão a tela e o banco passam a discordar em silêncio.
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
  const [segmento, setSegmento] = useState<SegmentoMotor | null>(null)
  const caixa = useRef<HTMLDivElement>(null)

  // As três perguntas do §20, respondidas pelo domínio: o filtro cabe? quais
  // segmentos existem de verdade? e o que sobra depois do recorte?
  const comFiltro = useMemo(() => podeFiltrarPorSegmento(modelos), [modelos])
  const segmentos = useMemo(() => segmentosPresentes(modelos), [modelos])
  // O RECORTE VEM ANTES DA BUSCA, e a ordem importa: `buscarModelos` corta em
  // 8 resultados. Buscar primeiro e filtrar depois devolveria menos de 8 (às
  // vezes zero) sem que nada tivesse acabado — a lista pareceria vazia com o
  // motor certo logo abaixo do corte.
  const universo = useMemo(
    () => (comFiltro ? filtrarPorSegmento(modelos, segmento) : [...modelos]),
    [modelos, segmento, comFiltro],
  )
  const achados = useMemo(() => buscarModelos(termo, universo), [termo, universo])

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
              <span className="valor block truncate tabular-nums">{nomeCompletoDoModelo(escolhido)}</span>
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
          {/* §20 — O RECORTE POR NATUREZA DO MOTOR, antes da busca.
              `quebra` e não rolagem: são no máximo quatro chips (Todos + os
              segmentos que existem), e a régua do `ChipLinha` diz que lista
              curta e fechada quebra em vez de rolar — opção escondida não é
              escolhida. Cada chip é um `<button type="button">`: o filtro é
              estado local dentro de um `<form>` que grava outra coisa, então
              nem `<Link>` (trocaria de rota e perderia o formulário) nem
              submit (enviaria o cadastro pela metade). */}
          {comFiltro && (
            <ChipLinha quebra className="mb-2 mt-1">
              <ChipSegmento ativo={segmento === null} onClick={() => setSegmento(null)}>
                Todos
              </ChipSegmento>
              {segmentos.map((s) => (
                <ChipSegmento key={s} ativo={segmento === s} onClick={() => setSegmento(s)}>
                  {ROTULO_SEGMENTO[s]}
                </ChipSegmento>
              ))}
            </ChipLinha>
          )}
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
                //
                // COM SEGMENTO ESCOLHIDO A FRASE MUDA, e é a metade do filtro
                // que não pode faltar: "não achei" seria mentira quando o
                // motor está no catálogo e foi o chip que o escondeu. O
                // recorte ativo aparece pelo nome, com o caminho de volta.
                <p className="apoio px-3.5 py-3 text-dim">
                  {segmento === null ? (
                    "Não achei esse motor no catálogo. Sem problema: preencha Marca e Modelo abaixo."
                  ) : (
                    <>
                      Nada em <span className="text-texto">{ROTULO_SEGMENTO[segmento]}</span> com esse
                      nome. Toque em <span className="text-texto">Todos</span> para procurar no catálogo
                      inteiro — ou preencha Marca e Modelo abaixo.
                    </>
                  )}
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
                      <span className="valor block truncate tabular-nums">{nomeCompletoDoModelo(m)}</span>
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

/**
 * O CHIP DO SEGMENTO — o vestido do `Chip` de `components/ui/chip.tsx`, num
 * `<button>`.
 *
 * Não dá pra reusar o `Chip` de verdade: ele é um `<Link href>`, porque no
 * resto do app filtro de lista mora na URL (compartilhável, sobrevive ao
 * voltar). Aqui o filtro é estado LOCAL dentro de um formulário de cadastro —
 * navegar jogaria fora o que a pessoa já digitou nos outros campos.
 *
 * O que é copiado é a linguagem, e de propósito: mesma altura de
 * `--altura-controle` (a régua de 44px, que aqui está no próprio elemento
 * clicável porque o chip É o alvo), mesmo `--raio-pilula`, mesmo par de cores
 * do nível `secundario` — contorno e `text-dim-chip` quando frio, borda e
 * texto `accent-forte` quando ativo. Um filtro com outro vestido leria como
 * outro tipo de controle.
 *
 * `aria-pressed` e não `aria-current`: `current` é para navegação, e isto não
 * navega — é um alternador que liga e desliga.
 */
function ChipSegmento({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`flex h-[var(--altura-controle)] shrink-0 items-center whitespace-nowrap rounded-[var(--raio-pilula)] border px-4 text-sm ${TOQUE} ${
        ativo ? "border-accent-forte font-semibold text-accent-forte" : "border-line text-dim-chip"
      }`}
    >
      {children}
    </button>
  )
}

/** "440 hp · desde 2015" — só o que existe. Sem potência e sem faixa de ano,
 *  devolve a família, que é a única coisa verdadeira que sobra. */
function detalhe(m: ModeloCatalogo): string {
  const faixa = faixaDeAno(m)
  const partes = [m.potenciaHp != null ? `${m.potenciaHp} hp` : null, faixa].filter(Boolean)
  return partes.length > 0 ? partes.join(" · ") : `Família ${m.familia}`
}
