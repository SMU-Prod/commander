import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { CardEmbarcacao } from "@/components/card-embarcacao"
import { Horimetro } from "@/components/horimetro"
import { Icone } from "@/components/icone"
import { SeloGold } from "@/components/selos/selo-gold"
import { SeloVerified } from "@/components/selos/selo-verified"
import { SituacaoVerified } from "@/components/selos/situacao-verified"
import { PatrocinioDashboard } from "@/components/publicidade/patrocinio-dashboard"
import { Abas } from "@/components/ui/abas"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { abaDoEquipamento, abaDoItem, CATEGORIAS_CASCO, ROTULO_CASCO } from "@/lib/domain/diario"
import {
  calcularSemaforo, formatarDataCurta, PESO, temInformacaoSuficiente, vencimentoPorData, type StatusFarol,
} from "@/lib/domain/semaforo"
import {
  carregarAcessoEmbarcacoes, carregarPainel, carregarVerified, hojeISO, itemMonitoradoToItemCalc,
} from "@/lib/consultas"
import { carregarMapaDaEmbarcacao } from "@/lib/consultas-mapa"
import { mensagemDowngrade } from "@/lib/domain/assinatura-ciclo"
import { carregarSeloGold } from "@/lib/consultas-gold"
import { carregarPatrocinioDashboard } from "@/lib/consultas-publicidade"
import { podeVer, podeEditar, type Aba } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import { ALVO_ACAO, PILULA_ACAO } from "@/lib/ui/acoes"

