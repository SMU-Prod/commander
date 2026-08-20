"use client"
import { useState } from "react"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { CampoSelect } from "@/components/ui/campo"
import {
  FUNCAO_PAPEL,
  PAPEIS_ENTERPRISE,
  PRESET_ENTERPRISE,
  ROTULO_PAPEL,
  type PapelEnterprise,
} from "@/lib/domain/enterprise"
import {
  ABAS,
  ROTULO_ABA,
  normalizarPermissoes,
  type Aba,
  type Permissoes,
} from "@/lib/domain/permissoes"
import { TOQUE } from "@/lib/ui/acoes"
import { mesmoAcesso, resumirAcesso } from "../resumo-permissoes"

/**
 * A MATRIZ DE ACESSO — ESCOLHER O PERFIL, LER O QUE ELE CONCEDE, E SÓ ENTÃO
 * GRAVAR.
 *
 * ---------------------------------------------------------------------------
 * O DEFEITO QUE ISTO FECHA
 * ---------------------------------------------------------------------------
 * `lib/domain/enterprise.ts` define, com teste, o que cada um dos cinco
 * perfis Enterprise enxerga — `PRESET_ENTERPRISE`, saído da tabela do §3 do
 * PRD. Até aqui NENHUMA tela chamava esse mapa: quem dava acesso a alguém
 * como "Operações" ou "Mecânica" recebia a grade em branco e marcava trinta
 * caixas à mão, uma por uma. Trinta gestos manuais pra reproduzir uma decisão
 * que já estava escrita e testada — e a conta de errar um deles é dar
 * Financeiro pra quem conserta motor, que é justamente o que o §7 proíbe.
 *
 * ---------------------------------------------------------------------------
 * POR QUE É UM COMPONENTE CLIENTE, E POR QUE ELE NÃO GRAVA NADA
 * ---------------------------------------------------------------------------
 * A única action que grava matriz é `salvarMatriz` (`lib/acoes/vinculos.ts`),
 * e ela lê `${aba}_ver` / `${aba}_editar` do formulário. `aplicarPreset` só
 * conhece "completo" e "operacional" — Enterprise não passa por ela. Então o
 * caminho honesto é este: o perfil MARCA AS CAIXAS, e quem grava continua
 * sendo o mesmo botão de sempre. Sem action nova, sem segunda porta de
 * escrita, e sem a tela e o banco discordando sobre o que foi salvo.
 *
 * O efeito colateral bom: entre escolher o perfil e gravar existe um momento
 * em que a pessoa LÊ o que está prestes a conceder. Um seletor que aplicasse
 * e gravasse no mesmo toque seria mais curto e seria pior — conceder acesso
 * às cegas é o oposto do que esta tela existe pra fazer.
 *
 * Como as caixas passam a ser CONTROLADAS pelo estado daqui, é este
 * componente que renderiza a grade inteira. Isso é aceitável porque a grade é
 * apresentação: a DECISÃO — qual área cada papel recebe — continua morando em
 * `PRESET_ENTERPRISE`, no domínio puro. Nenhuma linha abaixo escreve a matriz
 * de nenhum papel; ela é sempre LIDA de lá.
 */

/** O rótulo da coluna, num lugar só — ele vai pro cabeçalho e pro nome
 *  acessível de cada caixa, e os dois precisam dizer a mesma palavra. */
const ROTULO_COLUNA = { ver: "Ver", editar: "Editar" } as const
type Coluna = keyof typeof ROTULO_COLUNA

