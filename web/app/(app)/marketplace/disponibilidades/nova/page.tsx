import { redirect } from "next/navigation"
import { BloqueioPremium } from "@/components/ui/bloqueio-premium"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { publicarDisponibilidade } from "@/lib/acoes/marketplace"
import { carregarAssinatura } from "@/lib/consultas"
import { carregarTaxonomia, itensDoTipo } from "@/lib/consultas-marketplace"
import { carreiraLiberada, mensagemCarreiraBloqueada } from "@/lib/domain/captain"
import { DIAS_PADRAO_EXPIRACAO, ROTULO_TIPO_TRABALHO, TIPOS_TRABALHO } from "@/lib/domain/marketplace"
import { formatarPreco, PLANOS } from "@/lib/domain/planos"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * §11.3 — "Função, região, período, tipo de trabalho, experiência, porte e
 * certificações vêm de campos padronizados/perfil." Mesmo princípio do §11.2:
 * função e região saem da taxonomia, e o título do cartão é montado pelo
 * Commander (`tituloDaDisponibilidade`), não digitado.
 *
 * Gate de plano (onda 47): §11.3 restringe a publicação ao Captain Pro, e o
 * PRD FINAL fechou o preço (§2, R$ 24,90/mês). Aqui o degrau é o do PRÓPRIO
 * usuário — §12 separa as duas coisas de propósito: "Captain Pro nunca concede
 * acesso adicional à embarcação por si só", e o contrário também vale (pagar
 * Commander pelo barco não paga a carreira dele).
 *
 * O formulário continua montável mesmo sem Captain Pro, como no Marketplace
 * (§1.1, demonstração interativa) — o cadeado troca só o botão. A action
 * repete a checagem, porque tela não é segurança.
 */
export default async function NovaDisponibilidadePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const taxonomia = await carregarTaxonomia()
  const funcoes = itensDoTipo(taxonomia, "funcao")
  const regioes = itensDoTipo(taxonomia, "regiao")
  const { plano } = await carregarAssinatura()
  const temCaptainPro = carreiraLiberada("disponibilidade", plano)

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/marketplace/disponibilidades"
        voltarRotulo="Disponíveis"
        titulo="Estou disponível"
        descricao="Diga o que você faz, onde e quando. Proprietários da região veem e chamam."
      />
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <form action={publicarDisponibilidade} className="mt-6 space-y-4">
        <CampoSelect label="Função" id="funcao_id" name="funcao_id" required defaultValue="">
          <option value="" disabled>Escolha a função</option>
          {funcoes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </CampoSelect>

        <CampoSelect label="Região" id="regiao_id" name="regiao_id" required defaultValue="">
          <option value="" disabled>Escolha a região</option>
          {regioes.map((r) => (
            <option key={r.id} value={r.id}>{r.uf ? `${r.nome} — ${r.uf}` : r.nome}</option>
          ))}
        </CampoSelect>

        <CampoSelect label="Tipo de trabalho" id="tipo_trabalho" name="tipo_trabalho" required defaultValue="diaria">
          {TIPOS_TRABALHO.map((t) => <option key={t} value={t}>{ROTULO_TIPO_TRABALHO[t]}</option>)}
        </CampoSelect>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Disponível de" id="data_inicio" name="data_inicio" type="date" />
          <Campo label="Até" id="data_fim" name="data_fim" type="date" />
        </div>
        <p className="apoio -mt-1 text-dim">
          Com período, o anúncio expira junto com ele. Sem período, fica {DIAS_PADRAO_EXPIRACAO} dias no ar.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Experiência (anos)" id="experiencia_anos" name="experiencia_anos" inputMode="numeric" placeholder="8" />
          <Campo label="Porte máximo (pés)" id="porte_max_pes" name="porte_max_pes" inputMode="numeric" placeholder="60" />
        </div>

        <Campo
          label="Certificações (opcional)" id="certificacoes" name="certificacoes"
          placeholder="Capitão Amador, Arrais Amador, STCW…"
        />

        <CampoTextarea
          label="Observação curta (opcional)" id="observacao" name="observacao" rows={3} maxLength={400}
          placeholder="O que os campos acima não cobriram."
        />

        <Campo
          label="Telefone / WhatsApp (opcional)" id="telefone" name="telefone" inputMode="tel"
          placeholder="21 99999-0000"
          dica="Fica visível para quem vê o seu anúncio — deixe em branco se prefere ser chamado de outro jeito."
        />

        {temCaptainPro ? (
          <BotaoEnviar rotulo="Publicar disponibilidade" />
        ) : (
          // Onda 50 — o texto do cadeado saiu daqui e virou fonte única em
          // `mensagemCarreiraBloqueada` (lib/domain/captain.ts), e o botão
          // deixou de apontar pra assinatura do BARCO: quem publica
          // disponibilidade é o profissional, e o plano dele é o Captain Pro.
          <BloqueioPremium
            titulo={mensagemCarreiraBloqueada("disponibilidade").titulo}
            descricao={
              `${mensagemCarreiraBloqueada("disponibilidade").descricao} ` +
              `São ${formatarPreco(PLANOS.captain_pro.valorCentavos!)}/mês.`
            }
            href="/assinar?perfil=captain"
            rotuloAcao={`Assinar o ${PLANOS.captain_pro.rotulo}`}
          />
        )}
      </form>
    </main>
  )
}
