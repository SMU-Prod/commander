import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { exigirPapelAdmin } from "@/lib/admin"

/**
 * LISTA DE ESPERA DO COMMANDER CONNECT (achado A18 da auditoria de 19/08).
 *
 * `connect_interesses` recebe escrita desde a onda 34 (`lib/acoes/connect.ts`)
 * e nada no app lê. O funil está ABERTO — `/barco/connect` é linkado do Menu e
 * da Início da embarcação, e o questionário grava normalmente — então cada
 * pessoa que responde levanta a mão para uma sala onde ninguém do Comercial
 * entra. É a métrica que decide se um produto "Em breve" sai do papel.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTA TELA AINDA NÃO MOSTRA A LISTA — E POR QUE ISSO ESTÁ ESCRITO
 * AQUI EM VEZ DE UM `select` OTIMISTA
 * ---------------------------------------------------------------------------
 * A RLS de `connect_interesses` tem UMA policy de leitura:
 *
 *     using ( permissao(embarcacao_id, 'embarcacao', 'ver') )
 *
 * `permissao()` procura uma linha em `vinculos` do usuário logado. Papel
 * administrativo não entra nela — é o outro sistema de permissão, e o
 * cabeçalho de `lib/domain/admin-papeis.ts` explica por que os dois nunca se
 * encostam: um CEO não enxerga a embarcação de um cliente por ser CEO.
 *
 * O PERIGO É A FORMA DA FALHA. RLS não devolve erro: ela FILTRA. Um
 * `from("connect_interesses").select()` feito por um Comercial devolveria
 * `[]` com `error: null` — indistinguível de "ninguém se interessou". A tela
 * anunciaria "nenhum interesse ainda" com a mesma cara de certeza que teria se
 * houvesse mil linhas, e o Comercial arquivaria o produto com base num zero
 * que o banco nunca disse. Zero desenhado sobre ausência de permissão é a
 * pior das leituras erradas, porque parece uma medição.
 *
 * Por isso a tela não faz a consulta: uma consulta cujo resultado não pode ser
 * interpretado não é informação, é ruído com aparência de dado. O caminho é
 * uma policy nova, escrita e discutida (mesma disciplina de
 * `lib/consultas-suporte.ts`), e ela não se inventa numa tela.
 *
 * QUANDO A LEITURA FOR LIBERADA: troque este corpo por
 * `select` + contagem por `classificacao` (`lib/domain/connect.ts` já tem os
 * rótulos das 3 classes do PRD) e apague este bloco. Os campos que valem a
 * viagem são `classificacao`, `created_at`, `motor_marca`/`motor_modelo` e
 * `fotos_painel` — a triagem manda a conversa comercial, e as fotos do painel
 * são o que decide "consultar compatibilidade".
 */
export default async function AdminConnectPage() {
  // §21, Comercial: "Partners, destaques, campanhas, publicidade e métricas
  // comerciais". Interesse declarado num produto é sinal comercial, não
  // chamado de suporte. CEO entra por `temPapelAdmin`.
  await exigirPapelAdmin("comercial")

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/admin" voltarRotulo="Admin Commander" />
      <h1 className="titulo-pagina mt-3 inline-flex items-center gap-2">
        <Icone nome="sinal" className="size-5 text-accent-forte" /> Interesse no Connect
      </h1>
      <p className="apoio mt-1 text-dim">
        Quem respondeu a triagem de compatibilidade em /barco/connect. É a fila de espera que diz se
        o Connect tem demanda antes de existir.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {/* Os dois números que a tela vai mostrar um dia. Tracejado e "—" é o
            vestido de "não existe medição" do Dashboard (`admin/page.tsx`):
            enquanto a leitura não abre, nenhum deles pode virar 0. */}
        <SemFonte rotulo="Interesses declarados" />
        <SemFonte rotulo="Connect Ready" />
      </div>

      <SecaoPagina>Situação</SecaoPagina>
      <EstadoVazio
        icone="cadeado"
        titulo="A lista existe e ainda não pode ser lida por aqui"
        descricao="O questionário está no ar e grava normalmente, mas a leitura hoje é liberada só a quem tem vínculo com a embarcação — nenhum papel administrativo alcança a tabela. Isto não é uma lista vazia: é uma lista que este painel não consegue abrir. Falta uma permissão no banco, e ela precisa ser concedida por quem cuida das migrations."
      />
    </main>
  )
}

function SemFonte({ rotulo }: { rotulo: string }) {
  return (
    <div className="sombra-1 rounded-[var(--raio-cartao)] border border-dashed border-line bg-panel p-3">
      <p className="rotulo text-dim">{rotulo}</p>
      <p className="tabular-nums valor-forte mt-1 font-semibold text-dim">—</p>
      <p className="apoio mt-0.5 text-dim">Aguardando liberação de leitura</p>
    </div>
  )
}
