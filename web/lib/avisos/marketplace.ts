import { after } from "next/server"
import webpush from "web-push"
import { emLotes } from "@/lib/lotes"
import {
  interesseDoPerfilProfissional,
  usuariosCompativeis,
  type DemandaParaMatching,
  type InteresseParaMatching,
  type PerfilProfissionalParaMatching,
  type TipoDemanda,
} from "@/lib/domain/marketplace"
import {
  filtrarPorPermissao,
  notificacaoDeDemandaCompativel,
  PUSH_POR_NIVEL,
} from "@/lib/domain/notificacoes"
import {
  demandaCompativelComPartner,
  type AtividadeDeclarada,
  type DemandaParaPartner,
  type VagaDeclarada,
} from "@/lib/domain/partner"
import { normalizarPermissoes, type Permissoes } from "@/lib/domain/permissoes"
import { supabaseServico } from "@/lib/supabase/servico"
import type {
  InteresseMarketplace, Parceiro, ParceiroAtividade, ParceiroVaga,
  PerfilComandante, PushAssinatura, Vinculo,
} from "@/lib/db/types"

/**
 * O DISPARO QUE FALTAVA (onda 99, PRD §11.4 + §5.2, migration 089).
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE ARQUIVO EXISTE
 * ---------------------------------------------------------------------------
 * Até aqui, publicar um pedido no Marketplace produzia silêncio: a demanda
 * entrava no banco e ninguém era avisado. O prestador só descobria abrindo a
 * vitrine por conta própria — e quem publicou lia o silêncio como "ninguém
 * quis o serviço" em vez de "ninguém ficou sabendo". É a diferença entre um
 * marketplace que gira e um mural que ninguém visita duas vezes.
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTE ARQUIVO NÃO FAZ: DECIDIR
 * ---------------------------------------------------------------------------
 * Nenhuma regra de compatibilidade nasce aqui. Este módulo BUSCA, chama as
 * réguas puras que já existiam e testadas, e ESCREVE. As réguas são duas,
 * porque o app tem duas superfícies onde a pessoa declara o que atende — e
 * cada uma já tem dona:
 *
 *   · `usuariosCompativeis` (§11.4) sobre `interesses_marketplace` — a tela
 *     `/marketplace/interesses`, de quem NÃO é Partner. A mesma função que
 *     alimenta a lista "Combinam com você" da vitrine, então o que chega por
 *     push é exatamente o que a tela dele lista;
 *   · `demandaCompativelComPartner` (§11.4 + §13) sobre `parceiros` +
 *     `parceiro_atividades` + `parceiro_vagas` — o Partner declara no PRÓPRIO
 *     perfil, e `/parceiro/perfil` promete isso com todas as letras: "É por
 *     aqui que os pedidos do Marketplace chegam até você". Esta régua carrega
 *     o corte de produto do §13 (a Marina só recebe vaga, o Posto só recebe
 *     caminhão), que a régua de interesses não conhece.
 *
 * A terceira fonte, `perfis_comandante`, NÃO ganhou régua própria: ela é
 * traduzida para um interesse por `interesseDoPerfilProfissional` e julgada
 * pela primeira régua. Ver o comentário dela em `lib/domain/marketplace.ts`.
 *
 * ---------------------------------------------------------------------------
 * AS QUATRO GARANTIAS, E ONDE CADA UMA MORA
 * ---------------------------------------------------------------------------
 * 1. NUNCA AVISAR QUEM NÃO PODE VER. O aviso passa por
 *    `filtrarPorPermissao` — a mesma função da Central — antes de virar push,
 *    com as permissões REAIS da pessoa (`vinculos`), e com "nenhuma permissão"
 *    para quem não tem vínculo nenhum. Hoje ela deixa passar todo mundo,
 *    porque o aviso nasce com `aba: null`; escrever um `if` à mão aqui
 *    "porque dá no mesmo" é que seria o erro — no dia em que este aviso ganhar
 *    uma `aba`, o vazamento fecha sozinho.
 * 2. NUNCA AVISAR DUAS VEZES. Quem decide não é este código: é o índice único
 *    `(demanda_id, usuario_id)` da migration 089. O insert usa
 *    `ignoreDuplicates` e só manda push para as linhas que VOLTARAM do banco —
 *    quem já estava lá não volta, logo não recebe de novo. Vale contra retry
 *    do Next, clique duplo e dois disparos concorrentes.
 * 3. NADA DE AVISO FABRICADO. Sem ninguém compatível, ninguém é avisado e a
 *    função devolve 0 — e é esse 0 que a ficha do pedido lê (pela função
 *    `avisos_da_demanda`) para dizer a verdade a quem publicou.
 * 4. O AUTOR NUNCA SE AVISA. Quem publica pode ter interesse cadastrado no
 *    que acabou de pedir (uma marina que também procura vaga em outra marina);
 *    ele sai da lista antes da gravação, como já sai das vitrines.
 *
 * ---------------------------------------------------------------------------
 * CANAIS
 * ---------------------------------------------------------------------------
 * PUSH e IN-APP. E-mail fica de fora desta entrega, e não por esquecimento: o
 * §64 lista os três canais, mas `RESEND_API_KEY` NÃO EXISTE em produção — a
 * rota de alertas já convive com isso há ondas (`if (process.env
 * .RESEND_API_KEY)`, em `app/api/alertas/disparar/route.ts`). Ligar o e-mail
 * daqui é a mesma meia dúzia de linhas de lá no dia em que a chave existir;
 * escrevê-las hoje seria código que nunca roda e que ninguém nunca viu
 * funcionar.
 */

