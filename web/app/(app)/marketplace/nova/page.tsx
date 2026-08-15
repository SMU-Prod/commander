import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { BloqueioPremium } from "@/components/ui/bloqueio-premium"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { carregarNivelPlano } from "@/lib/consultas"
import { carregarTaxonomia, itensDoTipo } from "@/lib/consultas-marketplace"
import { mensagemBloqueio, recursoLiberado } from "@/lib/domain/plano-acesso"
import { publicarDemanda } from "@/lib/acoes/marketplace"
import {
  DIAS_PADRAO_EXPIRACAO,
  EXEMPLO_TIPO_DEMANDA,
  ICONE_TIPO_DEMANDA,
  QUEM_RECEBE_TIPO_DEMANDA,
  ROTULO_TIPO_DEMANDA,
  taxonomiaDaCategoria,
  TIPOS_DEMANDA,
  type TipoDemanda,
} from "@/lib/domain/marketplace"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * §11.2 — FORMULÁRIO ESTRUTURADO.
 *
 * "O sistema fornece categorias, funções, regiões e campos padronizados.
 * Texto livre é apenas observação curta complementar." Por isso não existe
 * campo "Título" nesta tela: o §11.2 diz que "o Commander gera o título/
 * cartão final do anúncio a partir dos campos", e é `tituloDaDemanda`
 * (lib/domain/marketplace.ts) quem faz isso — a pessoa vê o resultado no
 * cartão, não digita.
 *
 * O passo 1 escolhe o tipo (`?tipo=`), o passo 2 mostra só os campos daquele
 * tipo. Um formulário único com 15 campos condicionais seria ilegível no
 * celular, que é onde este app vive.
 */
