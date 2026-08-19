import Link from "next/link"
import { redirect } from "next/navigation"
import { Confirmar } from "@/components/confirmar"
import { Icone } from "@/components/icone"
import { EscolherPonto } from "@/components/mapa/escolher-ponto"
import { EscolherPinoParceiro } from "@/components/mapa/escolher-pino-parceiro"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { ChipDado } from "@/components/ui/chip"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import {
  adicionarAcomodacao,
  excluirAcomodacao,
  excluirFotoParceiro,
  salvarParceiro,
  subirFotoParceiro,
} from "@/lib/acoes/parceiro"
import { carregarTaxonomia } from "@/lib/consultas-marketplace"
import { carregarMeuPartner, urlFotoParceiro } from "@/lib/consultas-partner"
import { formatarReais } from "@/lib/domain/gastos"
import {
  AVISO_DISPONIBILIDADE_MARINA,
  ICONE_TIPO_PARTNER,
  perfilTem,
  ROTULO_MEU_PERFIL,
  ROTULO_TIPO_PARTNER,
  ROTULO_TIPO_VAGA,
  ROTULO_TOGGLE,
  taxonomiasDoPartner,
  TIPOS_PARTNER,
  TIPOS_VAGA_MARINA,
  toggleDisponivel,
  type TipoPartner,
} from "@/lib/domain/partner"
import { ROTULO_TIPO_TAXONOMIA } from "@/lib/domain/marketplace"
import { numeroParaCampoPtBr, rot } from "@/lib/ui/form"
import { ALVO_ACAO, PILULA_ACAO } from "@/lib/ui/acoes"
import { COR_PADRAO, ICONE_PADRAO_POR_CATEGORIA } from "@/lib/mapa/pino-parceiro"
import { supabaseServer } from "@/lib/supabase/server"
import type { ParceiroVaga } from "@/lib/db/types"

/**
 * O PERFIL DO PARTNER, POR TIPO (PRD §13.1 a §13.6).
 *
 * A tela é montada a partir do TIPO SALVO, não de CSS condicional: os blocos
 * de Marina (vagas), Restaurante (cardápio) e Pousada (acomodações) são
 * grandes demais pra viverem escondidos no HTML de todo mundo — e o §13 é
 * claro que cada tipo tem um perfil, não um formulário universal com campos
 * apagados. Consequência honesta: trocar o tipo e salvar é que revela os
 * campos novos, e a tela avisa isso em vez de deixar a pessoa procurando.
 *
 * O rótulo da página é o do §13.2 generalizado — "Minha Loja", "Minha
 * Marina", "Meu Perfil" —, nunca "Commander Partner", que é o nome do plano.
 */
function precoParaCampo(centavos: number | null): string {
  return centavos == null ? "" : (centavos / 100).toFixed(2).replace(".", ",")
}

/** Campo que recebe NÚMERO — vaga, calado, preço, quantidade. Mono tabular,
 *  como todo dígito do app (docs/DESIGN.md §5): sem isso a coluna de preços
 *  desalinha a vírgula e a comparação vira leitura de texto.
 *
 *  NÃO recebe `.valor` (14px) nem nenhum dos três degraus da onda 87, e é
 *  decisão: os degraus vestem número EXIBIDO — valor de linha, cartão de KPI,
 *  mostrador. Aqui o número está dentro de um `<input>`, que herda o
 *  `text-base` de `lib/ui/form.ts` — 16px é o que impede o iOS de dar zoom ao
 *  focar o campo, e trocá-lo por 14 pagaria a hierarquia com a tela pulando
 *  na cara de quem digita. Tamanho de controle e tamanho de dado são réguas
 *  diferentes. */
const NUMERO = "font-mono-instr tabular-nums"

