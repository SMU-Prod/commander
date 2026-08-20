import type { ReactNode } from "react"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { exigirPapelAdmin } from "@/lib/admin"
import { supabaseServer } from "@/lib/supabase/server"
import type { CelulaSondagemAgregada } from "@/lib/db/types"

/**
 * SAÚDE DA SONDAGEM COLABORATIVA (achado A18 da auditoria de 19/08).
 *
 * `sondagens` recebia escrita desde a onda 14 e NADA no app lia — nem a RPC
 * `sondagens_por_celula`, criada na migration 025 justamente pra isso e nunca
 * chamada (achado A19). Esta tela é a primeira leitura da tabela em produção.
 *
 * ---------------------------------------------------------------------------
 * POR QUE A LEITURA PASSA PELA RPC E NUNCA PELA TABELA
 * ---------------------------------------------------------------------------
 * O §22 e o `docs/OPERACAO.md` são categóricos: entre barcos só circula
 * AGREGADO, nunca a trilha individual. A tela de privacidade promete isso com
 * todas as letras a quem marcou o opt-in — "ninguém vê a rota individual de
 * ninguém" — e o Admin NÃO é exceção: um painel interno que abrisse a linha
 * crua transformaria a promessa em letra morta sem que ninguém percebesse.
 *
 * `sondagens_por_celula` é a única porta que respeita isso. Ela é
 * `security definer`, agrupa por célula e devolve mediana, contagem e data —
 * jamais `usuario_id` ou `embarcacao_id`. É por isso que esta tela NÃO faz
 * `from("sondagens")`: a RLS até deixaria o admin ler o que ele tem vínculo,
 * e é exatamente esse "só o que eu tenho vínculo" que produziria um número
 * errado com cara de número certo.
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTA TELA DELIBERADAMENTE NÃO MOSTRA
 * ---------------------------------------------------------------------------
 * 1. QUANTOS BARCOS CONTRIBUÍRAM. É a pergunta mais natural do painel e a
 *    resposta honesta hoje é "não dá pra saber por aqui": a RPC esconde a
 *    embarcação de propósito, e contar distintos exigiria uma função nova,
 *    escrita e discutida — não um `select` a mais aqui (mesma disciplina do
 *    cabeçalho de `lib/consultas-suporte.ts`). O cartão mostra "—" e diz o
 *    motivo, em vez de sumir da tela ou, pior, exibir um zero.
 *
 * 2. ONDE FICAM AS CÉLULAS. A RPC devolve lat/lon médios por célula, e seria
 *    fácil listar "as células com mais leituras". Com a base atual isso não
 *    é agregado coisa nenhuma: agregado sobre UM contribuinte é o rastro
 *    desse contribuinte com outro nome. A pergunta operacional ("a coleta
 *    está viva?") se responde com VOLUME e COBERTURA, que é o que o §22
 *    permite e o que esta tela mostra — a distribuição abaixo conta quantas
 *    células têm quantas leituras, sem dizer onde nenhuma delas fica.
 */

/** Mundo inteiro: este é o painel nacional, não um recorte de mapa. */
const MUNDO = { p_lat_min: -90, p_lat_max: 90, p_lon_min: -180, p_lon_max: 180 }

