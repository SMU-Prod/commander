import { Icone, type NomeIcone } from "@/components/icone"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { exigirAdmin } from "@/lib/admin"
import { carregarFontesDashboard } from "@/lib/consultas-admin"
import { grupoVazio, montarDashboard, type Metrica } from "@/lib/domain/admin-metricas"
import {
  podeAcessar,
  resumoPapeis,
  temPapelAdmin,
  type AreaAdmin,
  type PapelAdmin,
} from "@/lib/domain/admin-papeis"

/**
 * Admin Commander — porta de entrada (PRD §21) + Dashboard CEO (§21.1).
 *
 * Duas coisas na mesma tela porque são a mesma pergunta feita por pessoas
 * diferentes: "o que eu vim fazer aqui?". Pro CEO isso é o painel executivo;
 * pro Suporte é a lista de áreas dele. Quem não é CEO não vê métrica
 * executiva nenhuma — o §21 reserva "métricas executivas" à conta-mãe.
 *
 * Sobre os números: onde a fonte não existe, a tela DIZ que não existe em vez
 * de mostrar zero. Ver o cabeçalho de `lib/domain/admin-metricas.ts` — zero é
 * uma medição, "não existe" é a ausência dela, e confundir os dois num painel
 * executivo é o jeito mais fácil de tomar decisão errada com cara de dado.
 */
export default async function AdminHomePage() {
  const papeis = await exigirAdmin()
  const ehCeoAqui = podeAcessar(papeis, "dashboard")

  return (
    <main>
      <p className="rotulo text-dim">Admin Commander</p>
      <h1 className="titulo-pagina mt-1">{ehCeoAqui ? "Dashboard" : "Painel"}</h1>
      <p className="apoio mt-1 text-dim">Você entrou como {resumoPapeis(papeis)}.</p>

      <Atalhos papeis={papeis} />

      {ehCeoAqui && <PainelCeo />}
    </main>
  )
}