/**
 * A LINHA DE CAIXA DE SELEÇÃO — E OS 44px QUE ELA NÃO TINHA.
 *
 * Eram oito rótulos de caixa nesta tela, todos com o mesmo vestido escrito à
 * mão (`corpo`, `flex`, `items-center`, `gap-2.5` — e nenhuma altura):
 * texto de 14px ao lado de uma caixa de 20px, ou seja, ~21px de alvo — menos
 * da METADE do piso de `--altura-controle`, na tela mais longa da área do
 * Partner e num app usado com a mão molhada, no barco balançando. O alvo
 * verdadeiro era só o quadradinho de 20px, porque o `<label>` não tinha
 * altura própria pra emprestar.
 *
 * `min-h` e não `h`: rótulo que quebre em duas linhas ("Valores sob consulta"
 * numa coluna estreita) cresce em vez de ser cortado — mesmo raciocínio do
 * `campo` em `lib/ui/form.ts`. O token e não `min-h-11` cravado: a régua de
 * toque virou `--altura-controle` na onda 94 justamente pra não renascer como
 * número solto em cada arquivo. `cursor-pointer` porque a área toda passa a
 * ser tocável, e um alvo de 44px que não parece alvo é meio caminho andado.
 */
const CAIXA = "corpo flex min-h-[var(--altura-controle)] cursor-pointer items-center gap-2.5"