export default async function AdminSondagensPage() {
  // Operação da coleta é operação do produto — §21 dá ao Suporte "operação de
  // suporte", e o CEO entra por `temPapelAdmin` sem precisar do papel.
  await exigirPapelAdmin("suporte")

  const supabase = await supabaseServer()
  const { data, error } = await supabase.rpc("sondagens_por_celula", MUNDO)

  // OS TRÊS ESTADOS (padrão de `lib/consultas-patio.ts`). Falha de leitura não
  // é lista vazia: uma diz "não sei", a outra diz "sei, e não tem nada". Um
  // `?? []` mudo aqui faria o banco piscar e a tela anunciar que a coleta
  // colaborativa morreu — que é a decisão de produto mais cara que este
  // painel pode induzir.
  if (error) {
    return (
      <Moldura>
        <EstadoVazio
          icone="sonar"
          titulo="Não consegui ler a sondagem agora"
          descricao="A consulta ao banco falhou. Isto não quer dizer que ninguém contribuiu — quer dizer que a leitura não chegou. Recarregue em instantes."
        />
      </Moldura>
    )
  }

  const celulas = (data as CelulaSondagemAgregada[] | null) ?? []

  if (celulas.length === 0) {
    return (
      <Moldura>
        <EstadoVazio
          icone="sonar"
          titulo="Nenhuma leitura de profundidade ainda"
          descricao="A coleta é opt-in e depende de ecobatímetro conectado. Zero aqui significa que ninguém habilitou a contribuição ainda — não que a leitura falhou."
        />
      </Moldura>
    )
  }

  const leituras = celulas.reduce((soma, c) => soma + Number(c.leituras), 0)
  const ultima = celulas
    .map((c) => c.ultima_leitura)
    .reduce((maior, atual) => (atual > maior ? atual : maior))

  // Cobertura em profundidade, sem geografia: uma célula com uma leitura só é
  // um ponto solto; a mediana daquela célula é a própria medição de alguém.
  // Saber quantas estão nesse estado é a diferença entre "temos cobertura" e
  // "temos pontos espalhados".
  const faixa = (min: number, max: number) =>
    celulas.filter((c) => Number(c.leituras) >= min && Number(c.leituras) <= max).length
  const distribuicao: [string, number][] = [
    ["Com 1 leitura", faixa(1, 1)],
    ["Com 2 a 5 leituras", faixa(2, 5)],
    ["Com 6 ou mais", faixa(6, Number.MAX_SAFE_INTEGER)],
  ]

  return (
    <Moldura>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Numero rotulo="Leituras enviadas" valor={leituras.toLocaleString("pt-BR")} />
        <Numero rotulo="Células cobertas" valor={celulas.length.toLocaleString("pt-BR")} />
        <Numero
          rotulo="Última leitura"
          valor={new Date(ultima).toLocaleDateString("pt-BR")}
          apoio={apoioDeRecencia(ultima)}
        />
        {/* O cartão tracejado é o mesmo do Dashboard quando a fonte não
            existe: ausência de medição tem vestido próprio e nunca vira 0. */}
        <SemFonte
          rotulo="Barcos contribuindo"
          detalhe="O agregado por célula não expõe a embarcação (§22) — contar barcos exige uma função nova no banco."
        />
      </div>

      <SecaoPagina>Cobertura por célula</SecaoPagina>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
        {distribuicao.map(([nome, qtd]) => (
          <LinhaLista key={nome} titulo={nome} valor={qtd.toLocaleString("pt-BR")} />
        ))}
      </div>
      <p className="apoio mt-2 text-dim">
        Onde ficam as células não aparece aqui de propósito: com poucos contribuintes, localizar o
        agregado equivale a mostrar por onde alguém navegou.
      </p>
    </Moldura>
  )
}

function Moldura({ children }: { children: ReactNode }) {
  return (
    <main>
      <CabecalhoDetalhe voltarHref="/admin" voltarRotulo="Admin Commander" />
      <h1 className="titulo-pagina mt-3 inline-flex items-center gap-2">
        <Icone nome="sonar" className="size-5 text-accent-forte" /> Sondagem colaborativa
      </h1>
      <p className="apoio mt-1 text-dim">
        Volume e cobertura da coleta de profundidade enviada pelos barcos. Sempre agregado por
        célula — nenhuma leitura individual, nenhum barco identificado.
      </p>
      {children}
    </main>
  )
}

/** "há 11 dias" é o que responde "a coleta está viva?" — a data sozinha
 *  obriga quem lê a fazer a conta de cabeça toda vez que abre o painel. */
function apoioDeRecencia(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (dias <= 0) return "hoje"
  if (dias === 1) return "há 1 dia"
  return `há ${dias.toLocaleString("pt-BR")} dias`
}

function Numero({ rotulo, valor, apoio }: { rotulo: string; valor: string; apoio?: string }) {
  return (
    <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3">
      <p className="rotulo text-dim">{rotulo}</p>
      <p className="tabular-nums valor-forte mt-1 font-semibold">{valor}</p>
      {apoio && <p className="apoio mt-0.5 text-dim">{apoio}</p>}
    </div>
  )
}

function SemFonte({ rotulo, detalhe }: { rotulo: string; detalhe: string }) {
  return (
    <div className="sombra-1 rounded-[var(--raio-cartao)] border border-dashed border-line bg-panel p-3">
      <p className="rotulo text-dim">{rotulo}</p>
      <p className="tabular-nums valor-forte mt-1 font-semibold text-dim">—</p>
      <p className="apoio mt-0.5 text-dim">{detalhe}</p>
    </div>
  )
}
