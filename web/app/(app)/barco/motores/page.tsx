import Link from "next/link"
import { redirect } from "next/navigation"
import { Horimetro } from "@/components/horimetro"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { HeroiTecnico } from "@/components/ui/heroi-tecnico"
import { NumerosDoHub } from "@/components/ui/numeros-do-hub"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import {
  calcularSemaforo, PESO, temInformacaoSuficiente, type StatusFarol,
} from "@/lib/domain/semaforo"

/**
 * ONDA 101 — O HUB DOS MOTORES, que era uma seção da /barco.
 *
 * O dono pôs "Motores" na lista dos oito cards da central técnica (spec
 * `2026-08-19-arquitetura-quatro-apps.md` §3): *"A pessoa toca no card e entra
 * naquele hub"*. Elétrica, Hidráulica, Segurança, Equipamentos e Documentos já
 * tinham hub; Motores, Casco e Manutenções eram seção empilhada na porta.
 * Estas três telas fecham a simetria — nada aqui é conteúdo novo, é o mesmo
 * bloco no lugar onde ele passa a morar.
 *
 * Nenhuma consulta própria: `carregarPainel` já traz equipamentos e itens, e
 * tem `cache()` — entrar aqui vindo da /barco não paga segunda ida ao banco.
 *
 * A saída usa `CabecalhoDetalhe` e não o link "Barco" escrito à mão que os
 * hubs irmãos usam: a auditoria de 19/08 mediu esse link em 62×17px com
 * `min-height: 0` em oito arquivos, contra a régua de 44px. Tela nova nasce
 * certa; os oito herdados estão no relatório.
 */
export default async function MotoresPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "motores")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui os motores.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "motores")
  const hoje = hojeISO()
  const motores = painel.equipamentos.filter((e) => e.tipo === "motor")

  // A MESMA função que vivia na /barco, byte por byte no critério: `null`
  // quando não há item monitorado com informação suficiente, nunca `"ok"`. O
  // `Horimetro` aceita `null` desde a onda 94 e desenha o anel vazio — um motor
  // sem nenhum item cadastrado não pode acender "em dia".
  const statusDoMotor = (eqId: string): StatusFarol | null =>
    painel.itens
      .filter((i) => i.equipamento_id === eqId)
      .flatMap((i) => {
        const horas = painel.equipamentos.find((e) => e.id === eqId)?.horas_atuais ?? null
        const calc = itemMonitoradoToItemCalc(i)
        return temInformacaoSuficiente(calc, horas) ? [calcularSemaforo(calc, horas, hoje).status] : []
      })
      .sort((a, b) => PESO[b] - PESO[a])[0] ?? null

  // ONDA 109 — os números da trinca. Recorte por ITEM, e a régua de quem vota
  // é `temInformacaoSuficiente`, a mesma de `statusDoMotor`: item sem
  // intervalo nem data não conta nem a favor nem contra.
  const itensDosMotores = painel.itens.filter((i) => motores.some((m) => m.id === i.equipamento_id))
  const pedemAtencao = itensDosMotores.filter((i) => {
    const horas = motores.find((m) => m.id === i.equipamento_id)?.horas_atuais ?? null
    const calc = itemMonitoradoToItemCalc(i)
    return temInformacaoSuficiente(calc, horas) && calcularSemaforo(calc, horas, hoje).status !== "ok"
  }).length

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/barco"
        voltarRotulo="Barco"
        hub="motores"
        descricao="Horímetro, revisões e histórico de cada motor."
        acao={editavel ? (
          <Link
            href="/barco/equipamento/novo?tipo=motor"
            className="inline-flex min-h-[var(--altura-controle)] shrink-0 items-center gap-1 rounded-[var(--raio-pilula)] bg-accent px-4 corpo font-semibold text-acao-texto"
          >
            <Icone nome="mais" className="size-4" /> Motor
          </Link>
        ) : undefined}
      />

      {/* ONDA 105 — o objeto grande do topo, como nas oito imagens do guia.
          É ilustração técnica, não render 3D nem foto: ver o cabeçalho de
          `components/ui/heroi-tecnico.tsx` e o desvio de biblioteca de assets
          registrado em `docs/DESIGN-SYSTEM.md`. */}
      <HeroiTecnico chave="motores" className="mt-5 mb-4" />

      {/* ONDA 109 — a trinca da imagem 3, com o vocabulário desta tela: quantos
          motores, quantas manutenções penduradas neles, e quantas pedem
          atenção. Os números saem de `painel`, que já está em mãos. */}
      <NumerosDoHub
        chave="motores"
        className="mb-4"
        numeros={[
          { rotulo: "Motores", valor: String(motores.length), icone: "motor" },
          { rotulo: "Manutenções", valor: String(itensDosMotores.length), icone: "relogio" },
          {
            rotulo: "Atenção",
            valor: String(pedemAtencao),
            icone: "alerta",
            estado: pedemAtencao > 0 ? "atencao" : undefined,
          },
        ]}
      />

      {motores.length === 0 ? (
        <EstadoVazio
          className="mt-6"
          icone="motor"
          titulo="Nenhum motor cadastrado ainda"
          descricao="Cadastre pra ganhar horímetro e checklist de manutenção automáticos."
          acao={editavel ? { href: "/barco/equipamento/novo?tipo=motor", rotulo: "Cadastrar motor" } : undefined}
        />
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {motores.map((m) => (
            <Link key={m.id} href={`/barco/equipamento/${m.id}`}>
              <Horimetro
                rotulo={m.posicao ?? "Motor"}
                horas={m.horas_atuais}
                status={statusDoMotor(m.id)}
              />
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
