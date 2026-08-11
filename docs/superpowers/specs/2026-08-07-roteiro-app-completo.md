# Commander — Roteiro do app completo (consolidação v3)

**Fontes:** espec v3 (`2026-08-07-espec-v3-original.md`) + conversa Pedro/Erick de 07/08 (parceiros, poitas) + decisão de navegação marítima própria + auditoria 360 + o que já está construído até a Onda 3.

**Este documento é o mapa. Cada onda vira um plano detalhado (writing-plans) na hora de executar.**

---

## Estado atual (mergeado em master, 07/08/2026)

Fases 1-5 + Ondas 0-3. Em produção de código (não deployado): ficha completa da embarcação
(dados gerais, motores com abas e média de uso, elétrica, casco, documentos, fotos com cota,
contatos com nota, gastos com gráfico 6 meses), diário de bordo unificado com trilha GPS,
alertas push/e-mail (janelas 30/15/5), PWA, matriz de permissões PROP/CMDT valendo no banco,
convites, marketplace vitrine de comandantes com selo verificado, GPS Tier 0 (posição, trilha,
boletim do mar Open-Meteo), landing pública, assinatura Asaas (fundador R$ 69,99/699,90),
gate de cobrança dormente, analytics PostHog, relatório mensal por e-mail. 100 testes.

---

## Decisões e pendências do dono (nada disso é código)

| # | Pendência | Bloqueia |
|---|---|---|
| 1 | Conta Asaas + chave sandbox | teste do fluxo de pagamento ponta a ponta |
| 2 | Conta Mapbox + token `pk.` em `NEXT_PUBLIC_MAPBOX_TOKEN` | Onda 4 inteira |
| 3 | Deploy Vercel + CNAME `commander` (DNS only) no Cloudflare | tudo que é público |
| 4 | `SUPABASE_SERVICE_ROLE_KEY` e `RESEND_API_KEY` no `.env.local` | alertas/relatório locais |
| 5 | Asset final do logo | landing/identidade |
| 6 | **Parecer jurídico**: comissão/vínculo trabalhista, verificação RH, disclaimer de navegação, responsabilidade de poitas | Ondas 8, 9 e 10 |
| 7 | Decisão de preço: R$ 119,00 (espec v3) vs R$ 119,90 (implementado) | um ajuste de constante |
| 8 | "Inclui 1 acesso CMDT": marketing ou limite de plano? (recomendação: marketing, sem limite) | nada por ora |
| 9 | Desabilitar boleto na conta Asaas (o código também vai restringir) | Onda 6 |
| 10 | Corretora de seguro parceira + número WhatsApp Business | itens de retenção da Onda 6 |
| 11 | Confirm email ON no Supabase antes do público | lançamento |

---

## Onda 4 — O MAPA (parceiros comerciais + navegador de bordo)

Um mapa Mapbox só, duas caras. Retenção (abre toda saída) + receita paralela (parceiro paga
independente da base de PROPs).

**Parceiros (espec v3 §11 + conversa):**
- Migration: tabela `parceiros` — categoria (marina/posto/pousada/restaurante), nome, sobre,
  lat/lng, telefone, e-mail, horário, preços (diária de vaga/poita, diesel), calado máx,
  traslado incluso, vaga cortesia p/ quem consome, culinária, `tem_poita`/`qtd_poitas`
  (gancho da Onda 10), plano (`cortesia`/`basico` R$100/`destaque` R$200), 3 fotos (storage),
  `atualizado_em`, contador de visualizações. RLS: parceiro edita só o seu; PROP vê visíveis.
  Trava de 1 atualização de preço/dia (regra da espec).
- 4º tipo de conta com painel próprio autoatendimento ("zero estresse"): cadastro → categoria
  → dados → **posiciona o pino arrastando no mapa** (endereço não funciona no mar) → 3 fotos.
- Lançamento: grátis/cortesia para os primeiros de cada categoria (Pedro). Cobrança R$100/200
  liga depois na infra Asaas existente.
