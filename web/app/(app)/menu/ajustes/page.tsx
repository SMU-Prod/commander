import { AtivarAlertas } from "@/components/ativar-alertas"
import { ThemeToggle } from "@/components/theme-toggle"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { sair } from "@/lib/acoes/auth"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * AJUSTES (onda 58) — a casa de tudo que é configuração. O Menu virou o
 * índice do produto (spec de arquitetura §4) e só aponta pra cá por uma
 * linha no fim; Conta, Assinatura, Aparência, avisos do aparelho, cadastro
 * de embarcação, Legal e Sair moram AQUI, e em nenhum outro lugar.
 *
 * `AtivarAlertas` vinha de Avisos (onda 58, tarefa 2 tirou de lá); agora
 * tem casa fixa.
 */
export default async function AjustesPage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  // Pelo papel de verdade, não por suposição: o Menu antigo escrevia
  // "Proprietário" fixo e um comandante lia o rótulo errado na própria
  // conta. `carregarPainel` tem cache() — não custa segunda ida ao banco.
  const painel = await carregarPainel()
  const rotuloPapel = painel?.papel === "CMDT" ? "Comandante" : "Proprietário"

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/menu" voltarRotulo="Menu" titulo="Ajustes" />

      <SecaoPagina icone="pessoas">Conta</SecaoPagina>
      <LinhaLista
        href="/menu/perfil"
        variant="cartao"
        titulo={user?.email ?? "—"}
        subtitulo={rotuloPapel}
      />
      <LinhaLista
        href="/menu/assinatura"
        variant="cartao"
        className="mt-2"
        titulo="Assinatura"
      />

      <SecaoPagina icone="imagem">Aparência</SecaoPagina>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4 py-3.5">
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