/** Lote de push por vez — mesmo número da rota de alertas, pelo mesmo motivo:
 *  `Promise.allSettled` na lista inteira de uma vez pode esbarrar em limite de
 *  taxa dos serviços de push. Ver `lib/lotes.ts`. */
const TAMANHO_LOTE = 10

/** De onde veio a compatibilidade — grava em `avisos_demanda.origem` e é a
 *  única resposta possível ao "por que EU recebi isto?" meses depois. A ordem
 *  desta lista é a precedência quando a mesma pessoa casa por mais de uma
 *  fonte: a unique do banco só deixa uma linha existir, então alguém tem de
 *  ganhar, e ganha a declaração mais explícita (a que a pessoa foi lá e
 *  preencheu numa tela de interesses). */
const PRECEDENCIA_ORIGEM = ["interesse", "partner", "perfil_profissional"] as const
type OrigemAviso = (typeof PRECEDENCIA_ORIGEM)[number]

/** O pedido recém-publicado, já com o título resolvido pela taxonomia. Quem
 *  monta isto é `publicarDemanda` — que tem os campos em mãos e a sessão do
 *  usuário para ler `taxonomia`. */
export interface DemandaPublicada {
  id: string
  autor_id: string
  tipo: TipoDemanda
  regiao_id: string
  categoria_id: string | null
  funcao_id: string | null
  combustivel_id: string | null
  tipo_vaga: "seca" | "molhada" | null
  porte_pes: number | null
  /** Título gerado pelo Commander (§11.2) — é o que aparece no push e no
   *  detalhe do aviso. Nunca a observação livre de quem publicou. */
  titulo: string
}

/**
 * Avisa quem atende. Devolve QUANTAS pessoas foram avisadas AGORA — número
 * que a tela de quem publicou usa para não mentir.
 *
 * Nunca lança: publicar um pedido não pode falhar porque o aviso falhou. O
 * pedido já está no banco e visível na vitrine quando esta função roda; se
 * algo aqui quebrar, o Marketplace volta ao comportamento de antes (silêncio)
 * em vez de a pessoa perder o formulário que acabou de preencher.
 */
export async function avisarCompativeis(demanda: DemandaPublicada): Promise<number> {
  try {
    return await avisar(demanda)
  } catch (erro) {
    console.error("[avisos-marketplace] falha ao avisar compatíveis", erro)
    return 0
  }
}

