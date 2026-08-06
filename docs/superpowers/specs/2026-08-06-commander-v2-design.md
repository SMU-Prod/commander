# COMMANDER — Especificação v2.0

> Sucede a v1.1 (`2026-08-05-app-nautico-design.md`). Incorpora a identidade visual definida
> (nome **Commander**, navy + dourado, light mode padrão) e a espec de produto completa
> revisada com o Erick em 06/08/2026. O que não é redefinido aqui (conceitos de Item
> Monitorado, Diário de Bordo, Registro Rápido, GPS em 3 tiers, infra custo quase zero,
> modelo de dados) **continua valendo como está na v1.1**.
>
> Decisões desta versão: light padrão + dark opcional · pagamentos intermediados em fase
> própria após a gestão · matriz de permissões completa no módulo CMDT · GPS mantido no roadmap.

---

## 1. Identidade

- **Nome:** Commander — "Gestão completa da sua embarcação".
- **Marca:** monograma de dois "M" espelhados (comando/proa/brasão) em dourado sobre navy.
  Asset final do logo a receber do Erick; até lá o app usa um monograma SVG provisório fiel
  ao conceito + wordmark `COMMANDER` em caixa alta com tracking largo.
- **Paleta:** navy profundo `#0B1D2D` (base/texto no light, fundo no dark), dourado
  `#D4AF37` (ação/destaque — botões primários, aba ativa), off-white `#F5F7FA` (fundo
  light), cinzas `#60717F` / `#E6E9EE` de apoio.
- **Tipografia:** Urbanist (títulos e UI; geométrica, presente na prancha aprovada) +
  mono do sistema para dígitos de horímetro (`tabular-nums` — assinatura mantida da v1.1).
- **Temas:** **light é o padrão** (legibilidade sob sol forte — marina, convés); dark é
  preferência ativável (visual "yacht clube"). Mesma paleta e mesmos componentes — dois
  temas, uma identidade. Implementação por tokens CSS com `data-theme`.
- **Toque de instrumento:** o horímetro permanece um cartucho escuro com dígitos mono
  **nos dois temas** — instrumento é escuro como no painel real; é a assinatura visual do app.
- Cards com cantos 10–12 px; semáforo verde/amarelo/vermelho em todo status.

## 2. Usuários

| Papel | O que é |
|---|---|
| **PROP** | Proprietário; paga assinatura (inclui 1 CMDT vinculado) |
| **CMDT** | Comandante/tripulação: acesso à(s) embarcação(ões) + perfil público no marketplace |
| **PRESTADOR** | Mecânico/eletricista etc — perfil público, fase posterior |

**Permissões do CMDT (decisão: matriz completa).** O acesso espelha as abas do PROP e o
PROP configura, por embarcação e por aba, **Ver** e **Editar** (matriz aba × permissão).
Presets "Completo" e "Operacional" continuam existindo como atalhos que preenchem a matriz.
Entra junto com o módulo CMDT (fase 5) — o banco já tem `vinculos.nivel`, que evolui para a
matriz.

## 3. Modelo de negócio

| Receita | Valor | Observação |
|---|---|---|
| Assinatura PROP | R$ 119/mês | 1 CMDT incluso; promoção fundadores R$ 69,99 (100 primeiros) |
| CMDT no marketplace | R$ 19,99/mês | Ativar cobrança após fase inicial |
| Prestador listado | Grátis fase 1 | R$ 19,99 futuro, após massa de leads |
| **Comissão sobre fechamentos** | **10% (piso R$ 25)** | Ver §6 |
| Selo Ouro | Consultoria avulsa | Avaliação presencial |
| Anúncios | — | Fora do escopo desta fase |

**Princípio de caixa:** a plataforma nunca retém saldo de terceiros — split no gateway com
repasse no mesmo dia. **Pagamento:** cartão + **Pix recorrente**, sem boleto → o gateway
precisa ser nacional com split nativo (Pagar.me / Asaas / Iugu; Stripe não cobre Pix
recorrente bem). Decidir na fase 6.

## 4. Estrutura do app (navegação)

Mobile-first, 5 abas inferiores + botão de Registro Rápido:

| Aba | Conteúdo |
|---|---|
| **Início** | Saudação, seletor de embarcação, card do barco, alertas, acesso rápido |
| **Embarcação** | Ficha por sistemas: Dados gerais, Motores, Casco, Elétrica, Documentos, Fotos, Contatos, Gastos, Selo Ouro |
| **Marketplace** | Comandantes (e depois prestadores) — vitrine, perfis, contratação |
| **Notificações** | Central de alertas (semáforo + push quando existir) |
| **Menu** | Conta, assinatura, tema light/dark, convite CMDT, sair |

Multi-embarcação: seletor no topo do Início (o banco já suporta N embarcações por vínculo).

## 5. Módulo PROP — o que muda vs v1.1