export default async function ParceiroPerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>
}) {
  const { erro, ok } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?volta=/parceiro/perfil")

  const meu = await carregarMeuPartner()
  const p = meu?.parceiro ?? null
  const tipo: TipoPartner = p?.categoria ?? "prestador"
  const taxonomia = await carregarTaxonomia()
  const regioes = taxonomia.filter((t) => t.tipo === "regiao")

  const tiposDeclaraveis = taxonomiasDoPartner({
    categoria: tipo,
    tambem_vende_produtos: p?.tambem_vende_produtos ?? false,
    tambem_presta_servicos: p?.tambem_presta_servicos ?? false,
  })
  const declaradas = new Set((meu?.atividades ?? []).map((a) => a.taxonomia_id))
  const toggles = toggleDisponivel(tipo)

  const vagaPorTipo = new Map<string, ParceiroVaga>((meu?.vagas ?? []).map((v) => [v.tipo, v]))

  const fotos = await Promise.all(
    (p?.fotos ?? []).map(async (path) => ({ path, url: await urlFotoParceiro(path) })),
  )
  const cardapio = await Promise.all(
    (p?.fotos_cardapio ?? []).map(async (path) => ({ path, url: await urlFotoParceiro(path) })),
  )

  return (
    <main>
      <h1 className="titulo-pagina">{p ? ROTULO_MEU_PERFIL[tipo] : "Criar meu perfil"}</h1>
      <p className="apoio mt-1 text-dim">
        {p
          ? "É isto que os proprietários veem no Explorar. Você mesmo atualiza, sem chamar ninguém."
          : "Escolha o tipo do seu negócio e publique. Você aparece no Explorar assim que salvar."}
      </p>
      {/* Era texto cinza de 17px de altura — o vestido que o app usa para o
          que NÃO se toca (`lib/ui/acoes.ts`). Vira pílula de contorno dentro
          do alvo de 44px. */}
      <Link href="/parceiros" className={`${ALVO_ACAO} mt-3`}>
        <span className={PILULA_ACAO}>
          <Icone nome="voltar" className="size-3.5" /> Ver a página pública de apresentação
        </span>
      </Link>

      {ok && <p className="corpo mt-4 rounded-[var(--raio-controle)] border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-4 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <form action={salvarParceiro} className="mt-6 space-y-5">
        <section className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
          <p className="rotulo text-dim">Tipo do seu negócio</p>
          <div className="grid grid-cols-2 gap-2.5">
            {TIPOS_PARTNER.map((t) => (
              <label
                key={t}
                htmlFor={`cat-${t}`}
                className="sombra-1 flex cursor-pointer flex-col items-center gap-1.5 rounded-[var(--raio-cartao)] border border-line bg-panel px-3 py-4 text-center has-[:checked]:border-accent"
              >
                <Icone nome={ICONE_TIPO_PARTNER[t]} className="size-6 text-accent-forte" />
                <span className="titulo-card">{ROTULO_TIPO_PARTNER[t]}</span>
                <input
                  id={`cat-${t}`}
                  type="radio"
                  name="categoria"
                  value={t}
                  defaultChecked={tipo === t}
                  className="sr-only"
                />
              </label>
            ))}
          </div>
          <p className="apoio text-dim">
            Um tipo principal por perfil. Trocar o tipo muda os campos desta página — salve para ver os novos.
          </p>
        </section>

        <section className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
          <p className="rotulo text-dim">Identificação</p>
          {/* ONDA 93 — os campos desta tela eram `label` + `input` montados à
              mão, com as classes de `lib/ui/form.ts`. `Campo` é essa casca
              (rótulo, controle, dica, erro) e existe justamente para o texto
              de apoio não ficar preso a um `<p>` avulso em cada tela. */}
          <Campo label="Nome" id="nome" name="nome" required minLength={3} defaultValue={p?.nome ?? ""} />
          {/* §10/§21.2 — a mesma lista do Marketplace, pra "Angra" ser sempre
              a mesma Angra dos dois lados. */}
          <CampoSelect
            label="Região onde você atua"
            id="regiao_id"
            name="regiao_id"
            required
            defaultValue={p?.regiao_id ?? ""}
            dica="É por aqui que os pedidos do Marketplace chegam até você, e é o filtro de região do Explorar."
          >
            <option value="" disabled>Escolha a região</option>
            {regioes.map((r) => (
              <option key={r.id} value={r.id}>{r.uf ? `${r.nome} · ${r.uf}` : r.nome}</option>
            ))}
          </CampoSelect>
          <div>
            <p className={rot}>Ponto no mapa</p>
            <EscolherPonto lat={p?.lat ?? null} lng={p?.lng ?? null} />
          </div>
        </section>

        <section className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
          <p className="rotulo text-dim">Pino no mapa</p>
          <EscolherPinoParceiro
            iconeInicial={p?.icone ?? ICONE_PADRAO_POR_CATEGORIA[tipo]}
            corInicial={p?.cor ?? COR_PADRAO}
            destaque={p?.plano === "destaque"}
          />
        </section>

        {/* §13.1 "Também vendo produtos" / §13.2 "Também presto serviços" */}
        {(toggles.tambem_vende_produtos || toggles.tambem_presta_servicos) && (
          <section className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            <p className="rotulo text-dim">Atividade complementar</p>
            {toggles.tambem_vende_produtos && (
              <label className={CAIXA}>
                <input
                  type="checkbox"
                  name="tambem_vende_produtos"
                  defaultChecked={p?.tambem_vende_produtos ?? false}
                  className="size-5 accent-[var(--acao)]"
                />
                {ROTULO_TOGGLE.tambem_vende_produtos}
              </label>
            )}
            {toggles.tambem_presta_servicos && (
              <label className={CAIXA}>
                <input
                  type="checkbox"
                  name="tambem_presta_servicos"
                  defaultChecked={p?.tambem_presta_servicos ?? false}
                  className="size-5 accent-[var(--acao)]"
                />
                {ROTULO_TOGGLE.tambem_presta_servicos}
              </label>
            )}
            <p className="apoio text-dim">
              Sem duplicar perfil: você continua com um tipo principal e passa a receber também os pedidos da
              atividade marcada. Salve para escolher as categorias.
            </p>
          </section>
        )}

        {tiposDeclaraveis.map((tipoTax) => {
          const itens = taxonomia.filter((t) => t.tipo === tipoTax)
          if (itens.length === 0) return null
          return (
            <section key={tipoTax} className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
              <p className="rotulo text-dim">{ROTULO_TIPO_TAXONOMIA[tipoTax]}</p>
              {/* A pílula de escolha desta lista media 32px de altura
                  (`apoio` + `py-1.5`) — abaixo do piso de toque, e é a lista
                  mais tocada da tela: é aqui que a Loja marca as categorias
                  e o Posto o combustível.
                  A anatomia vem do `Chip` do app (`components/ui/chip.tsx`),
                  que é a pílula única e já resolveu esta briga: altura
                  `--altura-controle`, raio `--raio-pilula`, `px-4`. Não dá
                  pra usar o componente — ele é um `<Link>` de filtro e isto é
                  caixa de seleção dentro de um `<form>` —, então o que se
                  copia é a MEDIDA, não o markup, pra não nascer a próxima
                  altura de pílula do app. O texto fica em `apoio`: são
                  dezenas de itens lado a lado, e 12px é o que mantém a grade
                  legível sem virar parede. */}
              <div className="flex flex-wrap gap-1.5">
                {itens.map((i) => (
                  <label
                    key={i.id}
                    className="apoio flex min-h-[var(--altura-controle)] cursor-pointer items-center rounded-[var(--raio-pilula)] border border-line bg-panel2 px-4 has-[:checked]:border-accent has-[:checked]:bg-accent/10"
                  >
                    <input
                      type="checkbox"
                      name="atividade"
                      value={i.id}
                      defaultChecked={declaradas.has(i.id)}
                      className="sr-only"
                    />
                    {i.nome}
                  </label>
                ))}
              </div>
              <p className="apoio text-dim">
                Sem nada marcado você recebe pedidos de todas as opções desta lista na sua região.
              </p>
            </section>
          )
        })}

        {/* §13.3 — vagas da Marina */}
        {perfilTem(tipo, "vagas") && (
          <section className="sombra-1 space-y-4 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            <p className="rotulo text-dim">Vagas</p>
            {TIPOS_VAGA_MARINA.map((tv) => {
              const v = vagaPorTipo.get(tv)
              return (
                <div key={tv} className="space-y-2.5 rounded-[var(--raio-cartao)] border border-line bg-panel2 p-3">
                  <p className="titulo-card">{ROTULO_TIPO_VAGA[tv]}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Campo label="Total" id={`vaga_${tv}_total`} name={`vaga_${tv}_total`} inputMode="numeric"
                      defaultValue={v?.total ?? ""} className={NUMERO} />
                    <Campo label="Livres" id={`vaga_${tv}_disponiveis`} name={`vaga_${tv}_disponiveis`} inputMode="numeric"
                      defaultValue={v?.disponiveis ?? ""} className={NUMERO} />
                    <Campo label="Porte (pés)" id={`vaga_${tv}_porte`} name={`vaga_${tv}_porte`} inputMode="numeric"
                      defaultValue={v?.porte_max_pes ?? ""} className={NUMERO} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Campo label="Diária" id={`vaga_${tv}_diaria`} name={`vaga_${tv}_diaria`} inputMode="decimal"
                      placeholder="150,00" defaultValue={precoParaCampo(v?.preco_diaria_centavos ?? null)}
                      className={NUMERO} />
                    <Campo label="Mensal" id={`vaga_${tv}_mensal`} name={`vaga_${tv}_mensal`} inputMode="decimal"
                      placeholder="2.400,00" defaultValue={precoParaCampo(v?.preco_mensal_centavos ?? null)}
                      className={NUMERO} />
                  </div>
                  <label className={CAIXA}>
                    <input type="checkbox" name={`vaga_${tv}_sob_consulta`} defaultChecked={v?.sob_consulta ?? false}
                      className="size-5 accent-[var(--acao)]" />
                    Valores sob consulta
                  </label>
                </div>
              )
            })}
            {/* §13.3, na tela dos dois lados — aqui e no perfil público. */}
            <p className="apoio rounded-[var(--raio-controle)] border border-line bg-panel2 px-3 py-2 text-dim">
              {AVISO_DISPONIBILIDADE_MARINA} Deixe um bloco totalmente em branco para não publicar aquele tipo
              de vaga.
            </p>
          </section>
        )}

        {(perfilTem(tipo, "acesso_nautico") || perfilTem(tipo, "estrutura") || perfilTem(tipo, "atracacao") ||
          perfilTem(tipo, "calado") || perfilTem(tipo, "combustivel") || perfilTem(tipo, "poita")) && (
          <section className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            <p className="rotulo text-dim">Chegada e estrutura</p>
            {perfilTem(tipo, "acesso_nautico") && (
              <CampoTextarea label="Acesso pelo mar" id="acesso_nautico" name="acesso_nautico" rows={2}
                placeholder="Canal balizado, entrada pelo sul, profundidade na barra…"
                defaultValue={p?.acesso_nautico ?? ""} />
            )}
            {perfilTem(tipo, "calado") && (
              <Campo label="Calado máximo (m)" id="calado_max_m" name="calado_max_m" inputMode="decimal"
                placeholder="1,80" defaultValue={numeroParaCampoPtBr(p?.calado_max_m ?? null)}
                className={NUMERO} />
            )}
            {perfilTem(tipo, "atracacao") && (
              <CampoTextarea label="Atracação" id="atracacao" name="atracacao" rows={2}
                placeholder="Píer flutuante, finger, poitas, cais de espera…"
                defaultValue={p?.atracacao ?? ""} />
            )}
            {perfilTem(tipo, "estrutura") && (
              <CampoTextarea label="Estrutura" id="estrutura" name="estrutura" rows={2}
                placeholder="Água e energia no píer, travel lift, rampa, oficina, banheiros…"
                defaultValue={p?.estrutura ?? ""} />
            )}
            {tipo === "marina" && (
              <label className={CAIXA}>
                <input type="checkbox" name="tem_combustivel" defaultChecked={p?.tem_combustivel ?? false}
                  className="size-5 accent-[var(--acao)]" />
                Combustível no local
              </label>
            )}
            {tipo === "posto" && (
              <Campo
                label="Preço do combustível (por litro)" id="preco_diesel" name="preco_diesel"
                inputMode="decimal" placeholder="6,20"
                defaultValue={precoParaCampo(p?.preco_diesel_centavos ?? null)}
                className={NUMERO}
                dica="Opcional. O preço pode ser atualizado uma vez por dia, e o Explorar mostra a data da última atualização."
              />
            )}
            {perfilTem(tipo, "poita") && (
              <>
                <label className={CAIXA}>
                  <input id="tem_poita" type="checkbox" name="tem_poita" defaultChecked={p?.tem_poita ?? false}
                    className="size-5 accent-[var(--acao)]" />
                  Tem poita disponível
                </label>
                <Campo label="Quantas poitas" id="qtd_poitas" name="qtd_poitas" inputMode="numeric"
                  placeholder="4" defaultValue={p?.qtd_poitas ?? ""} className={NUMERO} />
              </>
            )}
          </section>
        )}

        {/* §13.5 — o que é do Restaurante além do cardápio */}
        {perfilTem(tipo, "restaurante_extra") && (
          <section className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            <p className="rotulo text-dim">Restaurante</p>
            <Campo label="Culinária" id="culinaria" name="culinaria" placeholder="Frutos do mar, brasileira…"
              defaultValue={p?.culinaria ?? ""} />
            <label className={CAIXA}>
              <input type="checkbox" name="vaga_cortesia" defaultChecked={p?.vaga_cortesia ?? false}
                className="size-5 accent-[var(--acao)]" />
              Vaga de carro cortesia
            </label>
          </section>
        )}

        {/* §13.6 — check-in/out e traslado da Pousada/Hotel */}
        {perfilTem(tipo, "check_in_out") && (
          <section className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            <p className="rotulo text-dim">Hospedagem</p>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Check-in" id="check_in" name="check_in" type="time"
                defaultValue={p?.check_in?.slice(0, 5) ?? ""} />
              <Campo label="Check-out" id="check_out" name="check_out" type="time"
                defaultValue={p?.check_out?.slice(0, 5) ?? ""} />
            </div>
            {perfilTem(tipo, "traslado") && (
              <label className={CAIXA}>
                <input type="checkbox" name="traslado_incluso" defaultChecked={p?.traslado_incluso ?? false}
                  className="size-5 accent-[var(--acao)]" />
                Traslado incluso
              </label>
            )}
            <p className="apoio text-dim">
              Sem calendário e sem reserva pelo app: a hospedagem é fechada direto com você.
            </p>
          </section>
        )}

        <section className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
          <p className="rotulo text-dim">Contato</p>
          <Campo label="Horário de funcionamento" id="horario" name="horario"
            placeholder="Todos os dias, 8h às 22h" defaultValue={p?.horario ?? ""} />
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Telefone / WhatsApp" id="telefone" name="telefone" inputMode="tel"
              placeholder="21 99999-0000" defaultValue={p?.telefone ?? ""} />
            <Campo label="E-mail" id="email" name="email" type="email"
              placeholder="contato@exemplo.com" defaultValue={p?.email ?? ""} />
          </div>
          <CampoTextarea label="Sobre" id="sobre" name="sobre" rows={3}
            placeholder="O que faz o seu lugar ser a parada certa…" defaultValue={p?.sobre ?? ""} />
        </section>

        <label className={CAIXA}>
          <input type="checkbox" name="visivel" defaultChecked={p?.visivel ?? true} className="size-5 accent-[var(--acao)]" />
          Visível no Explorar
        </label>

        {/* `py-3.5` dava 52px — a sétima altura de botão do app, e nenhuma
            delas avisava que estava enviando. Este formulário tem ~25 campos
            e sobe fotos: é o caminho mais longo da área do Partner. */}
        <BotaoEnviar rotulo={p ? "Salvar alterações" : "Publicar perfil"} larguraCheia />
      </form>

      {p && (
        <Galeria
          titulo={`Fotos do estabelecimento (${fotos.length}/3)`}
          album="estabelecimento"
          fotos={fotos}
          cabe={fotos.length < 3}
          alt={p.nome}
        />
      )}

      {p && perfilTem(tipo, "cardapio") && (
        <>
          <Galeria
            titulo={`Cardápio (${cardapio.length}/12)`}
            album="cardapio"
            fotos={cardapio}
            cabe={cardapio.length < 12}
            alt="Página do cardápio"
          />
          <p className="apoio mt-2 text-dim">
            O cardápio é uma galeria de imagens — fotografe ou exporte as páginas. Não há cadastro de pratos nem
            pedido pelo app.
          </p>
        </>
      )}

      {p && perfilTem(tipo, "acomodacoes") && (
        <section>
          <SecaoPagina>Acomodações</SecaoPagina>
          {(meu?.acomodacoes ?? []).length > 0 && (
            <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
              {(meu?.acomodacoes ?? []).map((a) => (
                <LinhaLista
                  key={a.id}
                  titulo={a.nome}
                  subtitulo={
                    a.capacidade != null
                      ? `Até ${a.capacidade} ${a.capacidade === 1 ? "pessoa" : "pessoas"}`
                      : undefined
                  }
                  /* A DIÁRIA SAI DA FRASE E VIRA DADO. Ela vinha colada na
                     capacidade por um " · " dentro do subtítulo, ou seja:
                     dinheiro renderizado como prosa cinza de 12px, do lado de
                     uma contagem, sem tabular e sem a cor de valor. `ChipDado`
                     é a peça que o app criou exatamente pra isto ("a medida
                     mora DENTRO do chip, nunca solta ao lado de um título") e
                     ela já escreve o degrau certo — `.valor`, os 14px do
                     dinheiro de lista.
                     Vai no slot `chips` e não em `valor` porque esta linha tem
                     `trailing` (o "Excluir"), e em `LinhaLista` o `trailing`
                     substitui o `valor`.
                     Diária nula continua NÃO desenhando nada — nem chip, nem
                     um "R$ 0,00" que diria à pousada que ela cobra zero. */
                  chips={
                    a.valor_diaria_centavos != null && (
                      <ChipDado rotulo="Diária">{formatarReais(a.valor_diaria_centavos)}</ChipDado>
                    )
                  }
                  trailing={
                    <form action={excluirAcomodacao} className="shrink-0">
                      <input type="hidden" name="id" value={a.id} />
                      <Confirmar mensagem="Excluir acomodação?" rotulo="Excluir"
                        className="apoio flex h-11 items-center text-crit" />
                    </form>
                  }
                />
              ))}
            </div>
          )}
          <form action={adicionarAcomodacao} className="sombra-1 mt-3 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            <Campo label="Nome" id="acom_nome" name="nome" required minLength={2} placeholder="Suíte vista mar" />
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Capacidade" id="acom_capacidade" name="capacidade" inputMode="numeric"
                placeholder="2" className={NUMERO} />
              <Campo label="Diária (opcional)" id="acom_valor" name="valor_diaria" inputMode="decimal"
                placeholder="450,00" className={NUMERO} />
            </div>
            <Campo label="Descrição" id="acom_descricao" name="descricao"
              placeholder="Ar, varanda, café da manhã incluso" />
            <BotaoEnviar rotulo="Adicionar acomodação" variante="contorno" larguraCheia />
          </form>
        </section>
      )}
    </main>
  )
}

/** Uma galeria de fotos com envio e exclusão. Duas na tela do Restaurante
 *  (estabelecimento e cardápio, §13.5) e uma nas demais — mesma casca, o
 *  `album` decide em qual coluna a action grava. */
function Galeria({
  titulo,
  album,
  fotos,
  cabe,
  alt,
}: {
  titulo: string
  album: "estabelecimento" | "cardapio"
  fotos: { path: string; url: string }[]
  cabe: boolean
  alt: string
}) {
  return (
    <section>
      <SecaoPagina>{titulo}</SecaoPagina>
      {fotos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {fotos.map((f) => (
            <div key={f.path} className="sombra-1 overflow-hidden rounded-[var(--raio-cartao)] border border-line bg-panel">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL pública do bucket parceiros */}
              <img src={f.url} alt={alt} className="aspect-square w-full object-cover" loading="lazy" />
              <form action={excluirFotoParceiro} className="p-1.5">
                <input type="hidden" name="path" value={f.path} />
                <input type="hidden" name="album" value={album} />
                <Confirmar mensagem="Excluir foto?" rotulo="Excluir"
                  className="apoio flex h-11 w-full items-center justify-center text-crit" />
              </form>
            </div>
          ))}
        </div>
      )}
      {cabe && (
        <form action={subirFotoParceiro} className="sombra-1 mt-3 flex items-center gap-2 rounded-[var(--raio-cartao)] border border-line bg-panel p-3">
          <input type="hidden" name="album" value={album} />
          {/* O seletor de arquivo é alvo de toque como qualquer outro — e era
              o menor da tela: o controle nativo mede ~24px de altura, e o
              elemento inteiro é o que abre a galeria. `min-h` do token põe a
              linha no piso de 44px sem estilizar o botão nativo (que cada
              navegador desenha do seu jeito e não é nosso pra redesenhar). */}
          <input name="foto" type="file" accept="image/jpeg,image/png,image/webp" required
            className="corpo min-h-[var(--altura-controle)] min-w-0 flex-1" />
          {/* Subir foto é a espera mais longa da tela e o botão media 32px.
              `contorno` dá os 44px e o aviso de envio — sem gastar dourado,
              que aqui já está no "Salvar alterações" logo acima. */}
          <BotaoEnviar rotulo="Enviar" variante="contorno" className="shrink-0" />
        </form>
      )}
    </section>
  )
}
