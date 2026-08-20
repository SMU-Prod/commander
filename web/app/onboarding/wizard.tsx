"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { GuardaFormulario } from "@/components/guarda-formulario"
import { Icone } from "@/components/icone"
import { Logo } from "@/components/logo"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { Campo, CampoSelect } from "@/components/ui/campo"
import { concluirOnboarding } from "@/lib/acoes/onboarding"
import { ROTULO_TIPO_EMBARCACAO, TIPOS_EMBARCACAO } from "@/lib/domain/tipo-embarcacao"
import { TOQUE, TOQUE_AMPLO } from "@/lib/ui/acoes"
import { linhaCampos, rot } from "@/lib/ui/form"

/**
 * ONBOARDING EM WIZARD (onda 62) — canvas tela-3j, agora com a decisão de
 * produto tomada: o dono aprovou o cadastro em QUATRO PASSOS, um assunto por
 * passo, com barra de progresso e o contador "N de 4" do canvas.
 *
 * Os quatro assuntos são os campos que a tela de página única já tinha,
 * redistribuídos — nenhum campo novo além do Tipo (chips do canvas, enum
 * `tipo_embarcacao` da migration 056) e NENHUMA validação nova: só o nome
 * continua obrigatório, exatamente como antes. Este é o primeiro contato do
 * pagante com o app — endurecer formulário aqui espantaria quem acabou de
 * assinar.
 *
 * POR QUE UM `<form>` SÓ COM SEÇÕES `hidden`, e não um form por passo:
 *   · o submit final é a MESMA action `concluirOnboarding` de sempre, que
 *     espera todos os campos juntos num FormData — seções ocultas por
 *     `hidden` continuam dentro do form e continuam enviando;
 *   · "voltar entre passos preserva o digitado" sai de graça: os inputs
 *     nunca desmontam, só saem de cena;
 *   · a `GuardaFormulario` continua funcionando inteira (restaura após
 *     `?erro=`, avisa ao sair com rascunho) porque o form é um só.
 *
 * O canvas não desenha botão de voltar (lá o passo 1 é a criação da conta,
 * que aqui já aconteceu no /login) — mas beco sem saída é proibido (§24),
 * então os passos 2–4 têm "Voltar" no topo, no mesmo lugar do link "Menu".
 */

const TOTAL_PASSOS = 4

/** Título, conversa de abertura e o gancho "Depois: …" de cada passo — o
 *  canvas pede que "cada campo diga o que ele destrava", então cada texto
 *  aponta o que o app FAZ com o dado, sem prometer nada que não existe. */
const PASSOS: { titulo: string; sub: string; teaser: string | null }[] = [
  {
    titulo: "Qual é a sua embarcação?",
    sub: "Só o nome é obrigatório. O resto você completa quando quiser — e a Saúde só liga quando houver dado real.",
    teaser: "onde ela fica",
  },
  {
    titulo: "Onde ela fica",
    sub: "Marina, garagem náutica, píer — o lugar onde o barco passa a semana.",
    teaser: "motores e horímetro",
  },
  {
    titulo: "Motores e horímetro",
    sub: "As horas de hoje viram o ponto de partida da revisão e da troca de óleo.",
    teaser: "vencimentos críticos",
  },
  {
    titulo: "Vencimentos críticos",
    sub: "Com as datas, seguro e TIE entram no radar de vencimentos — o app avisa antes do prazo.",
    teaser: null,
  },
]

