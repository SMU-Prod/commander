import Link from "next/link"
import { redirect } from "next/navigation"
import { Confirmar } from "@/components/confirmar"
import { Icone } from "@/components/icone"
import { EscolherPonto } from "@/components/mapa/escolher-ponto"
import { EscolherPinoParceiro } from "@/components/mapa/escolher-pino-parceiro"
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
import { campo, numeroParaCampoPtBr, rot } from "@/lib/ui/form"
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
      <Link href="/parceiros" className="apoio mt-2 inline-flex items-center gap-1 text-dim hover:text-texto">
        <Icone nome="voltar" className="size-3.5" /> Ver a página pública de apresentação
      </Link>

      {ok && <p className="corpo mt-4 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-4 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <form action={salvarParceiro} className="mt-5 space-y-5">
        <section className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo text-dim">Tipo do seu negócio</p>
          <div className="grid grid-cols-2 gap-2.5">
            {TIPOS_PARTNER.map((t) => (
              <label
                key={t}
                htmlFor={`cat-${t}`}
                className="sombra-1 flex cursor-pointer flex-col items-center gap-1.5 rounded-[14px] border border-line bg-panel px-3 py-4 text-center has-[:checked]:border-accent"
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

        <section className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo text-dim">Identificação</p>
          <div>
            <label className={rot} htmlFor="nome">Nome</label>
            <input id="nome" name="nome" required minLength={3} defaultValue={p?.nome ?? ""} className={campo} />
          </div>
          <div>
            <label className={rot} htmlFor="regiao_id">Região onde você atua</label>
            <select id="regiao_id" name="regiao_id" required defaultValue={p?.regiao_id ?? ""} className={campo}>
              <option value="" disabled>Escolha a região</option>
              {regioes.map((r) => (
                <option key={r.id} value={r.id}>{r.uf ? `${r.nome} · ${r.uf}` : r.nome}</option>
              ))}
            </select>
            {/* §10/§21.2 — a mesma lista do Marketplace, pra "Angra" ser sempre
                a mesma Angra dos dois lados. */}
            <p className="apoio mt-1 text-dim">
              É por aqui que os pedidos do Marketplace chegam até você, e é o filtro de região do Explorar.
            </p>
          </div>
          <div>
            <p className={rot}>Ponto no mapa</p>
            <EscolherPonto lat={p?.lat ?? null} lng={p?.lng ?? null} />
          </div>
        </section>

        <section className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo text-dim">Pino no mapa</p>
          <EscolherPinoParceiro
            iconeInicial={p?.icone ?? ICONE_PADRAO_POR_CATEGORIA[tipo]}
            corInicial={p?.cor ?? COR_PADRAO}
            destaque={p?.plano === "destaque"}
          />
        </section>

        {/* §13.1 "Também vendo produtos" / §13.2 "Também presto serviços" */}
        {(toggles.tambem_vende_produtos || toggles.tambem_presta_servicos) && (
          <section className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
            <p className="rotulo text-dim">Atividade complementar</p>
            {toggles.tambem_vende_produtos && (
              <label className="corpo flex items-center gap-2.5">
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
              <label className="corpo flex items-center gap-2.5">
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
            <section key={tipoTax} className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
              <p className="rotulo text-dim">{ROTULO_TIPO_TAXONOMIA[tipoTax]}</p>
              <div className="flex flex-wrap gap-1.5">
                {itens.map((i) => (
                  <label
                    key={i.id}
                    className="apoio cursor-pointer rounded-full border border-line bg-panel2 px-3 py-1.5 has-[:checked]:border-accent has-[:checked]:bg-accent/10"
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
          <section className="sombra-1 space-y-4 rounded-[14px] border border-line bg-panel p-4">
            <p className="rotulo text-dim">Vagas</p>
            {TIPOS_VAGA_MARINA.map((tv) => {
              const v = vagaPorTipo.get(tv)
              return (
                <div key={tv} className="space-y-2.5 rounded-[12px] border border-line bg-panel2 p-3">
                  <p className="titulo-card">{ROTULO_TIPO_VAGA[tv]}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className={rot} htmlFor={`vaga_${tv}_total`}>Total</label>
                      <input id={`vaga_${tv}_total`} name={`vaga_${tv}_total`} inputMode="numeric"
                        defaultValue={v?.total ?? ""} className={`${campo} font-mono-instr tabular-nums`} />
                    </div>
                    <div>
                      <label className={rot} htmlFor={`vaga_${tv}_disponiveis`}>Livres</label>
                      <input id={`vaga_${tv}_disponiveis`} name={`vaga_${tv}_disponiveis`} inputMode="numeric"
                        defaultValue={v?.disponiveis ?? ""} className={`${campo} font-mono-instr tabular-nums`} />
                    </div>
                    <div>
                      <label className={rot} htmlFor={`vaga_${tv}_porte`}>Porte (pés)</label>
                      <input id={`vaga_${tv}_porte`} name={`vaga_${tv}_porte`} inputMode="numeric"
                        defaultValue={v?.porte_max_pes ?? ""} className={`${campo} font-mono-instr tabular-nums`} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={rot} htmlFor={`vaga_${tv}_diaria`}>Diária</label>
                      <input id={`vaga_${tv}_diaria`} name={`vaga_${tv}_diaria`} inputMode="decimal" placeholder="150,00"
                        defaultValue={precoParaCampo(v?.preco_diaria_centavos ?? null)}
                        className={`${campo} font-mono-instr tabular-nums`} />
                    </div>
                    <div>
                      <label className={rot} htmlFor={`vaga_${tv}_mensal`}>Mensal</label>
                      <input id={`vaga_${tv}_mensal`} name={`vaga_${tv}_mensal`} inputMode="decimal" placeholder="2.400,00"
                        defaultValue={precoParaCampo(v?.preco_mensal_centavos ?? null)}
                        className={`${campo} font-mono-instr tabular-nums`} />
                    </div>
                  </div>
                  <label className="corpo flex items-center gap-2.5">
                    <input type="checkbox" name={`vaga_${tv}_sob_consulta`} defaultChecked={v?.sob_consulta ?? false}
                      className="size-5 accent-[var(--acao)]" />
                    Valores sob consulta
                  </label>
                </div>
              )
            })}
            {/* §13.3, na tela dos dois lados — aqui e no perfil público. */}
            <p className="apoio rounded-lg border border-line bg-panel2 px-3 py-2 text-dim">
              {AVISO_DISPONIBILIDADE_MARINA} Deixe um bloco totalmente em branco para não publicar aquele tipo
              de vaga.
            </p>
          </section>
        )}

        {(perfilTem(tipo, "acesso_nautico") || perfilTem(tipo, "estrutura") || perfilTem(tipo, "atracacao") ||
          perfilTem(tipo, "calado") || perfilTem(tipo, "combustivel") || perfilTem(tipo, "poita")) && (
          <section className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
            <p className="rotulo text-dim">Chegada e estrutura</p>
            {perfilTem(tipo, "acesso_nautico") && (
              <div>
                <label className={rot} htmlFor="acesso_nautico">Acesso pelo mar</label>
                <textarea id="acesso_nautico" name="acesso_nautico" rows={2}
                  placeholder="Canal balizado, entrada pelo sul, profundidade na barra…"
                  defaultValue={p?.acesso_nautico ?? ""} className={campo} />
              </div>
            )}
            {perfilTem(tipo, "calado") && (
              <div>
                <label className={rot} htmlFor="calado_max_m">Calado máximo (m)</label>
                <input id="calado_max_m" name="calado_max_m" inputMode="decimal" placeholder="1,80"
                  defaultValue={numeroParaCampoPtBr(p?.calado_max_m ?? null)}
                  className={`${campo} font-mono-instr tabular-nums`} />
              </div>
            )}
            {perfilTem(tipo, "atracacao") && (
              <div>
                <label className={rot} htmlFor="atracacao">Atracação</label>
                <textarea id="atracacao" name="atracacao" rows={2}
                  placeholder="Píer flutuante, finger, poitas, cais de espera…"
                  defaultValue={p?.atracacao ?? ""} className={campo} />
              </div>
            )}
            {perfilTem(tipo, "estrutura") && (
              <div>
                <label className={rot} htmlFor="estrutura">Estrutura</label>
                <textarea id="estrutura" name="estrutura" rows={2}
                  placeholder="Água e energia no píer, travel lift, rampa, oficina, banheiros…"
                  defaultValue={p?.estrutura ?? ""} className={campo} />
              </div>
            )}
            {tipo === "marina" && (
              <label className="corpo flex items-center gap-2.5">
                <input type="checkbox" name="tem_combustivel" defaultChecked={p?.tem_combustivel ?? false}
                  className="size-5 accent-[var(--acao)]" />
                Combustível no local
              </label>
            )}
            {tipo === "posto" && (
              <div>
                <label className={rot} htmlFor="preco_diesel">Preço do combustível (por litro)</label>
                <input id="preco_diesel" name="preco_diesel" inputMode="decimal" placeholder="6,20"
                  defaultValue={precoParaCampo(p?.preco_diesel_centavos ?? null)}
                  className={`${campo} font-mono-instr tabular-nums`} />
                <p className="apoio mt-1 text-dim">
                  Opcional. O preço pode ser atualizado uma vez por dia, e o Explorar mostra a data da última
                  atualização.
                </p>
              </div>
            )}
            {perfilTem(tipo, "poita") && (
              <>
                <label className="corpo flex items-center gap-2.5">
                  <input id="tem_poita" type="checkbox" name="tem_poita" defaultChecked={p?.tem_poita ?? false}
                    className="size-5 accent-[var(--acao)]" />
                  Tem poita disponível
                </label>
                <div>
                  <label className={rot} htmlFor="qtd_poitas">Quantas poitas</label>
                  <input id="qtd_poitas" name="qtd_poitas" inputMode="numeric" placeholder="4"
                    defaultValue={p?.qtd_poitas ?? ""} className={`${campo} font-mono-instr tabular-nums`} />
                </div>
              </>
            )}
          </section>
        )}

        {/* §13.5 — o que é do Restaurante além do cardápio */}
        {perfilTem(tipo, "restaurante_extra") && (
          <section className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
            <p className="rotulo text-dim">Restaurante</p>
            <div>
              <label className={rot} htmlFor="culinaria">Culinária</label>
              <input id="culinaria" name="culinaria" placeholder="Frutos do mar, brasileira…"
                defaultValue={p?.culinaria ?? ""} className={campo} />
            </div>
            <label className="corpo flex items-center gap-2.5">
              <input type="checkbox" name="vaga_cortesia" defaultChecked={p?.vaga_cortesia ?? false}
                className="size-5 accent-[var(--acao)]" />
              Vaga de carro cortesia
            </label>
          </section>
        )}

        {/* §13.6 — check-in/out e traslado da Pousada/Hotel */}
        {perfilTem(tipo, "check_in_out") && (
          <section className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
            <p className="rotulo text-dim">Hospedagem</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={rot} htmlFor="check_in">Check-in</label>
                <input id="check_in" name="check_in" type="time" defaultValue={p?.check_in?.slice(0, 5) ?? ""} className={campo} />
              </div>
              <div>
                <label className={rot} htmlFor="check_out">Check-out</label>
                <input id="check_out" name="check_out" type="time" defaultValue={p?.check_out?.slice(0, 5) ?? ""} className={campo} />
              </div>
            </div>
            {perfilTem(tipo, "traslado") && (
              <label className="corpo flex items-center gap-2.5">
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

        <section className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo text-dim">Contato</p>
          <div>
            <label className={rot} htmlFor="horario">Horário de funcionamento</label>
            <input id="horario" name="horario" placeholder="Todos os dias, 8h às 22h"
              defaultValue={p?.horario ?? ""} className={campo} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="telefone">Telefone / WhatsApp</label>
              <input id="telefone" name="telefone" inputMode="tel" placeholder="21 99999-0000"
                defaultValue={p?.telefone ?? ""} className={campo} />
            </div>
            <div>
              <label className={rot} htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" placeholder="contato@exemplo.com"
                defaultValue={p?.email ?? ""} className={campo} />
            </div>
          </div>
          <div>
            <label className={rot} htmlFor="sobre">Sobre</label>
            <textarea id="sobre" name="sobre" rows={3} placeholder="O que faz o seu lugar ser a parada certa…"
              defaultValue={p?.sobre ?? ""} className={campo} />
          </div>
        </section>

        <label className="corpo flex items-center gap-2.5">
          <input type="checkbox" name="visivel" defaultChecked={p?.visivel ?? true} className="size-5 accent-[var(--acao)]" />
          Visível no Explorar
        </label>

        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">
          {p ? "Salvar alterações" : "Publicar perfil"}
        </button>
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
        <section className="mt-6">
          <p className={rot}>Acomodações</p>
          {(meu?.acomodacoes ?? []).length > 0 && (
            <div className="sombra-1 mt-2 rounded-[14px] border border-line bg-panel px-4">
              {(meu?.acomodacoes ?? []).map((a) => (
                <div key={a.id} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="corpo font-medium">{a.nome}</p>
                    <p className="apoio text-dim">
                      {a.capacidade != null && `Até ${a.capacidade} ${a.capacidade === 1 ? "pessoa" : "pessoas"}`}
                      {a.capacidade != null && a.valor_diaria_centavos != null ? " · " : ""}
                      {a.valor_diaria_centavos != null && formatarReais(a.valor_diaria_centavos)}
                    </p>
                  </div>
                  <form action={excluirAcomodacao} className="shrink-0">
                    <input type="hidden" name="id" value={a.id} />
                    <Confirmar mensagem="Excluir acomodação?" rotulo="Excluir"
                      className="apoio flex h-11 items-center text-crit" />
                  </form>
                </div>
              ))}
            </div>
          )}
          <form action={adicionarAcomodacao} className="sombra-1 mt-3 space-y-3 rounded-[14px] border border-line bg-panel p-4">
            <div>
              <label className={rot} htmlFor="acom_nome">Nome</label>
              <input id="acom_nome" name="nome" required minLength={2} placeholder="Suíte vista mar" className={campo} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={rot} htmlFor="acom_capacidade">Capacidade</label>
                <input id="acom_capacidade" name="capacidade" inputMode="numeric" placeholder="2"
                  className={`${campo} font-mono-instr tabular-nums`} />
              </div>
              <div>
                <label className={rot} htmlFor="acom_valor">Diária (opcional)</label>
                <input id="acom_valor" name="valor_diaria" inputMode="decimal" placeholder="450,00"
                  className={`${campo} font-mono-instr tabular-nums`} />
              </div>
            </div>
            <div>
              <label className={rot} htmlFor="acom_descricao">Descrição</label>
              <input id="acom_descricao" name="descricao" placeholder="Ar, varanda, café da manhã incluso" className={campo} />
            </div>
            <button className="h-11 w-full rounded-xl border border-line text-sm font-semibold">
              Adicionar acomodação
            </button>
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
    <section className="mt-6">
      <p className={rot}>{titulo}</p>
      {fotos.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {fotos.map((f) => (
            <div key={f.path} className="sombra-1 overflow-hidden rounded-[12px] border border-line bg-panel">
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
        <form action={subirFotoParceiro} className="sombra-1 mt-3 flex items-center gap-2 rounded-[14px] border border-line bg-panel p-3">
          <input type="hidden" name="album" value={album} />
          <input name="foto" type="file" accept="image/jpeg,image/png,image/webp" required className="corpo min-w-0 flex-1" />
          <button className="shrink-0 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-acao-texto">Enviar</button>
        </form>
      )}
    </section>
  )
}
