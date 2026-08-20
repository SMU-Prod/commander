import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { HeroiTecnico } from "@/components/ui/heroi-tecnico"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { CATEGORIAS_CASCO, ROTULO_CASCO } from "@/lib/domain/diario"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import { calcularSemaforo, formatarDataCurta, vencimentoPorData } from "@/lib/domain/semaforo"
import { ALVO_ACAO, PILULA_ACAO } from "@/lib/ui/acoes"

/**
 * ONDA 101 — O CASCO GANHOU TELA, e não foi só mudança de endereço.
 *
 * Na /barco o Casco eram seis linhas com contagem e um "Adicionar" — e NENHUMA
 * delas abria coisa alguma. Quem cadastrava um item de deck ou de fibra só o
 * reencontrava pelo Histórico ou pelo Diário: a área tinha permissão própria na
 * matriz (`casco`), tinha categoria própria no banco e não tinha porta. Este
 * hub é a porta, e é o card "Casco" da central técnica (spec §3).
 *
 * POR QUE A ANATOMIA DIVERGE DA GÊMEA `/barco/hidraulica`, que é o outro hub
 * por categoria: lá cada categoria ganha seção + painel + estado vazio, sempre.
 * São três categorias, então o custo do vazio é três blocos. O Casco tem SEIS,
 * e num barco novo as seis estão vazias — seriam seis estados vazios seguidos,
 * ~820px de moldura dizendo "nada aqui" seis vezes. É o retrato de "informação
 * solta" que a auditoria de 19/08 mediu na Início ("cada estado vazio isolado é
 * bom; cinco empilhados são o retrato de informação solta").
 *
 * Então: categoria COM item vira seção com os itens à vista; categoria SEM item
 * vira uma linha só, num painel único no fim, com o mesmo "Adicionar" de antes
 * — que é o convite explícito de cadastro, pré-preenchido com a categoria
 * (`?alvo=cat:`). Nada perdeu entrada; o vazio parou de ocupar seis blocos.
 *
 * Sem bloco de ocorrências abertas (que Hidráulica e Segurança têm): custaria
 * uma consulta e repetiria o defeito nº 3 da lista do dono — *"Documentos abre
 * listagem + alertas + upload + formulário completo ao mesmo tempo"*. A lista
 * de ocorrências tem tela e está no menu.
 */
export default async function CascoPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "casco")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui o casco.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "casco")
  const hoje = hojeISO()
  // O MESMO recorte que o card "Casco" da /barco conta — a porta não pode
  // discordar da sala no número.
  const itensDaCategoria = (c: string) => painel.itens.filter((i) => i.categoria === c)

  const comItens = CATEGORIAS_CASCO.filter((c) => itensDaCategoria(c).length > 0)
  const semItens = CATEGORIAS_CASCO.filter((c) => itensDaCategoria(c).length === 0)

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/barco"
        voltarRotulo="Barco"
        hub="casco"
        descricao="Deck, fibra, inox, vidros e estofados — o que vence por data e o app avisa antes."
        acao={editavel ? (
          // `alvo=cat:casco_outros` e não `/barco/itens/novo` pelado: "Outros"
          // é o balde do Casco, então o formulário abre já na área certa (a
          // pessoa troca no seletor se for deck ou inox) e — o que importa
          // mais — o "Voltar" dele sabe voltar PRA CÁ, porque o destino sai do
          // `alvo` (ver `itens/novo`). Sem isso, adicionar do cabeçalho deste
          // hub devolvia a pessoa na central técnica.
          <Link
            href={`/barco/itens/novo?alvo=${encodeURIComponent("cat:casco_outros")}`}
            className="inline-flex min-h-[var(--altura-controle)] shrink-0 items-center gap-1 rounded-[var(--raio-pilula)] bg-accent px-4 corpo font-semibold text-acao-texto"
          >
            <Icone nome="mais" className="size-4" /> Item
          </Link>
        ) : undefined}
      />

      {/* ONDA 105 — o objeto grande do topo, como nas oito imagens do guia.
          É ilustração técnica, não render 3D nem foto: ver o cabeçalho de
          `components/ui/heroi-tecnico.tsx` e o desvio de biblioteca de assets
          registrado em `docs/DESIGN-SYSTEM.md`. */}
      <HeroiTecnico chave="casco" className="mt-5 mb-4" />

      {comItens.map((c) => (
        <div key={c}>
          <SecaoPagina
            denso
            acao={editavel ? { href: `/barco/itens/novo?alvo=${encodeURIComponent(`cat:${c}`)}`, rotulo: "Adicionar", icone: "mais" } : undefined}
          >
            {ROTULO_CASCO[c]}
          </SecaoPagina>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {itensDaCategoria(c).map((i) => {
              const calc = itemMonitoradoToItemCalc(i)
              const r = calcularSemaforo(calc, null, hoje)
              const venc = vencimentoPorData(calc)
              const dias = r.diasRestantes != null
                ? r.diasRestantes < 0 ? `vencido há ${-r.diasRestantes} d` : `${r.diasRestantes} dias`
                : "—"
              return (
                <LinhaLista
                  key={i.id}
                  href={editavel ? `/barco/itens/${i.id}/editar` : undefined}
                  leading={<Farol status={r.status} />}
                  titulo={i.nome}
                  valor={`${dias}${venc ? ` · ${formatarDataCurta(venc)}` : ""}`}
                  valorClassName={r.status === "vencido" ? "text-crit" : r.status === "atencao" ? "text-warn" : "text-dim"}
                />
              )
            })}
          </div>
        </div>
      ))}

      {semItens.length > 0 && (
        <>
          <SecaoPagina denso icone="escudo">
            {comItens.length === 0 ? "Categorias do casco" : "Ainda sem item"}
          </SecaoPagina>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {semItens.map((c) => (
              <LinhaLista
                key={c}
                // Anel vazio, nunca farol: categoria sem item é "não sei", e
                // verde por omissão é o que a onda 93 arrancou desta tela.
                leading={<span className="size-2 rounded-[var(--raio-pilula)] border border-line" />}
                titulo={ROTULO_CASCO[c]}
                trailing={editavel ? (
                  // Pílula de contorno e não texto: seis "Adicionar" dourados
                  // de uma vez estouravam o orçamento de cor da tela, e texto
                  // pelado é o que o dono chamou de "clicável que parece texto
                  // comum" (onda 82). Alvo 44px por fora, desenho 30px por
                  // dentro — `lib/ui/acoes.ts`.
                  <Link href={`/barco/itens/novo?alvo=${encodeURIComponent(`cat:${c}`)}`} className={ALVO_ACAO}>
                    <span className={PILULA_ACAO}>Adicionar</span>
                  </Link>
                ) : undefined}
              />
            ))}
          </div>
        </>
      )}
    </main>
  )
}
