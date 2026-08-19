import { Logo } from "@/components/logo"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { meusPapeisAdmin } from "@/lib/admin"
import { carregarPainel } from "@/lib/consultas"
import { carregarMeuPerfilConsultor } from "@/lib/consultas-gold"
import { resumoPapeis } from "@/lib/domain/admin-papeis"
import { podeVerAgenda } from "@/lib/domain/agenda"
import { hojeISO } from "@/lib/domain/datas"
import { abaDoEquipamento } from "@/lib/domain/diario"
import { formatarReais, resumoGastos } from "@/lib/domain/gastos"
import { podeVer } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { ReactNode } from "react"

/**
 * MENU = O ÍNDICE DO PRODUTO (onda 58, spec de arquitetura §4).
 *
 * O dono olhou esta tela e disse "o menu mais parece configurações do que
 * menu" — e leu certo: metade das linhas ERA configuração (Conta, Assinatura,
 * Aparência, avisos do aparelho, Legal, Sair). Tudo isso mudou de casa para
 * `/menu/ajustes`; o que fica aqui são só DESTINOS — áreas do produto,
 * agrupadas pela vida do barco (o barco · dinheiro · gente · rede), não por
 * tecnologia. O PRD §9 chama o Menu de *gate de descoberta*: é onde se
 * aprende que o app faz mais do que a barra de baixo mostra — por isso
 * Financeiro e Carteira aparecem aqui mesmo tendo caminho por /barco, e nada
 * pode depender de um link único (docs/CONTRIBUTING.md).
 *
 * ONDA 62 (canvas tela-1j): a ANATOMIA das linhas alinhou à fatia — cada
 * seção é UM painel com linhas separadas por borda (não um cartão solto por
 * linha), e o número que orienta decisão fica à DIREITA, em mono, colado no
 * chevron ("Tripulação · 3 ›"). A fatia também desenha o cartão de perfil e
 * o bloco Gold DENTRO do Menu — aqui o spec da onda 58 ganha: Conta e
 * Assinatura são ajuste e moram em /menu/ajustes; o Menu segue índice puro.
 *
 * ÍNDICE SEM INFORMAÇÃO É SUMÁRIO (spec §4.2): cada destino diz o que tem lá
 * dentro quando existe um número que orienta decisão. As consultas são
 * baratas (um `count`/`head` por seção, nunca N por linha) e NÃO acontecem
 * para área que a pessoa não pode ver: contar o que está bloqueado vazaria
 * pelo subtítulo o número que a tela de destino recusa mostrar.
 */

/** O painel de seção do canvas: uma borda pra lista inteira, linhas com
 *  `border-b` dentro (`LinhaLista` variant "grupo"). */
