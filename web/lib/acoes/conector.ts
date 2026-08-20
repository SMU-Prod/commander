"use server"

import { createHash, randomBytes } from "node:crypto"
import { carregarPainel } from "@/lib/consultas"
import { podeEditar } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * ONDA 140 — O TOKEN DO COMMANDER CONNECTOR.
 * ===========================================================================
 * O plugin de Signal K (connector/ na raiz do repo) se autentica no app com
 * um token de dispositivo. Este arquivo cria e revoga esses tokens.
 *
 * O TOKEN EM CLARO SÓ EXISTE UMA VEZ — no retorno desta ação, para a pessoa
 * copiar e colar na tela de configuração do plugin. No banco vive apenas o
 * SHA-256: vazamento de banco não vira acesso ao barco. É o mesmo desenho de
 * chave de API do resto da indústria, e o motivo de a ação DEVOLVER o token
 * em vez de redirecionar com ele na URL (URL vaza em log e histórico).
 *
 * Permissão: `podeEditar("embarcacao")` — plugar um dispositivo que
 * transmite dados do barco é mexer na embarcação, não é leitura.
 */
export async function criarTokenConector(): Promise<{ token: string } | { erro: string }> {
  const painel = await carregarPainel()
  if (!painel) return { erro: "Nenhuma embarcação ativa. Selecione uma embarcação e tente de novo." }
  if (!podeEditar(painel.permissoes, "embarcacao")) {
    return { erro: "Seu acesso não permite conectar dispositivos. Fale com o proprietário." }
  }

  const token = `cmdr_${randomBytes(32).toString("base64url")}`
  const hash = createHash("sha256").update(token).digest("hex")

  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from("conector_tokens")
    .insert({
      embarcacao_id: painel.embarcacao.id,
      token_hash: hash,
      rotulo: "Signal K do barco",
    })
    .select("id")

  // A tabela nasce na migration 20260820_conector_tokens_telemetria.sql —
  // se ela ainda não foi aplicada no banco, a mensagem diz isso em vez de
  // fingir sucesso (a regra da recusa silenciosa de RLS vale dobrado aqui).
  if (error || !data?.length) {
    return { erro: "Não foi possível gerar o token agora. Se o problema continuar, a migração do conector ainda não foi aplicada no banco." }
  }
  return { token }
}
