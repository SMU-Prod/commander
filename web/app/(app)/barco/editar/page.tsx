import { redirect } from "next/navigation"
import Link from "next/link"
import { GuardaFormulario } from "@/components/guarda-formulario"
import { Icone } from "@/components/icone"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { salvarDadosGerais } from "@/lib/acoes/embarcacao"
import { carregarPainel } from "@/lib/consultas"
import { carregarTaxonomia, itensDoTipo } from "@/lib/consultas-marketplace"
import { ROTULO_TIPO_EMBARCACAO, TIPOS_EMBARCACAO } from "@/lib/domain/tipo-embarcacao"
import { campo, linhaCampos, numeroParaCampoPtBr, rot } from "@/lib/ui/form"
import { TETO_FORMULARIO } from "@/lib/ui/superficies"

export default async function EditarEmbarcacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") {
    redirect(`/barco?erro=${encodeURIComponent("Só o proprietário edita os dados da embarcação.")}`)
  }
  const e = painel.embarcacao
  const regioes = itensDoTipo(await carregarTaxonomia(), "regiao")

  return (
    <main className={TETO_FORMULARIO}>
      <Link href="/barco" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Barco
      </Link>
      <h1 className="titulo-pagina mt-3">Dados da embarcação</h1>
      <p className="apoio mt-1 text-dim">O que estiver aqui aparece no dossiê e no Commander Verified.</p>
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <form action={salvarDadosGerais} className="mt-6 space-y-5">
        {/* 15 campos em três blocos. `salvarDadosGerais` volta pra cá com
            `?erro=` e a página re-renderiza do servidor com os valores do
            banco — ou seja, tudo que foi digitado e ainda não salvou some. */}
        <GuardaFormulario chave="barco:editar" />
        <section className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
          <p className="rotulo flex items-center gap-1.5 text-dim"><Icone nome="embarcacao" className="size-3.5" /> Identificação</p>
          <div>
            <label className={rot} htmlFor="nome">Nome</label>
            <input id="nome" name="nome" required defaultValue={e.nome} className={campo} />
          </div>
          <div className={linhaCampos}>
            <div>
              <label className={rot} htmlFor="estaleiro">Estaleiro</label>
              <input id="estaleiro" name="estaleiro" defaultValue={e.estaleiro ?? ""} className={campo} />
            </div>
            <div>
              <label className={rot} htmlFor="modelo">Modelo</label>
              <input id="modelo" name="modelo" defaultValue={e.modelo ?? ""} className={campo} />
            </div>
          </div>
          <div className={linhaCampos}>
            <div>
              <label className={rot} htmlFor="ano">Ano</label>
              <input id="ano" name="ano" inputMode="numeric" defaultValue={e.ano ?? ""} className={`${campo} tabular-nums tabular-nums`} />
            </div>
            <div>
              <label className={rot} htmlFor="marina">Marina</label>
              <input id="marina" name="marina" defaultValue={e.marina ?? ""} className={campo} />
            </div>
          </div>
          {/* Tipo (onda 62) — o mesmo vocabulário dos chips do onboarding
              (enum `tipo_embarcacao`). Todo barco criado antes da migration
              056 vive com tipo = null, e é AQUI que o dono completa depois —
              opcional como lá, com o "Não informar" pra desfazer. */}
          <div>
            <label className={rot} htmlFor="tipo">Tipo</label>
            <select id="tipo" name="tipo" defaultValue={e.tipo ?? ""} className={campo}>
              <option value="">Não informar</option>
              {TIPOS_EMBARCACAO.map((t) => (
                <option key={t} value={t}>{ROTULO_TIPO_EMBARCACAO[t]}</option>
              ))}
            </select>
          </div>
          {/* Região da base (onda 52). Serve pro Marketplace saber onde o
              barco está e pra segmentação do §20 — sem ela, o Dashboard só
              exibe patrocínio sem segmentação regional. É escolha do dono, e
              não uma dedução a partir de lat/lon: "perto de Angra" e "atende
              Angra" são coisas diferentes. */}
          <div>
            <label className={rot} htmlFor="regiao_id">Região</label>
            <select id="regiao_id" name="regiao_id" defaultValue={e.regiao_id ?? ""} className={campo}>
              <option value="">Não informar</option>
              {regioes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.uf ? `${r.nome} · ${r.uf}` : r.nome}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
          <p className="rotulo flex items-center gap-1.5 text-dim"><Icone nome="ancora" className="size-3.5" /> Medidas e casco</p>
          {/* Três colunas só sobrevivem a 390px porque os rótulos são
              abreviados ("Compr. (m)", "Boca (m)", "Calado (m)") e cabem em
              uma linha nos ~111px da célula. `items-end` segura o alinhamento
              caso algum deles cresça. */}
          <div className="grid grid-cols-3 items-end gap-3">
            <div>
              <label className={rot} htmlFor="comprimento_m">Compr. (m)</label>
              <input id="comprimento_m" name="comprimento_m" inputMode="decimal" placeholder="14,60"
                defaultValue={numeroParaCampoPtBr(e.comprimento_m)} className={`${campo} tabular-nums tabular-nums`} />
            </div>
            <div>
              <label className={rot} htmlFor="boca_m">Boca (m)</label>
              <input id="boca_m" name="boca_m" inputMode="decimal" placeholder="4,35"
                defaultValue={numeroParaCampoPtBr(e.boca_m)} className={`${campo} tabular-nums tabular-nums`} />
            </div>
            <div>
              <label className={rot} htmlFor="calado_m">Calado (m)</label>
              <input id="calado_m" name="calado_m" inputMode="decimal" placeholder="1,20"
                defaultValue={numeroParaCampoPtBr(e.calado_m)} className={`${campo} tabular-nums tabular-nums`} />
            </div>
          </div>
          <div className={linhaCampos}>
            <div>
              <label className={rot} htmlFor="casco_material">Material do casco</label>
              <input id="casco_material" name="casco_material" list="materiais" placeholder="PRFV"
                defaultValue={e.casco_material ?? ""} className={campo} />
              <datalist id="materiais">
                <option value="PRFV" /><option value="Fibra de vidro" /><option value="Alumínio" />
                <option value="Aço" /><option value="Madeira" />
              </datalist>
            </div>
            <div>
              <label className={rot} htmlFor="casco_numero">Nº do casco</label>
              <input id="casco_numero" name="casco_numero" defaultValue={e.casco_numero ?? ""} className={campo} />
            </div>
          </div>
          <div>
            <label className={rot} htmlFor="propulsao">Propulsão</label>
            <input id="propulsao" name="propulsao" list="propulsoes" placeholder="2× diesel · pés IPS"
              defaultValue={e.propulsao ?? ""} className={campo} />
            <datalist id="propulsoes">
              <option value="Centro-rabeta" /><option value="Pés IPS" /><option value="Linha de eixo" />
              <option value="Popa" /><option value="Jato" />
            </datalist>
          </div>
        </section>

        <section className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
          <p className="rotulo flex items-center gap-1.5 text-dim"><Icone nome="documento" className="size-3.5" /> Registro</p>
          <div className={linhaCampos}>
            <div>
              <label className={rot} htmlFor="tie">TIE</label>
              <input id="tie" name="tie" defaultValue={e.tie ?? ""} className={`${campo} tabular-nums`} />
            </div>
            <div>
              <label className={rot} htmlFor="capitania">Capitania</label>
              <input id="capitania" name="capitania" placeholder="CP do Rio de Janeiro"
                defaultValue={e.capitania ?? ""} className={campo} />
            </div>
          </div>
        </section>

        {/* ONDA 85 — 15 campos e zero retorno ao salvar (auditoria §3.3). De
            quebra some o `py-3.5`: 52px e `rounded-xl` eram uma altura e um
            raio que só existiam aqui e em `/financeiro/novo` — a sétima altura
            de botão que `chip.tsx` conta a história de ter caçado. */}
        <BotaoEnviar rotulo="Salvar dados" />
      </form>

      <Link
        href="/barco/transferir"
        className="mt-6 flex items-center gap-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4"
      >
        <Icone nome="transferir" className="size-5 shrink-0 text-dim" />
        <span className="min-w-0 flex-1">
          <span className="titulo-card block">Transferir propriedade</span>
          <span className="apoio block text-dim">Passe o barco pra outro dono — o histórico técnico fica com ele.</span>
        </span>
        <Icone nome="chevron" className="size-4 shrink-0 text-dim" />
      </Link>
    </main>
  )
}
