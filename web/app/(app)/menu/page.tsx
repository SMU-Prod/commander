import { Icone } from "@/components/icone"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { sair } from "@/lib/acoes/auth"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  const { erro } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  const painel = await carregarPainel()

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="titulo-pagina">Menu</h1>
        <Logo compacto />
      </div>
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

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
        leading={<Icone nome="cifrao" className="size-4 shrink-0 text-dim" />}
        titulo="Assinatura"
      />

      <SecaoPagina icone="embarcacao">Minhas embarcações</SecaoPagina>
      <LinhaLista
        href="/onboarding"
        variant="cartao"
        leading={<Icone nome="mais" className="size-4 shrink-0 text-dim" />}
        titulo="Cadastrar outra embarcação"
        subtitulo="Troque entre elas pelo nome no topo da tela Início"
      />
      <LinhaLista
        href="/barco/connect"
        variant="cartao"
        className="mt-2"
        leading={<Icone nome="sinal" className="size-4 shrink-0 text-dim" />}
        titulo="Commander Connect"
        subtitulo="Em breve — conectividade NMEA 2000"
      />

      <SecaoPagina icone="imagem">Aparência</SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4 py-3.5">
        <ThemeToggle />
        <p className="apoio mt-2 text-dim">
          O modo claro é o padrão — feito para leitura sob sol forte na marina.
        </p>
      </div>

      <SecaoPagina icone="alerta">Avisos</SecaoPagina>
      <LinhaLista
        href="/notificacoes"
        variant="cartao"
        titulo="Configurar avisos"
        subtitulo="Ative os avisos por aparelho e veja o histórico"
      />

      {painel?.papel === "PROP" && (
        <>
          <SecaoPagina icone="pessoas">Tripulação</SecaoPagina>
          <LinhaLista
            href="/menu/tripulacao"
            variant="cartao"
            titulo="Tripulação"
            subtitulo="Convide comandantes e ajuste as permissões"
          />
        </>
      )}

      {/* Onda 39 — segundo caminho até as 5 telas da rede profissional
          (RedeNav já cruza entre elas, mas o Menu é a lista de tudo que o
          app tem — gate de descoberta pede que nada fique só dependendo de
          um único link, ver CONTRIBUTING.md). */}
      <SecaoPagina icone="pessoas">Rede profissional</SecaoPagina>
      <LinhaLista href="/prestadores" variant="cartao" titulo="Prestadores" subtitulo="Mecânico, eletricista, fibra e outros profissionais" />
      <LinhaLista href="/servicos" variant="cartao" className="mt-2" titulo="Serviços" subtitulo="Encontre quem resolve um problema no barco" />
      <LinhaLista href="/oportunidades" variant="cartao" className="mt-2" titulo="Oportunidades" subtitulo="Publique uma vaga, diária ou peça — prestadores respondem" />
      <LinhaLista href="/explorar" variant="cartao" className="mt-2" titulo="Explorar" subtitulo="Mapa de marinas, postos, pousadas, restaurantes e lojas náuticas" />

      <SecaoPagina icone="ancora">Para estabelecimentos</SecaoPagina>
      <LinhaLista
        href="/parceiro"
        variant="cartao"
        titulo="É marina, posto, pousada, restaurante ou loja náutica?"
        subtitulo="Publique seu perfil e apareça no mapa de quem navega perto."
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
