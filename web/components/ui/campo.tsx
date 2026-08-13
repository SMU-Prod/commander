import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react"
import { campo as classeCampo, rot } from "@/lib/ui/form"

/**
 * Label + controle (input/select/textarea) + dica + erro, no mesmo
 * espaçamento em toda tela. Reaproveita as classes de `lib/ui/form.ts`
 * (`campo`/`rot`) — não duplica as strings de estilo em cada arquivo, como
 * acontecia antes (documentos/page.tsx e itens/novo/page.tsx tinham cada
 * um sua própria cópia local dessas classes).
 *
 * Quando usar: todo campo de formulário da ficha (embarcação, equipamento,
 * manutenção, documento). Três variantes com a mesma casca — `Campo` para
 * `<input>`, `CampoSelect` para `<select>`, `CampoTextarea` para `<textarea>`.
 * `children` é opcional e entra logo depois do controle — serve pra
 * `<datalist>` associada a um input com `list=`.
 */
type CascaProps = {
  label: string
  id: string
  /** Texto de ajuda neutro abaixo do campo. Escondido quando há `erro`. */
  dica?: string
  /** Mensagem de validação — substitui a dica e pinta o texto em crít. */
  erro?: string
  wrapperClassName?: string
  children?: ReactNode
}

function Casca({ label, id, dica, erro, wrapperClassName, children, controle }: CascaProps & { controle: ReactNode }) {
  return (
    <div className={wrapperClassName}>
      <label className={rot} htmlFor={id}>{label}</label>
      {controle}
      {children}
      {erro ? (
        <p className="apoio mt-1 text-crit">{erro}</p>
      ) : dica ? (
        <p className="apoio mt-1 text-dim">{dica}</p>
      ) : null}
    </div>
  )
}

export function Campo({
  label,
  id,
  dica,
  erro,
  wrapperClassName = "",
  className = "",
  children,
  ...props
}: CascaProps & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> & { className?: string }) {
  return (
    <Casca
      label={label} id={id} dica={dica} erro={erro} wrapperClassName={wrapperClassName}
      controle={<input id={id} className={`${classeCampo} ${className}`} {...props} />}
    >
      {children}
    </Casca>
  )
}

export function CampoSelect({
  label,
  id,
  dica,
  erro,
  wrapperClassName = "",
  className = "",
  children,
  ...props
}: CascaProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "className"> & { className?: string }) {
  return (
    <Casca
      label={label} id={id} dica={dica} erro={erro} wrapperClassName={wrapperClassName}
      controle={<select id={id} className={`${classeCampo} ${className}`} {...props}>{children}</select>}
    />
  )
}

export function CampoTextarea({
  label,
  id,
  dica,
  erro,
  wrapperClassName = "",
  className = "",
  children,
  ...props
}: CascaProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "className"> & { className?: string }) {
  return (
    <Casca
      label={label} id={id} dica={dica} erro={erro} wrapperClassName={wrapperClassName}
      controle={<textarea id={id} className={`${classeCampo} ${className}`} {...props} />}
    >
      {children}
    </Casca>
  )
}
