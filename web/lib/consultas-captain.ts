import { cache } from "react"
import { carregarAssinatura } from "@/lib/consultas"
import {
  planoDeCarreira, trilhaDaConta,
  type TipoPerfilProfissional, type TrilhaDaConta,
} from "@/lib/domain/captain"
import { supabaseServer } from "@/lib/supabase/server"
import type { PlanoId } from "@/lib/domain/planos"
import type { Disponibilidade, PerfilComandante } from "@/lib/db/types"

/**
 * Leituras da carreira profissional (onda 50, PRD §12).
 *
 * Arquivo separado de `lib/consultas.ts` de propósito: aquele responde
 * perguntas sobre a EMBARCAÇÃO ativa (painel, nível do plano do barco,
 * tripulação), e este responde sobre a PESSOA (trilha, perfil profissional,
 * trabalhos confirmados). O §12 separa os dois eixos — manter os dois grupos
 * de consulta no mesmo arquivo convidaria a primeira função a misturá-los.
 *
 * Nada aqui filtra visibilidade na mão: a RLS da migration 051 já decide o
 * que cada pessoa enxerga na vitrine. Estas funções só montam o formato.
 */

/** Quem é esta conta, na régua do §3/§12 — e em que degrau de carreira ela
 *  está. É o que a tela de assinatura e o menu usam pra saber se oferecem
 *  Captain Pro ou Commander. */
export const carregarTrilha = cache(async (): Promise<{
  trilha: TrilhaDaConta
  /** Plano vigente cru, como `carregarAssinatura` devolve. */
  plano: PlanoId
  /** O mesmo plano dito no vocabulário da trilha: quem é Captain sem
   *  assinatura é "Captain Free", não "Proprietário Free" (§12). */
  planoCarreira: PlanoId
  ehProprietario: boolean
  ehTripulacao: boolean
  tipoPerfilProfissional: TipoPerfilProfissional | null
}> => {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return {
      trilha: "proprietario",
      plano: "proprietario_free",
      planoCarreira: "proprietario_free",
      ehProprietario: false,
      ehTripulacao: false,
      tipoPerfilProfissional: null,
    }
  }

  const [{ plano }, { data: vinculos }, { data: perfil }] = await Promise.all([
    carregarAssinatura(),
    supabase.from("vinculos").select("papel").eq("usuario_id", user.id),
    supabase.from("perfis_comandante").select("tipo").eq("usuario_id", user.id).maybeSingle(),
  ])

  const papeis = ((vinculos ?? []) as { papel: string }[]).map((v) => v.papel)
  const sinal = {
    plano,
    ehProprietario: papeis.includes("PROP"),
    ehTripulacao: papeis.includes("CMDT"),
    tipoPerfilProfissional: (perfil as { tipo: TipoPerfilProfissional } | null)?.tipo ?? null,
  }
  const trilha = trilhaDaConta(sinal)
  return { ...sinal, trilha, planoCarreira: planoDeCarreira(plano, trilha) }
})

/** O meu perfil profissional, do jeito que está no banco. A RLS sempre deixa
 *  a pessoa ler o próprio, mesmo sem plano — preencher e revisar é grátis
 *  (§1.1); o que custa é aparecer pros outros. */
export const carregarMeuPerfilProfissional = cache(async (): Promise<PerfilComandante | null> => {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from("perfis_comandante").select("*").eq("usuario_id", user.id).maybeSingle()
  return (data as PerfilComandante | null) ?? null
})

/**
 * Trabalhos confirmados de uma pessoa (§12), lidos de `negocios` +
 * `negocios_confirmacoes` pela RPC `trabalhos_confirmados` (migration 051).
 *
 * Por que RPC e não uma query: `negocios` só é legível pelas duas partes
 * (§21.1) — quem visita um perfil não pode ler com quem a pessoa trabalhou
 * nem por quanto. A função devolve UM INTEIRO, que é exatamente o que o
 * perfil mostra. E não existe contador paralelo: o número sai sempre do fato
 * bilateral, então corrigir um negócio corrige o currículo junto.
 */
export async function carregarTrabalhosConfirmados(usuarioId: string): Promise<number> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.rpc("trabalhos_confirmados", { p_usuario: usuarioId })
  // Falha de leitura vira 0 e não erro de tela: o currículo é enfeite do
  // perfil, não a razão de ele existir. Mostrar "0" é honesto (é o que o app
  // sabe), derrubar a página inteira não seria.
  if (error) return 0
  return typeof data === "number" ? data : 0
}

/** A disponibilidade que ESTA pessoa tem no ar (§11.3), pro perfil mostrar
 *  "quando ela pode" sem duplicar o dado em coluna nenhuma. A RLS já devolve
 *  só as vivas pra quem visita, e todas pro próprio autor. */
export async function carregarDisponibilidadesDe(usuarioId: string): Promise<Disponibilidade[]> {
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from("disponibilidades").select("*")
    .eq("autor_id", usuarioId).eq("ativo", true)
    .order("criado_em", { ascending: false }).limit(5)
  return (data as Disponibilidade[] | null) ?? []
}

/** URL pública da foto do perfil (bucket `perfis`, migration 051). `null`
 *  quando a pessoa não subiu foto — a vitrine cai nas iniciais, que é o que
 *  ela já fazia antes. */
export async function urlDaFotoDePerfil(fotoPath: string | null): Promise<string | null> {
  if (!fotoPath) return null
  const resolver = await resolvedorDeFotoDePerfil()
  return resolver(fotoPath)
}

/** Versão pra LISTA: devolve um resolvedor síncrono depois de montar UM
 *  cliente. `getPublicUrl` é só concatenação de string, mas criar um cliente
 *  Supabase por linha da vitrine seria caro à toa. */
export async function resolvedorDeFotoDePerfil(): Promise<(fotoPath: string | null) => string | null> {
  const supabase = await supabaseServer()
  return (fotoPath) =>
    fotoPath ? supabase.storage.from("perfis").getPublicUrl(fotoPath).data.publicUrl : null
}
