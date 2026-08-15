import { redirect } from "next/navigation"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarMapaTaxonomia, nomeDaRegiao, tituloDeDemanda } from "@/lib/consultas-marketplace"
import { carregarMeuPartner } from "@/lib/consultas-partner"
import { hojeISO } from "@/lib/domain/datas"
import { diasAteExpirar, ROTULO_STATUS_PROPOSTA } from "@/lib/domain/marketplace"
import {
  demandasParaPartner,
  recebeDemandas,
  ROTULO_MEU_PERFIL,
  ROTULO_TIPO_PARTNER,
  type AtividadeDeclarada,
} from "@/lib/domain/partner"
import { supabaseServer } from "@/lib/supabase/server"
import type { Demanda, Proposta } from "@/lib/db/types"

/**
 * MARKETPLACE DO PARTNER, POR TIPO (PRD §13.3, §13.4, §11.4).
 *
 * Esta tela NÃO é a `/marketplace` do proprietário. Lá a pessoa publica o que
 * precisa; aqui o parceiro vê o que pode atender. E o recorte é o do §13:
 * a Marina vê "apenas demandas de VAGAS", o Posto vê Solicitações de Caminhão
 * e "não precisa receber o Marketplace geral".
 *
 * O corte por tipo (`demandasParaPartner`) vem antes de qualquer preferência:
 * é limite de produto, não filtro que o parceiro possa afrouxar. Dentro do que
 * o tipo permite, o que decide é o cadastro dele — região e atividades —, como
 * o §11.4 manda ("Parceiro escolhe no cadastro suas regiões e áreas de
 * interesse/atuação").
 */
export default async function ParceiroMarketplacePage() {
  const meu = await carregarMeuPartner()
  if (!meu) redirect("/parceiro/perfil")

  const { parceiro, atividades, vagas } = meu
  const tipo = parceiro.categoria
  if (!recebeDemandas(tipo)) {
    // Restaurante e Pousada não têm esta aba no menu (§13.5/§13.6); quem
    // chegar por link antigo vai pro Início em vez de tomar 404.
    redirect("/parceiro")
  }

  const supabase = await supabaseServer()
  const hoje = hojeISO()
  const [mapaTaxonomia, { data: demandasBrutas, error }, { data: propostasBrutas }] = await Promise.all([
    carregarMapaTaxonomia(),
    supabase
      .from("demandas").select("*")
      .in("status", ["aberta", "em_negociacao"])
      .gte("expira_em", hoje)
      .order("criado_em", { ascending: false })
      .limit(100),
    supabase.from("propostas").select("*").eq("autor_id", parceiro.usuario_id)
      .order("criado_em", { ascending: false }),
  ])
  if (error) throw new Error("Não foi possível carregar o Marketplace. Recarregue a página.")

  const paraMatching = {
    categoria: tipo,
    tambem_vende_produtos: parceiro.tambem_vende_produtos,
    tambem_presta_servicos: parceiro.tambem_presta_servicos,
    regiao_id: parceiro.regiao_id,
    atividades: atividades.map((a): AtividadeDeclarada => ({ id: a.taxonomia_id, tipo: a.tipo })),
  }
  const todas = ((demandasBrutas as Demanda[] | null) ?? []).filter((d) => d.autor_id !== parceiro.usuario_id)
  const compativeis = demandasParaPartner(todas, paraMatching, vagas)
  const propostas = (propostasBrutas as Proposta[] | null) ?? []
  const demandaPorId = new Map(todas.map((d) => [d.id, d]))

  const eDoPosto = tipo === "posto"

  return (
    <main>
      <h1 className="titulo-pagina">{eDoPosto ? "Solicitações de caminhão" : "Marketplace"}</h1>
      <p className="apoio mt-1 text-dim">
        {ROTULO_TIPO_PARTNER[tipo]} em {nomeDaRegiao(mapaTaxonomia, parceiro.regiao_id)}.{" "}
        {tipo === "marina"
          ? "Você recebe apenas pedidos de vaga compatíveis com o que declarou."
          : eDoPosto
            ? "Você recebe apenas pedidos de abastecimento por caminhão."
            : "Você recebe os pedidos das atividades que declarou, na sua região."}
      </p>

      <SecaoPagina icone="marketplace">
        {eDoPosto ? "Pedidos abertos" : "Compatíveis com você"}
      </SecaoPagina>
      {compativeis.length === 0 ? (
        <EstadoVazio
          icone="marketplace"
          titulo="Nada compatível agora"
          descricao="Pedidos aparecem aqui quando um proprietário publica algo que bate com a sua região e as suas atividades."
          acao={{ href: "/parceiro/perfil", rotulo: `Ajustar ${ROTULO_MEU_PERFIL[tipo].toLowerCase()}` }}
        />
      ) : (
        <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
          {compativeis.map((d) => {
            const dias = diasAteExpirar(d.expira_em, hoje)
            const prazo = dias <= 0 ? "Vence hoje" : dias <= 3 ? `Vence em ${dias} dia${dias === 1 ? "" : "s"}` : null
            return (
              <LinhaLista
                key={d.id}
                href={`/marketplace/${d.id}`}
                titulo={tituloDeDemanda(mapaTaxonomia, d)}
                subtitulo={d.autor_nome || "Proprietário"}
                valor={prazo}
                valorClassName={prazo ? "text-warn" : ""}
              />
            )
          })}
        </div>
      )}

      <SecaoPagina icone="documento">Minhas propostas</SecaoPagina>
      {propostas.length === 0 ? (
        <EstadoVazio
          icone="documento"
          titulo="Você ainda não enviou nenhuma proposta"
          descricao="Abra um pedido acima e responda com disponibilidade, prazo e valor."
        />
      ) : (
        <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
          {propostas.map((pr) => {
            const d = demandaPorId.get(pr.demanda_id)
            return (
              <LinhaLista
                key={pr.id}
                href={`/marketplace/${pr.demanda_id}`}
                titulo={d ? tituloDeDemanda(mapaTaxonomia, d) : "Pedido encerrado"}
                subtitulo={ROTULO_STATUS_PROPOSTA[pr.status]}
              />
            )
          })}
        </div>
      )}
    </main>
  )
}
