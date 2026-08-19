import type { NomeIcone } from "@/components/icone"
import type { Aba } from "@/lib/domain/permissoes"

/**
 * OS OITO HUBS TÉCNICOS — A FONTE ÚNICA.
 * ===========================================================================
 * O §7 do Guia de Design v1 (`docs/DESIGN-SYSTEM.md`) lista os oito hubs da
 * Central Meu Barco, e o §8 diz o que eles têm em comum: *"cada tela mantém a
 * MESMA estrutura e muda só objeto, cor técnica, métricas e abas pertinentes"*.
 * "Mesma estrutura" é uma promessa que não sobrevive a nove cópias — a grade
 * de `/barco` e as oito telas de destino precisam ler a amarração
 * hub → ícone → tom do MESMO lugar, senão a nona vez que alguém escrever
 * `text-hub-casco` à mão vai ser a vez em que ele digita `text-hub-eletrica`.
 *
 * ---------------------------------------------------------------------------
 * POR QUE AS CLASSES SÃO LITERAIS E REPETIDAS, e não montadas por template
 * ---------------------------------------------------------------------------
 * `text-hub-${chave}` não gera CSS nenhum: o Tailwind varre o CÓDIGO-FONTE
 * atrás da classe escrita por extenso, e uma classe montada em tempo de
 * execução simplesmente não existe no bundle. A repetição aqui é o preço de a
 * classe existir — e é o motivo de haver um teste (`hubs.test.ts`) provando
 * que cada entrada só nomeia o PRÓPRIO token.
 *
 * ---------------------------------------------------------------------------
 * A REGRA DE ESCOPO, QUE ESTE ARQUIVO EXISTE PARA TORNAR MECÂNICA
 * ---------------------------------------------------------------------------
 * §5 do guia: *"cor do hub apenas no estado ativo ou no card daquele
 * sistema"*. Não é "cor de hub pode aparecer no corpo do card"; é **a cor do
 * hub X só aparece no hub X**. Com a tabela solta em cada tela, essa regra era
 * uma intenção que dependia de revisão humana. Com ela aqui e o teste ao lado,
 * cruzar os fios reprova no `npm test`.
 *
 * O QUE NÃO ENTRA NESTA TABELA, e por quê: contagem, farol e permissão
 * calculada. Eles dependem do que a consulta trouxe naquela tela, e enfiá-los
 * aqui transformaria uma tabela de apresentação numa segunda régua de domínio.
 * `aba` entra porque é a CHAVE de permissão do hub, não o resultado dela.
 */
export type ChaveHub =
  | "motores"
  | "casco"
  | "eletrica"
  | "hidraulica"
  | "seguranca"
  | "equipamentos"
  | "documentos"
  | "manutencoes"

export type Hub = {
  chave: ChaveHub
  rotulo: string
  icone: NomeIcone
  href: string
  /** A chave de PERMISSÃO. Nem sempre é igual a `chave` — ver Manutenções. */
  aba: Aba
  /** Traço do ícone. */
  tom: string
  /** A moldura do §5: a cor do hub no card daquele hub, em repouso e ao apontar. */
  borda: string
  /** O halo atrás do ícone — o "rim light na cor do hub" do §6. */
  halo: string
  /** O filete sob o título da tela do hub, no lugar do dourado de `TituloTela`. */
  filete: string
  /** O anel do cartucho de ícone no cabeçalho da tela do hub. */
  anel: string
}

