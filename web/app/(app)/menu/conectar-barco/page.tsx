import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { carregarPainel } from "@/lib/consultas"

/**
 * ONDA 142 — O GUIA "CONECTAR O BARCO" (pedido do dono, 20/08: "devemos
 * instruir nossos usuários como utilizar e conectar com o Signal K").
 * ===========================================================================
 * A página é o manual do Commander Connector escrito pra DONO DE BARCO, não
 * pra desenvolvedor: cada passo diz onde clicar e o que esperar ver. Vive em
 * /menu/conectar-barco e é linkada do cartão do token em Ajustes →
 * Navegação — a pessoa lê e executa no mesmo lugar onde gera o token.
 *
 * Conteúdo segue as regras de honestidade da casa: diz o que PRECISA existir
 * no barco (um servidor Signal K), oferece os dois caminhos de quem não tem
 * (Cerbo GX já embarca; gateway wifi resolve o resto), e nunca promete dado
 * que o barco não publica.
 */

const PASSOS: { titulo: string; corpo: string }[] = [
  {
    titulo: "Confira se o barco tem um servidor Signal K",
    corpo:
      "Ele costuma morar num Raspberry Pi de bordo ou já vir de fábrica em equipamentos como o Victron Cerbo GX. No navegador do celular, conectado ao Wi-Fi do barco, tente abrir http://signalk.local:3000. Se aparecer o painel do Signal K, você tem. Se não tiver, um gateway Wi-Fi de rede NMEA 2000 resolve. Fale com a gente: é o próximo produto do Commander.",
  },
  {
    titulo: "Instale o plugin Commander Connector",
    corpo:
      "No painel do Signal K: menu Appstore → Available → busque “commander” → Install no signalk-commander-connector → reinicie o servidor pelo botão Restart que a própria tela oferece.",
  },
  {
    titulo: "Gere o seu token aqui no app",
    corpo:
      "Ajustes → Navegação → Commander Connector → “Gerar token do conector”. Copie na hora: por segurança ele aparece uma única vez. Se perder, é só gerar outro.",
  },
  {
    titulo: "Cole o token e escolha o que compartilhar",
    corpo:
      "De volta ao Signal K: Server → Plugin Config → Commander Connector. Cole o token, marque as categorias que quer enviar (posição, motor, profundidade, elétrica, ambiente) e salve. Tudo nasce desligado. Nada sobe sem a sua escolha.",
  },
  {
    titulo: "Confirme que está falando",
    corpo:
      "Na própria tela do plugin, o estado muda para “enviando” em até um minuto. Se a internet da marina cair, o plugin guarda as leituras e entrega quando voltar. Você não perde o histórico.",
  },
]

export default async function ConectarBarcoPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/menu/ajustes"
        voltarRotulo="Ajustes"
        titulo="Conectar o barco"
        descricao="O caminho pro Commander receber motor, bateria e profundidade direto dos instrumentos, mesmo com você longe."
      />

      <ol className="mt-5 flex flex-col gap-3">
        {PASSOS.map((p, i) => (
          <li key={p.titulo} className="sombra-1 flex gap-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-accent/40 tabular-nums font-semibold text-accent-forte">
              {i + 1}
            </span>
            <div className="min-w-0">
              <h2 className="titulo-card">{p.titulo}</h2>
              <p className="corpo mt-1.5 text-dim">{p.corpo}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* O que a pessoa ganha — dito em benefício, não em tecnologia. */}
      <div className="sombra-1 mt-4 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-panel2 text-dim">
            <Icone nome="sinal" className="size-4" />
          </span>
          <h2 className="titulo-card">O que passa a funcionar sozinho</h2>
        </div>
        <ul className="mt-3 space-y-2">
          <li className="apoio text-dim">· Horas de motor contadas automaticamente. O horímetro para de depender de anotação.</li>
          <li className="apoio text-dim">· Posição e bateria visíveis no app com o barco na marina e você em casa.</li>
          <li className="apoio text-dim">· O ecobatímetro alimenta o seu mapa de profundidade a cada saída.</li>
        </ul>
        <p className="apoio mt-3 text-dim">
          Privacidade: só sobe o que você marcar, o plugin é somente leitura (não comanda nada no
          barco) e o código dele é aberto — qualquer pessoa pode auditar exatamente o que sai.
        </p>
      </div>
    </main>
  )
}