async function PainelCeo() {
  const grupos = montarDashboard(await carregarFontesDashboard())
  return (
    <>
      <SecaoPagina className="mt-8">Métricas executivas</SecaoPagina>
      {grupos.map((g) => (
        <section key={g.titulo} className="mt-4 first:mt-0">
          <p className="corpo mb-2 font-medium">{g.titulo}</p>
          {grupoVazio(g) ? (
            // Um grupo inteiro sem fonte vira UMA frase, não cinco cartões
            // repetindo a mesma explicação — o painel fica legível e a
            // ausência continua explícita.
            <div className="sombra-1 rounded-[var(--raio-cartao)] border border-dashed border-line bg-panel px-4 py-3">
              <p className="apoio text-dim">{g.metricas[0]?.detalhe ?? "Ainda não há dado para esta seção."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {g.metricas.map((m) => (
                <Cartao key={m.rotulo} metrica={m} />
              ))}
            </div>
          )}
        </section>
      ))}
    </>
  )
}

function Cartao({ metrica }: { metrica: Metrica }) {
  if (metrica.valor == null) {
    return (
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-dashed border-line bg-panel p-3">
        <p className="rotulo text-dim">{metrica.rotulo}</p>
        <p className="apoio mt-1 text-dim">{metrica.detalhe}</p>
      </div>
    )
  }
  return (
    <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3">
      <p className="rotulo text-dim">{metrica.rotulo}</p>
      {/* ONDA 87 — O DEGRAU SE ESCOLHE PELO PAPEL DO NÚMERO, NÃO PELO TAMANHO
          QUE ELE TINHA. `text-xl` são 18px, e 18px não é degrau nenhum da
          escala: é o tamanho que sobrou quando ninguém tinha declarado a voz do
          número. Este aqui é o número de um cartão de KPI, e a escala tem
          exatamente um degrau pra isso — `.valor-forte`, 20px (globals.css).
          `font-semibold` continua escrito no elemento porque a regra de
          especificidade zero só SUGERE peso 500, e o cartão de métrica já era
          600; `tabular-nums` sai porque a classe traz o alinhamento de dígito
          junto — mantê-lo à mão seria repetir o que o degrau já garante. */}
      <p className="font-mono-instr valor-forte mt-1 font-semibold">{metrica.valor}</p>
      {metrica.apoio && <p className="apoio mt-0.5 text-dim">{metrica.apoio}</p>}
    </div>
  )
}

const ATALHOS: { area: AreaAdmin; href: string; titulo: string; apoio: string; icone: NomeIcone }[] = [
  { area: "administradores", href: "/admin/administradores", titulo: "Administradores", apoio: "Conceder, editar e suspender funções", icone: "pessoas" },
  { area: "usuarios", href: "/admin/usuarios", titulo: "Usuários e embarcações", apoio: "Buscar pessoa, ver plano, status e barcos", icone: "pessoas" },
  { area: "parceiros", href: "/admin/parceiros", titulo: "Partners", apoio: "Carteira, plano e suspensão do perfil", icone: "ancora" },
  { area: "publicidade", href: "/admin/publicidade", titulo: "Publicidade e destaques", apoio: "Preços, campanhas, impressões e cliques", icone: "grafico" },
  { area: "taxonomia", href: "/admin/taxonomia", titulo: "Conteúdo padronizado", apoio: "Categorias, marcas, regiões e funções", icone: "guardado" },
  { area: "gold", href: "/admin/gold", titulo: "Commander Gold", apoio: "Solicitações, agenda e avaliações", icone: "selo" },
  { area: "gold_precos", href: "/admin/gold/precos", titulo: "Preços do Gold", apoio: "Tabela por porte da embarcação", icone: "cifrao" },
  { area: "marketplace", href: "/admin/marketplace", titulo: "Marketplace", apoio: "Pedidos, propostas e negócios", icone: "marketplace" },
  { area: "avaliacoes", href: "/admin/avaliacoes", titulo: "Avaliações contestadas", apoio: "Manter no ar ou ocultar por violação", icone: "estrela" },
  { area: "logs", href: "/admin/logs", titulo: "Logs administrativos", apoio: "Quem fez o quê e quando", icone: "documento" },
]

/**
 * ONDA 95 — AS DUAS TELAS QUE FECHAM TABELAS WRITE-ONLY (auditoria 19/08, A18).
 *
 * `connect_interesses` e `sondagens` recebiam escrita e ninguém lia. As telas
 * novas entram no índice pelo MESMO motivo que as de cima: rota sem link é
 * área que ninguém acha, e `lib/ui/menu-destinos.test.ts` reprova a rota
 * ilhada — foi assim que `/parceiro` e `/consultor` sumiram do produto.
 *
 * POR QUE UMA LISTA SEPARADA, e não mais duas linhas em `ATALHOS`: aquela
 * lista é indexada por `AreaAdmin`, o tipo que a matriz `ALCANCE` de
 * `lib/domain/admin-papeis.ts` usa pra decidir acesso por ÁREA. Estas duas
 * telas não são áreas novas do §21 — são leituras pontuais que se penduram em
 * papéis existentes (o interesse é sinal comercial, a sondagem é operação), e
 * cada página exige o mesmo papel com `exigirPapelAdmin`. Inventar duas áreas
 * pra elas mudaria a matriz de permissão do produto inteiro pra encaixar duas
 * telas — o rabo abanando o cachorro. Aqui a porta usa `temPapelAdmin`, que é
 * exatamente o que a página checa, então menu e barreira não podem divergir.
 */
const ATALHOS_POR_PAPEL: { papel: PapelAdmin; href: string; titulo: string; apoio: string; icone: NomeIcone }[] = [
  { papel: "comercial", href: "/admin/connect", titulo: "Interesse no Connect", apoio: "Fila de espera da triagem de compatibilidade", icone: "sinal" },
  { papel: "suporte", href: "/admin/sondagens", titulo: "Sondagem colaborativa", apoio: "Volume e cobertura da coleta de profundidade", icone: "sonar" },
]

function Atalhos({ papeis }: { papeis: PapelAdmin[] }) {
  // O menu é montado a partir da MESMA matriz testada que barra a rota
  // (`podeAcessar`) — mostrar um atalho que leva a um redirect seria mentir
  // duas vezes: sobre o acesso e sobre a existência da área.
  const visiveis = ATALHOS.filter((a) => podeAcessar(papeis, a.area))
  const porPapel = ATALHOS_POR_PAPEL.filter((a) => temPapelAdmin(papeis, a.papel))
  return (
    <div className="mt-6 space-y-2">
      {/* A porta de entrada do Admin era dez linhas de lista escritas à mão —
          e sem `active:`, ou seja, dez alvos que não davam retorno nenhum ao
          toque. `LinhaLista variant="cartao"` é a peça, e ela traz a
          confirmação junto. */}
      {visiveis.map((a) => (
        <LinhaLista
          key={a.href}
          variant="cartao"
          href={a.href}
          leading={<Icone nome={a.icone} className="size-5 shrink-0 text-accent-forte" />}
          titulo={a.titulo}
          subtitulo={a.apoio}
        />
      ))}
      {porPapel.map((a) => (
        <LinhaLista
          key={a.href}
          variant="cartao"
          href={a.href}
          leading={<Icone nome={a.icone} className="size-5 shrink-0 text-accent-forte" />}
          titulo={a.titulo}
          subtitulo={a.apoio}
        />
      ))}
    </div>
  )
}
