import { Avatar } from "@/components/avatar"
import { AjustesNavegacao } from "@/components/ajustes-navegacao"
import { AtivarAlertas } from "@/components/ativar-alertas"
import { ThemeToggle } from "@/components/theme-toggle"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { sair } from "@/lib/acoes/auth"
import { carregarNivelPlano, carregarPainel } from "@/lib/consultas"
import { ehPago } from "@/lib/domain/plano-acesso"
import { PLANOS } from "@/lib/domain/planos"
import { supabaseServer } from "@/lib/supabase/server"
import pacote from "@/package.json"
import { TETO_FORMULARIO } from "@/lib/ui/superficies"

/**
 * AJUSTES (onda 58) — a casa de tudo que é configuração. O Menu virou o
 * índice do produto (spec de arquitetura §4) e só aponta pra cá por uma
 * linha no fim; Conta, Assinatura, Aparência, avisos do aparelho, cadastro
 * de embarcação, Legal e Sair moram AQUI, e em nenhum outro lugar.
 *
 * ONDA 62 (canvas tela-1j) — a fatia desenha o cartão de perfil e o bloco da
 * assinatura no Menu; o spec da onda 58 fixa que isso é ajuste e mora aqui.
 * A ANATOMIA veio da fatia: o cartão de pessoa (avatar + nome + papel ·
 * embarcação), a assinatura com a borda dourada SÓ quando é plano pago (o
 * único bloco de borda dourada do app — pertencimento à marca, não ação),
 * "Sair da conta" como texto vermelho e o rodapé de versão com a ressalva
 * de honestidade que o CONTRIBUTING.md exige em toda superfície de
 * navegação.
 */
export default async function AjustesPage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  // Pelo papel de verdade, não por suposição: o Menu antigo escrevia
  // "Proprietário" fixo e um comandante lia o rótulo errado na própria
  // conta. `carregarPainel` tem cache() — não custa segunda ida ao banco.
  const painel = await carregarPainel()
  const rotuloPapel = painel?.papel === "CMDT" ? "Comandante" : "Proprietário"

  // O nome de quem está logado (canvas: "Erick Monteiro") — do perfil, com o
  // e-mail de reserva quando o cadastro ainda não tem nome.
  const { data: perfil } = user
    ? await supabase.from("profiles").select("nome, avatar_path").eq("id", user.id).maybeSingle()
    : { data: null }
  const nome = perfil?.nome?.trim() || user?.email || "—"
  const urlAvatar = perfil?.avatar_path
    ? (await supabase.storage.from("acervo").createSignedUrl(perfil.avatar_path, 3600)).data?.signedUrl ?? null
    : null

  const nivel = await carregarNivelPlano()
  const plano = PLANOS[nivel]

  return (
    <main className={TETO_FORMULARIO}>
      <CabecalhoDetalhe voltarHref="/menu" voltarRotulo="Menu" titulo="Ajustes" />

      <SecaoPagina icone="pessoas">Conta</SecaoPagina>
      {/* O cartão de perfil do canvas: avatar, nome, papel · embarcação. */}
      <LinhaLista
        href="/menu/perfil"
        variant="cartao"
        leading={<Avatar url={urlAvatar} nome={nome} />}
        titulo={nome}
        subtitulo={painel ? `${rotuloPapel} · ${painel.embarcacao.nome}` : rotuloPapel}
      />
      {/* A borda dourada é SÓ do plano pago (canvas tela-1j: "o único bloco
          com borda dourada do app é o Gold — pertencimento à marca, não
          ação"). No Free a linha é comum: nada a celebrar. */}
      <LinhaLista
        href="/menu/assinatura"
        variant="cartao"
        className={ehPago(nivel) ? "mt-2 !border-accent/35" : "mt-2"}
        titulo="Assinatura"
        subtitulo={plano.rotulo}
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

      {/* Onda 80 — consentimentos de corredores/sondagem colaborativa e a
          URL do Signal K, que até aqui viviam em cima do mapa em
          /navegar (ver o comentário grande em AjustesNavegacao). Âncora
          `id="navegacao"` porque o painel de sondagem em /navegar linka
          pra cá quando a coleta está desligada por falta de consentimento. */}
      <SecaoPagina icone="mapa" id="navegacao" className="scroll-mt-4">Navegação</SecaoPagina>
      <AjustesNavegacao />

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

      {/* Texto vermelho, não botão emoldurado (canvas): sair não é a ação
          principal da tela — é a porta discreta do fim. `min-h-11` mantém o
          alvo de toque da régua. */}
      <form action={sair} className="mt-6">
        <button className="flex min-h-11 items-center text-sm font-medium text-crit">
          Sair da conta
        </button>
      </form>

      {/* O rodapé do canvas: versão real (package.json) + a ressalva que o
          CONTRIBUTING.md exige em toda superfície de navegação. */}
      <p className="mt-3 font-mono-instr text-[11px] leading-relaxed text-dim">
        Commander {pacote.version} · não é auxílio à navegação
      </p>
    </main>
  )
}
