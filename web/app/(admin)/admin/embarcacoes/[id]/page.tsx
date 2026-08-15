import Link from "next/link"
import { notFound } from "next/navigation"
import { Icone } from "@/components/icone"
import { LinhaLista } from "@/components/ui/linha-lista"
import { exigirAreaAdmin } from "@/lib/admin"
import { carregarFichaEmbarcacao } from "@/lib/consultas-suporte"
import { carregarMapaTaxonomia, nomeDe } from "@/lib/consultas-marketplace"

/**
 * Admin > Ficha da embarcação (PRD §21, escopo Suporte: "Usuários,
 * embarcações, planos/status").
 *
 * SÓ LEITURA, e só do CADASTRO. Nome, medidas, casco, TIE, capitania,
 * propulsão, base e quem tem acesso — que é o suficiente pra o atendimento
 * confirmar "é este barco mesmo?" e "quem consegue entrar nele?", as duas
 * perguntas que abrem um chamado sobre embarcação.
 *
 * NÃO tem formulário nenhum, e isso é uma decisão explícita: o dado técnico
 * do barco é do proprietário e da tripulação dele. Se o Suporte pudesse
 * corrigir horas de motor ou data de manutenção "pra ajudar", o histórico
 * deixaria de ser o que a tripulação registrou e viraria o que alguém do
 * time achou que devia estar lá — e o Commander Verified, que se apoia
 * nesse histórico, passaria a atestar dado de terceiro.
 *
 * A trava real não é a ausência de botão: motor, manutenção, documento,
 * diário, foto e financeiro não têm policy pro papel `suporte` no banco
 * (migration 053). Mesmo uma chamada direta à API volta vazia.
 */
export default async function AdminFichaEmbarcacaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await exigirAreaAdmin("usuarios")
  const { id } = await params

  const [ficha, mapa] = await Promise.all([carregarFichaEmbarcacao(id), carregarMapaTaxonomia()])
  if (!ficha) notFound()
  const e = ficha.embarcacao

  const CAMPOS: [string, string | null][] = [
    ["Estaleiro", e.estaleiro],
    ["Modelo", e.modelo],
    ["Ano", e.ano != null ? String(e.ano) : null],
    ["Comprimento", e.comprimento_m != null ? `${e.comprimento_m.toLocaleString("pt-BR")} m` : null],
    ["Boca", e.boca_m != null ? `${e.boca_m.toLocaleString("pt-BR")} m` : null],
    ["Calado", e.calado_m != null ? `${e.calado_m.toLocaleString("pt-BR")} m` : null],
    ["Material do casco", e.casco_material],
    ["Número do casco", e.casco_numero],
    ["TIE", e.tie],
    ["Capitania", e.capitania],
    ["Propulsão", e.propulsao],
    ["Marina / base", e.marina],
    ["Região", nomeDe(mapa, e.regiao_id)],
  ]

  return (
    <main>
      <Link href="/admin/usuarios" className="rotulo inline-flex items-center gap-1 text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Usuários
      </Link>
      <h1 className="titulo-pagina mt-3">{e.nome}</h1>
      <p className="apoio mt-1 text-dim">
        Cadastro da embarcação, somente leitura. Cadastrada em {formatarData(e.created_at)}.
      </p>

      <p className="rotulo mt-8 mb-2 text-dim">Dados gerais</p>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {CAMPOS.map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt className="rotulo text-dim">{rotulo}</dt>
              <dd className="corpo mt-0.5">{valor ?? <span className="text-dim">—</span>}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="rotulo mt-8 mb-2 text-dim">Quem tem acesso</p>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {ficha.acessos.map((a) => (
          <LinhaLista
            key={a.usuarioId}
            href={`/admin/usuarios/${a.usuarioId}`}
            leading={<Icone nome="pessoas" className="size-5 shrink-0 text-dim" />}
            titulo={a.nome}
            subtitulo={`${a.papel === "PROP" ? "Proprietário" : "Comandante / tripulação"} · desde ${formatarData(a.desde)}`}
          />
        ))}
      </div>

      <p className="apoio mt-6 text-dim">
        Motores, manutenções, documentos, ocorrências, fotos, Diário de Bordo e financeiro não aparecem aqui e
        não podem ser editados pelo Suporte — são dados do proprietário e da tripulação. A restrição está na
        permissão do banco, não só nesta tela.
      </p>
    </main>
  )
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}
