import Link from "next/link"
import { Icone, type NomeIcone } from "@/components/icone"
import { exigirAdmin } from "@/lib/admin"
import { carregarFontesDashboard } from "@/lib/consultas-admin"
import { grupoVazio, montarDashboard, type Metrica } from "@/lib/domain/admin-metricas"
import { podeAcessar, resumoPapeis, type AreaAdmin, type PapelAdmin } from "@/lib/domain/admin-papeis"

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
      <p className="rotulo mt-8 mb-2 text-dim">Métricas executivas</p>
      {grupos.map((g) => (
        <section key={g.titulo} className="mt-4 first:mt-0">
          <p className="corpo mb-2 font-medium">{g.titulo}</p>
          {grupoVazio(g) ? (
            // Um grupo inteiro sem fonte vira UMA frase, não cinco cartões
            // repetindo a mesma explicação — o painel fica legível e a
            // ausência continua explícita.
            <div className="sombra-1 rounded-[14px] border border-dashed border-line bg-panel px-4 py-3">
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
      <div className="sombra-1 rounded-[14px] border border-dashed border-line bg-panel p-3">
        <p className="rotulo text-dim">{metrica.rotulo}</p>
        <p className="apoio mt-1 text-dim">{metrica.detalhe}</p>
      </div>
    )
  }
  return (
    <div className="sombra-1 rounded-[14px] border border-line bg-panel p-3">
      <p className="rotulo text-dim">{metrica.rotulo}</p>
      <p className="font-mono-instr mt-1 text-lg font-semibold tabular-nums">{metrica.valor}</p>
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

function Atalhos({ papeis }: { papeis: PapelAdmin[] }) {
  // O menu é montado a partir da MESMA matriz testada que barra a rota
  // (`podeAcessar`) — mostrar um atalho que leva a um redirect seria mentir
  // duas vezes: sobre o acesso e sobre a existência da área.
  const visiveis = ATALHOS.filter((a) => podeAcessar(papeis, a.area))
  return (
    <div className="mt-5 space-y-2">
      {visiveis.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="sombra-1 flex items-center gap-3 rounded-[14px] border border-line bg-panel px-4 py-3"
        >
          <Icone nome={a.icone} className="size-5 shrink-0 text-accent-forte" />
          <span className="min-w-0 flex-1">
            <span className="corpo block font-medium">{a.titulo}</span>
            <span className="apoio block truncate text-dim">{a.apoio}</span>
          </span>
          <Icone nome="chevron" className="size-4 shrink-0 text-dim" />
        </Link>
      ))}
    </div>
  )
}