async function avisar(demanda: DemandaPublicada): Promise<number> {
  // A chave de serviço é obrigatória e o motivo é a RLS, não conveniência:
  // `interesses_marketplace` só devolve as linhas do PRÓPRIO dono ("interesses:
  // só os próprios"), então quem publica não enxerga o interesse de mais
  // ninguém — e não deve mesmo. Sem a chave (preview sem segredos), ninguém é
  // avisado e a tela dirá isso; nunca "avisamos N" no vazio.
  const admin = supabaseServico()
  if (!admin) return 0

  const paraMatching: DemandaParaMatching = {
    tipo: demanda.tipo,
    regiao_id: demanda.regiao_id,
    categoria_id: demanda.categoria_id,
    funcao_id: demanda.funcao_id,
    combustivel_id: demanda.combustivel_id,
    porte_pes: demanda.porte_pes,
  }

  // Os três `eq("regiao_id", ...)` são ESTREITAMENTO, não decisão: as três
  // réguas puras já recusam quem não é da região (é a primeira pergunta das
  // duas), e o filtro existe só pra não varrer o cadastro inteiro da
  // plataforma a cada publicação — o custo O(base) que a auditoria de 18/08 já
  // cobrou uma vez em `carregarPainel`. Quem decide continua sendo a regra.
  const [interessesR, parceirosR, perfisR] = await Promise.all([
    admin.from("interesses_marketplace").select("*")
      .eq("ativo", true).eq("regiao_id", demanda.regiao_id),
    admin.from("parceiros").select("*").eq("regiao_id", demanda.regiao_id),
    // Perfil profissional só entra em demanda de tripulação — §11.1, e ver
    // `interesseDoPerfilProfissional`. Nos outros quatro tipos a consulta nem
    // sai.
    demanda.tipo === "tripulacao"
      ? admin.from("perfis_comandante").select("usuario_id, regiao_id, funcao_id, porte_max_pes, visivel")
          .eq("visivel", true).eq("regiao_id", demanda.regiao_id)
      : Promise.resolve({ data: [] as unknown[] }),
  ])

  const interesses = ((interessesR.data ?? []) as InteresseMarketplace[]) as InteresseParaMatching[]
  const parceiros = (parceirosR.data ?? []) as Parceiro[]
  const perfis = (perfisR.data ?? []) as Pick<
    PerfilComandante, "usuario_id" | "regiao_id" | "funcao_id" | "porte_max_pes" | "visivel"
  >[]

  // Atividades e vagas só dos parceiros que sobraram da região. Sem isto, as
  // duas tabelas viriam inteiras.
  const idsParceiros = parceiros.map((p) => p.id)
  const [atividadesR, vagasR] = idsParceiros.length > 0
    ? await Promise.all([
        admin.from("parceiro_atividades").select("*").in("parceiro_id", idsParceiros),
        admin.from("parceiro_vagas").select("*").in("parceiro_id", idsParceiros),
      ])
    : [{ data: [] }, { data: [] }]

  const atividadesPorParceiro = agrupar(
    (atividadesR.data ?? []) as ParceiroAtividade[],
    (a) => a.parceiro_id,
  )
  const vagasPorParceiro = agrupar((vagasR.data ?? []) as ParceiroVaga[], (v) => v.parceiro_id)

  // ---------------------------------------------------------------------
  // Quem recebe — as duas réguas, nesta ordem de precedência de `origem`
  // ---------------------------------------------------------------------
  const origemPorUsuario = new Map<string, OrigemAviso>()
  const marcar = (usuarioId: string, origem: OrigemAviso) => {
    // O autor nunca se avisa: ele pode ter interesse cadastrado justamente no
    // que acabou de pedir. As vitrines já o excluem (`d.autor_id !== user.id`
    // em `/marketplace` e em `/parceiro/marketplace`); o disparo faz o mesmo.
    if (usuarioId === demanda.autor_id) return
    const atual = origemPorUsuario.get(usuarioId)
    if (atual != null && PRECEDENCIA_ORIGEM.indexOf(atual) <= PRECEDENCIA_ORIGEM.indexOf(origem)) return
    origemPorUsuario.set(usuarioId, origem)
  }

  for (const id of usuariosCompativeis(paraMatching, interesses)) marcar(id, "interesse")

  const paraPartner: DemandaParaPartner = {
    tipo: demanda.tipo,
    regiao_id: demanda.regiao_id,
    categoria_id: demanda.categoria_id,
    combustivel_id: demanda.combustivel_id,
    tipo_vaga: demanda.tipo_vaga,
    porte_pes: demanda.porte_pes,
  }
  for (const p of parceiros) {
    const compativel = demandaCompativelComPartner(
      paraPartner,
      {
        categoria: p.categoria,
        tambem_vende_produtos: p.tambem_vende_produtos,
        tambem_presta_servicos: p.tambem_presta_servicos,
        regiao_id: p.regiao_id,
        atividades: (atividadesPorParceiro.get(p.id) ?? []).map(
          (a): AtividadeDeclarada => ({ id: a.taxonomia_id, tipo: a.tipo }),
        ),
      },
      (vagasPorParceiro.get(p.id) ?? []) as VagaDeclarada[],
    )
    if (compativel) marcar(p.usuario_id, "partner")
  }

  const interessesDePerfil = perfis
    .map((p) => interesseDoPerfilProfissional(p as PerfilProfissionalParaMatching))
    .filter((i): i is InteresseParaMatching => i != null)
  for (const id of usuariosCompativeis(paraMatching, interessesDePerfil)) {
    marcar(id, "perfil_profissional")
  }

  if (origemPorUsuario.size === 0) return 0

  // ---------------------------------------------------------------------
  // Grava — e é o BANCO que resolve o "duas vezes não"
  // ---------------------------------------------------------------------
  // `ignoreDuplicates` = `on conflict do nothing` sobre a unique da 089. O
  // `.select()` devolve só as linhas que de fato entraram; quem já tinha sido
  // avisado deste pedido não volta e, por consequência, não recebe push de
  // novo. É a mesma lógica de `alertas_enviados`, com a diferença de que lá o
  // erro de duplicata é que servia de sinal.
  const linhas = [...origemPorUsuario.entries()]
    // Ordem estável só por higiene de gravação/depuração — a regra do §11.4
    // pede distribuição determinística, e isso vale inclusive pra ordem em que
    // as linhas nascem.
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([usuario_id, origem]) => ({ demanda_id: demanda.id, usuario_id, origem }))

  const { data: gravadas, error } = await admin
    .from("avisos_demanda")
    .upsert(linhas, { onConflict: "demanda_id,usuario_id", ignoreDuplicates: true })
    .select("usuario_id")
  // Sem `.select()` uma escrita barrada voltaria com `error: null` e a tela
  // diria "avisamos N" sem ter avisado ninguém (regra da casa).
  if (error) {
    console.error("[avisos-marketplace] falha ao gravar avisos", error)
    return 0
  }
  const novos = ((gravadas ?? []) as { usuario_id: string }[]).map((l) => l.usuario_id)
  if (novos.length === 0) return 0

  // O push sai DEPOIS da resposta. Publicar já é o formulário mais longo do
  // app; fazer quem publicou esperar a rede do serviço de push de N aparelhos
  // antes de ver a própria tela seria pagar a lentidão no lugar errado. O
  // in-app, que é o canal garantido, já está gravado acima — se o push falhar,
  // o aviso continua existindo.
  after(async () => {
    try {
      await dispararPush(admin, demanda, novos)
    } catch (erro) {
      console.error("[avisos-marketplace] falha no push", erro)
    }
  })

  return novos.length
}