- **Casco por categorias:** Deck, Fibra, Inox, Vidros, Estofados, Outros — cada uma é um
  conjunto de Itens Monitorados com semáforo e histórico próprios (mesma arquitetura;
  categorias são `equipamento.tipo`/grupos de itens, sem mudança de schema conceitual).
- **Fotos:** álbuns (Exterior, Interior, Convés, Documentação visual) + barra de uso da
  cota de nuvem; upgrade pago ao exceder.
- **Gastos financeiros (novo):** painel de despesas do PROP (não é carteira). Resumo do
  mês por categoria, gráfico de 6 meses, lançamentos recentes. Diárias pagas via plataforma
  entram automaticamente; o resto é lançamento manual **vinculável** ao histórico da aba
  correspondente. Implementação: agregação sobre `eventos.custo_centavos` + eventos manuais
  de gasto — a fundação já grava custo por evento.
- **Alertas:** regra "o que vencer primeiro" (horas OU data) confirmada; avisos 30/15/5
  dias para documentos; por horas, margem de 15% do intervalo (motor da v1.1, já testado).
- Dados gerais, Motores, Elétrica, Documentos, Contatos, Selo Ouro: como na v1.1/espec
  Commander (sem divergência de conteúdo).
- **Diário de Bordo:** a arquitetura de tabela única de eventos permanece; a UI apresenta
  históricos **por aba** (como a espec Commander pede) e o diário completo segue existindo
  como visão geral — os dois saem do mesmo dado.

## 6. Marketplace e pagamentos (fase própria, após a gestão)

**Perfil público do CMDT:** avatar, selo "Verificado" (só após crivo de RH validado por
advogado), especialidade, localização, rating; métricas (vagas fixas ativas, diárias no
mês, total histórico); ofertas em **Vagas fixas** e **Diárias**; avaliações apenas de quem
contratou pela plataforma.

**Regra de preço das diárias:**
- 1º fechamento de cada CMDT (global): preço fixo da plataforma — **R$ 350**.
- Após o 1º fechamento pago via plataforma: preço livre.
- Pacotes: CMDT ativa ou não; degraus de desconto padronizados pela plataforma (valores a
  definir); cálculo automático no fechamento múltiplo.
- Comissão: **10% do total, piso R$ 25**; PROP paga no app → plataforma retém comissão →
  repasse líquido no mesmo dia.
- Risco aceito: CMDT pode "queimar" o 1º fechamento com valor baixo para destravar preço
  livre — não travar agora; se doer na receita, migrar para regra por par PROP-CMDT.

**Prestador (fase posterior):** sem vagas fixas — só "Trabalhos em aberto" postados pelo
PROP; aceitos ficam esmaecidos; avaliações e chat no mesmo padrão do CMDT.

**⚠️ Jurídico (bloqueia esta fase, não as anteriores):** (1) verificação de carteira/RH e
responsabilidade civil; (2) posicionamento contratual como intermediária de pagamento, sem
definir escala nem supervisionar execução (risco de vínculo empregatício).

## 7. Roadmap revisado

| Fase | Escopo | Status |
|---|---|---|
| **1 — Fundação** | Auth, onboarding, Item Monitorado, semáforo, Registro Rápido, telas Início/Embarcação | ✅ mergeado 06/08/2026 |
| **1.5 — Repaginação Commander** | Nome, tokens light/dark, Urbanist, navegação 5 abas, Menu com sair + tema | em execução |
| **2 — Histórico e acervo** | Diário por aba + visão geral, Documentos com upload, Contatos, Casco por categorias, Gastos | |
| **3 — Alertas e PWA** | Push + e-mail, central de Notificações, instalação PWA, `error.tsx`, config | |
| **4 — GPS Tier 0** | Trilha pelo celular, boletim do mar (Open-Meteo), mapa; Tiers 1-2 seguem §12 da v1.1 | |
| **5 — Marketplace vitrine + CMDT** | Perfis, convite do CMDT, **matriz de permissões completa**, avaliações | |
| **6 — Receita** | Assinatura (cartão + Pix recorrente), gateway nacional com split, deploy Cloudflare, go-live | |
| **7 — Transacional** | Diárias com comissão/split/repasse, R$ 350 no 1º fechamento, pacotes (pós-aval jurídico) | |
| **Depois** | Prestadores, Selo Ouro operacional, GPS Tiers 1-2, anúncios, cursos | |

## 8. Pendências

- Asset final do logo (SVG/PNG) — Erick fornece; provisório em código até lá.
- Valores dos degraus de desconto de pacote.
- Gateway (Pagar.me × Asaas × Iugu) — decidir na fase 6 com o critério Pix recorrente + split.
- Validação jurídica (§6) antes da fase 7.
- Confirm email OFF no dashboard (dev) — ainda pendente da fase 1.