export function MatrizDeAcesso({ permissoesIniciais }: { permissoesIniciais: Permissoes }) {
  const [permissoes, setPermissoes] = useState<Permissoes>(permissoesIniciais)
  // Qual perfil a pessoa escolheu NESTA sessão de edição. Vazio é o estado de
  // quem chegou e ainda não escolheu nada — e não "nenhum perfil", que é
  // outra coisa: o vínculo tem papel próprio, mostrado no cartão acima.
  const [perfilEscolhido, setPerfilEscolhido] = useState<PapelEnterprise | "">("")

  const resumo = resumirAcesso(permissoes)
  const aindaEhOperfil =
    perfilEscolhido !== "" && mesmoAcesso(permissoes, PRESET_ENTERPRISE[perfilEscolhido])
  const temMudancaNaoGravada = !mesmoAcesso(permissoes, permissoesIniciais)

  function escolherPerfil(valor: string) {
    // `find` no lugar de um `as PapelEnterprise`: o `<select>` é nosso e só
    // oferece estes cinco, mas um cast aqui seria a tela AFIRMANDO um tipo em
    // vez de conferir — e é assim que um papel removido do domínio vira
    // `PRESET_ENTERPRISE[undefined]` em produção.
    const papel = PAPEIS_ENTERPRISE.find((p) => p === valor)
    if (!papel) {
      // Voltar pro "escolha um perfil" NÃO desfaz as caixas. Desfazer seria a
      // tela jogar fora sozinha o ajuste que a pessoa acabou de fazer à mão.
      setPerfilEscolhido("")
      return
    }
    setPerfilEscolhido(papel)
    setPermissoes(PRESET_ENTERPRISE[papel])
  }

  function alternar(aba: Aba, coluna: Coluna, marcado: boolean) {
    setPermissoes((atual) => {
      const antes = atual[aba]
      // A REGRA É A DO DOMÍNIO, NÃO UMA CÓPIA DELA. `normalizarPermissoes` já
      // sabe que quem edita vê (`ver = editar || ver`), e é ela que
      // `salvarMatriz` chama antes de gravar — então a tela chama a MESMA
      // função em vez de repetir o `if` e passar a divergir na primeira
      // mudança de regra. O que sobra aqui é só o gesto: desmarcar "Ver"
      // apaga "Editar" junto, porque não se altera o que não se enxerga.
      const depois = coluna === "editar"
        ? { ver: antes.ver, editar: marcado }
        : { ver: marcado, editar: marcado ? antes.editar : false }
      return normalizarPermissoes({ ...atual, [aba]: depois })
    })
  }

  return (
    <>
      <div className="rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        <CampoSelect
          label="Aplicar o acesso padrão de um perfil"
          id="perfil_enterprise"
          // SEM `name`, e isso é decisão: este seletor não é gravado. Quem
          // grava é `salvarMatriz`, lendo as caixas abaixo. Um campo com nome
          // que a action ignora é uma promessa quebrada — o mesmo defeito de
          // um controle que parece salvar e não salva.
          value={perfilEscolhido}
          onChange={(e) => escolherPerfil(e.target.value)}
          dica="Nada é gravado agora: as caixas mudam, você confere, e só o botão do fim da grade grava."
        >
          <option value="">Escolha um perfil…</option>
          {PAPEIS_ENTERPRISE.map((papel) => (
            <option key={papel} value={papel}>{ROTULO_PAPEL[papel]}</option>
          ))}
        </CampoSelect>
        {perfilEscolhido !== "" && (
          // A função do perfil sai de `FUNCAO_PAPEL`, a mesma frase do §3 que
          // o convite usará quando existir — fonte única pra tela e convite
          // nunca descreverem o mesmo perfil de dois jeitos.
          <p className="corpo mt-3">{FUNCAO_PAPEL[perfilEscolhido]}</p>
        )}
      </div>

      {/* O RESUMO DESCREVE AS CAIXAS, NÃO O PERFIL. É uma diferença que
          importa: se descrevesse o perfil, ele viraria mentira no instante em
          que alguém marcasse uma caixa à mão depois de aplicar. Descrevendo o
          estado atual, ele continua verdadeiro nos dois casos — e a linha de
          cima é que diz se aquilo ainda é o padrão ou já é um ajuste. */}
      <div className="mt-3 rounded-[var(--raio-cartao)] border border-line bg-panel2 p-4">
        <p className="titulo-card">O que este acesso concede</p>
        {perfilEscolhido !== "" && (
          <p className="apoio mt-1 text-dim">
            {aindaEhOperfil
              ? `Exatamente o padrão de ${ROTULO_PAPEL[perfilEscolhido]}.`
              : `Ajustado à mão a partir de ${ROTULO_PAPEL[perfilEscolhido]}.`}
          </p>
        )}
        <dl className="mt-3 space-y-2">
          <LinhaDoResumo
            rotulo="Altera"
            areas={resumo.altera}
            vazio="Nenhuma área — este acesso não muda nada no barco."
          />
          <LinhaDoResumo rotulo="Só vê" areas={resumo.soVe} vazio="Nenhuma área." />
          <LinhaDoResumo
            rotulo="Sem acesso"
            areas={resumo.semAcesso}
            vazio="Nenhuma área de fora — este acesso alcança o barco inteiro."
          />
        </dl>
      </div>

      <div className="mt-3 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
        {/* `.rotulo` no lugar de `text-xs uppercase tracking-[.14em]`:
            é o MESMO desenho escrito à mão, e `.14em` era mais um dos onze
            trackings que a auditoria contou pro mesmo gesto (achado 5.12). */}
        <div className="flex items-center gap-3 border-b border-line py-2">
          <span className="rotulo flex-1 text-dim">Área</span>
          <span className="rotulo w-12 text-center text-dim">{ROTULO_COLUNA.ver}</span>
          <span className="rotulo w-12 text-center text-dim">{ROTULO_COLUNA.editar}</span>
        </div>
        {ABAS.map((aba) => (
          // O `py-3` saiu da LINHA e foi pro nome da área: quem define a
          // altura agora é a caixa de toque de 44px, e a linha continua com
          // exatamente a mesma altura de antes. Grade não engorda, alvo
          // triplica.
          <div key={aba} className="flex items-center gap-3 border-b border-line last:border-0">
            <span className="corpo flex-1 py-3">{ROTULO_ABA[aba]}</span>
            <CaixaDaGrade
              aba={aba} coluna="ver" marcado={permissoes[aba].ver} aoAlternar={alternar}
            />
            <CaixaDaGrade
              aba={aba} coluna="editar" marcado={permissoes[aba].editar} aoAlternar={alternar}
            />
          </div>
        ))}
      </div>

      {/* Era "Marcar Editar libera Ver automaticamente AO SALVAR" — verdade
          quando as caixas eram burras e a regra só rodava no servidor. Agora
          ela roda na hora (a mesma `normalizarPermissoes`), e a frase precisa
          contar o que a pessoa vai ver acontecer, senão ela espera um pulo
          que já aconteceu. */}
      <p className="apoio mt-2 text-dim">
        Marcar &quot;Editar&quot; acende &quot;Ver&quot; na mesma hora; apagar &quot;Ver&quot;
        apaga &quot;Editar&quot; junto — não se altera o que não se enxerga.
      </p>
      {temMudancaNaoGravada && (
        // O aviso só aparece quando há o que gravar. Um lembrete permanente
        // seria ruído em toda visita e deixaria de ser lido justamente na
        // visita em que há mudança pendente de verdade.
        <p className="apoio mt-2 text-warn">Estas mudanças ainda não foram gravadas.</p>
      )}
      <BotaoEnviar rotulo="Salvar permissões" className="mt-3" />
    </>
  )
}

