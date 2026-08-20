import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Icone } from "@/components/icone"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { HeroiTecnico } from "@/components/ui/heroi-tecnico"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { abaDoEquipamento } from "@/lib/domain/diario"
import { calcularSemaforo, PESO, type StatusFarol } from "@/lib/domain/semaforo"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"

/**
 * Hub Equipamentos (PRD §17) — "área flexível": o que existe a bordo e o dono
 * quer acompanhar, mas não é motor, elétrica, hidráulica nem segurança.
 * Bote, guincho, ar-condicionado, VHF, dessalinizador.
 *
 * Por que a tela existe: a onda 32 já deu a estes equipamentos (`tipo =
 * "outro"`) uma área própria na matriz de permissões e na RLS
 * (`aba_do_equipamento`), mas eles continuaram listados em Elétrica — quem
 * tinha só Equipamentos liberado não tinha onde vê-los, e quem tinha só
 * Elétrica via na tela coisas que o banco recusava salvar.
 */
export default async function EquipamentosPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "equipamentos")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui os equipamentos.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "equipamentos")
  const hoje = hojeISO()
  const equipamentos = painel.equipamentos.filter((e) => abaDoEquipamento(e.tipo) === "equipamentos")

  const statusDe = (eqId: string): StatusFarol =>
    painel.itens
      .filter((i) => i.equipamento_id === eqId)
      .map((i) => {
        const eq = painel.equipamentos.find((e) => e.id === eqId)
        return calcularSemaforo(itemMonitoradoToItemCalc(i), eq?.horas_atuais ?? null, hoje).status
      })
      .sort((a, b) => PESO[b] - PESO[a])[0] ?? "ok"

  return (
    <main>
      {/* ONDA 104 (§8 do Guia) — cabeçalho padrão, com a identidade do hub. */}
      <CabecalhoDetalhe
        voltarHref="/barco"
        voltarRotulo="Barco"
        hub="equipamentos"
        descricao="Bote, guincho, ar-condicionado, dessalinizador — o que você quiser acompanhar a bordo."
        acao={editavel ? (
          <Link
            href="/barco/equipamento/novo?tipo=outro"
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
      <HeroiTecnico chave="equipamentos" className="mb-4" />

      <div className="sombra-1 mt-6 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
        {equipamentos.length === 0 && (
          <div className="py-2">
            <EstadoVazio
              icone="ferramenta"
              titulo="Nada cadastrado ainda"
              descricao="Cadastre o que tem manutenção própria e o app passa a avisar dos vencimentos junto com o resto."
            />
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
                  {e.identificacao_interna || [e.marca, e.modelo].filter(Boolean).join(" ") || "Equipamento"}
                  {e.quantidade != null ? ` · ${e.quantidade}×` : ""}
                </p>
                <p className="apoio mt-0.5 text-dim">
                  {/* quando a identificação interna já é o título, marca e
                      modelo descem pra cá em vez de sumir da tela */}
                  {(e.identificacao_interna ? [e.marca, e.modelo].filter(Boolean).join(" ") : "") || "Sem marca informada"}
                  {` · ${itens.length} ${itens.length === 1 ? "item" : "itens"}`}
                </p>
              </div>
              <Icone nome="chevron" className="size-4 text-dim" />
            </Link>
          )
        })}
      </div>
    </main>
  )
}