export const HUBS: readonly Hub[] = [
  {
    chave: "motores",
    rotulo: "Motores",
    icone: "motor",
    href: "/barco/motores",
    aba: "motores",
    tom: "text-hub-motores",
    borda: "border-hub-motores/35 hover:border-hub-motores/60",
    halo: "bg-hub-motores/10",
    filete: "bg-hub-motores",
    anel: "border-hub-motores/40",
  },
  {
    // `embarcacao` e não `escudo`: na grade, o Casco fica vizinho da Segurança,
    // e dois escudos quase iguais deixam de distinguir um card do outro. O
    // casco é o corpo do barco — a silhueta é o desenho certo.
    chave: "casco",
    rotulo: "Casco",
    icone: "embarcacao",
    href: "/barco/casco",
    aba: "casco",
    tom: "text-hub-casco",
    borda: "border-hub-casco/35 hover:border-hub-casco/60",
    halo: "bg-hub-casco/10",
    filete: "bg-hub-casco",
    anel: "border-hub-casco/40",
  },
  {
    chave: "eletrica",
    rotulo: "Elétrica",
    icone: "raio",
    href: "/barco/eletrica",
    aba: "eletrica",
    tom: "text-hub-eletrica",
    borda: "border-hub-eletrica/35 hover:border-hub-eletrica/60",
    halo: "bg-hub-eletrica/10",
    filete: "bg-hub-eletrica",
    anel: "border-hub-eletrica/40",
  },
  {
    chave: "hidraulica",
    rotulo: "Hidráulica",
    icone: "hidraulica",
    href: "/barco/hidraulica",
    aba: "hidraulica",
    tom: "text-hub-hidraulica",
    borda: "border-hub-hidraulica/35 hover:border-hub-hidraulica/60",
    halo: "bg-hub-hidraulica/10",
    filete: "bg-hub-hidraulica",
    anel: "border-hub-hidraulica/40",
  },
  {
    chave: "seguranca",
    rotulo: "Segurança",
    icone: "seguranca",
    href: "/barco/seguranca",
    aba: "seguranca",
    tom: "text-hub-seguranca",
    borda: "border-hub-seguranca/35 hover:border-hub-seguranca/60",
    halo: "bg-hub-seguranca/10",
    filete: "bg-hub-seguranca",
    anel: "border-hub-seguranca/40",
  },
  {
    chave: "equipamentos",
    rotulo: "Equipamentos",
    icone: "ferramenta",
    href: "/barco/equipamentos",
    aba: "equipamentos",
    tom: "text-hub-equipamentos",
    borda: "border-hub-equipamentos/35 hover:border-hub-equipamentos/60",
    halo: "bg-hub-equipamentos/10",
    filete: "bg-hub-equipamentos",
    anel: "border-hub-equipamentos/40",
  },
  {
    chave: "documentos",
    rotulo: "Documentos",
    icone: "documento",
    href: "/barco/documentos",
    aba: "documentos",
    tom: "text-hub-documentos",
    borda: "border-hub-documentos/35 hover:border-hub-documentos/60",
    halo: "bg-hub-documentos/10",
    filete: "bg-hub-documentos",
    anel: "border-hub-documentos/40",
  },
  {
    // A CHAVE DE PERMISSÃO É `embarcacao`, E ISSO NÃO É ERRO DE DIGITAÇÃO.
    // Manutenções aqui é o recorte de item SEM categoria e SEM equipamento —
    // o que pende da embarcação inteira, e não de um sistema. Quem pode ver a
    // embarcação vê essas; não existe (nem deve existir) uma permissão
    // "manutencoes" separada.
    chave: "manutencoes",
    rotulo: "Manutenções",
    icone: "relogio",
    href: "/barco/manutencoes",
    aba: "embarcacao",
    tom: "text-hub-manutencoes",
    borda: "border-hub-manutencoes/35 hover:border-hub-manutencoes/60",
    halo: "bg-hub-manutencoes/10",
    filete: "bg-hub-manutencoes",
    anel: "border-hub-manutencoes/40",
  },
]

/** O hub pela chave. Lança em vez de devolver `undefined`: quem chama é uma
 *  tela de hub, e uma chave errada ali é erro de programação — devolver nulo
 *  faria a tela abrir sem identidade nenhuma, calada. */
export function hub(chave: ChaveHub): Hub {
  const achado = HUBS.find((h) => h.chave === chave)
  if (!achado) throw new Error(`Hub desconhecido: ${chave}`)
  return achado
}
