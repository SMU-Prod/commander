import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { assinar } from "@/lib/acoes/assinatura"
import { carregarAssinatura } from "@/lib/consultas"
import { hojeISO } from "@/lib/domain/datas"
import {
  formatarPreco,
  PLANOS,
  planosDoPerfil,
  precoEmTexto,
  precoVigenteCentavos,
  PROMOCOES,
  type PerfilPlano,
} from "@/lib/domain/planos"
import { BENEFICIOS_PAGOS } from "@/lib/domain/plano-acesso"
import { Campo } from "@/components/ui/campo"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * Escolha do plano (onda 47 — PRD FINAL §2, §23; ampliada na onda 51).
 *
 * §23, primeiro passo do fluxo: "Usuário escolhe plano e VÊ PREÇO/BENEFÍCIOS".
 * Por isso a tela lista os planos com preço, regra do §2 e o que cada um
 * libera — nada de "assine e descubra".
 *
 * ---------------------------------------------------------------------------
 * ONDA 51 — OS PLANOS DE PARTNER PASSAM A SER VENDÁVEIS AQUI
 * ---------------------------------------------------------------------------
 * A onda 47 deixou Captain Pro e os dois Partners pagos no catálogo e na
 * constraint de `assinaturas` (migration 048), mas a TELA só listava o
 * proprietário e terminava com "fale com a equipe para ativar". Um plano de
 * R$ 24,90 que exige atendimento humano pra ser contratado não é um plano,
 * é um orçamento — e o §2 não coloca nenhum deles atrás de vendas.
 *
 * Agora a tela tem os três perfis do §2 (`PerfilPlano`), cada um com os seus
 * planos. Os tipos de Partner gratuitos (Marina, Posto, Restaurante, Pousada)
 * aparecem na aba, sem botão de pagar: o caminho deles é criar o perfil, e o
 * link leva direto pra lá em vez de fingir que há algo a contratar.
 *
 */
const PERFIS: { valor: PerfilPlano; rotulo: string }[] = [
  { valor: "proprietario", rotulo: "Proprietário" },
  { valor: "captain", rotulo: "Comandante" },
  { valor: "partner", rotulo: "Parceiro" },
]

function perfilValido(v: string | undefined): PerfilPlano {
  return PERFIS.some((p) => p.valor === v) ? (v as PerfilPlano) : "proprietario"
}

