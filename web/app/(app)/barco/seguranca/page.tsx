import { redirect } from "next/navigation"
import { Farol, FarolOcorrencia } from "@/components/farol"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { HeroiTecnico } from "@/components/ui/heroi-tecnico"
import { AcaoDoHub, NumerosDoHub } from "@/components/ui/numeros-do-hub"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { CATEGORIA_SEGURANCA } from "@/lib/domain/diario"
import { ESTADOS_QUE_PESAM_NA_SAUDE, ROTULO_ESTADO } from "@/lib/domain/ocorrencias"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import { calcularSemaforo, formatarDataCurta, vencimentoPorData } from "@/lib/domain/semaforo"
import { supabaseServer } from "@/lib/supabase/server"
import type { Ocorrencia } from "@/lib/db/types"

export default async function SegurancaPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "seguranca")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui a segurança.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "seguranca")
  const hoje = hojeISO()
  const itens = painel.itens.filter((i) => i.categoria === CATEGORIA_SEGURANCA)

  const supabase = await supabaseServer()
  const { data: ocorrenciasBrutas } = await supabase.from("ocorrencias")
    .select("*").eq("embarcacao_id", painel.embarcacao.id).eq("aba", "seguranca")
    .in("estado", [...ESTADOS_QUE_PESAM_NA_SAUDE]).order("created_at", { ascending: false })
  const ocorrencias = (ocorrenciasBrutas ?? []) as Ocorrencia[]

  /**
   * ONDA 106 — A TRINCA DE NÚMEROS DA IMAGEM 3, e ela é literalmente esta:
   * o cartão de Segurança do guia mostra "Itens 24 · Em dia 22 · Atenção 2".
   *
   * A régua de quem entra na conta é `calcularSemaforo`, a MESMA da lista
   * abaixo — recontar por fora era como a faixa de Documentos e a frase de
   * resumo daquela tela chegaram a discordar (onda 92). E o mesmo `.map` já
   * roda na lista; aqui ele sobe para o topo do componente e a lista passa a
   * ler o resultado, então não há cálculo repetido.
   */
  const avaliados = itens.map((i) => ({
    item: i,
    r: calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje),
    venc: vencimentoPorData(itemMonitoradoToItemCalc(i)),
  }))
  const emDia = avaliados.filter((a) => a.r.status === "ok").length
  const pedemAtencao = avaliados.filter((a) => a.r.status !== "ok").length

  return (
    <main>
      {/* ONDA 104 (§8 do Guia) — cabeçalho padrão, com a identidade do hub. */}
      <CabecalhoDetalhe
        voltarHref="/barco"
        voltarRotulo="Barco"
        hub="seguranca"
        descricao="Colete, extintor, balsa e sinalização."
        /* ONDA 106 — A PÍLULA DOURADA DO CABEÇALHO SAIU. A ação desceu para o
           botão de largura cheia logo abaixo dos números, que é onde a imagem 3
           a desenha. Manter as duas seria a MESMA ação escrita duas vezes na
           mesma tela — e duas ações principais numa tela é o que o §6.2 do
           `docs/DESIGN.md` proíbe. */
      />

      {/* ONDA 105 — o objeto grande do topo, como nas oito imagens do guia.
          É ilustração técnica, não render 3D nem foto: ver o cabeçalho de
          `components/ui/heroi-tecnico.tsx` e o desvio de biblioteca de assets
          registrado em `docs/DESIGN-SYSTEM.md`. */}
      <HeroiTecnico chave="seguranca" className="mt-5 mb-4" />

      {/* Os três números da imagem 3. "Atenção" é o único que pode virar cor de
          ESTADO — e só quando é maior que zero: "Atenção 0" em âmbar diria o
          contrário do que o zero diz (ver `numeros-do-hub.tsx`). */}
      <NumerosDoHub
        chave="seguranca"
        className="mb-4"
        numeros={[
          { rotulo: "Itens", valor: String(itens.length), icone: "seguranca" },
          { rotulo: "Em dia", valor: String(emDia), icone: "check" },
          {
            rotulo: "Atenção",
            valor: String(pedemAtencao),
            icone: "alerta",
            estado: pedemAtencao > 0 ? "atencao" : undefined,
          },
        ]}
      />

      {editavel && (
        <AcaoDoHub
          chave="seguranca"
          href={`/barco/itens/novo?alvo=${encodeURIComponent(`cat:${CATEGORIA_SEGURANCA}`)}`}
          className="mb-6"
        >
          Cadastrar item
        </AcaoDoHub>
      )}

      {ocorrencias.length > 0 && (
        <>
          {/* ONDA 92 (achado 6.1) — rótulo único "Ver tudo", igual ao gêmeo
              desta seção em `/barco/hidraulica`. */}
          <SecaoPagina icone="alerta" acao={{ href: "/barco/ocorrencias?setor=seguranca", rotulo: "Ver tudo" }}>
            Ocorrências abertas
          </SecaoPagina>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {ocorrencias.map((o) => (
              <LinhaLista
                key={o.id}
                href={`/barco/ocorrencias/${o.id}`}
                leading={<FarolOcorrencia estado={o.estado} />}
                titulo={o.titulo}
                valor={ROTULO_ESTADO[o.estado]}
              />
            ))}
          </div>
        </>
      )}

      <SecaoPagina icone="seguranca">Itens de segurança</SecaoPagina>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
        {itens.length === 0 && (
          <EstadoVazio
            variant="linha"
            icone="seguranca"
            titulo="Nenhum item de segurança cadastrado ainda"
            descricao="Cadastre coletes, extintores e balsas — o semáforo avisa antes de vencer o teste ou a validade."
            /* ONDA 106 — SEM AÇÃO AQUI QUANDO O BOTÃO DO HUB EXISTE.
               `AcaoDoHub` fica duas peças acima com o MESMO destino; dois
               botões para a mesma coisa em 200px de tela é o que faz alguém
               parar pra decidir qual apertar. Para quem só VÊ, os dois somem
               juntos e sobra o texto, que continua explicando o vazio. */
          />
        )}
        {/* Lê o MESMO `avaliados` que alimenta a trinca lá em cima: se a lista
            recalculasse por conta própria, o "Em dia 22" e as linhas poderiam
            discordar num item de borda. */}
        {avaliados.map(({ item: i, r, venc }) => {
          const dias = r.diasRestantes != null
            ? r.diasRestantes < 0 ? `vencido há ${-r.diasRestantes} d` : `${r.diasRestantes} dias`
            : "—"
          return (
            <LinhaLista
              key={i.id}
              href={editavel ? `/barco/itens/${i.id}/editar` : undefined}
              leading={<Farol status={r.status} />}
              titulo={i.nome}
              subtitulo={i.quantidade ? `${i.quantidade}` : undefined}
              valor={`${dias}${venc ? ` · ${formatarDataCurta(venc)}` : ""}`}
              valorClassName={r.status === "vencido" ? "text-crit" : r.status === "atencao" ? "text-warn" : "text-dim"}
            />
          )
        })}
      </div>
    </main>
  )
}
