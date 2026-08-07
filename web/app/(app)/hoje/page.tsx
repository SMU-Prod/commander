import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { Farol } from "@/components/farol"
import { CardEmbarcacao } from "@/components/card-embarcacao"
import { Horimetro } from "@/components/horimetro"
import { Icone, type NomeIcone } from "@/components/icone"
import { calcularSemaforo, textoRestante, PESO } from "@/lib/domain/semaforo"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { nomeDoEquipamento } from "@/lib/domain/diario"
import { podeVer, podeEditar, type Aba } from "@/lib/domain/permissoes"
import { boletimDoMar } from "@/lib/mar"
import { supabaseServer } from "@/lib/supabase/server"

async function BoletimDoMar({ lat, lon }: { lat: number; lon: number }) {
  const boletim = await boletimDoMar(lat, lon)
  if (!boletim) {
    return (
      <div className="rounded-[14px] border border-line bg-panel p-4 corpo text-dim sombra-1">
        Boletim indisponível agora. Tente mais tarde.
      </div>
    )
  }
  return (
    <div className="rounded-[14px] border border-line bg-panel p-4 sombra-1">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono-instr text-sm tabular-nums">
        <span><span className="mr-1.5 text-[11px] uppercase tracking-[.12em] text-dim">Onda</span>{boletim.ondaM != null ? `${boletim.ondaM.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m` : "—"}</span>
        <span><span className="mr-1.5 text-[11px] uppercase tracking-[.12em] text-dim">Vento</span>{boletim.ventoKt != null ? `${Math.round(boletim.ventoKt)} kt` : "—"}</span>
        <span><span className="mr-1.5 text-[11px] uppercase tracking-[.12em] text-dim">Água</span>{boletim.aguaC != null ? `${Math.round(boletim.aguaC)} °C` : "—"}</span>
        <span className={`ml-auto rounded px-2 py-0.5 font-mono-instr text-[10.5px] uppercase tracking-[.1em] ${
          boletim.selo.nivel === "ok" ? "border border-ok/40 text-ok"
          : boletim.selo.nivel === "atencao" ? "border border-warn/40 text-warn"
          : "border border-crit/40 text-crit"
        }`}>{boletim.selo.rotulo}</span>
      </div>
    </div>
  )
}

