import { redirect } from "next/navigation"
import { GuardaFormulario } from "@/components/guarda-formulario"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { criarOcorrencia } from "@/lib/acoes/ocorrencias"
import { carregarPainel } from "@/lib/consultas"
import { ABAS_OCORRENCIA, GRAVIDADES, ROTULO_GRAVIDADE } from "@/lib/domain/ocorrencias"
import { podeEditar, ROTULO_ABA, type Aba } from "@/lib/domain/permissoes"

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
    <main>
      <CabecalhoDetalhe voltarHref="/barco/ocorrencias" voltarRotulo="Ocorrências" titulo="Registrar ocorrência" />
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      {setoresPermitidos.length === 0 ? (
        <p className="corpo mt-5 text-dim">Seu acesso não permite registrar ocorrência em nenhum setor.</p>
      ) : (
        <form action={criarOcorrencia} className="mt-5 space-y-4">
          {/* A descrição de uma avaria costuma ser o texto mais longo que
              alguém digita no app. `criarOcorrencia` volta com `?erro=` e
              limpava tudo — inclusive o relato inteiro. */}
          <GuardaFormulario chave="barco:ocorrencia-nova" />
          <CampoSelect label="Setor" id="aba" name="aba" defaultValue={setor ?? ""} required>
            <option value="">Selecione</option>
            {setoresPermitidos.map((aba: Aba) => (
              <option key={aba} value={aba}>{ROTULO_ABA[aba]}</option>
            ))}
          </CampoSelect>
          <Campo label="Título" id="titulo" name="titulo" required placeholder="Ex.: luz de navegação BE falhou" />
          <CampoTextarea label="Descrição — opcional" id="descricao" name="descricao" rows={4} />
          <CampoSelect label="Gravidade — opcional" id="gravidade" name="gravidade" defaultValue="">
            <option value="">Não informar</option>
            {GRAVIDADES.map((g) => (
              <option key={g} value={g}>{ROTULO_GRAVIDADE[g]}</option>
            ))}
          </CampoSelect>
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
            label="Anexo (foto do problema) — opcional, até 10 MB"
            id="anexo"
            name="anexo"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="py-2.5 text-sm"
          />
          <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">Registrar ocorrência</button>
        </form>
      )}
    </main>
  )
}
