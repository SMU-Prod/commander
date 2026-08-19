import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { carregarPainel } from "@/lib/consultas"

// mesmo contato do rodapé da landing (app/page.tsx) e das telas de Selos —
// é a equipe Commander, não um endereço inventado pra esta tela.
const EMAIL_EQUIPE = "atendimento.smu@gmail.com"

const PLANEJADO = [
  "Integração com rede NMEA 2000",
  "Leitura de dados de motores quando disponíveis na rede",
  "Conexão com a infraestrutura usada por chartplotters/MFDs compatíveis",
  "Registro automático de horas e dados no Diário de Bordo",
  "Histórico de temperatura e eventos do motor",
  "Alertas e ocorrências baseados em dados reais da embarcação",
]

/**
 * Tela "Em breve" do Commander Connect (`docs/prd/commander-connect.txt`).
 * Regras de honestidade obrigatórias desta tela (mesmo documento, seção 6):
 * - NÃO escrever "SeaTalk" nem "CAN bus" como conexão direta do produto —
 *   a promessa técnica da V1 é NMEA 2000, e só isso;
 * - NÃO dizer "compatível com Garmin/Raymarine/Furuno" de forma absoluta —
 *   o texto certo é "pensado para coexistir com a infraestrutura NMEA 2000
 *   usada por equipamentos marítimos compatíveis";
 * - é tela de "em breve": não sugere que já funciona, não coleta pagamento,
 *   não promete data de lançamento.
 */
export default async function ConnectPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/barco" voltarRotulo="Barco" />
      <div className="mt-3 flex items-center gap-2">
        <Icone nome="sinal" className="size-5 text-dim" />
        <h1 className="titulo-pagina">Commander Connect</h1>
        <span className="rounded-full border border-line bg-panel2 px-2 py-0.5 rotulo text-dim-chip">
          Em breve
        </span>
      </div>
      <p className="corpo mt-3 font-medium">Sua embarcação, conectada ao Commander.</p>
      <p className="apoio mt-1 text-dim">
        Estamos preparando a conexão do Commander com os sistemas digitais da sua embarcação. A
        proposta é integrar redes e equipamentos compatíveis para transformar dados de bordo em
        histórico automático dentro do Commander — menos preenchimento manual, mais histórico
        real.
      </p>

      <p className="rotulo mt-6 mb-2 text-dim">Planejado para o ecossistema Connect</p>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {PLANEJADO.map((item) => (
          <div key={item} className="flex items-start gap-3 border-b border-line py-3 last:border-0">
            <Icone nome="sinal" className="mt-0.5 size-4 shrink-0 text-dim" />
            <p className="corpo">{item}</p>
          </div>
        ))}
      </div>

      <p className="apoio mt-4 text-dim">
        A promessa técnica desta primeira versão é a rede <strong>NMEA 2000</strong>, já usada por
        motores e equipamentos de bordo — o Commander Connect foi pensado para coexistir com essa
        infraestrutura, não para substituir chartplotters, MFDs ou os painéis dos motores.
      </p>

      <p className="rotulo mt-6 mb-2 text-dim">Quer saber se sua embarcação já é compatível?</p>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
        <p className="corpo">
          Responda um questionário curto sobre a sua instalação. O resultado é uma classificação
          preliminar — nunca uma promessa — e ajuda a Commander a priorizar quem atender primeiro.
        </p>
        <Link href="/barco/connect/interesse" className="apoio mt-2 inline-block text-accent-forte">
          Responder o questionário
        </Link>
      </div>

      <p className="rotulo mt-6 mb-2 text-dim">Seu sistema não aparece como compatível?</p>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
        <p className="corpo">
          A Commander poderá analisar a instalação e indicar interfaces adicionais quando houver
          uma solução viável.
        </p>
        <a href={`mailto:${EMAIL_EQUIPE}`} className="apoio mt-2 inline-block text-accent-forte">
          Falar com a equipe — {EMAIL_EQUIPE}
        </a>
      </div>
    </main>
  )
}
