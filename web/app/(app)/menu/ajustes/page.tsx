import { AtivarAlertas } from "@/components/ativar-alertas"
import { ThemeToggle } from "@/components/theme-toggle"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { sair } from "@/lib/acoes/auth"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * AJUSTES (onda 58, tarefa 3) — a casa nova de tudo que é configuração; o
 * Menu hoje mistura isso com destinos do produto, e a tarefa 4 esvazia o
 * Menu depois que esta tela existir. Os blocos abaixo foram MOVIDOS de
 * `menu/page.tsx` como estavam, não reescritos — por um commit as duas
 * telas mostram as mesmas linhas (Conta, Aparência), e está certo assim.
 *
 * `AtivarAlertas` vinha de Avisos (onda 58, tarefa 2 tirou de lá); esta é a
 * primeira vez que ela é renderizada de novo, agora com casa fixa.
 */
export default async function AjustesPage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/menu" voltarRotulo="Menu" titulo="Ajustes" />

      <SecaoPagina icone="pessoas">Conta</SecaoPagina>
      <LinhaLista
        href="/menu/perfil"
        variant="cartao"
        titulo={user?.email ?? "—"}
        subtitulo="Proprietário"
      />
      <LinhaLista
        href="/menu/assinatura"
        variant="cartao"
        className="mt-2"
        titulo="Assinatura"
      />

      <SecaoPagina icone="imagem">Aparência</SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4 py-3.5">
        <ThemeToggle />
        <p className="apoio mt-2 text-dim">
          O modo claro é o padrão — feito para leitura sob sol forte na marina.
        </p>
      </div>

      <SecaoPagina icone="alerta">Avisos no aparelho</SecaoPagina>
      <p className="apoio -mt-1 mb-2 text-dim">
        A ativação vale só para este aparelho — troque de celular ou navegador e precisa ativar de novo.
      </p>
      <AtivarAlertas />

      <SecaoPagina icone="embarcacao">Embarcações</SecaoPagina>
      <LinhaLista
        href="/onboarding"
        variant="cartao"
        titulo="Cadastrar outra embarcação"
        subtitulo="Troque entre elas pelo nome no topo da tela Início"
      />

      <SecaoPagina icone="documento">Legal</SecaoPagina>
      <LinhaLista href="/termos" variant="cartao" titulo="Termos de Uso" />
      <LinhaLista href="/privacidade" variant="cartao" className="mt-2" titulo="Política de Privacidade" />

      <form action={sair} className="mt-8">
        <button className="w-full rounded-xl border border-crit/40 py-3 text-sm font-semibold text-crit">
          Sair da conta
        </button>
      </form>
    </main>
  )
}