export default async function AssinarPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; perfil?: string }>
}) {
  const { erro, perfil: perfilBruto } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?volta=/assinar")

  const perfil = perfilValido(perfilBruto)

  // §2.1/§2.2 — promoção vigente (no máximo uma; o banco garante que não
  // acumulam) muda o preço mostrado E o preço cobrado. A action recalcula por
  // conta própria: o preço nunca vem do formulário.
  const { promocao, plano: planoAtual } = await carregarAssinatura()
  const hoje = hojeISO()
  const promo = promocao ? { promocao: promocao.promocao, validoAte: promocao.validoAte } : null

  const planos = planosDoPerfil(perfil)
  const primeiroContratavel = planos.find(
    (p) => p.disponibilidade === "disponivel" && p.valorCentavos != null && p.valorCentavos > 0,
  )

  return (
    <main>
      <p className="rotulo text-dim">Commander</p>
      <h1 className="titulo-pagina mt-2">Escolha seu plano</h1>
      <p className="corpo mt-2 text-dim">
        {perfil === "captain"
          ? // §12 — a primeira coisa que um comandante precisa ler nesta tela
            // é que o trabalho dele não está sendo cobrado. O que a assinatura
            // vende é carreira, não acesso a bordo.
            "Operar as embarcações em que você foi convidado é grátis e continua sendo. O que a assinatura " +
            "libera é a sua carreira: perfil na vitrine, Marketplace, candidaturas e histórico de trabalhos."
          : "Todo o dossiê do barco, os avisos de vencimento e os alertas de segurança continuam funcionando em " +
            "qualquer plano. O que muda é quanto você gerencia."}
      </p>

      <nav
        aria-label="Tipo de conta"
        className="-mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {PERFIS.map((p) => (
          <Link
            key={p.valor}
            href={`/assinar?perfil=${p.valor}`}
            aria-current={perfil === p.valor ? "true" : undefined}
            className={`flex h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium ${
              perfil === p.valor ? "border-accent bg-accent text-acao-texto" : "border-line bg-panel text-dim"
            }`}
          >
            {p.rotulo}
          </Link>
        ))}
      </nav>

      {perfil === "partner" && (
        <p className="apoio mt-3 text-dim">
          Commander Partner é o plano de quem atende o meio náutico. O seu perfil no app mostra o tipo real do
          seu negócio — Marina, Loja Náutica, Prestador de Serviço —, e é ele que decide o que você recebe.
        </p>
      )}

      {promocao && (
        <p className="apoio mt-3 inline-flex items-start gap-1.5 rounded-lg border border-accent/40 bg-accent/5 px-3 py-2">
          <Icone nome="estrela" className="mt-0.5 size-3.5 shrink-0 text-accent-forte" />
          <span>
            {PROMOCOES[promocao.promocao].rotulo} ativa até{" "}
            {promocao.validoAte.split("-").reverse().join("/")}. Depois desse período a cobrança volta ao valor
            normal do plano.
          </span>
        </p>
      )}

      {erro && <p className="corpo mt-4 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <form action={assinar} className="mt-5 space-y-4">
        <div className="space-y-2.5">
          {planos.map((p) => {
            const preco = precoVigenteCentavos(p.id, promo, hoje)
            const emPromocao = preco != null && p.valorCentavos != null && preco < p.valorCentavos
            const contratavel = p.disponibilidade === "disponivel" && p.valorCentavos != null && p.valorCentavos > 0

            if (!contratavel) {
              // Grátis e "Em breve" aparecem, mas não são contratáveis aqui —
              // um sem cobrança, o outro sem definição (§2). Esconder o
              // gratuito faria a tela parecer pedágio em vez de escolha.
              const etiqueta =
                p.disponibilidade === "em_breve"
                  ? "Em breve"
                  : p.id === planoAtual
                    ? "Seu plano hoje"
                    : precoEmTexto(p.id)
              return (
                <div key={p.id} className="rounded-[14px] border border-line bg-panel2 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="titulo-card text-dim">{p.rotulo}</span>
                    <span className="rotulo rounded-full bg-panel px-2.5 py-1 text-dim-chip">{etiqueta}</span>
                  </div>
                  <p className="apoio mt-1 text-dim">{p.regra}</p>
                </div>
              )
            }

            return (
              <label
                key={p.id}
                className="sombra-1 block cursor-pointer rounded-[14px] border border-line bg-panel p-4 has-[:checked]:border-accent"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="titulo-card">{p.rotulo}</span>
                  <input
                    type="radio"
                    name="plano"
                    value={p.id}
                    defaultChecked={p.id === primeiroContratavel?.id}
                    className="size-5 accent-[var(--acao)]"
                  />
                </div>
                <p className="corpo mt-1">
                  {emPromocao && (
                    <span className="apoio mr-1.5 text-dim line-through">{formatarPreco(p.valorCentavos!)}</span>
                  )}
                  <span className="font-semibold">{formatarPreco(preco ?? p.valorCentavos!)}</span>
                  <span className="text-dim"> /mês</span>
                </p>
                <p className="apoio mt-1 text-dim">{p.regra}</p>
              </label>
            )
          })}
        </div>

        {perfil === "proprietario" && (
          <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
            <p className="rotulo text-dim">O que o plano pago libera</p>
            <ul className="mt-2 space-y-1.5">
              {BENEFICIOS_PAGOS.map((b) => (
                <li key={b} className="apoio flex items-start gap-2">
                  <Icone nome="selo" className="mt-0.5 size-3.5 shrink-0 text-accent-forte" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {primeiroContratavel && (
          <>
            <div className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
              <Campo label="Nome completo" id="nome" name="nome" required minLength={5} autoComplete="name" />
              <Campo
                label="CPF"
                id="cpf"
                name="cpf"
                required
                inputMode="numeric"
                placeholder="000.000.000-00"
                dica="Exigido pelo sistema de pagamento para emitir a cobrança."
              />
            </div>

            <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">
              Continuar para o pagamento
            </button>
            <p className="apoio text-center text-dim">
              Cartão ou Pix, direto na página segura do Asaas. Nada de cartão aqui no app.
            </p>
            <p className="apoio text-center text-dim">
              Você pode cancelar quando quiser — o que já foi registrado continua guardado, nada é apagado.
            </p>
          </>
        )}
      </form>

      {perfil !== "partner" && (
        <p className="apoio mt-6 text-center text-dim">
          É empresa do meio náutico — marina, posto, loja, prestador, restaurante ou pousada?{" "}
          <Link href="/assinar?perfil=partner" className="text-accent-forte">
            Veja os planos Commander Partner
          </Link>{" "}
          a partir de {formatarPreco(PLANOS.partner_prestador.valorCentavos!)}/mês.
        </p>
      )}
    </main>
  )
}