export default async function HojePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const { embarcacao, equipamentos, itens, permissoes } = painel
  const hoje = hojeISO()

  const avaliados = itens
    .map((i) => {
      const eq = equipamentos.find((e) => e.id === i.equipamento_id)
      const r = calcularSemaforo(itemMonitoradoToItemCalc(i), eq?.horas_atuais ?? null, hoje)
      const onde = eq ? `${i.nome} — ${nomeDoEquipamento(eq)}` : i.nome
      return { item: i, r, onde }
    })
    .sort((a, b) => PESO[b.r.status] - PESO[a.r.status])

  const alertas = avaliados.filter((a) => a.r.status !== "ok")
  const contagem = {
    vencido: avaliados.filter((a) => a.r.status === "vencido").length,
    atencao: avaliados.filter((a) => a.r.status === "atencao").length,
    ok: avaliados.filter((a) => a.r.status === "ok").length,
  }
  const motores = equipamentos.filter((e) => e.tipo === "motor")

  const statusGeral = avaliados[0]?.r.status ?? "ok"
  const supabase = await supabaseServer()
  const urlCapa = embarcacao.foto_capa_path
    ? (await supabase.storage.from("acervo").createSignedUrl(embarcacao.foto_capa_path, 3600)).data?.signedUrl ?? null
    : null
  const { data: comandantes } = await supabase
    .from("perfis_comandante").select("usuario_id, nome_publico, categoria, disponibilidade")
    .eq("visivel", true).limit(2)

  return (
    <main>
      <CardEmbarcacao
        embarcacao={embarcacao}
        statusGeral={statusGeral}
        urlCapa={urlCapa}
        podeEditarFotos={podeEditar(permissoes, "fotos")}
      />
      <div className="mt-3 flex justify-end gap-2.5 font-mono-instr text-xs tabular-nums text-dim">
        <span className="flex items-center gap-1"><Farol status="vencido" />{contagem.vencido}</span>
        <span className="flex items-center gap-1"><Farol status="atencao" />{contagem.atencao}</span>
        <span className="flex items-center gap-1"><Farol status="ok" />{contagem.ok}</span>
      </div>

      {erro && (
        <p className="mt-4 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erro}</p>
      )}

      <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
        <Icone nome="alerta" className="size-3.5" />
        {alertas.length > 0 ? "Precisa de atenção" : "Tudo em dia"}
      </p>
      {alertas.length === 0 && (
        <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4 corpo text-dim">
          Nenhum vencimento na margem. Bom vento e mar calmo.
        </div>
      )}
      <div className="space-y-2">
        {alertas.map(({ item, r, onde }) => (
          <div key={item.id} className="sombra-1 flex items-center gap-3 rounded-[14px] border border-line bg-panel p-3.5">
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
              r.status === "vencido" ? "bg-crit/12 text-crit" : "bg-warn/12 text-warn"
            }`}>
              <Icone nome={item.equipamento_id ? "motor" : "documento"} className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="titulo-card truncate">{onde}</p>
              <p className="apoio mt-0.5 text-dim">{item.nome}</p>
            </div>
            <span className={`shrink-0 text-right font-mono-instr text-sm font-semibold tabular-nums ${
              r.status === "vencido" ? "text-crit" : "text-warn"
            }`}>
              {textoRestante(r)}
            </span>
          </div>
        ))}
      </div>

      <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
        <Icone nome="mapa" className="size-3.5" /> Mar agora
      </p>
      {embarcacao.marina_lat == null || embarcacao.marina_lon == null ? (
        <Link href="/barco/local" className="sombra-1 block rounded-[14px] border border-line bg-panel p-4">
          <p className="titulo-card">Ligue o boletim do mar</p>
          <p className="apoio mt-0.5 text-dim">Defina a posição da marina para ver onda, vento e água aqui.</p>
        </Link>
      ) : (
        <Suspense fallback={<div className="h-[74px] animate-pulse rounded-[14px] bg-panel2" />}>
          <BoletimDoMar lat={embarcacao.marina_lat} lon={embarcacao.marina_lon} />
        </Suspense>
      )}

      <Link href="/navegar" className="sombra-1 mt-3 block rounded-[14px] border border-accent/40 bg-panel p-3.5 text-center text-sm font-semibold text-accent-forte">
        <span className="inline-flex items-center justify-center gap-2">
          <Icone nome="mapa" className="size-4" /> Iniciar navegação — gravar trilha
        </span>
      </Link>

      {motores.length > 0 && (
        <>
          <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
            <Icone nome="relogio" className="size-3.5" /> Horas de motor
          </p>
          <div className="grid grid-cols-2 gap-2">
            {motores.map((m) => {
              const status =
                avaliados
                  .filter((a) => a.item.equipamento_id === m.id)
                  .map((a) => a.r.status)
                  .sort((a, b) => PESO[b] - PESO[a])[0] ?? "ok"
              return <Horimetro key={m.id} rotulo={m.posicao ?? "Motor"} horas={m.horas_atuais ?? 0} status={status} />
            })}
          </div>
        </>
      )}

      <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
        <Icone nome="raio" className="size-3.5" /> Acesso rápido
      </p>
      <div className="grid grid-cols-4 gap-2 text-center">
        {(
          [
            { href: "/barco", rotulo: "Motores", icone: "motor" },
            { href: "/barco/documentos", rotulo: "Docs", aba: "documentos", icone: "documento" },
            { href: "/diario", rotulo: "Diário", icone: "calendario" },
            { href: "/barco/contatos", rotulo: "Contatos", aba: "contatos", icone: "pessoas" },
          ] as { href: string; rotulo: string; aba?: Aba; icone: NomeIcone }[]
        )
          .filter((a) => !a.aba || podeVer(permissoes, a.aba))
          .map((a) => (
            <Link key={a.href} href={a.href}
              className="sombra-1 flex flex-col items-center gap-1.5 rounded-[12px] border border-line bg-panel px-1 py-3">
              <Icone nome={a.icone} className="size-5 text-accent-forte" />
              <span className="text-[11px] font-medium">{a.rotulo}</span>
            </Link>
          ))}
      </div>

      {(comandantes ?? []).length > 0 && (
        <>
          <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
            <Icone nome="pessoas" className="size-3.5" /> Comandantes disponíveis
          </p>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            {(comandantes ?? []).map((c) => (
              <div key={c.usuario_id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="titulo-card">{c.nome_publico}</p>
                  <p className="apoio mt-0.5 text-dim">{[c.categoria, c.disponibilidade].filter(Boolean).join(" · ")}</p>
                </div>
                <Link href="/marketplace" className="text-xs text-accent-forte">Ver</Link>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
