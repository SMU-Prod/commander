import { redirect } from "next/navigation"
import { GuardaFormulario } from "@/components/guarda-formulario"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { criarOcorrencia } from "@/lib/acoes/ocorrencias"
import { carregarPainel } from "@/lib/consultas"
import { ABAS_OCORRENCIA, GRAVIDADES, ROTULO_GRAVIDADE, type Gravidade } from "@/lib/domain/ocorrencias"
import { podeEditar, ROTULO_ABA, type Aba } from "@/lib/domain/permissoes"
import { rot } from "@/lib/ui/form"
import { TETO_FORMULARIO } from "@/lib/ui/superficies"

// O segmento escolhido acende na cor do que a escolha SIGNIFICA (canvas
// tela-3g pinta a "Média" selecionada de âmbar): alta é a luz de crítico —
// a mesma consequência que a frase abaixo do controle anuncia —, média e
// baixa a de atenção/neutra. Palavra sempre presente, cor nunca sozinha.
const SEGMENTO_GRAVIDADE: Record<Gravidade, string> = {
  baixa: "peer-checked:bg-panel2 peer-checked:text-texto",
  media: "peer-checked:bg-warn/10 peer-checked:text-warn",
  alta: "peer-checked:bg-crit/10 peer-checked:text-crit",
}

export default async function NovaOcorrenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; setor?: string }>
}) {
  const { erro, setor } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  // Só oferece os setores que a pessoa realmente pode editar — sem isso, ela
  // escolhe um setor e só descobre que não tem acesso depois de tentar salvar.
  const setoresPermitidos = ABAS_OCORRENCIA.filter((aba) => podeEditar(painel.permissoes, aba))

  return (
    <main className={TETO_FORMULARIO}>
      <CabecalhoDetalhe voltarHref="/barco/ocorrencias" voltarRotulo="Ocorrências" titulo="Abrir ocorrência" />
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      {setoresPermitidos.length === 0 ? (
        <p className="corpo mt-5 text-dim">Seu acesso não permite abrir ocorrência em nenhum setor.</p>
      ) : (
        <form action={criarOcorrencia} className="mt-5 space-y-4">
          {/* A descrição de uma avaria costuma ser o texto mais longo que
              alguém digita no app. `criarOcorrencia` volta com `?erro=` e
              limpava tudo — inclusive o relato inteiro. A guarda também
              restaura radios (setor e gravidade abaixo). */}
          <GuardaFormulario chave="barco:ocorrencia-nova" />

          <Campo
            label="O que aconteceu"
            id="titulo"
            name="titulo"
            required
            placeholder="Ex.: luz de navegação BE falhou"
          />

          {/* Canvas tela-3g: a escolha do lugar é em pílulas, não dropdown —
              todas as opções à vista, escolha num toque. O canvas chama de
              "Zona"; aqui a palavra continua "Setor" porque o campo é a aba
              de permissão (`aba`), não a zona física do Mapa da Embarcação
              (onda 61) — dois conceitos que não podem trocar de nome. */}
          <fieldset>
            <legend className={rot}>Setor</legend>
            <div className="flex flex-wrap gap-1.5">
              {setoresPermitidos.map((aba: Aba) => (
                <label key={aba} className="cursor-pointer">
                  <input
                    type="radio"
                    name="aba"
                    value={aba}
                    defaultChecked={setor === aba}
                    required
                    className="peer sr-only"
                  />
                  <span className="flex h-11 items-center rounded-[var(--raio-pilula)] border border-line px-3.5 text-sm text-dim-chip peer-checked:border-accent-forte peer-checked:font-semibold peer-checked:text-accent-forte peer-focus-visible:outline-2 peer-focus-visible:outline-accent-forte">
                    {ROTULO_ABA[aba]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Gravidade segmentada, não dropdown (canvas): três opções curtas,
              escolha em meio segundo — e a tela diz a consequência de "Alta"
              ANTES de a pessoa escolher (é verdade dos dois lados: crítico na
              Saúde via GRAVIDADE_CRITICA e aviso crítico via
              nivelDaOcorrencia). Continua opcional: dado que ninguém declarou
              não vira alarme, então nenhum segmento nasce marcado. */}
          <fieldset>
            <legend className={rot}>Gravidade — opcional</legend>
            <div className="grid grid-cols-3 overflow-hidden rounded-[var(--raio-controle)] border border-line">
              {GRAVIDADES.map((g) => (
                <label key={g} className="cursor-pointer border-l border-line first:border-l-0">
                  <input type="radio" name="gravidade" value={g} className="peer sr-only" />
                  <span
                    className={`flex h-11 items-center justify-center text-sm text-dim peer-checked:font-semibold peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-accent-forte ${SEGMENTO_GRAVIDADE[g]}`}
                  >
                    {ROTULO_GRAVIDADE[g]}
                  </span>
                </label>
              ))}
            </div>
            <p className="apoio mt-1.5 text-dim">Alta entra na Saúde como ação necessária e dispara aviso crítico.</p>
          </fieldset>

          {painel.equipamentos.length > 0 && (
            <CampoSelect label="Equipamento — opcional" id="equipamento_id" name="equipamento_id" defaultValue="">
              <option value="">Nenhum</option>
              {painel.equipamentos.map((e) => (
                <option key={e.id} value={e.id}>
                  {(e.tipo === "motor" ? "Motor" : e.tipo === "gerador" ? "Gerador" : e.tipo === "bateria" ? "Bateria" : "Equipamento")}
                  {e.posicao ? ` ${e.posicao}` : ""}
                </option>
              ))}
            </CampoSelect>
          )}

          <Campo
            label="Foto do problema — opcional, até 10 MB"
            id="anexo"
            name="anexo"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="py-2.5 text-sm"
          />

          <CampoTextarea
            label="Detalhe — opcional"
            id="descricao"
            name="descricao"
            rows={4}
            placeholder="Onde exatamente, quando notou, se piora navegando…"
          />

          {/* ONDA 85 — este formulário sobe FOTO (até 10 MB, no 3G da marina).
              É um dos caminhos mais longos do app, e era o mais mudo: o botão
              ficava idêntico do primeiro ao último byte. */}
          <BotaoEnviar rotulo="Abrir ocorrência" />
        </form>
      )}
    </main>
  )
}
