import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { atualizarPrecoGold } from "@/lib/acoes/gold-admin"
import { exigirAreaAdmin } from "@/lib/admin"
import { carregarPrecosGold } from "@/lib/consultas-gold"
import { formatarPrecoGold } from "@/lib/domain/gold"

/** Admin > Preços (Correção 19 + PRD §39: "os valores devem ser
 *  configuráveis pelo sistema/admin, não hardcoded de forma irreversível"). */
export default async function AdminPrecosGoldPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  await exigirAreaAdmin("gold_precos")
  const { ok, erro } = await searchParams
  const precos = await carregarPrecosGold()

  return (
    <main>
      {/* Só o `voltarHref` — sem `titulo`. `CabecalhoDetalhe` trunca o h1 em
          uma linha, e este título tem 34 caracteres: a 390px ele viraria
          "Preços da avaliação Comm…". O componente prevê este uso (ver o
          cabeçalho dele) e o que interessava aqui era o alvo de 44px do
          "Voltar", que o link à mão não tinha. */}
      <CabecalhoDetalhe voltarHref="/admin/gold" voltarRotulo="Commander Gold" />
      <h1 className="titulo-pagina mt-3">Preços da avaliação Commander Gold</h1>
      <p className="apoio mt-1 text-dim">
        Deixe o valor em branco para marcar a faixa como &quot;sob consulta&quot;.
      </p>

      {ok && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <div className="mt-4 space-y-3">
        {precos.map((p) => (
          <form
            key={p.faixa} action={atualizarPrecoGold}
            className="sombra-1 flex items-center gap-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4"
          >
            <input type="hidden" name="faixa" value={p.faixa} />
            <div className="min-w-0 flex-1">
              <p className="corpo font-medium">{p.rotulo}</p>
              <p className="apoio text-dim">Atual: {formatarPrecoGold(p.valor_centavos)}</p>
            </div>
            <input
              type="text" name="valor_reais" inputMode="decimal" placeholder="1990,00"
              defaultValue={p.valor_centavos != null ? (p.valor_centavos / 100).toFixed(2).replace(".", ",") : ""}
              className="w-28 rounded-[var(--raio-controle)] border border-line bg-panel2 px-2 py-1.5 text-right corpo"
            />
            {/* Era uma caixa de 30px — 14px abaixo da régua de toque — e o
                preço da vistoria é gravação de verdade. `contorno` é a única
                altura de pílula do app (44px) e traz o aviso de envio. */}
            <BotaoEnviar rotulo="Salvar" variante="contorno" className="shrink-0 whitespace-nowrap" />
          </form>
        ))}
      </div>
    </main>
  )
}
