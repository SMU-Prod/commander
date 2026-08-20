import { Avatar } from "@/components/avatar"
import { AjustesNavegacao } from "@/components/ajustes-navegacao"
import { AtivarAlertas } from "@/components/ativar-alertas"
import { ThemeToggle } from "@/components/theme-toggle"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { ALVO_ACAO, PILULA_ACAO } from "@/lib/ui/acoes"
import { sair } from "@/lib/acoes/auth"
import { meusPapeisAdmin } from "@/lib/admin"
import { carregarNivelPlano, carregarPainel } from "@/lib/consultas"
import { carregarMeuPerfilConsultor } from "@/lib/consultas-gold"
import { ehAdminQualquer, resumoPapeis } from "@/lib/domain/admin-papeis"
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
 * "Sair da conta" como a porta discreta do fim e o rodapé de versão com a
 * ressalva de honestidade que o CONTRIBUTING.md exige em toda superfície de
 * navegação. (O "texto vermelho" que esta linha descrevia até a onda 88 virou
 * pílula de contorno — o porquê está no comentário do próprio botão.)
 */
export default async function AjustesPage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  // Pelo papel de verdade, não por suposição: o Menu antigo escrevia
  // "Proprietário" fixo e um comandante lia o rótulo errado na própria
  // conta. `carregarPainel` tem cache() — não custa segunda ida ao banco.
  //
  // ONDA 102 — `meusPapeisAdmin` e `carregarMeuPerfilConsultor` MUDARAM DE
  // TELA e chegam aqui EM PARALELO, não em fila. As duas perguntam sobre a
  // pessoa e não sobre o barco: nenhuma lê um campo de `painel`, então
  // esperá-lo seria pagar uma volta de rede (~150 ms) por nada — é o mesmo
  // diagnóstico que `carregarPainel` tem escrito em `lib/consultas.ts`, e que
  // o Menu aplicou na onda 101. Elas vinham de lá justamente porque o Menu é
  // atravessado pelo app inteiro e Ajustes não: as portas de Admin e do
  // consultor Gold descrevem um papel DA PESSOA, e agora só custam consulta
  // quando alguém abre a própria conta.
  const [painel, papeisAdmin, meuConsultor] = await Promise.all([
    carregarPainel(),
    meusPapeisAdmin(),
    carregarMeuPerfilConsultor(),
  ])
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
      {/* ONDA 102 — "Minha conta" e não "Ajustes": é o sexto item do §2.1, e a
          tela deixou de ser só configuração quando recebeu os outros acessos
          da pessoa. O endereço continua `/menu/ajustes` de propósito — link
          salvo, conversa antiga e URL indexada não valem uma rota nova. */}
      <CabecalhoDetalhe voltarHref="/menu" voltarRotulo="Menu" titulo="Minha conta" />

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
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4 py-3">
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
      {/* ONDA 102 — COTISTAS MUDOU DE CASA, E O MOTIVO É TÉCNICO ANTES DE SER
          de arrumação. `/cotistas` é a tela que GRAVA `embarcacoes.cotas_total`
          (`lib/acoes/cotistas.ts`) — e `cotas_total > 0` é exatamente o sinal
          que acende a Operação da frota no Menu (`veOperacaoDaFrota`, em
          `lib/domain/enterprise.ts`). Se esta linha morasse lá, atrás daquele
          recorte, ela dependeria do sinal que ela própria liga: o dono nunca
          conseguiria configurar a primeira cota. Porta que se tranca por
          dentro.
          Em Ajustes ela é o que de fato é — configuração da embarcação, ao
          lado do cadastro de outra —, e de quebra some do menu do proprietário
          particular, que é a primeira reclamação da spec ("um proprietário
          comum vê Cotistas"). Só pro PROP: quem define quantas cotas a unidade
          tem é o dono dela.
          Moradia ÚNICA (o teste do gate cobra): por isso "Cotistas" NÃO
          reaparece na Operação da frota do Menu, mesmo o §2.4 listando-a lá. */}
      {painel?.papel === "PROP" && (
        <LinhaLista
          href="/cotistas"
          variant="cartao"
          className="mt-2"
          titulo="Cotas da embarcação"
          subtitulo={
            painel.embarcacao.cotas_total > 0
              ? `${painel.embarcacao.cotas_total} cotas · vagas, convite e suspensão de acesso`
              : "Opere esta embarcação em cotas, com vagas e link de convite"
          }
        />
      )}

      {/* OS OUTROS ACESSOS DESTA PESSOA (spec 19/08, §2 — o quarto aplicativo
          sai do menu normal).
          As três linhas abaixo descrevem um PAPEL NA PLATAFORMA, não uma área
          do barco: administrar o Commander, avaliar embarcações pelo Gold,
          manter o perfil de um estabelecimento. Estavam no Menu, entre as
          áreas do produto, e o dono leu isso como vazamento — *"um
          proprietário comum vê... até Admin Commander. Isso não deveria
          aparecer para ele."*
          Aqui elas continuam descobríveis por quem TEM o papel, e some do
          índice do produto pra quem não tem. A decisão de acesso continua
          sendo do servidor (`exigirAdmin` no layout de `(admin)`, RLS por
          papel); isto é só descoberta.
          Admin e consultor só existem pra quem tem o papel — anunciar a porta
          é meio caminho pra alguém tentar a maçaneta, e mostrar a todo mundo
          levaria a maioria a uma tela de "não encontramos seu cadastro", que é
          o beco que a onda 54 caçou. Parceiro fica visível pra todos porque
          ali a ausência de cadastro é o começo do fluxo, não um beco. */}
      <SecaoPagina icone="ancora">Outros acessos</SecaoPagina>
      <LinhaLista
        href="/parceiro"
        variant="cartao"
        titulo="Painel do parceiro"
        subtitulo="É marina, posto, pousada, restaurante ou loja náutica? Apareça no mapa."
      />
      {meuConsultor !== null && (
        <LinhaLista
          href="/consultor"
          variant="cartao"
          className="mt-2"
          titulo="Minha agenda de avaliações"
          subtitulo="Commander Gold — visitas marcadas e o Protocolo de cada embarcação"
        />
      )}
      {ehAdminQualquer(papeisAdmin) && (
        <LinhaLista
          href="/admin"
          variant="cartao"
          className="mt-2"
          titulo="Admin Commander"
          subtitulo={`Você entrou como ${resumoPapeis(papeisAdmin)}`}
        />
      )}

      <SecaoPagina icone="documento">Legal</SecaoPagina>
      <LinhaLista href="/termos" variant="cartao" titulo="Termos de Uso" />
      <LinhaLista href="/privacidade" variant="cartao" className="mt-2" titulo="Política de Privacidade" />

      {/* A nota antiga aqui dizia "texto vermelho, não botão emoldurado
          (canvas)" — a intenção estava certa (sair é a porta discreta do fim,
          não a ação principal da tela) e o meio ficou errado quando a onda 82
          chegou: DISCRETO deixou de significar "sem forma" e passou a
          significar "pílula de contorno". Texto vermelho de 14px é o vestido
          que o app usa pra MENSAGEM DE ERRO; usá-lo num alvo faz a mesma
          tinta dizer duas coisas. A pílula de contorno é discreta sem ser
          invisível, e não é o "botão emoldurado" que o canvas recusou —
          esse é o dourado cheio, que continua fora daqui. */}
      <form action={sair} className="mt-6">
        <button className={ALVO_ACAO}>
          <span className={PILULA_ACAO}>Sair da conta</span>
        </button>
      </form>

      {/* O rodapé do canvas: versão real (package.json) + a ressalva que o
          CONTRIBUTING.md exige em toda superfície de navegação.
          `.rotulo-dado` no lugar de `text-xs`: mesmo piso de 11px, agora
          pela escala em vez de um tamanho avulso. */}
      <p className="rotulo-dado mt-3 font-mono-instr leading-relaxed text-dim">
        Commander {pacote.version} · não é auxílio à navegação
      </p>
    </main>
  )
}