export default async function NovaDemandaPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; erro?: string }>
}) {
  const { tipo: tipoBruto, erro } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const tipo = (TIPOS_DEMANDA as readonly string[]).includes(tipoBruto ?? "")
    ? (tipoBruto as TipoDemanda)
    : null

  // --- Passo 1: que tipo de pedido? ---------------------------------------
  if (!tipo) {
    return (
      <main>
        <CabecalhoDetalhe
          voltarHref="/marketplace"
          voltarRotulo="Marketplace"
          titulo="O que você precisa?"
          descricao="Escolha o tipo — cada um pergunta só o que faz sentido e vai para quem realmente atende."
        />
        <div className="mt-5 space-y-2">
          {TIPOS_DEMANDA.map((t) => (
            <Link
              key={t}
              href={`/marketplace/nova?tipo=${t}`}
              className="sombra-1 flex items-start gap-3 rounded-[14px] border border-line bg-panel p-4"
            >
              <Icone nome={ICONE_TIPO_DEMANDA[t]} className="mt-0.5 size-5 shrink-0 text-accent-forte" />
              <span className="min-w-0 flex-1">
                <span className="titulo-card block">{ROTULO_TIPO_DEMANDA[t]}</span>
                <span className="apoio mt-0.5 block text-dim">{EXEMPLO_TIPO_DEMANDA[t]}</span>
                <span className="apoio mt-1 block text-dim">Vai para: {QUEM_RECEBE_TIPO_DEMANDA[t]}</span>
              </span>
              <Icone nome="chevron" className="mt-1 size-4 shrink-0 text-dim" />
            </Link>
          ))}
        </div>
      </main>
    )
  }

  // --- Passo 2: os campos padronizados daquele tipo -----------------------
  const taxonomia = await carregarTaxonomia()
  const regioes = itensDoTipo(taxonomia, "regiao")
  const tipoCategoria = taxonomiaDaCategoria(tipo)
  const categorias = tipoCategoria ? itensDoTipo(taxonomia, tipoCategoria) : []
  const funcoes = itensDoTipo(taxonomia, "funcao")
  const combustiveis = itensDoTipo(taxonomia, "combustivel")
  const marcas = itensDoTipo(taxonomia, "marca")
  const podePublicar = recursoLiberado("marketplace_publicar", await carregarNivelPlano())

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/marketplace/nova"
        voltarRotulo="Trocar tipo"
        titulo={ROTULO_TIPO_DEMANDA[tipo]}
        descricao={`Vai para: ${QUEM_RECEBE_TIPO_DEMANDA[tipo]}`}
      />
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      <form action={publicarDemanda} className="mt-5 space-y-4">
        <input type="hidden" name="tipo" value={tipo} />

        <CampoSelect
          label="Região" id="regiao_id" name="regiao_id" required defaultValue=""
          dica="É a região que decide quem recebe o seu pedido."
        >
          <option value="" disabled>Escolha a região</option>
          {regioes.map((r) => (
            <option key={r.id} value={r.id}>{r.uf ? `${r.nome} — ${r.uf}` : r.nome}</option>
          ))}
        </CampoSelect>

        {tipoCategoria && (
          <CampoSelect
            label={tipo === "produto" ? "O que você procura" : "Categoria do serviço"}
            id="categoria_id" name="categoria_id" required defaultValue=""
          >
            <option value="" disabled>Escolha uma opção</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </CampoSelect>
        )}

        {tipo === "produto" && (
          <CampoSelect label="Marca (opcional)" id="marca_id" name="marca_id" defaultValue="">
            <option value="">Qualquer marca</option>
            {marcas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </CampoSelect>
        )}

        {tipo === "tripulacao" && (
          <CampoSelect label="Função a bordo" id="funcao_id" name="funcao_id" required defaultValue="">
            <option value="" disabled>Escolha a função</option>
            {funcoes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </CampoSelect>
        )}

        {tipo === "vaga_embarcacao" && (
          <>
            <CampoSelect label="Tipo de vaga" id="tipo_vaga" name="tipo_vaga" required defaultValue="molhada">
              <option value="molhada">Vaga molhada</option>
              <option value="seca">Vaga seca</option>
            </CampoSelect>
            <Campo
              label="Porte da embarcação (pés)" id="porte_pes" name="porte_pes" required
              inputMode="numeric" placeholder="80"
              dica="Marinas com porte máximo menor que este não recebem o pedido."
            />
          </>
        )}

        {tipo === "caminhao" && (
          <>
            <CampoSelect label="Combustível" id="combustivel_id" name="combustivel_id" required defaultValue="">
              <option value="" disabled>Escolha o combustível</option>
              {combustiveis.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </CampoSelect>
            <Campo
              label="Quantidade (litros)" id="quantidade_litros" name="quantidade_litros" required
              inputMode="numeric" placeholder="1500"
            />
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Campo
            label={tipo === "tripulacao" ? "Data da saída" : "Data desejada"}
            id="data_desejada" name="data_desejada" type="date"
          />
          <Campo label="Até (opcional)" id="data_fim" name="data_fim" type="date" />
        </div>
        <p className="apoio -mt-1 text-dim">
          Com data, o pedido expira no próprio prazo. Sem data, ele fica no ar por {DIAS_PADRAO_EXPIRACAO} dias.
        </p>

        <CampoTextarea
          label="Observação (opcional)" id="observacao" name="observacao" rows={3} maxLength={400}
          placeholder="Só o que os campos acima não cobriram — urgência, detalhe do equipamento, acesso à marina…"
          dica="O anúncio é montado pelos campos acima; isto entra como complemento."
        />

        <fieldset className="rounded-[14px] border border-line bg-panel p-4">
          <legend className="rotulo px-1 text-dim">Seu contato</legend>
          <p className="apoio text-dim">
            Fica guardado e só aparece para quem você aceitar. Ninguém vê o seu telefone só por ler o pedido.
          </p>
          <div className="mt-3 space-y-3">
            <Campo label="Telefone / WhatsApp" id="telefone" name="telefone" inputMode="tel" placeholder="21 99999-0000" />
            <Campo label="E-mail (opcional)" id="email" name="email" type="email" placeholder="voce@exemplo.com" />
          </div>
        </fieldset>

        {/* §2.3 — "Marketplace: pode preencher o fluxo de uma demanda, mas o
            botão Publicar aciona o paywall." O formulário acima continua
            inteiro e utilizável no Free de propósito: o PRD quer demonstração
            interativa (§1.1), então o cadeado troca só o BOTÃO, nunca a tela.
            A action repete a checagem — esta aqui é pra pessoa não descobrir
            o limite depois de digitar tudo. */}
        {podePublicar ? (
          <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">Publicar pedido</button>
        ) : (
          <BloqueioPremium {...mensagemBloqueio("marketplace_publicar")} />
        )}
      </form>

      <p className="apoio mt-4 text-center text-dim">
        Não achou a sua região ou categoria?{" "}
        <Link href="/marketplace/interesses#pedir" className="text-accent-forte">Peça a inclusão</Link>.
      </p>
    </main>
  )
}