/**
 * Uma das três listas do resumo. `<dl>` e não três parágrafos porque é
 * literalmente termo e definição — e é o que faz um leitor de tela anunciar
 * "Altera: Motores, Elétrica…" em vez de despejar quinze substantivos soltos.
 */
function LinhaDoResumo({
  rotulo,
  areas,
  vazio,
}: {
  rotulo: string
  areas: string[]
  vazio: string
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <dt className="rotulo w-20 shrink-0 text-dim">{rotulo}</dt>
      <dd className="corpo min-w-0 flex-1">
        {/* Lista vazia NÃO é lacuna a preencher com traço: aqui "nenhuma" é
            resposta, e resposta que a pessoa precisa ler por extenso — "sem
            acesso: nenhuma área de fora" é a frase que faz alguém perceber
            que acabou de conceder o barco inteiro. */}
        {areas.length > 0 ? areas.join(" · ") : <span className="text-dim">{vazio}</span>}
      </dd>
    </div>
  )
}

/**
 * UMA CAIXA DA GRADE — 20px de desenho dentro de 44px de alvo.
 *
 * É a mesma separação de `ALVO_ACAO`/`PILULA_ACAO` (`lib/ui/acoes.ts`): a
 * caixinha marcada precisa continuar pequena pra grade de quinze linhas caber
 * na tela, e o dedo precisa dos 44px que não se negociam. Quem carrega o alvo
 * é o `<label>` — que, de quebra, torna toda a célula clicável, e não só o
 * quadradinho no meio dela. São trinta alvos nesta tela.
 *
 * O `aria-label` fica no `<input>` (e não como texto do `<label>`, que é
 * vazio de propósito): o nome acessível precisa dizer a coluna E a área
 * ("Editar Motores"), porque fora do contexto visual da grade um "Editar"
 * solto não distingue uma linha da outra.
 */
function CaixaDaGrade({
  aba,
  coluna,
  marcado,
  aoAlternar,
}: {
  aba: Aba
  coluna: Coluna
  marcado: boolean
  aoAlternar: (aba: Aba, coluna: Coluna, marcado: boolean) => void
}) {
  return (
    <label
      className={`flex h-[var(--altura-controle)] w-12 shrink-0 cursor-pointer items-center justify-center ${TOQUE}`}
    >
      <input
        type="checkbox"
        name={`${aba}_${coluna}`}
        checked={marcado}
        onChange={(e) => aoAlternar(aba, coluna, e.target.checked)}
        aria-label={`${ROTULO_COLUNA[coluna]} ${ROTULO_ABA[aba]}`}
        className="size-5 accent-[var(--acao)]"
      />
    </label>
  )
}
