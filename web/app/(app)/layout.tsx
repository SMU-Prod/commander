import { Suspense } from "react"
import { BottomNav } from "@/components/bottom-nav"
import { FaixaTopo } from "@/components/faixa-topo"
import { MolduraApp } from "@/components/moldura-app"
import { RegistrarSw } from "@/components/registrar-sw"
import { Toast } from "@/components/toast"
import { carregarNotificacoes, carregarPainel, hojeISO } from "@/lib/consultas"
import { contadorSino } from "@/lib/domain/notificacoes"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const painel = await carregarPainel()

  // ONDA 47 — O GATE DE COBRANÇA GLOBAL FOI REMOVIDO.
  //
  // Até aqui, com `NEXT_PUBLIC_COBRANCA_ATIVA === "1"`, qualquer PROP sem
  // assinatura viva levava um redirect duro pra `/assinar` em TODA página de
  // `(app)`: o app inteiro era pago ou nada. O PRD FINAL desmonta essa
  // premissa — §2 cria o "Proprietário Free" como plano de verdade e §2.3
  // manda o Free "navegar pelos hubs" com cadeado nos pontos certos ("Free
  // deve funcionar como demonstração interativa", §1.1). Um redirect global
  // tornaria o plano gratuito literalmente inalcançável.
  //
  // O paywall agora é POR RECURSO, não por aplicativo: `recursoLiberado`
  // (`lib/domain/plano-acesso.ts`) nos pontos que o §2.3 lista, e
  // `avaliarCiclo` (`lib/domain/assinatura-ciclo.ts`) decidindo quando a
  // tolerância do §23 acaba. §23 é explícito sobre o que acontece quando o
  // pagamento some: "conta volta ao nível Free aplicável, PRESERVANDO DADOS
  // E HISTÓRICO; recursos pagos ficam bloqueados, NÃO APAGADOS" — e não
  // "a pessoa não entra mais no app".
  //
  // A variável `NEXT_PUBLIC_COBRANCA_ATIVA` não é mais lida em lugar nenhum.

  // Contador de avisos no rodapé (onda 44, PRD §5.2 "sino no topo com
  // contador"). Fica no layout pra acompanhar a pessoa em toda tela, e usa
  // a MESMA `carregarNotificacoes` da tela /notificacoes e do sino da
  // Início — com `cache()`, na Início isso não vira consulta extra. Já vem
  // filtrado por permissão: tripulante não vê contador subir por causa de
  // um hub que ele não pode abrir.
  const avisos = painel ? contadorSino(await carregarNotificacoes()) : 0

  // ONDA 60 — o FAB global "+ Registrar" (`RegistroRapido`) saiu daqui, e
  // do app. O gesto que ele atendia ganhou casas melhores no conteúdo nas
  // ondas 57–59: a Início registra pelo cartão do Diário, o Diário tem vaga
  // fixa na bottom-nav e o "Registrar" na `BarraFerramentas`, e as listas
  // têm as próprias ações — o FAB tinha virado duplicata flutuando por cima
  // de conteúdo. O registro em si (`registrarVoltaAoMar`) continua vivo por
  // `/diario/[id]/horas` e pela sugestão pós-trilha. A folga inferior do
  // conteúdo é assunto da `MolduraApp` — ver `lib/ui/superficies.ts`, que
  // conta essa história inteira.
  return (
    // ONDA 57 (revisão) — `permissoes` e `avisos` descem até aqui porque o
    // trilho de desktop precisa das duas: as permissões pra não anunciar
    // porta que o backend fecha (o `redirect` de `/financeiro` e `/agenda`),
    // e o contador porque a barra de baixo, que o carregava, é `lg:hidden`.
    // São os MESMOS valores que a Início e a bottom-nav já usam — nada é
    // recalculado, nada é buscado de novo.
    <MolduraApp
      permissoes={painel?.permissoes ?? null}
      avisos={avisos}
      // ONDA 60 — a faixa de topo do desktop (spec fundação §3.3), montada
      // AQUI porque tudo que ela mostra o layout já tem em mãos: `painel`
      // (barco atual, a lista de embarcações pro seletor, motores, itens,
      // e-mail da conta) e `avisos`. Zero consulta nova por página — é a
      // restrição que decidiu o que entra nela (ver
      // `components/faixa-topo.tsx`). Sem barco, sem faixa.
      faixa={painel != null && (
        <FaixaTopo
          embarcacao={{ id: painel.embarcacao.id, nome: painel.embarcacao.nome }}
          embarcacoes={painel.embarcacoes}
          equipamentos={painel.equipamentos}
          itens={painel.itens}
          hoje={hojeISO()}
          avisos={avisos}
          email={painel.emailUsuario}
        />
      )}
    >
      <RegistrarSw />
      <Suspense fallback={null}>
        <Toast />
      </Suspense>
      {children}
      <BottomNav avisos={avisos} />
    </MolduraApp>
  )
}
