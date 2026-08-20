"use client"
import { useId, useState } from "react"
import { Icone } from "../icone"

/**
 * O CAMPO DE ARQUIVO EM PORTUGUÊS.
 *
 * O `<input type="file">` nativo desenha o próprio botão, e quem escreve o
 * rótulo dele é o navegador — em INGLÊS, no idioma do sistema, não no do
 * app: "Choose File · No file chosen" no meio de uma tela onde todo o resto
 * fala português (auditoria visual 18/08, §8). Num app que cobra R$ 69,90
 * por mês isso não passa por detalhe: é o tipo de costura que faz o produto
 * parecer montado às pressas.
 *
 * O contorno é o padrão da web pra isto: o input fica escondido (não
 * `display:none` — `sr-only`, pra continuar focável e anunciado) dentro de
 * um `<label>` que veste o visual de botão da casa. O clique no rótulo abre
 * o seletor nativo do sistema; o teclado alcança pelo próprio input.
 *
 * O nome do arquivo escolhido aparece em `tabular-nums`: é identificador,
 * não prosa — mesma régua de "todo número/código em fonte de instrumento".
 * Sem escolha, o texto diz o que se espera (formato e tamanho), que é a
 * informação que o rótulo nativo nunca deu.
 *
 * `name`, `accept` e `required` passam direto pro input: o fluxo de upload
 * (server action + `subirArquivo`) não sabe que este componente existe.
 */
export function CampoArquivo({
  label,
  name,
  accept,
  required = false,
  ajuda,
  className = "",
}: {
  label: string
  name: string
  accept?: string
  required?: boolean
  /** O que se espera do arquivo ("JPG ou PNG, até 10 MB"). Vira o texto de
   *  reserva enquanto ninguém escolheu nada. */
  ajuda?: string
  className?: string
}) {
  const id = useId()
  const [escolhido, setEscolhido] = useState<string | null>(null)

  return (
    <div className={className}>
      <label htmlFor={id} className="rotulo mb-1.5 block text-dim">
        {label}
      </label>
      <label
        htmlFor={id}
        className="flex min-h-[var(--altura-controle)] cursor-pointer items-center gap-2.5 rounded-[var(--raio-controle)] border border-line bg-campo px-3.5 py-2"
      >
        <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-texto">
          <Icone nome="mais" className="size-4" />
          Escolher arquivo
        </span>
        <span
          className={`min-w-0 flex-1 truncate text-sm ${
            escolhido ? "tabular-nums text-texto" : "text-dim"
          }`}
        >
          {escolhido ?? ajuda ?? "Nenhum arquivo escolhido"}
        </span>
        <input
          id={id}
          name={name}
          type="file"
          accept={accept}
          required={required}
          onChange={(e) => setEscolhido(e.target.files?.[0]?.name ?? null)}
          className="sr-only"
        />
      </label>
    </div>
  )
}
