import Link from "next/link"
import { redirect } from "next/navigation"
import { GuardaFormulario } from "@/components/guarda-formulario"
import { Icone } from "@/components/icone"
import { Campo, CampoTextarea } from "@/components/ui/campo"
import { avaliarContato, criarContato, excluirContato } from "@/lib/acoes/contatos"
import { carregarPainel } from "@/lib/consultas"
import { podeVer } from "@/lib/domain/permissoes"
import { linhaCampos } from "@/lib/ui/form"
import { supabaseServer } from "@/lib/supabase/server"
import { Confirmar } from "@/components/confirmar"
import type { Contato } from "@/lib/db/types"

export default async function ContatosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; volta?: string }>
}) {
  const { erro, volta } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "contatos")) redirect("/hoje?erro=" + encodeURIComponent("Seu acesso não inclui os contatos."))
  const supabase = await supabaseServer()
  const [{ data: contatos }, { data: eventos }] = await Promise.all([
    supabase.from("contatos").select("*").eq("embarcacao_id", painel.embarcacao.id).order("nome"),
    supabase.from("eventos").select("contato_id").eq("embarcacao_id", painel.embarcacao.id).not("contato_id", "is", null),
  ])
  const servicos = new Map<string, number>()
  for (const e of eventos ?? []) {
    if (e.contato_id) servicos.set(e.contato_id, (servicos.get(e.contato_id) ?? 0) + 1)
  }

  return (
    <main>
      <Link href={volta || "/barco"} className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> {volta ? "Voltar ao registro" : "Barco"}
      </Link>
      <h1 className="titulo-pagina mt-3">Contatos</h1>
      {volta && (
        <p className="mt-3 rounded-lg border border-line bg-panel2 px-3 py-2 corpo text-dim-chip">
          Cadastre o prestador e volte pro registro — o que você já preencheu lá continua salvo.
        </p>
      )}
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erro}</p>}

      <div className="sombra-1 mt-5 rounded-[14px] border border-line bg-panel px-4">
        {(contatos ?? []).length === 0 && (
          <p className="corpo py-4 text-dim">Salve aqui o mecânico, o eletricista e todo mundo que cuida do barco.</p>
        )}
        {((contatos ?? []) as Contato[]).map((c) => (
          <div key={c.id} className="border-b border-line py-3 last:border-0">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="titulo-card">{c.nome}</p>
                {c.empresa && <p className="apoio mt-0.5 text-dim-chip">{c.empresa}</p>}
                <p className="apoio mt-0.5 text-dim">
                  {[c.especialidade, c.telefone, c.email, `${servicos.get(c.id) ?? 0} serviços neste barco`]
                    .filter(Boolean).join(" · ")}
                </p>
                {c.observacoes && <p className="apoio mt-1 text-dim">{c.observacoes}</p>}
              </div>
              {c.telefone && (
                <a href={`https://wa.me/55${c.telefone.replace(/\D/g, "")}`} target="_blank"
                  className="rounded-lg border border-ok/40 px-2.5 py-1.5 text-xs text-ok">WhatsApp</a>
              )}
              <form action={excluirContato}>
                <input type="hidden" name="contato_id" value={c.id} />
                <Confirmar mensagem="Excluir contato?" rotulo="Excluir" className="flex h-11 items-center text-xs text-crit" />
              </form>
            </div>
            <form action={avaliarContato} className="mt-2 flex items-center gap-1" aria-label={`Avaliar ${c.nome}`}>
              <input type="hidden" name="contato_id" value={c.id} />
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} name="avaliacao" value={n} aria-label={`${n} estrelas`}
                  className={`flex size-11 items-center justify-center ${c.avaliacao != null && n <= c.avaliacao ? "text-warn" : "text-line"}`}>
                  <Icone nome="estrela" className="size-5" />
                </button>
              ))}
            </form>
          </div>
        ))}
      </div>

      <p className="rotulo text-dim mt-6 mb-2">Novo contato</p>
      <form action={criarContato} className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
        {/* Esta tela é meio-caminho de outro fluxo: quem chega com `?volta=`
            veio de um registro do Diário pra cadastrar o prestador. Perder o
            que digitou aqui por um erro custa DOIS formulários, não um. */}
        <GuardaFormulario chave="barco:contato-novo" />
        {volta && <input type="hidden" name="volta" value={volta} />}
        <Campo label="Nome" id="nome" name="nome" required />
        <Campo label="Empresa (opcional)" id="empresa" name="empresa" placeholder="Náutica Angra" />
        <div className={linhaCampos}>
          <Campo label="Especialidade" id="especialidade" name="especialidade" placeholder="Mecânica diesel" />
          <Campo label="Telefone (com DDD)" id="telefone" name="telefone" inputMode="tel" placeholder="21 99999-0000" />
        </div>
        <Campo label="E-mail (opcional)" id="email" name="email" type="email" inputMode="email" placeholder="contato@nautica.com.br" />
        <CampoTextarea label="Observações (opcional)" id="observacoes" name="observacoes" rows={2}
          placeholder="Atende sábado, cobra deslocamento de Angra" />
        <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">Salvar contato</button>
      </form>
    </main>
  )
}
