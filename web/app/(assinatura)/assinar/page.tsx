import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { assinar } from "@/lib/acoes/assinatura"
import { asaasConfigurado } from "@/lib/asaas"
import { carregarAssinatura } from "@/lib/consultas"
import { carregarTrilha } from "@/lib/consultas-captain"
import { O_QUE_O_CAPTAIN_FREE_FAZ, O_QUE_O_CAPTAIN_PRO_LIBERA } from "@/lib/domain/captain"
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
 * ---------------------------------------------------------------------------
 * ONDA 50 — O QUE A ABA "COMANDANTE" PRECISA DIZER (§12)
 * ---------------------------------------------------------------------------
 * Três acréscimos, todos pela mesma razão: a aba de Captain herdava a
 * linguagem de proprietário e ficava vendendo a coisa errada.
 *   · a aba que ABRE por padrão é deduzida da conta (`trilhaDaConta`), não
 *     fixa em "proprietário";
 *   · o Captain Pro tem lista de benefícios PRÓPRIA — `BENEFICIOS_PAGOS` fala
 *     de Diário sem limite, tripulação e Financeiro, que são gestão de barco
 *     e não é nada do que ele entrega;
 *   · o Captain FREE aparece dizendo o que já faz, porque o §12 é explícito
 *     que operar a embarcação "não depende de Captain Pro".
 */
const PERFIS: { valor: PerfilPlano; rotulo: string }[] = [
  { valor: "proprietario", rotulo: "Proprietário" },
  { valor: "captain", rotulo: "Comandante" },
  { valor: "partner", rotulo: "Parceiro" },
]

function perfilValido(v: string | undefined, padrao: PerfilPlano): PerfilPlano {
  return PERFIS.some((p) => p.valor === v) ? (v as PerfilPlano) : padrao
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

  // ONDA 50 (§12) — a aba que abre por padrão é DEDUZIDA, não fixa. Um
  // comandante contratado que caísse sempre em "Proprietário" veria o preço da
  // gestão de um barco que não é dele, e concluiria que o Commander não tem
  // nada pra ele. `trilhaDaConta` lê os fatos que já existem (é PROP de
  // alguma embarcação? foi convidado a operar a de outro? tem perfil
  // profissional?) — ver `lib/domain/captain.ts`.
  const { trilha } = await carregarTrilha()
  const perfil = perfilValido(perfilBruto, trilha)

  // §2.1/§2.2 — promoção vigente (no máximo uma; o banco garante que não
  // acumulam) muda o preço mostrado E o preço cobrado. A action recalcula por
  // conta própria: o preço nunca vem do formulário.
  const { promocao, plano: planoAtual } = await carregarAssinatura()
  const hoje = hojeISO()
  const promo = promocao ? { promocao: promocao.promocao, validoAte: promocao.validoAte } : null

  const planos = planosDoPerfil(perfil)
  // ONDA 83 — `asaasConfigurado()` entra na conta, e essa é a correção do
  // achado A-02 da auditoria de 19/08/2026.
  //
  // Até aqui esta tela decidia mostrar o checkout olhando SÓ o catálogo: se
  // existisse plano cobrável, ela desenhava os campos de nome e CPF e o botão
  // "Continuar para o pagamento". Só que em produção não existe
  // `ASAAS_API_KEY` — a chamada morre na primeira linha de `lib/asaas.ts`, e a
  // pessoa recebia "Não foi possível falar com o sistema de pagamento. Tente
  // de novo em instantes."
  //
  // Aquela frase MENTE: ela promete que a próxima tentativa pode dar certo, e
  // nenhuma vai. Pior que um botão desligado é um botão que culpa a rede por
  // uma decisão nossa. O fluxo do Commander Gold já fazia certo desde a
  // Correção 08 (`lib/acoes/gold.ts`), avisando honestamente que a contratação
  // abre em breve; esta tela passa a fazer o mesmo.
  //
  // A flag é a MESMA que governa o Gold — a presença da chave, não uma
  // variável nova. Ligar a chave acende as duas telas de uma vez, sem
  // ninguém precisar lembrar de virar mais um interruptor.
  const cobrancaLigada = asaasConfigurado()
  const planoCobravel = planos.find(
    (p) => p.disponibilidade === "disponivel" && p.valorCentavos != null && p.valorCentavos > 0,
  )
  const primeiroContratavel = cobrancaLigada ? planoCobravel : undefined

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
                  {/* §12 — o Captain Free não é uma versão capada esperando
                      upgrade: é o plano de quem foi CONTRATADO pra operar um
                      barco. Dizer o que ele já faz evita que a tela pareça
                      cobrar por algo que a pessoa já tem. */}
                  {p.id === "captain_free" && (
                    <ul className="mt-2 space-y-1">
                      {O_QUE_O_CAPTAIN_FREE_FAZ.map((b) => (
                        <li key={b} className="apoio flex items-start gap-2 text-dim">
                          <Icone nome="documento" className="mt-0.5 size-3.5 shrink-0" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {/* Partner gratuito não tem o que pagar: o caminho dele é
                      publicar o perfil, e o link vai direto pra lá. */}
                  {p.perfil === "partner" && p.valorCentavos === 0 && (
                    <Link href="/parceiro/perfil" className="apoio mt-2 inline-block text-accent-forte">
                      Criar perfil gratuito
                    </Link>
                  )}
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

        {/* ONDA 50 (§12) — a lista do Captain Pro é OUTRA. `BENEFICIOS_PAGOS`
            fala de Diário sem limite, tripulação e Financeiro: tudo gestão de
            barco, nada que o Captain Pro entregue. Mostrar aquela lista aqui
            seria prometer o que a assinatura não dá. */}
        {perfil === "captain" && (
          <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
            <p className="rotulo text-dim">O que o {PLANOS.captain_pro.rotulo} libera</p>
            <ul className="mt-2 space-y-1.5">
              {O_QUE_O_CAPTAIN_PRO_LIBERA.map((b) => (
                <li key={b} className="apoio flex items-start gap-2">
                  <Icone nome="selo" className="mt-0.5 size-3.5 shrink-0 text-accent-forte" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <p className="apoio mt-3 rounded-lg border border-line bg-panel2 px-3 py-2 text-dim">
              O que ela <strong>não</strong> muda: o acesso às embarcações que você opera. Isso vem do convite
              do proprietário e das permissões que ele deu — assinar não abre nem fecha nenhuma porta a bordo.
            </p>
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

        {/* O aviso honesto: existe plano cobrável no catálogo, mas a cobrança
            ainda não está ligada. Sem isto, a tela seria um checkout que
            fracassa sempre — ver o comentário em `primeiroContratavel`. */}
        {!cobrancaLigada && planoCobravel && (
          <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
            <p className="titulo-card">A contratação abre em breve</p>
            <p className="apoio mt-1 text-dim">
              Os planos acima já estão definidos, mas o pagamento ainda não está aberto. Enquanto
              isso, seu acesso atual continua exatamente como está — nada muda e nada é cobrado.
            </p>
          </div>
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
