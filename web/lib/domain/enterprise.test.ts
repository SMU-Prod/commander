import { describe, expect, it } from "vitest"
import {
  ACOES_ENTERPRISE,
  ehAcaoCritica,
  ehPapelEnterprise,
  EVENTOS_AUDITADOS,
  exigeAprovacao,
  exigeMotivoDeAjuste,
  FUNCAO_PAPEL,
  linhaDeAuditoria,
  MODOS_APROVACAO,
  PAPEIS,
  PAPEIS_ENTERPRISE,
  podePublicarParaCotistas,
  PRESET_ENTERPRISE,
  ROTULO_EVENTO,
  ROTULO_MODO_APROVACAO,
  ROTULO_PAPEL,
  type ModoAprovacao,
} from "./enterprise"
import { ABAS } from "./permissoes"

describe("Enterprise", () => {
  describe("vocabulário", () => {
    it("todo papel tem rótulo", () => {
      for (const p of PAPEIS) expect(ROTULO_PAPEL[p], p).toBeTruthy()
    })

    it("todo papel Enterprise tem a função descrita", () => {
      for (const p of PAPEIS_ENTERPRISE) expect(FUNCAO_PAPEL[p], p).toBeTruthy()
    })

    it("todo modo de aprovação tem rótulo", () => {
      for (const m of MODOS_APROVACAO) expect(ROTULO_MODO_APROVACAO[m], m).toBeTruthy()
    })

    it("todo evento auditado tem rótulo", () => {
      for (const e of EVENTOS_AUDITADOS) expect(ROTULO_EVENTO[e], e).toBeTruthy()
    })

    it("PROP e CMDT continuam existindo e não são Enterprise", () => {
      expect(PAPEIS).toContain("PROP")
      expect(PAPEIS).toContain("CMDT")
      expect(ehPapelEnterprise("PROP")).toBe(false)
      expect(ehPapelEnterprise("CMDT")).toBe(false)
      expect(ehPapelEnterprise("ADM")).toBe(true)
    })
  })

  describe("presets", () => {
    it("todo preset cobre as 15 áreas — área nova não fica indefinida", () => {
      for (const papel of PAPEIS_ENTERPRISE) {
        for (const aba of ABAS) {
          expect(PRESET_ENTERPRISE[papel][aba], `${papel}/${aba}`).toBeDefined()
        }
      }
    })

    it("ADM Geral e ADM veem e editam tudo", () => {
      for (const papel of ["ADM_GERAL", "ADM"] as const) {
        for (const aba of ABAS) {
          expect(PRESET_ENTERPRISE[papel][aba], `${papel}/${aba}`).toEqual({ ver: true, editar: true })
        }
      }
    })

    it("cotista não edita NADA — §13: visualiza, não administra", () => {
      for (const aba of ABAS) {
        expect(PRESET_ENTERPRISE.COTISTA[aba].editar, aba).toBe(false)
      }
    })

    it("cotista vê a unidade, mas não o dinheiro nem a equipe", () => {
      expect(PRESET_ENTERPRISE.COTISTA.embarcacao.ver).toBe(true)
      expect(PRESET_ENTERPRISE.COTISTA.gastos.ver).toBe(false)
      expect(PRESET_ENTERPRISE.COTISTA.carteira.ver).toBe(false)
      expect(PRESET_ENTERPRISE.COTISTA.contatos.ver).toBe(false)
    })

    it("mecânica não chega no dinheiro da frota — §7 proíbe virar ERP de oficina", () => {
      expect(PRESET_ENTERPRISE.MECANICA.gastos.ver).toBe(false)
      expect(PRESET_ENTERPRISE.MECANICA.carteira.ver).toBe(false)
    })

    it("mecânica edita o técnico", () => {
      expect(PRESET_ENTERPRISE.MECANICA.motores.editar).toBe(true)
      expect(PRESET_ENTERPRISE.MECANICA.eletrica.editar).toBe(true)
    })

    it("operações não chega no dinheiro nem na carteira", () => {
      expect(PRESET_ENTERPRISE.OPERACOES.gastos.ver).toBe(false)
      expect(PRESET_ENTERPRISE.OPERACOES.carteira.ver).toBe(false)
    })

    it("operações registra o dia a dia do pátio", () => {
      expect(PRESET_ENTERPRISE.OPERACOES.diario.editar).toBe(true)
      expect(PRESET_ENTERPRISE.OPERACOES.fotos.editar).toBe(true)
      expect(PRESET_ENTERPRISE.OPERACOES.motores.editar).toBe(true)
    })
  })

  describe("régua de aprovação", () => {
    it("sem aprovação: rotina entra direto", () => {
      expect(exigeAprovacao("sem_aprovacao", "check_out", "OPERACOES")).toBe(false)
      expect(exigeAprovacao("sem_aprovacao", "horas_lancar", "OPERACOES")).toBe(false)
    })

    it("tudo exige aprovação: nem o check-out escapa", () => {
      for (const acao of ACOES_ENTERPRISE) {
        expect(exigeAprovacao("tudo", acao, "OPERACOES"), acao).toBe(true)
      }
    })

    it("somente críticos: horas e avaria esperam, check-in/out não", () => {
      expect(exigeAprovacao("somente_criticos", "horas_lancar", "OPERACOES")).toBe(true)
      expect(exigeAprovacao("somente_criticos", "avaria_abrir", "OPERACOES")).toBe(true)
      // §6 quer o pátio rápido: travar a saída do barco esperando ADM seria
      // a fricção que o PRD manda evitar.
      expect(exigeAprovacao("somente_criticos", "check_out", "OPERACOES")).toBe(false)
      expect(exigeAprovacao("somente_criticos", "check_in", "OPERACOES")).toBe(false)
    })

    it("MECÂNICA NUNCA publica direto pro cotista — nem em 'sem aprovação'", () => {
      // §7 e §25: "Mecânica nunca publica diretamente aos cotistas". É a
      // única ação que ignora a régua de confiança.
      for (const modo of MODOS_APROVACAO) {
        expect(exigeAprovacao(modo, "publicar_para_cotistas", "MECANICA"), modo).toBe(true)
      }
    })

    it("a exceção da mecânica não vaza para outras ações dela", () => {
      expect(exigeAprovacao("sem_aprovacao", "manutencao_registrar", "MECANICA")).toBe(false)
    })

    it("modo inválido não passa despercebido pelo tipo", () => {
      // Guarda de regressão: se alguém adicionar um modo em MODOS_APROVACAO
      // sem tratar no switch, este teste quebra junto com o `tsc`.
      const modos: ModoAprovacao[] = [...MODOS_APROVACAO]
      for (const m of modos) {
        expect(typeof exigeAprovacao(m, "check_out", "OPERACOES")).toBe("boolean")
      }
    })

    it("publicar é crítico por natureza, não só pela mecânica", () => {
      expect(ehAcaoCritica("publicar_para_cotistas")).toBe(true)
      expect(exigeAprovacao("somente_criticos", "publicar_para_cotistas", "OPERACOES")).toBe(true)
    })
  })

  // AUDITORIA 19/08, B6 — a régua acima existia e ninguém a chamava; o app
  // decidia com `ehDono &&` no JSX. Estes casos são a tradução dela para o
  // gesto de publicar, que /mecanica e `publicarServico` agora consultam.
  describe("quem publica laudo para os cotistas", () => {
    it("o dono da conta publica", () => {
      expect(podePublicarParaCotistas("PROP", "tudo").pode).toBe(true)
    })

    it("comandante não publica — publicar é ato da administradora", () => {
      const r = podePublicarParaCotistas("CMDT", "sem_aprovacao")
      expect(r.pode).toBe(false)
      expect(r.motivo).toBeTruthy()
    })

    it("MECÂNICA nunca publica, em nenhum modo — e o motivo diz por quê", () => {
      // A trava do §7. Sem ela, a policy da 063 ("quem edita motores
      // atualiza") deixaria o próprio mecânico gravar `publicado_em`.
      for (const modo of MODOS_APROVACAO) {
        const r = podePublicarParaCotistas("MECANICA", modo)
        expect(r.pode, modo).toBe(false)
        expect(r.motivo, modo).toContain("ADM")
      }
    })

    it("ADM e ADM Geral publicam quando a régua deixa passar", () => {
      expect(podePublicarParaCotistas("ADM", "sem_aprovacao").pode).toBe(true)
      expect(podePublicarParaCotistas("ADM_GERAL", "sem_aprovacao").pode).toBe(true)
    })

    it("ADM com a régua em 'tudo' não publica sozinho", () => {
      // Era exatamente o caso que o `ehDono &&` do JSX resolvia por acidente:
      // acertava a recusa pelo motivo errado.
      expect(podePublicarParaCotistas("ADM", "tudo").pode).toBe(false)
    })

    it("Operações e Cotista não publicam nem com a confiança no máximo", () => {
      expect(podePublicarParaCotistas("OPERACOES", "sem_aprovacao").pode).toBe(false)
      expect(podePublicarParaCotistas("COTISTA", "sem_aprovacao").pode).toBe(false)
    })

    it("toda recusa vem com motivo — a tela nunca some com o botão em silêncio", () => {
      for (const papel of PAPEIS) {
        for (const modo of MODOS_APROVACAO) {
          const r = podePublicarParaCotistas(papel, modo)
          if (!r.pode) expect(r.motivo, `${papel}/${modo}`).toBeTruthy()
        }
      }
    })
  })

  describe("auditoria", () => {
    it("ajuste que bate com o teórico não exige motivo", () => {
      expect(exigeMotivoDeAjuste(1200, 1200)).toBe(false)
    })

    it("qualquer divergência exige motivo — pra menos e pra mais", () => {
      expect(exigeMotivoDeAjuste(1200, 1150)).toBe(true)
      expect(exigeMotivoDeAjuste(1200, 1260)).toBe(true)
    })

    it("a linha diz quem, o quê e quando", () => {
      const l = linhaDeAuditoria("Ana Souza", "aprovou", "2026-08-18T17:32:00Z")
      expect(l).toContain("Ana Souza")
      expect(l).toContain("aprovou")
      expect(l).toContain("18/08/2026")
    })

    it("o horário é o de São Paulo, não o UTC do banco", () => {
      // 02:30Z do dia 19 é 23:30 do dia 18 em Brasília. Sem o fuso, a linha
      // de auditoria diria um dia que não aconteceu — o mesmo tipo de erro
      // que a onda 63 achou na idade de ocorrência.
      const l = linhaDeAuditoria("Ana", "criou", "2026-08-19T02:30:00Z")
      expect(l).toContain("18/08/2026")
      expect(l).toContain("23:30")
    })

    it("com alvo, a frase nomeia quem sofreu a ação", () => {
      const l = linhaDeAuditoria("Ana", "bloqueou_cotista", "2026-08-18T17:32:00Z", "João Lima")
      expect(l).toContain("bloqueou o acesso de João Lima")
    })

    it("sem alvo, não sobra espaço nem traço solto", () => {
      const l = linhaDeAuditoria("Ana", "criou", "2026-08-18T17:32:00Z", "   ")
      expect(l).toContain("Ana criou ·")
    })
  })
})