function PainelMenu({ children }: { children: ReactNode }) {
  return <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">{children}</div>
}

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  // `cache()` no `meusPapeisAdmin` — a mesma consulta que o layout de (admin)
  // faz; aqui não custa uma ida a mais ao banco.
  // As duas descobertas por papel saem juntas: papel administrativo e papel
  // de consultor do Gold. Uma consulta indexada cada, e as duas em paralelo
  // porque nenhuma depende da outra.
  const [papeisAdmin, meuConsultor] = await Promise.all([
    meusPapeisAdmin(),
    carregarMeuPerfilConsultor(),
  ])
  const ehConsultor = meuConsultor !== null

  // Equipamentos do hub (tipo "outro") já vêm inteiros em `painel.equipamentos`
  // — contar de novo no banco seria pagar duas vezes pela mesma resposta. O
  // filtro é o MESMO de /barco/equipamentos (`abaDoEquipamento`), senão o
  // número da porta discordaria do que a sala mostra.
  const equipamentosNoHub =
    painel != null && podeVer(painel.permissoes, "equipamentos")
      ? painel.equipamentos.filter((e) => abaDoEquipamento(e.tipo) === "equipamentos").length
      : 0

  let ocorrenciasAbertas = 0
  let totalMesCentavos = 0
  let comandantesComAcesso = 0
  if (painel != null) {
    const supabase = await supabaseServer()
    const hoje = hojeISO()
    const [{ count: abertas }, { data: despesasMes }, { count: comandantes }] = await Promise.all([
      // Só `estado = 'aberta'`: o subtítulo diz "abertas", então "em
      // acompanhamento" não entra — número e palavra têm que ser o mesmo fato.
      supabase
        .from("ocorrencias").select("id", { count: "exact", head: true })
        .eq("embarcacao_id", painel.embarcacao.id).eq("estado", "aberta"),
      // Mesmo recorte da Início (/hoje): despesas pagas de
      // `lancamentos_financeiros` — e a soma é a MESMA `resumoGastos` de
      // `lib/domain/gastos.ts`, nunca uma segunda fórmula. Aqui só o mês
      // corrente, porque o subtítulo não compara com o anterior.
      podeVer(painel.permissoes, "gastos")
        ? supabase
            .from("lancamentos_financeiros").select("data, valor_centavos")
            .eq("embarcacao_id", painel.embarcacao.id)
            .eq("tipo", "despesa").eq("status", "pago")
            .gte("data", `${hoje.slice(0, 7)}-01`)
        : Promise.resolve({ data: [] as { data: string; valor_centavos: number }[] }),
      // O "Tripulação · 3" do canvas — a MESMA contagem da seção
      // "Comandantes com acesso" de /tripulacao (vínculos CMDT), só que em
      // `head` (o número, não as linhas). Só pro PROP, que é quem vê a porta.
      painel.papel === "PROP"
        ? supabase
            .from("vinculos").select("id", { count: "exact", head: true })
            .eq("embarcacao_id", painel.embarcacao.id).eq("papel", "CMDT")
        : Promise.resolve({ count: 0 }),
    ])
    ocorrenciasAbertas = abertas ?? 0
    comandantesComAcesso = comandantes ?? 0
    totalMesCentavos = resumoGastos(
      (despesasMes ?? []).map((l) => ({ data: l.data, custoCentavos: l.valor_centavos, grupo: "" })),
      hoje,
    ).totalMesCentavos
  }

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="titulo-pagina">Menu</h1>
        <Logo compacto />
      </div>
      {/* Outras telas redirecionam pra cá com ?erro= — o toast fica. */}
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {/* Onda 56 — as linhas do Menu não têm ícone à ESQUERDA de propósito:
          a coluna de títulos alinha, o chevron da direita é a única marca de
          "isto navega", e o ícone significa uma coisa só: a seção. */}
      <SecaoPagina icone="embarcacao">O barco</SecaoPagina>
      <PainelMenu>
        {/* Onda 61 — o Mapa da Embarcação abre a seção: é a visão nova do
            barco físico ("ONDE fica?"), e o Menu é gate de descoberta (PRD
            §9) — /barco também leva lá, mas nada depende de link único. */}
        <LinhaLista
          href="/barco/mapa"
          titulo="Mapa da embarcação"
          subtitulo="O barco em corte — equipamentos, manutenções e ocorrências por zona"
        />
        <LinhaLista
          href="/barco/equipamentos"
          titulo="Equipamentos"
          subtitulo="Bote, guincho, ar-condicionado — o que você acompanha a bordo"
          valor={equipamentosNoHub > 0 ? String(equipamentosNoHub) : undefined}
        />
        <LinhaLista href="/barco/fotos" titulo="Fotos" subtitulo="Os álbuns do barco" />
        <LinhaLista
          href="/barco/documentos"
          titulo="Documentos"
          subtitulo="Validade e arquivos — o semáforo avisa antes de vencer"
        />
        <LinhaLista
          href="/barco/ocorrencias"
          titulo="Ocorrências"
          subtitulo="Problemas apontados no Diário ou registrados direto, por setor"
          valor={ocorrenciasAbertas > 0 ? `${ocorrenciasAbertas} ${ocorrenciasAbertas === 1 ? "aberta" : "abertas"}` : undefined}
        />
        {/* Saiu de "Minhas embarcações" (seção que acabou: cadastrar outra
            embarcação é ajuste e mora em /menu/ajustes): o Connect é área do
            barco, não ajuste. */}
        <LinhaLista
          href="/barco/connect"
          titulo="Commander Connect"
          subtitulo="Em breve — conectividade NMEA 2000"
        />
      </PainelMenu>

      {/* A porta segue a sala (onda 52, reafirmado no trilho da onda 57):
          Financeiro e Carteira só aparecem pra quem entra — /financeiro
          devolve o CMDT sem `gastos` com faixa de erro, e anunciar porta
          que o backend fecha era exatamente o defeito que a revisão da
          onda 58 apontou. `podeVer(null, ...)` é true — PROP vê tudo. */}
      {painel != null &&
        (podeVer(painel.permissoes, "gastos") ||
          painel.papel === "PROP" ||
          podeVer(painel.permissoes, "carteira")) && (
          <>
            <SecaoPagina icone="cifrao">Dinheiro</SecaoPagina>
            <PainelMenu>
              {podeVer(painel.permissoes, "gastos") && (
                <LinhaLista
                  href="/financeiro"
                  titulo="Financeiro"
                  subtitulo="Despesas, entradas, recorrentes e relatórios"
                  valor={totalMesCentavos > 0 ? formatarReais(totalMesCentavos) : undefined}
                  valorSecundario={totalMesCentavos > 0 ? "este mês" : undefined}
                />
              )}
              {/* Mesmo gate da própria /carteira: PROP sempre; CMDT só com a área. */}
              {(painel.papel === "PROP" || podeVer(painel.permissoes, "carteira")) && (
                <LinhaLista
                  href="/carteira"
                  titulo="Carteira da Tripulação"
                  subtitulo="Repasse, gasto e devolução — controle contábil, o app não movimenta dinheiro"
                />
              )}
            </PainelMenu>
          </>
        )}

      <SecaoPagina icone="pessoas">Gente</SecaoPagina>
      <PainelMenu>
        {painel?.papel === "PROP" && (
          <LinhaLista
            href="/tripulacao"
            titulo="Tripulação"
            subtitulo="Convide comandantes e ajuste as permissões"
            valor={comandantesComAcesso > 0 ? String(comandantesComAcesso) : undefined}
          />
        )}
        <LinhaLista
          href="/comandantes"
          titulo="Comandantes"
          subtitulo="Disponíveis para contratar direto pelo WhatsApp"
        />
        {/* Onda 78 — as portas do Enterprise. Cotistas é do dono (é ele quem
            define cota e link); Atualizações serve os dois lados, com a tela
            mudando de cara conforme o papel. */}
        {painel?.papel === "PROP" && (
          <LinhaLista
            href="/cotistas"
            titulo="Cotistas"
            subtitulo="Vagas, link de convite e suspensão de acesso"
          />
        )}
        <LinhaLista
          href="/atualizacoes"
          titulo="Atualizações"
          subtitulo={painel?.papel === "PROP"
            ? "O que os cotistas informaram, aguardando sua análise"
            : "Informe a administradora sobre o uso da unidade"}
        />
      </PainelMenu>

      {/* Onda 78 — Operação da frota (PRD Upgrade 3). Bloco próprio porque
          são ferramentas de EMPRESA, não do dono de um barco só: estoque e
          tanque pertencem à base e servem várias unidades. */}
      <SecaoPagina icone="ferramenta">Operação</SecaoPagina>
      <PainelMenu>
        <LinhaLista
          href="/patio"
          titulo="Pátio"
          subtitulo="Saída e retorno da unidade, com fotos e horímetro"
        />
        <LinhaLista
          href="/mecanica"
          titulo="Mecânica"
          subtitulo="Diagnóstico, conserto, orçamento e votação dos cotistas"
        />
        <LinhaLista
          href="/afazeres"
          titulo="Afazeres"
          subtitulo="O que a equipe combinou de fazer"
        />
        <LinhaLista
          href="/estoque"
          titulo="Estoque"
          subtitulo="Peças, óleo e consumíveis da base"
        />
        <LinhaLista
          href="/combustivel"
          titulo="Combustível"
          subtitulo="Tanque próprio, abastecimentos e balanço"
        />
        {podeVer(painel?.permissoes ?? null, "gastos") && (
          <LinhaLista
            href="/frota"
            titulo="Custo da frota"
            subtitulo="Quanto cada unidade custou para operar"
          />
        )}
      </PainelMenu>

      {/* Onda 39 — segundo caminho até as telas da rede profissional
          (RedeNav já cruza entre elas; gate de descoberta, ver
          docs/CONTRIBUTING.md). Agenda (onda 43, PRD §8) continua só pra quem
          pode ver: desde a onda 46 ela tem área PRÓPRIA na matriz
          (`AREA_AGENDA` em lib/domain/agenda.ts). */}
      <SecaoPagina icone="chat">Rede</SecaoPagina>
      <PainelMenu>
        <LinhaLista href="/prestadores" titulo="Prestadores" subtitulo="Encontre por especialidade quem resolve um problema no barco" />
        <LinhaLista href="/marketplace" titulo="Marketplace" subtitulo="Peça profissional, tripulação, peça, vaga ou caminhão — quem atende sua região responde" />
        <LinhaLista href="/explorar" titulo="Explorar" subtitulo="Mapa de marinas, postos, pousadas, restaurantes e lojas náuticas" />
        {painel != null && podeVerAgenda(painel.permissoes) && (
          <LinhaLista
            href="/agenda"
            titulo="Agenda"
            subtitulo="Marque saídas e compromissos e compartilhe com a tripulação"
          />
        )}
      </PainelMenu>

      <SecaoPagina icone="ancora">Para estabelecimentos</SecaoPagina>
      <PainelMenu>
        <LinhaLista
          href="/parceiro"
          titulo="É marina, posto, pousada, restaurante ou loja náutica?"
          subtitulo="Publique seu perfil e apareça no mapa de quem navega perto."
        />
      </PainelMenu>

      {/* Admin Commander (§21). Só aparece pra quem tem papel — pra todo mundo
          mais a seção nem existe, porque anunciar a porta é meio caminho pra
          alguém tentar a maçaneta. A decisão de acesso continua sendo do
          servidor (`exigirAdmin` no layout de `(admin)` + RLS por papel); isto
          aqui é só descoberta. */}
      {papeisAdmin.length > 0 && (
        <>
          <SecaoPagina icone="escudo">Commander (interno)</SecaoPagina>
          <PainelMenu>
            <LinhaLista
              href="/admin"
              titulo="Admin Commander"
              subtitulo={`Você entrou como ${resumoPapeis(papeisAdmin)}`}
            />
          </PainelMenu>
        </>
      )}

      {/* ONDA 88 / AUDITORIA 19/08 (achado C1) — A PORTA DO CONSULTOR.
          `/consultor` é a agenda de trabalho de quem faz a avaliação do
          Commander Gold: papel PAGO, externo, que precisa entrar todo dia — e
          passou três ondas sem UM link no app inteiro, alcançável só digitando
          a URL de cabeça. Os únicos apontamentos que existiam eram os
          `redirect` pós-ação do próprio fluxo, ou seja, só quem já estava lá
          dentro voltava pra lá.
          Mesma regra do bloco de admin logo acima, e pelo mesmo motivo: a
          seção só existe pra quem TEM o papel. Mostrar a todo mundo levaria a
          maioria a uma tela de "não encontramos seu cadastro" — um beco, que é
          justamente o que a onda 54 caçou. A decisão de acesso continua sendo
          do servidor; isto aqui é só descoberta. */}
      {ehConsultor && (
        <>
          <SecaoPagina icone="pessoas">Commander Gold</SecaoPagina>
          <PainelMenu>
            <LinhaLista
              href="/consultor"
              titulo="Minha agenda de avaliações"
              subtitulo="Visitas marcadas e o Protocolo de cada embarcação"
            />
          </PainelMenu>
        </>
      )}

      {/* A única linha que não é destino do produto — e por isso fica no fim,
          fora de seção: é a porta pra TUDO que saiu daqui (spec §4.2). */}
      <LinhaLista
        href="/menu/ajustes"
        variant="cartao"
        className="mt-6"
        titulo="Ajustes"
        subtitulo="Conta, assinatura, aparência e avisos do aparelho"
      />
    </main>
  )
}