export function WizardOnboarding({ jaTemBarco, erro }: { jaTemBarco: boolean; erro: string | null }) {
  const [passo, setPasso] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  const tituloRef = useRef<HTMLHeadingElement>(null)
  const montou = useRef(false)

  // Passo novo = tela nova: volta pro topo e leva o foco pro título, pra
  // leitor de tela anunciar onde a pessoa está (o DOM inteiro continua lá,
  // só trocou o que está visível).
  useEffect(() => {
    if (!montou.current) {
      montou.current = true
      return
    }
    window.scrollTo({ top: 0 })
    tituloRef.current?.focus()
  }, [passo])

  const avancar = () => {
    // A única validação que o wizard conhece é a que a página já tinha: nome
    // obrigatório. `reportValidity` usa o balão nativo do navegador — sem
    // inventar um quarto padrão de erro.
    if (passo === 0) {
      const nome = formRef.current?.elements.namedItem("nome")
      if (nome instanceof HTMLInputElement && !nome.reportValidity()) return
    }
    setPasso((p) => Math.min(p + 1, TOTAL_PASSOS - 1))
  }

  // Enter num campo de texto sem isto dispararia a "implicit submission" do
  // form — que nos passos 1–3 significaria ENVIAR o cadastro pela metade.
  // Enter passa a fazer o que o botão da tela faz: continuar.
  const aoTeclar = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== "Enter" || passo === TOTAL_PASSOS - 1) return
    if (e.target instanceof HTMLInputElement) {
      e.preventDefault()
      avancar()
    }
  }

  const { titulo, sub, teaser } = PASSOS[passo]

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-5 py-8">
      {/* Saída do topo: no passo 1, o "Menu" de quem já tem barco (quem não
          tem ainda não tem pra onde ir); nos demais, o Voltar do wizard. */}
      <div className="mb-4 min-h-11">
        {passo > 0 ? (
          <button
            type="button"
            onClick={() => setPasso((p) => Math.max(p - 1, 0))}
            className={`rotulo inline-flex h-11 items-center gap-1 text-accent-forte ${TOQUE}`}
          >
            <Icone nome="voltar" className="size-4" /> Voltar
          </button>
        ) : jaTemBarco ? (
          <Link href="/menu" className={`rotulo inline-flex h-11 items-center gap-1 text-accent-forte ${TOQUE}`}>
            <Icone nome="voltar" className="size-4" /> Menu
          </Link>
        ) : null}
      </div>

      {/* Canvas tela-3j: a marca abre a tela — no cadastro não há barra
          inferior nem pra onde navegar, o wordmark é o que diz onde a pessoa
          está — e o contador "N de 4" fica na mesma linha, em mono. */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs">
          <Logo />
        </div>
        <span className="tabular-nums text-xs tabular-nums text-dim">
          {passo + 1} de {TOTAL_PASSOS}
        </span>
      </div>

      {/* A barra de progresso do canvas: um segmento por passo, preenchido
          até o passo atual. Decorativa — quem informa é o "N de 4" acima. */}
      <div aria-hidden="true" className="mt-3.5 flex gap-1.5">
        {PASSOS.map((p, i) => (
          <span
            key={p.titulo}
            className={`h-[3px] flex-1 rounded-[var(--raio-pilula)] ${i <= passo ? "bg-accent" : "bg-line"}`}
          />
        ))}
      </div>

      <h1 ref={tituloRef} tabIndex={-1} className="titulo-pagina mt-7 outline-none">
        {passo === 0 && jaTemBarco ? "Cadastrar outra embarcação" : titulo}
      </h1>
      <p className="corpo mt-2 text-dim">
        {passo === 0 && jaTemBarco
          ? "Ela vira a embarcação ativa — você troca a qualquer momento pelo nome no topo da tela Início."
          : sub}
      </p>
      {erro && <p className="mt-4 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      <form ref={formRef} action={concluirOnboarding} onKeyDown={aoTeclar} className="mt-6 flex flex-1 flex-col">
        {/* O erro de limite do plano volta com `?erro=` e antes apagava tudo
            que a pessoa digitou — no PRIMEIRO contato com o app. A guarda
            restaura (PRD §24, mesma peça dos outros formulários) — inclusive
            os chips de Tipo, que são radios com nome. */}
        <GuardaFormulario chave="onboarding" />

        {/* PASSO 1 — o barco. Seções ocultas ficam no DOM (`hidden`), então
            todo campo continua entrando no FormData do submit final. */}
        <section hidden={passo !== 0} className="space-y-3">
          <Campo label="Nome" id="nome" name="nome" required />
          <div className={linhaCampos}>
            <Campo label="Estaleiro" id="estaleiro" name="estaleiro" />
            <Campo label="Modelo" id="modelo" name="modelo" />
          </div>
          <div className={linhaCampos}>
            <Campo label="Ano" id="ano" name="ano" inputMode="numeric" />
          </div>
          {/* Os chips do canvas: Lancha, Veleiro, Iate, Bote — radios de
              verdade (restauráveis pela guarda, focáveis por teclado), no
              alvo de 44px da régua do app. Opcional como todo o resto. */}
          <fieldset>
            <legend className={rot}>Tipo</legend>
            <div className="flex flex-wrap gap-2">
              {TIPOS_EMBARCACAO.map((t) => (
                <label
                  key={t}
                  className={`flex h-11 cursor-pointer items-center rounded-[var(--raio-pilula)] border border-line px-4 text-sm text-dim has-[:checked]:border-accent has-[:checked]:font-semibold has-[:checked]:text-accent-forte has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/50 ${TOQUE}`}
                >
                  <input type="radio" name="tipo" value={t} className="sr-only" />
                  {ROTULO_TIPO_EMBARCACAO[t]}
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        {/* PASSO 2 — onde ela fica. "Um assunto por passo" (canvas): o lugar
            ganhou o passo dele em vez de dividir tela com o resto. */}
        <section hidden={passo !== 1} className="space-y-3">
          {/* A nota é a versão honesta da do canvas: aqui só o NOME é
              gravado — quem liga o boletim é a posição, marcada depois no
              mapa. */}
          <Campo
            label="Onde ela fica"
            id="marina"
            name="marina"
            placeholder="Ex.: Marina Verolme, Angra dos Reis"
            dica="Depois você marca a posição no mapa — é ela que liga o boletim de onda, vento e água na sua Início."
          />
        </section>

        {/* PASSO 3 — motores e horímetro ("Depois: motores e horímetro",
            literal do canvas). Mesmos campos de sempre. */}
        <section hidden={passo !== 2} className="space-y-3">
          <CampoSelect label="Quantos motores?" id="qtd_motores" name="qtd_motores" defaultValue="2">
            <option value="1">1 motor</option>
            <option value="2">2 motores (BB e BE)</option>
          </CampoSelect>
          <div className={linhaCampos}>
            <Campo label="Marca" id="motor_marca" name="motor_marca" />
            <Campo label="Modelo" id="motor_modelo" name="motor_modelo" />
          </div>
          <div className={linhaCampos}>
            <Campo label="Horas BB (ou único)" id="horas_bb" name="horas_bb" inputMode="decimal" />
            <Campo label="Horas BE" id="horas_be" name="horas_be" inputMode="decimal" />
          </div>
        </section>

        {/* PASSO 4 — vencimentos críticos, e o submit de verdade. */}
        <section hidden={passo !== 3} className={linhaCampos}>
          <Campo label="Seguro vence em" id="seguro_validade" name="seguro_validade" type="date" />
          <Campo label="TIE vence em" id="tie_validade" name="tie_validade" type="date" />
        </section>

        {/* Rodapé do canvas: UMA ação principal por tela, e embaixo dela o
            gancho do que vem depois. `mt-auto` cola no pé como na fatia.

            DOIS botões FIXOS alternados por `hidden` — nunca um ternário que
            troca o MESMO nó de "Continuar" pra submit. Com o ternário, o
            clique de Continuar no passo 3 avançava o estado, o React trocava
            o type do nó AINDA DENTRO do evento, e a ação padrão do clique
            virava SUBMIT — o barco era criado sem a pessoa ver o último
            passo (aconteceu de verdade na prova visual: três embarcações
            fantasmas em produção antes do conserto). */}
        <div className="mt-auto space-y-3 pt-8">
          <button
            type="button"
            hidden={passo === TOTAL_PASSOS - 1}
            onClick={avancar}
            className={`h-12 w-full rounded-[var(--raio-controle)] bg-accent text-base font-semibold text-acao-texto ${TOQUE_AMPLO}`}
          >
            Continuar
          </button>
          {/* O submit vira `BotaoEnviar` — o `hidden` sobe para um invólucro
              porque a prop não existe no componente, e a alternância continua
              entre DOIS NÓS FIXOS, que é o que o comentário acima protege: um
              `<button>` e um `<div><button>`, nunca o mesmo nó trocando de
              `type` dentro do evento de clique.
              Vale o incômodo: era exatamente aqui que o duplo-toque criava a
              embarcação duas vezes, e a prova visual já pegou três barcos
              fantasmas em produção por outro caminho. */}
          <div hidden={passo !== TOTAL_PASSOS - 1}>
            <BotaoEnviar
              rotulo={jaTemBarco ? "Cadastrar embarcação" : "Criar meu painel de bordo"}
              larguraCheia
            />
          </div>
          {teaser && <p className="apoio text-center text-dim">Depois: {teaser}</p>}
        </div>
      </form>
    </main>
  )
}