export default async function BarcoPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const { embarcacao, equipamentos, itens, papel, permissoes } = painel
  const hoje = hojeISO()
  const [verified, seloGold, acesso, patrocinios, mapa] = await Promise.all([
    carregarVerified(),
    carregarSeloGold(embarcacao.id),
    carregarAcessoEmbarcacoes(),
    // §20 — a segmentação mínima é a REGIÃO, e ela vem da embarcação aberta.
    // Nula significa "não sei onde este barco está": nesse caso só entra
    // campanha sem segmentação regional (ver `segmentacaoAtende`).
    carregarPatrocinioDashboard(embarcacao.regiao_id),
    // Mapa da Embarcação (onda 61) — o MESMO agregado da tela /barco/mapa,
    // pra porta nunca discordar da sala no número de zonas pedindo atenção.
    carregarMapaDaEmbarcacao(),
  ])
  // Só avisa quando a embarcação ABERTA é uma das excedentes — um aviso
  // genérico em todo barco seria ruído pra quem está justamente no barco que
  // continua liberado.
  const avisoPlano = acesso.ativaBloqueada ? mensagemDowngrade(acesso.divisao, acesso.limite) : null

  // O MESMO "verde por omissão" do `statusGeral` mora aqui, e este NÃO dá pra
  // fechar sem tocar no componente: `Horimetro` pede `status: StatusFarol`
  // (não aceita `null`), então um motor sem nenhum item monitorado continua
  // com farol verde no mostrador. O certo é `StatusFarol | null` com o anel
  // vazio que o Casco já desenha logo abaixo — `components/horimetro.tsx` é de
  // outro agente nesta rodada, está no relatório.
  // ONDA 94 — devolve `null` quando NÃO HÁ informação suficiente, e o
  // `Horimetro` desenha o anel vazio. O `?? "ok"` que estava aqui era o mesmo
  // verde falso que o escudo do herói acabou de perder: um motor sem item
  // monitorado (ou com item sem intervalo nem data) acendia "em dia" sobre um
  // motor de que o app não sabe nada.
  // `temInformacaoSuficiente` é a MESMA régua que a Início usa desde a onda 7 —
  // não é um segundo critério, é o critério.
  const statusDoEquipamento = (eqId: string): StatusFarol | null =>
    itens
      .filter((i) => i.equipamento_id === eqId)
      .map((i) => {
        const eq = equipamentos.find((e) => e.id === eqId)
        const calc = itemMonitoradoToItemCalc(i)
        return temInformacaoSuficiente(calc, eq?.horas_atuais ?? null)
          ? calcularSemaforo(calc, eq?.horas_atuais ?? null, hoje).status
          : null
      })
      .filter((s): s is StatusFarol => s !== null)
      .sort((a, b) => PESO[b] - PESO[a])[0] ?? null

  const motores = equipamentos.filter((e) => e.tipo === "motor")
  // Era contado duas vezes dentro do JSX da seção Elétrica; agora a aba de
  // salto lê o MESMO número, e ele passa a existir uma vez só.
  const eletricos = equipamentos.filter((e) => abaDoEquipamento(e.tipo) === "eletrica")
  const itensDoCasco = itens.filter((i) => (CATEGORIAS_CASCO as readonly string[]).includes(i.categoria ?? ""))
  // Duas coisas diferentes que moravam na mesma seção: documentos (categoria
  // "documento") e itens gerais da embarcação, sem motor/elétrica/casco/
  // documento — o item "Embarcação (geral)" do formulário cai aqui.
  const documentos = itens.filter((i) => i.categoria === "documento")
  const outrasManutencoes = itens.filter((i) => i.categoria === null && i.equipamento_id === null)

  // ONDA 93 — O ESCUDO VERDE POR OMISSÃO ERA A PRIMEIRA COISA DA TELA, E ERA
  // MENTIRA. O `?? "ok"` que estava aqui pintava "Em dia" no herói de um barco
  // SEM NENHUM item monitorado, e um item sem intervalo nem data votava "ok"
  // do mesmo jeito (é o que `calcularSemaforo` devolve quando não há régua
  // nenhuma pra medir). Verde por ausência de dado é exatamente o que a regra
  // de honestidade da onda 16 proíbe — está escrito em `seloDoFarol`: "null é
  // equipamento sem nenhum item monitorado: neutro e 'Sem dados' — NUNCA verde
  // por omissão". A ficha de equipamento (`statusFicha`) e a de item
  // (`statusItem`) já faziam assim; a porta do barco, não.
  //
  // `temInformacaoSuficiente` é o mesmo filtro que /hoje e /barco/saude usam
  // pra decidir quem entra na conta — nenhuma régua nova aqui.
  //
  // Sem nenhum item com dado real, `statusGeral` fica `null` e o escudo
  // simplesmente NÃO é desenhado (`statusGeral` é opcional em
  // `CardEmbarcacao`) — a mesma escolha do anel vazio do Casco, mais abaixo:
  // ausência de farol lê como "ainda não sei", verde lê como "está tudo bem".
  const statusGeral: StatusFarol | null =
    itens
      .flatMap((i) => {
        const eq = equipamentos.find((e) => e.id === i.equipamento_id)
        const calc = itemMonitoradoToItemCalc(i)
        const horas = eq?.horas_atuais ?? null
        return temInformacaoSuficiente(calc, horas) ? [calcularSemaforo(calc, horas, hoje).status] : []
      })
      .sort((a, b) => PESO[b] - PESO[a])[0] ?? null

  const supabase = await supabaseServer()
  const urlCapa = embarcacao.foto_capa_path
    ? (await supabase.storage.from("acervo").createSignedUrl(embarcacao.foto_capa_path, 3600)).data?.signedUrl ?? null
    : null

  return (
    <main>
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {/* §23, downgrade Commander Pro → Commander: "não apagar embarcações
          excedentes; BLOQUEAR GESTÃO das excedentes e exigir seleção da
          embarcação ativa até regularização".

          O aviso fica no topo da ficha do barco porque é aqui que a pessoa
          vem tentar gerenciar. Ele explica a pausa e diz, com todas as
          letras, que nada foi apagado — a leitura do dossiê continua inteira
          (por isso o bloqueio é um aviso, não uma parede: esconder a ficha
          seria exatamente o "apagar" que o PRD proíbe). */}
      {avisoPlano && (
        <div className="sombra-1 mt-3 rounded-[var(--raio-cartao)] border border-aten/40 bg-panel p-4">
          <p className="titulo-card">Gestão pausada pelo plano</p>
          <p className="apoio mt-1 text-dim">{avisoPlano}</p>
          <Link href="/menu/assinatura" className="apoio mt-3 inline-block font-semibold text-accent-forte">
            Ver planos
          </Link>
        </div>
      )}

      <CardEmbarcacao
        embarcacao={embarcacao}
        statusGeral={statusGeral ?? undefined}
        urlCapa={urlCapa}
        podeEditarFotos={podeEditar(permissoes, "fotos")}
      />

      {/* Mapa da Embarcação (onda 61, spec §3.4) — a porta pra tela nova,
          logo abaixo do herói: com dado, diz quantas zonas pedem atenção
          (mesma conta de /barco/mapa, via `carregarMapaDaEmbarcacao`); sem
          nenhum equipamento mapeado, vira convite — nunca "0" seco. */}
      {mapa && (
        <LinhaLista
          href="/barco/mapa"
          variant="cartao"
          className="mt-2"
          leading={<Icone nome="mapa" className="size-5 shrink-0 text-dim" />}
          titulo="Mapa da embarcação"
          subtitulo={
            mapa.zonas.length === 0
              ? "O barco em corte — diga onde cada equipamento mora"
              : mapa.zonasPedindoAtencao > 0
                ? `${mapa.zonasPedindoAtencao === 1 ? "1 zona pede" : `${mapa.zonasPedindoAtencao} zonas pedem`} atenção${mapa.naoMapeados.length > 0 ? ` · ${mapa.naoMapeados.length} sem zona` : ""}`
                : `Zonas mapeadas sem pendência${mapa.naoMapeados.length > 0 ? ` · ${mapa.naoMapeados.length} sem zona` : ""}`
          }
        />
      )}

      {/* ONDA 92 — `Abas` EM /barco, MAS COMO ÂNCORA, NÃO COMO RECORTE.
          ------------------------------------------------------------------
          A auditoria de 19/08 (achado 1.3) mede o problema certo: oito
          `SecaoPagina` gastam 457px — 61% de uma tela de 390×844 — só em
          cabeçalho, e propõe `Abas` pra quebrar isso. A proposta foi avaliada
          e aceita PELA METADE, e é a metade que importa.

          O QUE NÃO ENTRA: aba que RECORTA conteúdo. Esta é a tela que
          responde "como está meu barco". Recortar em oito abas esconde sete
          oitavos da resposta atrás de um toque e transforma uma rolagem em
          oito navegações — e como o estado de `Abas` mora na URL, cada uma é
          uma ida ao servidor. Pior: o que o dono precisa VER (o farol vermelho
          de um item do Casco, o documento vencido) passaria a depender de ele
          adivinhar em qual aba mora. `Abas` tem `contagem`, mas contagem não é
          farol — "Casco 6" não diz que um dos seis está vencido. Esconder
          semáforo atrás de número é exatamente a troca que este app não faz.

          O QUE ENTRA: a mesma leitura da referência — a ficha de equipamento
          já usa `Abas` com `href="#seção"` e `ativa=""`, rolagem contínua,
          nada escondido (onda 79, "isto é atalho, não recorte de conteúdo").
          É o índice que a tela pedia, custa uma linha de 44px, e a resposta
          inteira continua a um scroll de distância.

          O QUE FICOU PENDENTE E FECHA AGORA (onda 93): os 457px de moldura.
          A prop `denso` de `SecaoPagina` (`mt-4 mb-1` no lugar de `mt-6 mb-2`)
          nasceu na onda 91 pra este achado e passou a onda inteira sem
          consumidor. As oito seções abaixo a pedem, e a conta medida é:

            seção            antes   depois
            com ação (5×)    62,0    50,5     (24 + 30 + 8 → 16 + 30 + 4)
            sem ação (3×)    48,5    36,5     (24 + 16,5 + 8 → 16 + 16,5 + 4)
            TOTAL            455,5   359,5

          — 96px devolvidos, 12 por seção, sem esconder nada e sem tocar no
          rótulo. (A linha do cabeçalho é 30px com ação — `ALVO_ACAO` é 44px de
          toque com `-my-[7px]` devolvendo 14 ao layout — e 16,5px sem ela, que
          é a entrelinha do `.rotulo`. O alvo de toque continua 44px: `denso`
          mexe em margem, não no alvo.)

          NÃO se resolve com `mt-*` no `className`: duas classes da mesma
          família no mesmo elemento é loteria de ordem de CSS (ver
          `botao-ficha.tsx`) — e o Tailwind emite `.mt-5` ANTES de `.mt-6`, ou
          seja, o `mt-6` do componente vence sempre. Era o caso do
          `className="mt-5"` de /barco/documentos, inerte desde que foi
          escrito. */}
      <Abas
        className="mt-4"
        abas={[
          { valor: "motores", rotulo: "Motores", href: "#motores", contagem: motores.length },
          { valor: "eletrica", rotulo: "Elétrica", href: "#eletrica", contagem: eletricos.length },
          { valor: "casco", rotulo: "Casco", href: "#casco", contagem: itensDoCasco.length },
          { valor: "documentos", rotulo: "Documentos", href: "#documentos", contagem: documentos.length },
          { valor: "outras", rotulo: "Manutenções", href: "#outras", contagem: outrasManutencoes.length },
          // Sem `contagem` de propósito nas três últimas: elas não são coleção
          // de nada. Um número ali teria de ser inventado, e `Abas` documenta
          // que aba sem número diz "não sei contar isto" — que é a verdade.
          { valor: "ferramentas", rotulo: "Ferramentas", href: "#ferramentas" },
          { valor: "selos", rotulo: "Selos", href: "#selos" },
          { valor: "dados", rotulo: "Dados gerais", href: "#dados" },
        ]}
        ativa=""
      />

      <SecaoPagina
        id="motores"
        denso
        className="scroll-mt-4"
        icone="motor"
        acao={podeEditar(permissoes, "motores") ? { href: "/barco/equipamento/novo?tipo=motor", rotulo: "Motor", icone: "mais" } : undefined}
      >
        Motores
      </SecaoPagina>
      {motores.length === 0 && (
        <EstadoVazio
          icone="motor"
          titulo="Nenhum motor cadastrado ainda"
          descricao="Cadastre pra ganhar horímetro e checklist de manutenção automáticos."
          className="mb-2"
        />
      )}
      <div className="grid grid-cols-2 gap-2">
        {motores.map((m) => (
          <Link key={m.id} href={`/barco/equipamento/${m.id}`}>
            <Horimetro
              rotulo={m.posicao ?? "Motor"}
              horas={m.horas_atuais}
              status={statusDoEquipamento(m.id)}
            />
          </Link>
        ))}
      </div>

      <SecaoPagina id="eletrica" denso className="scroll-mt-4" icone="raio" acao={{ href: "/barco/eletrica", rotulo: "Ver tudo" }}>
        Elétrica
      </SecaoPagina>
      <LinhaLista
        href="/barco/eletrica"
        variant="cartao"
        leading={<Icone nome="raio" className="size-5 shrink-0 text-dim" />}
        titulo={eletricos.length === 0 ? "Cadastre gerador e baterias" : `${eletricos.length} equipamentos`}
        subtitulo="Manutenção do gerador, troca das baterias e painel de bordo"
      />

      {/* Equipamentos (PRD §17) — área flexível, separada da Elétrica desde a
          onda 41: a matriz de permissões já tratava as duas como áreas
          distintas, faltava a tela. */}
      {podeVer(permissoes, "equipamentos") && (
        <LinhaLista
          href="/barco/equipamentos"
          variant="cartao"
          className="mt-2"
          leading={<Icone nome="ferramenta" className="size-5 shrink-0 text-dim" />}
          titulo="Equipamentos"
          subtitulo="Bote, guincho, ar-condicionado e o mais que você acompanhar"
        />
      )}

      {podeVer(permissoes, "hidraulica") && (
        <LinhaLista
          href="/barco/hidraulica"
          variant="cartao"
          className="mt-2"
          leading={<Icone nome="hidraulica" className="size-5 shrink-0 text-dim" />}
          titulo="Hidráulica"
          subtitulo="Água doce, Grey Water e Black Water"
        />
      )}
      {podeVer(permissoes, "seguranca") && (
        <LinhaLista
          href="/barco/seguranca"
          variant="cartao"
          className="mt-2"
          leading={<Icone nome="seguranca" className="size-5 shrink-0 text-dim" />}
          titulo="Segurança"
          subtitulo="Coletes, extintores, balsa — validade e último teste"
        />
      )}

      <SecaoPagina id="casco" denso className="scroll-mt-4" icone="escudo">Casco</SecaoPagina>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
        {CATEGORIAS_CASCO.map((c) => {
          const doGrupo = itens.filter((i) => i.categoria === c)
          const status = doGrupo
            .map((i) => calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje).status)
            .sort((a, b) => PESO[b] - PESO[a])[0]
          return (
            <LinhaLista
              key={c}
              leading={status ? <Farol status={status} /> : <span className="size-2 rounded-[var(--raio-pilula)] border border-line" />}
              titulo={ROTULO_CASCO[c]}
              trailing={
                doGrupo.length === 0 ? (
                  // Onda 63 — neutro, não dourado: o Casco tem seis categorias
                  // e num barco novo as seis estão vazias, ou seja, SEIS
                  // "Adicionar" dourados de uma vez. É o mesmo raciocínio (e o
                  // mesmo vestido) do `enfase="discreta"` de `EstadoVazio`.
                  // Onda 82 — o vestido deixou de ser sublinhado e virou
                  // pílula de contorno: era a coluna de "Adicionar" desta
                  // seção que o dono apontou como texto comum fingindo ser
                  // ação. Ver `lib/ui/acoes.ts`.
                  <Link
                    href={`/barco/itens/novo?alvo=${encodeURIComponent(`cat:${c}`)}`}
                    className={ALVO_ACAO}
                  >
                    <span className={PILULA_ACAO}>Adicionar</span>
                  </Link>
                ) : (
                  <span className="shrink-0 font-mono-instr text-xs tabular-nums text-dim">{doGrupo.length} itens</span>
                )
              }
            />
          )
        })}
      </div>

      <SecaoPagina id="documentos" denso className="scroll-mt-4" icone="documento">Documentos</SecaoPagina>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
        {documentos.length === 0 && (
          <EstadoVazio
            variant="linha"
            icone="documento"
            titulo="Nenhum documento com vencimento cadastrado"
            descricao="Seguro, TIE, vistoria — cadastre a validade e o semáforo avisa antes de vencer."
            acao={podeEditar(permissoes, "documentos") ? { href: "/barco/documentos", rotulo: "Adicionar documento" } : undefined}
            // Aninhado dentro do painel de Documentos, num hub que não tem
            // ação principal: exatamente o caso que o cabeçalho de
            // `EstadoVazio` descreve pro `enfase="discreta"`.
            enfase="discreta"
          />
        )}
        {documentos.map((i) => {
          const r = calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje)
          const venc = vencimentoPorData(itemMonitoradoToItemCalc(i))
          const editavelItem = podeEditar(permissoes, abaDoItem(i, equipamentos))
          const dias = r.diasRestantes != null
            ? r.diasRestantes < 0 ? `vencido há ${-r.diasRestantes} d` : `${r.diasRestantes} dias`
            : "—"
          return (
            <LinhaLista
              key={i.id}
              href={editavelItem ? `/barco/itens/${i.id}/editar` : undefined}
              leading={<Farol status={r.status} />}
              titulo={i.nome}
              valor={`${dias}${venc ? ` · ${formatarDataCurta(venc)}` : ""}`}
              valorClassName={r.status === "vencido" ? "text-crit" : r.status === "atencao" ? "text-warn" : "text-dim"}
            />
          )
        })}
      </div>

      <SecaoPagina
        id="outras"
        denso
        className="scroll-mt-4"
        icone="ferramenta"
        acao={podeEditar(permissoes, "embarcacao") ? { href: "/barco/itens/novo", rotulo: "Manutenção", icone: "mais" } : undefined}
      >
        Outras manutenções
      </SecaoPagina>
      {/* O `-mt-1` saiu junto com o `denso`, e não é descuido: margens de
          irmãos adjacentes COLAPSAM, então os 8px do `mb-2` da seção mais os
          -4px daqui davam 4px de folga. Com `denso` o `mb` já é 4 — manter o
          negativo grudaria a frase no rótulo (0px). Sem ele, a folga continua
          exatamente os mesmos 4px de antes. */}
      <p className="apoio mb-2 text-dim">Vence, mas não é motor, elétrica, casco nem documento.</p>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
        {outrasManutencoes.length === 0 && (
          <EstadoVazio variant="linha" icone="ferramenta" titulo="Nenhuma outra manutenção cadastrada ainda" />
        )}
        {outrasManutencoes.map((i) => {
          const r = calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje)
          const venc = vencimentoPorData(itemMonitoradoToItemCalc(i))
          const editavelItem = podeEditar(permissoes, abaDoItem(i, equipamentos))
          const dias = r.diasRestantes != null
            ? r.diasRestantes < 0 ? `vencido há ${-r.diasRestantes} d` : `${r.diasRestantes} dias`
            : "—"
          return (
            <LinhaLista
              key={i.id}
              href={editavelItem ? `/barco/itens/${i.id}/editar` : undefined}
              leading={<Farol status={r.status} />}
              titulo={i.nome}
              valor={`${dias}${venc ? ` · ${formatarDataCurta(venc)}` : ""}`}
              valorClassName={r.status === "vencido" ? "text-crit" : r.status === "atencao" ? "text-warn" : "text-dim"}
            />
          )
        })}
      </div>

      <SecaoPagina id="ferramentas" denso className="scroll-mt-4" icone="imagem">Ferramentas do dia a dia</SecaoPagina>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            { href: "/barco/documentos", rotulo: "Documentos", desc: "validade e arquivos", aba: "documentos" },
            // Onda 42: "Gastos" virou "Financeiro" (PRD §9.1) — mesma área de
            // permissão (`gastos`), tela nova. /barco/gastos continua existindo
            // como redirect pra quem tiver o link velho.
            { href: "/financeiro", rotulo: "Financeiro", desc: "despesas, entradas e saldo", aba: "gastos" },
            { href: "/carteira", rotulo: "Carteira", desc: "repasse à tripulação", aba: "carteira" },
            { href: "/diario", rotulo: "Diário de Bordo", desc: "registrar saídas e serviços" },
            { href: "/barco/ocorrencias", rotulo: "Ocorrências", desc: "abertas, em curso, resolvidas" },
            { href: "/barco/historico", rotulo: "Histórico", desc: "tudo, num lugar só", aba: "historico" },
            // Onda 62: "Resumos" virou "Relatórios" (canvas tela-1g) — a
            // porta com o mesmo nome da sala.
            { href: "/barco/resumos", rotulo: "Relatórios", desc: "custo e uso do período, em PDF", aba: "historico" },
            { href: "/barco/fotos", rotulo: "Fotos", desc: "álbuns do barco", aba: "fotos" },
            { href: "/barco/contatos", rotulo: "Contatos", desc: "quem cuida do barco", aba: "contatos" },
          ] as { href: string; rotulo: string; desc: string; aba?: Aba }[]
        )
          .filter((c) => !c.aba || podeVer(permissoes, c.aba))
          .map((c) => (
            <Link key={c.href} href={c.href} className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3.5">
              <p className="titulo-card">{c.rotulo}</p>
              <p className="apoio mt-0.5 text-dim">{c.desc}</p>
            </Link>
          ))}
      </div>

      <SecaoPagina id="selos" denso className="scroll-mt-4" icone="escudo" acao={{ href: "/barco/selos", rotulo: "Ver tudo" }}>
        Selos Commander
      </SecaoPagina>
      <Link
        href="/barco/selos"
        className="sombra-1 block rounded-[var(--raio-cartao)] border border-line bg-panel p-3.5"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="titulo-card inline-flex min-w-0 items-center gap-1.5">
            <SeloVerified size={18} /> Commander Verified
          </p>
          {verified && <SituacaoVerified selo={verified.selo} />}
        </div>
        {/* Requisitos atendidos e o que falta — contagem, nunca barra de
            progresso: barra é porcentagem desenhada, e o PRD §15 proíbe
            porcentagem no selo. */}
        {verified && (
          <p className="apoio mt-1 text-dim">
            {verified.completos} de {verified.total} requisitos atendidos
            {verified.pendentes.length > 0 && ` · falta ${verified.pendentes[0].rotulo.toLowerCase()}`}
            {verified.pendentes.length > 1 && ` +${verified.pendentes.length - 1}`}
          </p>
        )}
        <p className="apoio mt-2 inline-flex items-center gap-1.5 text-dim">
          <SeloGold size={16} variant={seloGold ? "ativo" : "convite"} /> Commander Gold — avaliação
          presencial, não depende do Verified.
        </p>
      </Link>

      <Link
        href="/barco/connect"
        className="sombra-1 mt-2 block rounded-[var(--raio-cartao)] border border-line bg-panel p-3.5"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="titulo-card inline-flex items-center gap-1.5">
            <Icone nome="sinal" className="size-4 text-dim" /> Commander Connect
          </p>
          {/* Onda 87 — o mesmo selo "Em breve" de /barco/connect, que lá era
              11px e aqui 10, abaixo do piso tipográfico. Os dois agora pedem
              `.rotulo`, que é o desenho declarado desse gesto. */}
          <span className="shrink-0 rounded-[var(--raio-pilula)] border border-line bg-panel2 px-2 py-0.5 rotulo text-dim-chip">
            Em breve
          </span>
        </div>
        <p className="apoio mt-0.5 text-dim">Conectividade NMEA 2000 pro diário automático.</p>
      </Link>

      {/* "Editar" fica: é a exceção declarada do rótulo único (achado 6.1) —
          o verbo muda o que acontece de verdade, porque leva a uma tela de
          edição, não a uma lista. */}
      <SecaoPagina
        id="dados"
        denso
        className="scroll-mt-4"
        icone="embarcacao"
        acao={papel === "PROP" ? { href: "/barco/editar", rotulo: "Editar" } : undefined}
      >
        Dados gerais
      </SecaoPagina>
      {/* ALTERNATIVA DESCARTADA (onda 93): trocar este painel por `Cartao`
          com `nivel="painel"`, que é o desenho declarado do painel de primeiro
          nível (raio 16 + `.painel-lustro`). Ele É um painel de primeiro nível
          e ganharia 8px com o `p-3`, mas os três painéis logo acima (Casco,
          Documentos, Outras manutenções) NÃO podem seguir junto: são caixas de
          `LinhaLista variant="grupo"`, que pedem `px-4` sem padding vertical
          pra linha nenhuma perder o ritmo — o `p-3` de `Cartao` quebraria as
          três. Promover só este deixaria dois raios diferentes no mesmo nível
          da mesma tela, que é justamente a hierarquia achatada que o
          `--raio-painel` existe pra desfazer. A promoção é da tela inteira, e
          por isso vai no relatório em vez de meia. */}
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {([
            ["Comprimento", embarcacao.comprimento_m != null ? `${embarcacao.comprimento_m.toLocaleString("pt-BR")} m` : null],
            ["Boca", embarcacao.boca_m != null ? `${embarcacao.boca_m.toLocaleString("pt-BR")} m` : null],
            ["Calado", embarcacao.calado_m != null ? `${embarcacao.calado_m.toLocaleString("pt-BR")} m` : null],
            ["Casco", [embarcacao.casco_material, embarcacao.casco_numero].filter(Boolean).join(" · ") || null],
            ["Propulsão", embarcacao.propulsao],
            ["TIE", embarcacao.tie],
            ["Capitania", embarcacao.capitania],
          ] as [string, string | null][]).map(([nome, valor]) => (
            <div key={nome}>
              <dt className="rotulo text-dim">{nome}</dt>
              <dd className="corpo mt-0.5">{valor ?? <span className="text-dim">—</span>}</dd>
            </div>
          ))}
        </dl>
      </div>

      {papel === "PROP" && (
        <LinhaLista
          href="/barco/local"
          variant="cartao"
          className="mt-6"
          leading={<Icone nome="mapa" className="size-5 shrink-0 text-dim" />}
          titulo="Posição da marina"
          subtitulo={
            embarcacao.marina_lat != null && embarcacao.marina_lon != null
              ? `${embarcacao.marina_lat.toFixed(4)}, ${embarcacao.marina_lon.toFixed(4)}`
              : "Defina para ligar o boletim do mar"
          }
        />
      )}

      {/* §3.4, última linha do bloco do Dashboard: "Publicidade: no máximo
          uma unidade visível por vez, carrossel de até 5 patrocinadores,
          SEMPRE ABAIXO DA ÁREA OPERACIONAL PRIORITÁRIA."

          Por isso está aqui embaixo, depois de tudo — saúde, atenção,
          motores, casco, documentos, ferramentas, selos e dados gerais. O
          proprietário paga assinatura e ainda assim vê anúncio: é o que o
          §20 desenha, não uma liberdade tomada aqui. O que dá pra garantir
          sem contrariar o PRD está garantido — o anúncio não empurra
          nenhuma informação operacional pra baixo, se identifica como
          "Patrocinado", não gira sozinho e não aparece em tela de
          segurança/ocorrência (`TELAS_SEM_PUBLICIDADE`). */}
      <PatrocinioDashboard anuncios={patrocinios} />
    </main>
  )
}
