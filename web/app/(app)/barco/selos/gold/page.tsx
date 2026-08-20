import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { SeloGold } from "@/components/selos/selo-gold"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { criarSolicitacaoGold } from "@/lib/acoes/gold"
import {
  carregarMinhasSolicitacoesGoldExternas, carregarPainel, carregarPrecosGold,
  carregarSeloGold, carregarSolicitacaoGoldDaEmbarcacao, hojeISO,
} from "@/lib/consultas-gold"
import {
  DESCRICAO_ESTADO_SOLICITACAO, estadoFinal, formatarPrecoGold, ROTULO_ESTADO_SOLICITACAO,
  ROTULO_FAIXA_PORTE, ROTULO_STATUS_SELO, statusSeloGold, sugerirFaixaPorte,
} from "@/lib/domain/gold"

/**
 * Commander Gold — vitrine + fluxo real (onda 35, substitui a manifestação
 * de interesse da onda 33). Correções 02/06/08/09/15/19 do PRD de Correções.
 * Nunca a palavra "Review" (Correção 01/20).
 */
export default async function GoldPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  const { ok, erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const [selo, solicitacao, precos, externas] = await Promise.all([
    carregarSeloGold(painel.embarcacao.id),
    carregarSolicitacaoGoldDaEmbarcacao(painel.embarcacao.id),
    carregarPrecosGold(),
    carregarMinhasSolicitacoesGoldExternas(),
  ])

  const hoje = hojeISO()
  const statusSelo = selo ? statusSeloGold(selo.validade_ate, hoje) : null
  // A20 — os três estados terminais estavam listados à mão aqui, e `estadoFinal`
  // (que os deriva de `TRANSICOES_VALIDAS`, a mesma tabela que espelha a RPC
  // `gold_definir_estado`) nunca era chamada. Uma lista literal não acompanha a
  // máquina de estados: acrescentar um estado terminal no domínio deixaria esta
  // tela oferecendo "solicitar de novo" numa avaliação que ainda está viva.
  const emAndamento = solicitacao != null && !estadoFinal(solicitacao.estado)
  const faixaSugerida = sugerirFaixaPorte(painel.embarcacao.comprimento_m)

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/barco/selos" voltarRotulo="Selos Commander" />
      <h1 className="titulo-pagina mt-3 inline-flex items-center gap-2">
        <SeloGold size={32} variant={selo ? "ativo" : "convite"} /> Commander Gold
      </h1>
      <p className="apoio mt-1 text-dim">
        O nível de confiança presencial do Commander: avaliação de um consultor náutico autorizado,
        seguindo o Protocolo Commander. Não depende de completar o Commander Verified — os dois são
        independentes.
      </p>

      {ok && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {selo && statusSelo && (
        <Link
          href={`/barco/selos/gold/${selo.solicitacao_id}`}
          className="sombra-1 mt-6 block rounded-[var(--raio-cartao)] border border-accent-forte/40 bg-panel p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="titulo-card inline-flex items-center gap-1.5">
              <SeloGold size={20} variant="ativo" /> Commander Gold {ROTULO_STATUS_SELO[statusSelo]}
            </p>
            <Icone nome="chevron" className="size-4 text-dim" />
          </div>
          <p className="apoio mt-1 text-dim">
            Válido até {new Date(`${selo.validade_ate}T00:00:00`).toLocaleDateString("pt-BR")} — toque para ver o relatório.
          </p>
        </Link>
      )}

      {emAndamento && solicitacao && (
        <Link
          href={`/barco/selos/gold/${solicitacao.id}`}
          className="sombra-1 mt-6 block rounded-[var(--raio-cartao)] border border-line bg-panel p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="titulo-card">{ROTULO_ESTADO_SOLICITACAO[solicitacao.estado]}</p>
            <Icone nome="chevron" className="size-4 text-dim" />
          </div>
          <p className="apoio mt-1 text-dim">{DESCRICAO_ESTADO_SOLICITACAO[solicitacao.estado]}</p>
        </Link>
      )}

      {!emAndamento && (
        <>
          <p className="rotulo mt-6 mb-2 text-dim">Valores da avaliação Commander Gold</p>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {precos.map((p) => (
              <div key={p.faixa} className="flex items-center justify-between border-b border-line py-2.5 last:border-0">
                <p className="corpo text-dim">{p.rotulo}</p>
                <p className="corpo tabular-nums tabular-nums">{formatarPrecoGold(p.valor_centavos)}</p>
              </div>
            ))}
          </div>
          <p className="apoio mt-2 text-dim">
            Deslocamentos extraordinários podem ser cobrados à parte. A equipe Commander confirma o
            valor final antes do pagamento.
          </p>

          <p className="rotulo mt-6 mb-2 text-dim">Solicitar Commander Gold</p>
          {painel.papel === "PROP" ? (
            <form action={criarSolicitacaoGold} className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
              <input type="hidden" name="tipo" value="minha" />
              <p className="corpo font-medium">{painel.embarcacao.nome}</p>
              <p className="apoio text-dim">Solicitação para a sua própria embarcação.</p>
              <CampoSelect
                label="Porte da embarcação" id="faixa_porte_minha" name="faixa_porte"
                defaultValue={faixaSugerida ?? ""} required
              >
                <option value="" disabled>Escolha o porte</option>
                {precos.map((p) => <option key={p.faixa} value={p.faixa}>{p.rotulo}</option>)}
              </CampoSelect>
              <CampoSelect label="Quem vai pagar" id="quem_paga_minha" name="quem_paga" defaultValue="proprio">
                <option value="proprio">Eu</option>
                <option value="interessado">Outra pessoa (gero um link de pagamento)</option>
              </CampoSelect>
              <button className="w-full rounded-[var(--raio-controle)] bg-accent py-3 font-semibold text-acao-texto">
                Quero o Commander Gold
              </button>
            </form>
          ) : (
            <p className="apoio rounded-[var(--raio-cartao)] border border-line bg-panel p-4 text-dim">
              Só o proprietário pode solicitar o Commander Gold para esta embarcação.
            </p>
          )}

          <details className="mt-3">
            <summary className="corpo cursor-pointer text-accent-forte">
              Quero avaliar outra embarcação (ainda não é minha)
            </summary>
            <form action={criarSolicitacaoGold} className="sombra-1 mt-3 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
              <input type="hidden" name="tipo" value="outra" />
              <p className="apoio text-dim">
                Vai comprar um barco e quer a avaliação presencial antes de fechar negócio? Ou está
                vendendo e quer o Gold no anúncio? A embarcação não precisa estar cadastrada no
                Commander.
              </p>
              {/* §16: "pode ser solicitado por proprietário, vendedor ou
                  interessado/comprador". O papel muda quem é a pessoa no
                  relatório e nada mais — não dá acesso a ficha nenhuma. */}
              <CampoSelect label="Você é" id="papel_solicitante" name="papel_solicitante" defaultValue="interessado">
                <option value="interessado">Interessado / comprador</option>
                <option value="vendedor">Vendedor</option>
              </CampoSelect>
              <Campo label="Nome ou identificação da embarcação" id="embarcacao_externa_nome" name="embarcacao_externa_nome" required />
              <Campo label="Onde ela está (marina, cidade)" id="embarcacao_externa_local" name="embarcacao_externa_local" />
              <CampoTextarea label="Observações (opcional)" id="embarcacao_externa_obs" name="embarcacao_externa_obs" rows={2} />
              <CampoSelect label="Porte da embarcação" id="faixa_porte_outra" name="faixa_porte" required defaultValue="">
                <option value="" disabled>Escolha o porte</option>
                {precos.map((p) => <option key={p.faixa} value={p.faixa}>{p.rotulo}</option>)}
              </CampoSelect>
              <CampoSelect label="Quem vai pagar" id="quem_paga_outra" name="quem_paga" defaultValue="proprio">
                <option value="proprio">Eu</option>
                <option value="interessado">Outra pessoa (gero um link de pagamento)</option>
              </CampoSelect>
              <button className="w-full rounded-[var(--raio-controle)] border border-line bg-panel2 py-3 font-semibold">
                Solicitar avaliação dessa embarcação
              </button>
            </form>
          </details>
        </>
      )}

      <p className="rotulo mt-6 mb-2 text-dim">O que é avaliado</p>
      <p className="apoio text-dim">
        Motores, casco, elétrica, hidráulica, segurança, equipamentos aplicáveis, documentação e
        histórico — cada item marcado como avaliado, em atenção ou não aplicável pelo consultor,
        com data da avaliação, validade e a versão do Protocolo Commander usada.
      </p>

      {externas.length > 0 && (
        <>
          <p className="rotulo mt-6 mb-2 text-dim">Suas solicitações para outras embarcações</p>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {externas.map((s) => (
              <Link
                key={s.id} href={`/barco/selos/gold/${s.id}`}
                className="flex items-center justify-between gap-2 border-b border-line py-3 last:border-0"
              >
                <div className="min-w-0">
                  <p className="corpo truncate">{s.embarcacao_externa_nome}</p>
                  <p className="apoio text-dim">{ROTULO_ESTADO_SOLICITACAO[s.estado]} · {ROTULO_FAIXA_PORTE[s.faixa_porte]}</p>
                </div>
                <Icone nome="chevron" className="size-4 shrink-0 text-dim" />
              </Link>
            ))}
          </div>
        </>
      )}

      {!selo && !emAndamento && externas.length === 0 && painel.papel !== "PROP" && (
        <EstadoVazio
          className="mt-6" icone="ancora" titulo="Nenhum pedido de Commander Gold ainda"
          descricao="Peça pro proprietário da embarcação solicitar, ou avalie outra embarcação acima."
        />
      )}
    </main>
  )
}