/** Push para quem acabou de ser avisado. Best-effort por definição: aparelho
 *  sem assinatura, assinatura morta ou serviço fora do ar não podem apagar o
 *  aviso in-app, que é o canal de verdade. */
async function dispararPush(
  admin: NonNullable<ReturnType<typeof supabaseServico>>,
  demanda: DemandaPublicada,
  usuarios: readonly string[],
): Promise<void> {
  const vapidPublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivada = process.env.VAPID_PRIVATE_KEY
  if (!vapidPublica || !vapidPrivada) return

  const [{ data: assinaturasR }, { data: vinculosR }] = await Promise.all([
    admin.from("push_assinaturas").select("*").in("usuario_id", [...usuarios]),
    admin.from("vinculos").select("usuario_id, papel, permissoes").in("usuario_id", [...usuarios]),
  ])
  const assinaturas = (assinaturasR ?? []) as PushAssinatura[]
  if (assinaturas.length === 0) return

  // As permissões REAIS de cada pessoa. Quem tem mais de um vínculo entra pelo
  // mais generoso (PROP vence): a régua da Central é "pode VER a área", e
  // poder ver num barco é poder ver.
  const permissoesPorUsuario = new Map<string, Permissoes | null>()
  for (const v of (vinculosR ?? []) as Pick<Vinculo, "usuario_id" | "papel" | "permissoes">[]) {
    if (permissoesPorUsuario.get(v.usuario_id) === null) continue // já é PROP
    permissoesPorUsuario.set(v.usuario_id, v.papel === "PROP" ? null : normalizarPermissoes(v.permissoes))
  }

  const aviso = notificacaoDeDemandaCompativel({
    id: demanda.id,
    tipo: demanda.tipo,
    titulo: demanda.titulo,
    criadoEm: new Date().toISOString(),
  })
  // A régua de push é a mesma da Central: só interrompe o celular o que a
  // Central contaria no sino. Ver `PUSH_POR_NIVEL`.
  if (!PUSH_POR_NIVEL[aviso.nivel]) return

  webpush.setVapidDetails("mailto:atendimento.smu@gmail.com", vapidPublica, vapidPrivada)

  await emLotes([...usuarios], TAMANHO_LOTE, async (u) => {
    // A régua de permissão da Central, não um `if` escrito aqui. Sem vínculo
    // nenhum (Partner, Captain sem barco) entra com "nenhuma permissão", que é
    // o padrão SEGURO: só passa aviso sem `aba`, que é o caso deste. `null`
    // significaria PROP e liberaria tudo — o oposto do que se quer pra quem o
    // app não conhece vínculo.
    const permissoes = permissoesPorUsuario.has(u)
      ? (permissoesPorUsuario.get(u) as Permissoes | null)
      : normalizarPermissoes(null)
    if (filtrarPorPermissao([aviso], permissoes).length === 0) return

    const doUsuario = assinaturas.filter((a) => a.usuario_id === u)
    const resultados = await Promise.allSettled(
      doUsuario.map((a) =>
        webpush.sendNotification(
          { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
          JSON.stringify({
            titulo: aviso.titulo,
            corpo: demanda.titulo,
            // Direto no pedido, e não em `/notificacoes` como os alertas do
            // barco: o destino do toque é a tela onde a AÇÃO do aviso
            // acontece — enviar a proposta —, não a caixa que a listaria.
            //
            // ONDA 101 — a razão escrita aqui até agora era outra ("a Central
            // ainda é uma tela de dono de barco"), e ela deixou de ser verdade
            // no mesmo commit que a escreveu: a onda 99 tirou o
            // `redirect("/onboarding")` da Central justamente para o Partner e
            // o Captain. O destino continua certo pelo motivo acima; o que
            // muda é o comentário parar de justificar-se por um defeito que
            // não existe mais.
            url: aviso.href,
          }),
        ),
      ),
    )
    for (let i = 0; i < resultados.length; i++) {
      const r = resultados[i]
      if (r.status === "fulfilled") continue
      // Só remove assinatura morta (404/410); erro transitório mantém — mesma
      // política da rota de alertas.
      const codigo = r.reason instanceof webpush.WebPushError ? r.reason.statusCode : null
      if (codigo === 404 || codigo === 410) {
        await admin.from("push_assinaturas").delete().eq("endpoint", doUsuario[i].endpoint)
      }
    }
  })
}

function agrupar<T>(itens: readonly T[], chave: (item: T) => string): Map<string, T[]> {
  const mapa = new Map<string, T[]>()
  for (const item of itens) {
    const lista = mapa.get(chave(item))
    if (lista) lista.push(item)
    else mapa.set(chave(item), [item])
  }
  return mapa
}