- Mapa do PROP: pinos por categoria, badge Destaque (dourado) e badge poita, card bottom-sheet
  (nunca Popup.setHTML — dado de parceiro é não-confiável), "atualizado há X" (aviso >30d),
  "Como chegar" (abre o app de mapas do celular — "só direcionando mesmo"), ligar.

**Navegador de bordo — degrau 1 (dados abertos + GPS do aparelho):**
- GeolocateControl no máximo: `trackUserLocation`, `showUserHeading`,
  `enableHighAccuracy` — posição ao vivo com seta de rumo.
- SOG em nós na tela; overlay OpenSeaMap (boias/faróis; atribuição CC-BY-SA obrigatória).
- Toque em qualquer destino → linha de rumo: distância em MN, bearing, ETA na velocidade atual.
- **Alarme de âncora** (raio de segurança, alerta se garrar) e botão MOB.
- Disclaimer fixo: "auxílio à navegação — não substitui as cartas náuticas oficiais".

## Onda 5 — ROTA MARÍTIMA ✅ (entregue 08/08/2026)

A linha de destino parou de cruzar terra. Máscara água/terra da costa **Ilhabela →
Búzios** gerada da linha de costa do OpenStreetMap (ODbL), 4088×1547 células a 100 m,
21 KB versionados; A* octile com margem de 200 m da costa, string-pulling em pernas,
rodando em Web Worker; painel com distância da rota, rumo da próxima perna, ETA e
número de pernas; estados honestos (fora da área / sem caminho / calculando). Prova:
Abraão → Angra sai por dentro do canal da Ilha Grande. Custo operacional zero.
**Sabe contornar TERRA, não conhece PROFUNDIDADE** — o disclaimer de carta oficial
continua valendo.

## Onda 6 — O BARCO VIVO (deltas da espec v3 na ficha + retenção)

- **Livro de Bordo completo (§10)**: hora saída/retorno com duração, tripulação a bordo
  (dos vínculos), destino, condições do mar gravadas automaticamente (Open-Meteo no momento
  do registro), observações — e a sinergia: "essa saída durou 4h — atualizar horas dos motores?"
- **Selo Ouro (§4.9)**: checklist de completude + barra de progresso + botão "Solicitar
  avaliação presencial" (dispara contato para a equipe; avaliação em si é operação).
