import { redirect } from "next/navigation"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { carregarPainel } from "@/lib/consultas"
import { ImportarFrotaCliente } from "./importar-frota-cliente"

/**
 * IMPORTAR FROTA (PRD-UPGRADE-3-COTAS §21) — AUDITORIA 19/08, A9.
 *
 * O §21 tem uma frase só de justificativa: *"evitar cadastro manual em
 * empresas grandes."* Até esta rodada, a administradora que chegava com 40
 * unidades numa planilha cadastrava as 40 na mão, uma por uma, pelo
 * onboarding — enquanto `validarImportacao`, `resumoDaImportacao` e
 * `importacaoVazia` esperavam no domínio, testadas em 11 casos, sem página,
 * sem upload e sem action.
 *
 * A porta é aqui e não no Menu de propósito: quem importa frota está indo
 * cuidar de frota, e "Custo da frota" é a tela dessa cabeça. Um item novo no
 * Menu principal para uma ação que se faz uma vez na vida da conta custaria
 * mais atenção do que vale.
 *
 * A CONFERÊNCIA É QUEM MANDA. Nada é gravado antes de a pessoa ver, linha por
 * linha, o que o app entendeu — e o que ele não entendeu, com o número da
 * linha da planilha. Criar 40 registros é a operação menos reversível que
 * esta conta tem; ela não acontece com um clique cego.
 */
export default async function ImportarFrotaPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  // Importar cria embarcação, e criar embarcação é ato de dono da conta — o
  // mesmo recorte de /cotistas. A trava de verdade é a RPC `criar_embarcacao`
  // (migration 048), que aplica limite de plano e cria o vínculo PROP de quem
  // chamou; aqui o `EstadoVazio` só evita que alguém da equipe cole uma
  // planilha inteira pra depois receber 40 recusas.
  const ehDono = painel.papel === "PROP"

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/frota"
        voltarRotulo="Frota"
        titulo="Importar frota"
        descricao="Cole a planilha das unidades — o app confere antes de cadastrar qualquer coisa."
      />

      {ehDono ? (
        <ImportarFrotaCliente />
      ) : (
        <EstadoVazio
          icone="pessoas"
          titulo="Quem cadastra unidade é o dono da conta"
          descricao="Peça ao proprietário para importar a planilha. Depois disso as unidades aparecem para você normalmente."
          className="mt-4"
        />
      )}
    </main>
  )
}
