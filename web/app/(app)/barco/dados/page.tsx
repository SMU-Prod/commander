import Link from "next/link"
import { redirect } from "next/navigation"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { LinhaLista } from "@/components/ui/linha-lista"
import { carregarPainel } from "@/lib/consultas"
import { podeVer } from "@/lib/domain/permissoes"
import { ALVO_ACAO, PILULA_ACAO } from "@/lib/ui/acoes"

/**
 * ONDA 101 — OS DADOS CADASTRAIS SAEM DA PORTA E GANHAM ENDEREÇO.
 *
 * O dono listou "Dados cadastrais" entre as coisas que faziam da /barco uma
 * *"página enorme"*, e não o pôs entre os oito cards da central técnica (spec
 * `2026-08-19-arquitetura-quatro-apps.md` §3). Só que a informação é real e a
 * única outra porta dela era `/barco/editar`, que é FORMULÁRIO — e formulário
 * não serve a quem só quer conferir o calado: um tripulante sem permissão de
 * edição perderia o acesso de leitura que tinha.
 *
 * Por isso esta tela existe e é de LEITURA: as medidas e os registros do
 * barco, com o caminho para editar só para quem edita. A Posição da marina
 * mora aqui junto porque é do mesmo assunto (onde este barco está e o que ele
 * é) e porque uma linha sozinha no rodapé da /barco era mais um bloco na
 * pilha que o dono mandou desmontar.
 *
 * Sem consulta própria — `carregarPainel` tem `cache()` e já trouxe tudo.
 */
export default async function DadosPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "embarcacao")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui os dados da embarcação.")}`)
  }
  const { embarcacao, papel } = painel

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/barco"
        voltarRotulo="Barco"
        titulo="Dados cadastrais"
        descricao="Medidas, casco e registros da embarcação."
        // "Editar" e não "Ver tudo": é a exceção declarada do rótulo único
        // (achado 6.1 da auditoria) — o verbo muda o que acontece de verdade,
        // porque leva a uma tela de edição, não a uma lista.
        acao={papel === "PROP" ? (
          <Link href="/barco/editar" className={ALVO_ACAO}>
            <span className={PILULA_ACAO}>Editar</span>
          </Link>
        ) : undefined}
      />

      <div className="sombra-1 mt-6 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
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
              {/* O travessão é a ausência declarada: campo não preenchido não
                  pode virar zero nem sumir da lista — quem lê precisa saber
                  que o app não sabe. */}
              <dd className="corpo mt-0.5">{valor ?? <span className="text-dim">—</span>}</dd>
            </div>
          ))}
        </dl>
      </div>

      {papel === "PROP" && (
        <div className="sombra-1 mt-4 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
          <LinhaLista
            href="/barco/local"
            titulo="Posição da marina"
            subtitulo={
              embarcacao.marina_lat != null && embarcacao.marina_lon != null
                ? `${embarcacao.marina_lat.toFixed(4)}, ${embarcacao.marina_lon.toFixed(4)}`
                : "Defina para ligar o boletim do mar"
            }
          />
        </div>
      )}
    </main>
  )
}