- **Assinatura completa (§9.4)**: data da próxima cobrança + histórico de faturas (API Asaas).
- **Boleto fora no código** (§9): restringir meios no checkout (par com pendência #9).
- **Alertas meteorológicos push (§12)**: condição desfavorável na região da marina → push
  (encaixa no cron de alertas existente).
- **Lembretes de boa prática (§12)**: baseados em dado real (motor parado há X semanas).
- **Suporte e peças na Elétrica (§4.4)**: vincular contato à aba.
- **Gatilho de seguro (§12)**: vencimento de apólice → oferta de cotação da corretora parceira
  (link/formulário — depende da pendência #10).
- Menores herdados: preço dourado no card fundador, unificar secrets APP_URL/COMMANDER_URL,
  editar item monitorado, lightbox de fotos, "Em breve" do menu limpo.

## Onda 7 — CARTAS NÁUTICAS E OFFLINE (degrau 2 da navegação)

- Pipeline: cartas raster gratuitas da Marinha (BSB/NOAA v3) → tiles → camada opcional
  "ver carta náutica" no mapa.
- Cache offline de tiles no service worker (no mar não tem sinal).
- Batimetria/sombreamento de profundidade conforme o que a carta raster der.

## Onda 8 — MARKETPLACE TRANSACIONAL (bloqueada pelo jurídico #6)

Espec v3 §6/§7: contratação de diária no app — 1º fechamento R$ 350 fixo global, comissão 10%
piso R$ 25, split Asaas com repasse no mesmo dia (nunca reter saldo), pacotes de diárias com
degraus padronizados (valores a definir — pendência), liberação de preço próprio pós-1º
fechamento (risco de "queimar" aceito na espec), avaliações reais (só quem contratou),
métricas do CMDT (vagas fixas ativas, diárias/mês, histórico), vagas fixas, chat PROP↔CMDT,
cobrança do CMDT R$ 19,99 adiada 12+ meses (CMO). Verificação RH operacional com crivo.

## Onda 9 — PRESTADORES (espec v3 §8; bloqueada pelo jurídico e por massa de PROPs)

Trabalhos em aberto postados pelo PROP (título, valor, local, tempo), aceite esmaece para os
demais, avaliações, chat (reusa o da Onda 8), cadastro grátis na fase 1 (R$ 19,99 só com
massa crítica de leads).

## Onda 10 — POITAS (a carta na manga — Pedro mandou guardar; bloqueada por jurídico + operação)

- Cadastro de poitas com lat/lng exata, detalhes, valor, fotos, **laudo técnico assinado**.
- Reserva e pagamento no app com split (ex.: 150 = 100 dono + 50 Commander) — mesma infra
  de split da Onda 8.
- Disclaimers obrigatórios: "necessária verificação da vaga pessoalmente" + "responsabilidade
  do dono caso a poita estoure" (enquanto não houver laudo).
- Visão Pedro: poitas Commander com bandeira própria em pontos estratégicos (Saco do Céu,
  Abraão, Paraty, Ilhabela...), sociedade 50/50 com operadores locais, controle de uso e
  estado. Exige funcionário por área — por isso é a ÚLTIMA onda, não a primeira.

## Fora de escopo mantido (espec v3 §13)

Anúncios (fixo/freelance) · cursos com certificação · regra de comissão por par PROP-CMDT
(só se a global falhar).

## Trilha operacional (paralela, não é código — auditoria CMO)

Concierge de onboarding dos 100 fundadores · recrutar 20-30 CMDTs verificados de Glória+Angra
antes do lançamento público · parcerias de marina · pré-venda 1:1 · Rio Boat Show (~abr/2027,
carona em estande) · Instagram de bastidor de marina.

---

## Ordem e porquê

4 antes de tudo: destrava o funil de vendas de parceiros (receita paralela imediata do leque
"barcos, marinas, postos, restaurantes, pousadas") e muda a frequência de uso do app de mensal
para semanal. 5 fecha a espec da ficha e a retenção. 6 aprofunda o diferencial de navegação.
8-10 dependem do advogado e de operação — o código espera a caneta.

---

## Pilar Strava do Mar (decidido pelo dono em 11/08/2026)

Decisão do Erick, com o mockup do Pedro como referência visual: o Commander vira também o
registro social/vivo do uso do barco — "um Strava no mar". A frase que define a estratégia:
**"sempre que forem usar o app devemos traçar a rota real do barco e guardar isso sempre,
para definir as rotas dos próximos barcos que solicitarem."** Mesmo desenho da sondagem
colaborativa (onda 13), aplicado ao caminho: dado agregado por célula, nunca a rota
individual de alguém exposta, consentimento explícito, e valor que só acumula.

### Onda 17 — corredores (a rota que aprende)
Toda trilha gravada alimenta, com consentimento, um agregado global de passagens por célula
("corredores"). O A* passa a PREFERIR célula com passagem real comprovada (redutor de custo,
nunca sobrepõe bloqueio por terra/calado). Trilha com gravação automática opcional ao
navegar (preferência lembrada, aviso honesto de bateria). Com a tabela vazia, a rota fica
idêntica à de hoje — testado.

### Onda 18 — a saída como atividade
Cada saída do Livro de Bordo vira uma "atividade" com mapa da trilha + distância/tempo/vel
média/máx + condições de mar — a tela que dá orgulho de compartilhar. Totais pessoais
(milhas no ano, horas no mar) na Início/perfil. Base: `resumoTrilha` e migration 022, que já
guardam tudo — a onda é apresentação, não coleta nova.

### Onda 19 — planejar viagem (Próximas paradas)
Destino com paradas intermediárias usando a rota por A* + ETA pela velocidade de cruzeiro.
Devolve ao mockup do Pedro o cartão "Próximas paradas" — agora com dado real. Depende da 17
mergeada (rota preferindo corredores).

Nota de privacidade (vale para as três): posição de barco é dado sensível. Entre barcos, SÓ
agregado por célula via função security definer (mesma régua da migration 025); a trilha
individual pertence ao dono e aparece apenas nas SUAS atividades.
