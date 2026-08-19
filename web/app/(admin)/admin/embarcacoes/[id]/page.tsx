import { notFound } from "next/navigation"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { GradeRotuloValor } from "@/components/ui/grade-rotulo-valor"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
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
      <CabecalhoDetalhe
        voltarHref="/admin/usuarios"
        voltarRotulo="Usuários"
        titulo={e.nome}
        descricao={`Cadastro da embarcação, somente leitura. Cadastrada em ${formatarData(e.created_at)}.`}
      />

      <SecaoPagina className="mt-8">Dados gerais</SecaoPagina>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        {/* O `<dl>` à mão daqui era a mesma anatomia que a ficha de
            equipamento já tinha extraído para `GradeRotuloValor` — inclusive
            o travessão de campo sem dado. Trocar traz junto o `.rotulo-dado`
            (caixa de frase), que é a voz que a referência usa para legenda de
            valor dentro de cartão. */}
        <GradeRotuloValor itens={CAMPOS} />
      </div>

      <SecaoPagina className="mt-8">Quem tem acesso</SecaoPagina>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
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
