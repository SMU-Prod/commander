import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Icone } from "@/components/icone"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { HeroiTecnico } from "@/components/ui/heroi-tecnico"
import { NumerosDoHub } from "@/components/ui/numeros-do-hub"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { abaDoEquipamento } from "@/lib/domain/diario"
import { calcularSemaforo, PESO, type StatusFarol } from "@/lib/domain/semaforo"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { Contato } from "@/lib/db/types"

/** Sem acento, minúsculo — "Elétrica"/"eletricista"/"ELETRICISTA" batem todos em "eletric". */
const semAcento = (s: string) =>
  s.toLowerCase()
    .replace(/[áàâã]/g, "a").replace(/[éèê]/g, "e").replace(/[íì]/g, "i")
    .replace(/[óòôõ]/g, "o").replace(/[úù]/g, "u").replace(/ç/g, "c")

export default async function EletricaPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "eletrica")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui a elétrica.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "eletrica")
  const hoje = hojeISO()
  // Só o que a matriz de permissões governa como "eletrica" (onda 32:
  // `abaDoEquipamento`). Antes era `tipo !== "motor"`, que arrastava os
  // equipamentos "outro" pra cá — e esses passaram a pertencer à área
  // Equipamentos, com RLS própria: quem só tinha Elétrica via na tela um
  // colete salva-vidas que o banco não deixava editar.
  const equipamentos = painel.equipamentos.filter((e) => abaDoEquipamento(e.tipo) === "eletrica")

  const podeVerContatos = podeVer(painel.permissoes, "contatos")
  let contatosEletrica: Contato[] = []
  if (podeVerContatos) {
    const supabase = await supabaseServer()
    const { data } = await supabase.from("contatos")
      .select("*").eq("embarcacao_id", painel.embarcacao.id).order("nome")
    contatosEletrica = ((data ?? []) as Contato[])
      .filter((c) => c.especialidade != null && semAcento(c.especialidade).includes("eletric"))
  }

  const statusDe = (eqId: string): StatusFarol =>
    painel.itens
      .filter((i) => i.equipamento_id === eqId)
      .map((i) => {
        const eq = painel.equipamentos.find((e) => e.id === eqId)
        return calcularSemaforo(itemMonitoradoToItemCalc(i), eq?.horas_atuais ?? null, hoje).status
      })
      .sort((a, b) => PESO[b] - PESO[a])[0] ?? "ok"

  // ONDA 109 — os números da trinca. `statusDe` já existe e é a régua desta
  // tela; aqui o recorte é por ITEM e não por equipamento, porque "Atenção" tem
  // que contar o que vence, não quantas máquinas existem.
  const itensDaArea = painel.itens.filter((i) => equipamentos.some((e) => e.id === i.equipamento_id))
  const pedemAtencao = itensDaArea.filter((i) => {
    const eq = equipamentos.find((e) => e.id === i.equipamento_id)
    return calcularSemaforo(itemMonitoradoToItemCalc(i), eq?.horas_atuais ?? null, hoje).status !== "ok"
  }).length

  const rotuloTipo: Record<string, string> = {
    gerador: "Gerador", bateria: "Baterias", painel: "Painel de bordo",
  }

  return (
    <main>
      {/* ONDA 104 (§8 do Guia) — passa a usar o cabeçalho padrão. O que se
          ganha, além da identidade do hub: o "Voltar" desenhado à mão aqui
          media 16px de alvo, menos da metade do piso da casa, e o componente
          entrega os 44px sem empurrar o título meia tela pra baixo. */}
      <CabecalhoDetalhe
        voltarHref="/barco"
        voltarRotulo="Barco"
        hub="eletrica"
        descricao="Gerador, baterias e painel de bordo."
        acao={editavel ? (
          <Link
            href="/barco/equipamento/novo?tipo=gerador"
            className="inline-flex min-h-[var(--altura-controle)] shrink-0 items-center gap-1 rounded-[var(--raio-pilula)] bg-accent px-4 corpo font-semibold text-acao-texto"
          >
            <Icone nome="mais" className="size-4" /> Equipamento
          </Link>
        ) : undefined}
      />

      {/* ONDA 105 — o objeto grande do topo, como nas oito imagens do guia.
          É ilustração técnica, não render 3D nem foto: ver o cabeçalho de
          `components/ui/heroi-tecnico.tsx` e o desvio de biblioteca de assets
          registrado em `docs/DESIGN-SYSTEM.md`. */}
      <HeroiTecnico chave="eletrica" className="mt-5 mb-4" />

      {/* ONDA 109 — a trinca da imagem 3. O universo aqui é EQUIPAMENTO (é o
          que a tela lista), e os itens dele entram como segunda coluna. */}
      <NumerosDoHub
        chave="eletrica"
        className="mb-4"
        numeros={[
          { rotulo: "Equipamentos", valor: String(equipamentos.length), icone: "raio" },
          { rotulo: "Manutenções", valor: String(itensDaArea.length), icone: "relogio" },
          {
            rotulo: "Atenção",
            valor: String(pedemAtencao),
            icone: "alerta",
            estado: pedemAtencao > 0 ? "atencao" : undefined,
          },
        ]}
      />

      <div className="sombra-1 mt-6 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
        {equipamentos.length === 0 && (
          <div className="py-6 text-center">
            <Icone nome="raio" className="mx-auto size-7 text-dim" />
            <p className="corpo mt-2 font-medium">Nada cadastrado ainda</p>
            <p className="apoio mt-1 text-dim">
              Cadastre o gerador e as baterias para o app avisar das manutenções deles também.
            </p>
          </div>
        )}
        {equipamentos.map((e) => {
          const itens = painel.itens.filter((i) => i.equipamento_id === e.id)
          return (
            <Link key={e.id} href={`/barco/equipamento/${e.id}`}
              className="flex items-center gap-3 border-b border-line py-3.5 last:border-0">
              <Farol status={statusDe(e.id)} />
              <div className="min-w-0 flex-1">
                <p className="titulo-card">
                  {rotuloTipo[e.tipo] ?? "Equipamento"}
                  {e.posicao ? ` ${e.posicao}` : ""}
                  {e.quantidade != null ? ` · ${e.quantidade}×` : ""}
                </p>
                <p className="apoio mt-0.5 text-dim">
                  {[e.marca, e.modelo].filter(Boolean).join(" ") || "Sem marca informada"}
                  {e.horas_atuais != null ? ` · ${e.horas_atuais.toLocaleString("pt-BR")} h` : ""}
                  {` · ${itens.length} ${itens.length === 1 ? "item" : "itens"}`}
                </p>
              </div>
              <Icone nome="chevron" className="size-4 text-dim" />
            </Link>
          )
        })}
      </div>

      {podeVerContatos && (
        <>
          {/* ONDA 92 (achado 5.2) — era um `SecaoPagina` reescrito à mão, com
              a ação em texto dourado de 14px: um dos seis vestidos de "ação
              secundária" que a auditoria mediu, e justamente o vestido que a
              onda 82 baniu (texto pelado não diz "aqui se toca"; quem diz é a
              forma). Passa a ser o componente, com a pílula de contorno e o
              alvo de 44px que ele já garante nas outras ~35 telas. */}
          <SecaoPagina
            icone="pessoas"
            acao={{ href: "/barco/contatos", rotulo: "Cadastrar contato", icone: "mais" }}
          >
            Suporte e peças
          </SecaoPagina>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {contatosEletrica.length === 0 && (
              <p className="corpo py-4 text-dim">
                Nenhum contato de elétrica cadastrado ainda. Salve o eletricista de confiança para
                achar rápido na próxima vez.
              </p>
            )}
            {contatosEletrica.map((c) => (
              <div key={c.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="titulo-card">{c.nome}</p>
                  <p className="apoio mt-0.5 text-dim">
                    {[c.especialidade, c.telefone].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {c.telefone && (
                  <a href={`https://wa.me/55${c.telefone.replace(/\D/g, "")}`} target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-[var(--raio-controle)] border border-ok/40 px-2.5 py-1.5 text-xs text-ok">
                    WhatsApp
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
