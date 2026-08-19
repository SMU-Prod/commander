import { notFound, redirect } from "next/navigation"
import { aplicarPreset, removerCmdt, salvarMatriz } from "@/lib/acoes/vinculos"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarPainel } from "@/lib/consultas"
import {
  EXPLICACAO_MODO_APROVACAO,
  FUNCAO_PAPEL,
  MODOS_APROVACAO,
  ROTULO_MODO_APROVACAO,
  ROTULO_PAPEL,
  ehPapelEnterprise,
} from "@/lib/domain/enterprise"
import { normalizarPermissoes } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import { CampoSelect } from "@/components/ui/campo"
import { mudarModoAprovacao } from "./acoes"
import { MatrizDeAcesso } from "./matriz-acesso"
import type { Vinculo } from "@/lib/db/types"

export default async function MatrizPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string; salvo?: string }>
}) {
  const { id } = await params
  const { erro, salvo } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") redirect("/menu")

  const supabase = await supabaseServer()
  const [{ data: vinculo }, { data: perfil }] = await Promise.all([
    // ERA `.eq("papel", "CMDT")`, e era o ESPELHO do buraco que a onda 69b
    // fechou na lista: com os cinco papéis Enterprise no banco (migration
    // 059), um vínculo ADM/Operações/Mecânica/Cotista aparecia em
    // `/tripulacao` e caía em `notFound()` ao ser tocado. Ou seja: a única
    // tela do app onde se ajusta e se REVOGA acesso era inalcançável
    // justamente pros papéis que mais precisam dela.
    //
    // Trocar por `.neq("papel", "PROP")` NÃO afrouxa barreira nenhuma, e vale
    // deixar escrito quais são as barreiras, porque elas continuam onde
    // estavam: `painel.papel !== "PROP" → redirect("/menu")` acima (só o dono
    // abre esta tela) e `v.embarcacao_id !== painel.embarcacao.id →
    // notFound()` abaixo (o vínculo tem que ser da unidade aberta). Este
    // filtro nunca foi barreira — era recorte de LISTA, e recorte por lista
    // fechada precisa ser lembrado a cada papel novo. Excluir o dono, não.
    supabase.from("vinculos").select("*").eq("id", id).neq("papel", "PROP").maybeSingle(),
    supabase.from("vinculos").select("usuario_id").eq("id", id).maybeSingle()
      .then(async (r) => {
        if (!r.data) return { data: null }
        return supabase.from("profiles").select("nome").eq("id", r.data.usuario_id).maybeSingle()
      }),
  ])
  const v = vinculo as Vinculo | null
  if (!v || v.embarcacao_id !== painel.embarcacao.id) notFound()
  const permissoes = normalizarPermissoes(v.permissoes)
  const papel = v.papel
  // O fallback era "Comandante" cravado — a mesma mentira que a onda 69b tirou
  // do chip da lista, só que no TÍTULO da página: um cotista sem nome no
  // perfil virava "Comandante" no `<h1>`. Agora o que falta o nome mostra a
  // credencial que o banco realmente tem.
  const nome = (perfil as { nome: string } | null)?.nome || ROTULO_PAPEL[papel]

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/tripulacao"
        voltarRotulo="Tripulação"
        titulo={nome}
        // "o que este COMANDANTE vê e edita" descrevia uma tela que hoje
        // atende sete papéis. "Esta pessoa" serve os sete sem inventar o papel
        // de ninguém — e o papel de verdade está no cartão logo abaixo.
        descricao="Defina, área por área, o que esta pessoa vê e edita nesta embarcação."
      />
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}
      {/* `salvo=1` é o aviso genérico da matriz (`salvarMatriz`/`aplicarPreset`);
          qualquer outro valor é a frase que a própria action escreveu — a régua
          de aprovação devolve QUAL ficou valendo, e "Permissões salvas." em
          cima disso responderia por uma mudança que não foi a que aconteceu. */}
      {salvo && (
        <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-ok/40 bg-panel px-3 py-2">
          {salvo === "1" ? "Permissões salvas." : salvo}
        </p>
      )}

      {/* A CREDENCIAL, ANTES DA GRADE. Quem chega nesta tela precisa saber com
          quem está mexendo antes de mexer — e o papel sozinho ("Mecânica") não
          diz o que a pessoa faz. `FUNCAO_PAPEL` é a frase do §3 do PRD, a
          mesma fonte que o resumo do perfil usa: tela e convite descrevendo o
          mesmo perfil com as mesmas palavras. */}
      <div className="mt-4 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        <span className="rotulo inline-flex rounded-[var(--raio-pilula)] border border-line px-2 py-0.5 text-dim-chip">
          {ROTULO_PAPEL[papel]}
        </span>
        {ehPapelEnterprise(papel) && <p className="corpo mt-2">{FUNCAO_PAPEL[papel]}</p>}
        {/* A RÉGUA DE APROVAÇÃO (§3) APARECE SEMPRE AQUI, e na lista só quando
            NÃO é a padrão — as duas decisões são a mesma decisão vista de dois
            lugares. Na lista se VARRE gente, e chip em todo mundo some com a
            exceção, que é o que o ADM precisa achar. Aqui se olha UMA pessoa,
            e nesta tela "sem aprovação" não é ausência de informação: é a
            resposta pra "o que esta pessoa lança entra direto?".

            ERA SÓ LEITURA ATÉ 19/08/2026, e o comentário que ficava aqui dizia
            o porquê com todas as letras: nenhuma action do app gravava
            `modo_aprovacao`, e desenhar um seletor sem escritor seria um
            controle que mente. `mudarModoAprovacao` (em `./acoes`) é esse
            escritor — com a policy de UPDATE conferida no banco antes de
            existir, `.select()` conferindo linhas e rastro na auditoria. */}
        <form action={mudarModoAprovacao} className="mt-3 space-y-2">
          <input type="hidden" name="vinculo_id" value={v.id} />
          <CampoSelect
            label="Régua de aprovação"
            id="modo_aprovacao"
            name="modo_aprovacao"
            defaultValue={v.modo_aprovacao}
            // A explicação do modo ATUAL vira a dica do campo. O §3 é uma
            // regra de confiança, não um jargão: "Somente críticos" não
            // significa nada pra quem não leu o PRD, e quem administra a
            // equipe é quem menos pode ficar adivinhando. Cada opção repete a
            // sua no próprio rótulo, pra a escolha ser informada ANTES do
            // toque e não depois.
            dica={EXPLICACAO_MODO_APROVACAO[v.modo_aprovacao]}
          >
            {MODOS_APROVACAO.map((m) => (
              <option key={m} value={m}>
                {ROTULO_MODO_APROVACAO[m]} — {EXPLICACAO_MODO_APROVACAO[m]}
              </option>
            ))}
          </CampoSelect>
          {/* `BotaoEnviar` e não uma pílula: é submit de formulário, e o que
              o componente soma é o aviso de envio (rótulo que troca, duplo
              toque bloqueado). Contorno porque a dourada desta tela é o
              "Salvar" da matriz — o orçamento de dois dourados por tela
              (DESIGN §5) não paga um terceiro. */}
          <BotaoEnviar
            rotulo="Salvar régua"
            rotuloEnviando="Salvando…"
            variante="contorno"
            larguraCheia
          />
        </form>
      </div>

      <SecaoPagina>Perfil e áreas</SecaoPagina>
      <form action={salvarMatriz}>
        <input type="hidden" name="vinculo_id" value={v.id} />
        {/* Filho do `<form>`, e é obrigatório que seja: quem grava é
            `salvarMatriz` lendo as caixas, e o `BotaoEnviar` lá dentro precisa
            do `<form>` ANCESTRAL pro `useFormStatus` enxergar o envio. */}
        <MatrizDeAcesso permissoesIniciais={permissoes} />
      </form>

      {/* OS DOIS ATALHOS DO COMMANDER INDIVIDUAL, e por que eles continuam
          separados do seletor de perfil acima: estes gravam NO TOQUE, porque
          `aplicarPreset` é uma action própria que escreve a matriz e o `nivel`
          ("completo"/"operacional") de uma vez. O seletor Enterprise não pode
          fazer isso — a action não conhece os cinco papéis —, então ele marca
          as caixas e deixa a gravação com o botão da grade. Juntar os dois num
          controle só faria metade das opções salvar sozinha e a outra metade
          não, que é a pior coisa que um controle pode fazer.

          `larguraCheia` porque cada um divide a linha ao meio. */}
      <SecaoPagina>Atalhos que gravam na hora</SecaoPagina>
      <div className="flex gap-2">
        <form action={aplicarPreset} className="flex-1">
          <input type="hidden" name="vinculo_id" value={v.id} />
          <input type="hidden" name="preset" value="operacional" />
          <BotaoEnviar rotulo="Aplicar Operacional" variante="contorno" larguraCheia />
        </form>
        <form action={aplicarPreset} className="flex-1">
          <input type="hidden" name="vinculo_id" value={v.id} />
          <input type="hidden" name="preset" value="completo" />
          <BotaoEnviar rotulo="Aplicar Completo" variante="contorno" larguraCheia />
        </form>
      </div>

      <form action={removerCmdt} className="mt-6">
        <input type="hidden" name="vinculo_id" value={v.id} />
        {/* O rótulo carrega a credencial REAL em vez de deixar "da tripulação"
            responder por sete papéis — remover um Cotista não é remover
            tripulante, e a tela não pode chamar as duas coisas pelo mesmo
            nome. O travessão separa o gesto da credencial justamente pra
            frase não virar "Remover Mecânica", que se leria como remover a
            área e não a pessoa.

            A altura sai de `--altura-controle` no lugar do `py-3` que dava
            exatamente 44px por soma: o alvo passa a estar declarado, e não a
            depender de ninguém mexer no tamanho da fonte deste botão. */}
        <button
          className="flex min-h-[var(--altura-controle)] w-full items-center justify-center rounded-[var(--raio-controle)] border border-crit/40 px-4 text-sm font-semibold text-crit"
        >
          Remover acesso — {ROTULO_PAPEL[papel]}
        </button>
      </form>
    </main>
  )
}
