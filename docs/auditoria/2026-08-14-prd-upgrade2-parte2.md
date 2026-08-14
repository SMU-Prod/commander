# Auditoria — PRD Master Upgrade 2 (segunda metade) + PRD de Correções + Commander Connect

Data: 2026-08-14 · Escopo: seções 30–84 do `upgrade2-master.txt` (selos/confiança até o fim), `upgrade2-correcoes.txt` (inteiro, 14 págs / 377 linhas) e `commander-connect.txt` (inteiro, 112 linhas), contra o código real em `C:\Users\erick\GEST-NAV`. Trabalho só de leitura — nada foi alterado no código.

Fontes conferidas: código-fonte em `web/`, migrations em `supabase/migrations/001..031`, e o **banco remoto de produção** (`khgjtxvmduizyooqaoox`) via `list_tables`/`execute_sql` — não só os arquivos `.sql` locais, para garantir que o schema realmente aplicado bate com as migrations.

Legenda: **PRONTO** = implementado e batendo com o PRD · **PARCIAL** = existe algo, mas incompleto/diferente · **AUSENTE** = não encontrado · **DIVERGENTE** = existe, mas com conceito diferente do que o PRD define.

---

## 1. Veredito dos 6 pontos que o orquestrador pediu para confirmar

### 1.1 "Selo Ouro" = Verified ou Gold?

**Nem um nem outro isoladamente — é um híbrido, e isso é o achado mais importante da auditoria.**

- `web/lib/domain/selo.ts` (`avaliarSelo`): um checklist 100% digital de 7 critérios (dados gerais, motor com horas, 3+ documentos válidos, nada vencido, 1+ foto, 6+ eventos no diário, 1+ contato). Isso é conceitualmente **Verified** — "verificação digital baseada no cadastro e histórico" (PRD §31, correção 05).
- Mas o rótulo na UI é **"Selo Ouro"** (`web/app/(app)/barco/selo/page.tsx:24`, `web/app/(app)/barco/page.tsx:217`) — literalmente "Gold" em português — e o botão de call-to-action ao final do checklist é **"Solicitar avaliação presencial"** (`web/app/(app)/barco/selo/page.tsx:79`, ação em `web/lib/acoes/selo.ts`), que grava um evento no diário e dispara e-mail pra equipe. Isso é o **início do fluxo do Gold** (PRD correção 02: "SOLICITAR COMMANDER GOLD → AVALIAÇÃO PRESENCIAL → PROTOCOLO COMMANDER → APROVAÇÃO").
- Não existe no banco nenhuma coluna `verificado`/`verified_status`/`gold_status` em `embarcacoes` (confirmado via `list_tables` no projeto remoto) — o percentual do checklist é calculado on-the-fly a cada carregamento, não é um selo persistido e concedido. Não existe também nenhuma tabela `GoldApplication`/`GoldEvaluation`/`ReviewProtocol` (ver §"Entidades" abaixo) — o pedido de avaliação presencial é só uma linha de evento com um texto-marcador (`MARCADOR_SOLICITACAO_SELO`), sem workflow de pagamento/agendamento/aprovação.
- A única "verificação" que de fato é gravada e protegida por trigger no banco é `perfis_comandante.verificado` (migration `009_selo_protegido_storage_matriz.sql`) — e essa é a verificação **do comandante/profissional** (PRD §48), um sistema totalmente diferente do selo da embarcação.

**Conclusão prática:** o mapeamento correto para dar nome ao que existe hoje é **Verified** (o checklist é 100% digital, nunca inspeciona fisicamente, e a própria tela diz isso: "O selo reconhece documentação e histórico completos no app. Quem qualifica o selo de fato é a avaliação presencial da equipe Commander"). O nome "Selo Ouro" e a cor dourada, porém, já usam a identidade visual do **Gold** (PRD §34 pede medalhão navy + dourado + âncora para o Gold; §32 pede navy/prata/sem dourado para o Verified). Ou seja: a *função* de hoje é Verified, o *nome/cor* já é Gold — os dois selos ainda não foram desdobrados em duas entidades/telas separadas. Isso é retrabalho de nomenclatura + criar o segundo selo (Gold real, com workflow de pagamento/agendamento/aprovação), não uma migração de dado.

### 1.2 Asaas / assinatura vs. o que o PRD pede

| Requisito PRD (§44, §43) | Status | Evidência |
|---|---|---|
| Integração de cobrança real (Pix/cartão, sem o app ver cartão) | PRONTO | `web/lib/asaas.ts` — cliente da API Asaas v3, sandbox/produção por env var, checkout é sempre a `invoiceUrl` hospedada do Asaas |
| Tela mostra Plano, Valor, Próxima cobrança, Histórico de cobranças, Cancelamento | PRONTO | `web/app/(app)/menu/assinatura/page.tsx` — busca faturas via `listarCobrancas`/`proximaCobrancaAsaas`, botão "Cancelar assinatura" |
| Formas de pagamento (Cartão, Pix) | PRONTO | `billingType: "UNDEFINED"` deixa o assinante escolher entre os meios habilitados na conta Asaas |
| **Plano Free com limite de uso (ex.: até 2 Diários)** | **AUSENTE** | Não encontrado. `supabase/migrations/017_assinaturas.sql` e `web/lib/domain/planos.ts` só definem `fundador_mensal`/`fundador_anual` — não existe conceito de plano Free na tabela `assinaturas` nem contagem de diários por plano em nenhuma action (`lib/acoes/*`) |
| **Paywall com recursos Premium visíveis, porém bloqueados** | **AUSENTE** | Nenhuma tela do app hoje bloqueia funcionalidade por status de assinatura — busquei checagens de `assinatura.status === "ativa"` gateando acesso e não encontrei nenhuma; um usuário sem assinatura tem acesso total ao dossiê, diário, gastos etc. |
| Upgrade de plano | AUSENTE | Só existe um nível pago ("fundador"); não há hierarquia Free→Premium para "upgrade" |
| Gold inclui 6 meses de Premium (§40) | AUSENTE | Sem tabela de plano Premium nem lógica de concessão automática — e nem existe o fluxo do Gold em si (ver 1.1) |

**Resumo:** o Asaas está de fato integrado e funcional para *uma* assinatura paga ("fundador"), mas o modelo comercial Free/Premium/paywall do PRD §43–44 simplesmente não existe no código — hoje é "assinante fundador" ou "não assinante", sem diferença de acesso entre os dois.

### 1.3 Marketplace: PRD (oportunidades/vagas/diárias/"COMPRO") vs. nosso "Comandantes"

**Divergência de conceito confirmada — são coisas diferentes, e o código já documenta essa confusão histórica.**

- A rota `/marketplace` (`web/app/(app)/marketplace/page.tsx`) tem `<h1>Comandantes</h1>` e lista `perfis_comandante` — é uma **vitrine de perfis de comandantes contratáveis via WhatsApp**. Não tem post de demanda, não tem "COMPRO — Rádio VHF", não tem vagas/diárias, não tem resposta de fornecedor.
- O item de menu inferior (`web/components/bottom-nav.tsx:18-20`) aponta `/marketplace` mas o rótulo visível é **"Comandantes"** — e há um comentário no próprio arquivo confirmando a renomeação: *"'Comandantes' não cabe em 11px... foi o que aconteceu **ao trocar Marketplace por Comandantes**"*. Ou seja: o time já trocou o nome da aba de "Marketplace" para "Comandantes" numa onda anterior — a URL ficou desatualizada, mas a intenção de produto já reconhece que aquilo é vitrine de perfil, não bolsa de oportunidades.
- O conceito de Marketplace do PRD (§49, §53, §54: vagas, diárias, "COMPRO — Rádio VHF", prestadores respondendo demandas) **não existe em lugar nenhum do código** — não há tabela `vagas`, `diarias`, `demandas`, `marketplace_post` no banco (confirmado via `list_tables`), nem página, nem action.

**Conclusão:** são conceitos diferentes. O que chamamos de "Marketplace" hoje é o "Comandantes" do PRD (perfil profissional — §47). O "Marketplace" do PRD (oportunidades/demandas) ainda não foi construído.

### 1.4 Explorar: mapa de parceiros em /navegar é a mesma coisa?

**Parcialmente — a funcionalidade de mapa existe, mas não como tela "Explorar" dedicada.**

- `web/app/(app)/navegar/page.tsx` carrega `parceiros` visíveis e renderiza no `NavegarMapa`, com pins, card resumido e ações (ligar, ver informações) — tecnicamente cobre boa parte do §52 (mapa de marina/posto/pousada/restaurante).
- Mas `/navegar` é a tela de **navegação náutica** (rota, calado, planejamento de viagem, sondagem colaborativa) — parceiros são uma camada a mais dessa tela, não uma tela "Explorar" independente e não está no bottom-nav como aba própria (o bottom-nav só tem Início/Barco/Comandantes/Avisos/Menu — sem "Explorar" nem "Marketplace" nem "Parceiros").
- Falta a categoria **Loja Náutica** — a constraint do banco (`categoria` em `public.parceiros`, migration `020_parceiros.sql` e confirmado no schema remoto) só aceita `'marina','posto','pousada','restaurante'`. O PRD marca loja náutica como "✅ ADICIONADA AO MODELO" (§60) mas ela não está no `CHECK` da tabela nem no formulário de cadastro do parceiro (`web/app/(parceiro)/parceiro/page.tsx:13-18`).

**Conclusão:** não existe tela "Explorar" separada — a função está embutida em `/navegar`. Isso é PARCIAL, não AUSENTE nem "é o mesmo": é a mesma ideia, mas fundida com navegação e sem uma das 5 categorias do PRD.

### 1.5 Commander Connect: distância técnica real

**Grande. O que existe hoje resolve um problema adjacente (profundidade colaborativa), não o do Connect (dados de motor via NMEA 2000).**

| Dimensão | PRD Commander Connect | Código hoje |
|---|---|---|
| Protocolo de rede | **NMEA 2000** (CAN bus, mensagens binárias PGN) | **NMEA 0183** (texto ASCII, sentenças tipo `$--DPT,...*hh`) — protocolo diferente, não é "a mesma rede com parser diferente", é outra camada física/de enlace inteira |
| Parser implementado | Ler PGNs (ex. horas de motor, RPM, temperatura, combustível, tensão) | `web/lib/domain/sondagem.ts` só entende **duas sentenças**: `DPT` e `DBT` (profundidade). Não há parser de motor nenhum — nem RPM, nem MTW (temperatura da água), nem XDR (transdutor genérico) |
| Transporte | Gateway NMEA 2000 → Wi-Fi/BT/4G → nuvem | `web/lib/nmea/transporte.ts` define a interface `TransporteProfundidade`; hoje só tem **Signal K via WebSocket** (`signalk.ts`, JSON já convertido) funcionando de fato. O transporte nativo por socket TCP/UDP (`nmea-socket-plugin.ts`, `nativo.ts`, plugins Android/iOS `NmeaSocket*`) existe em código mas o próprio `nativo.ts`/comentários indicam que é caminho recém-plugado (onda 13/14), feito **só para alimentar a sondagem de profundidade**, não motor/RPM/combustível |
| Dado de destino | Diário de Bordo automatizado com horas de motor, alarmes, temperatura | Não há nenhuma automação de eventos do Diário a partir de dados de sensor hoje — o único uso de dado "ao vivo" de rede de bordo é gravar `sondagens` (profundidade) num mapa colaborativo |
| Hardware/gateway | Caixa própria ou gateway de terceiro homologado, LEDs Power/NMEA/Cloud | Não existe — o app é só cliente de socket/WebSocket, não há especificação de hardware nem lista de gateways homologados |
| Tela "Em breve" no app | Aba dedicada vendendo a visão sem prometer compatibilidade não homologada | AUSENTE — não encontrei nenhuma rota/componente "Commander Connect" ou "Em breve" no `app/` |

**Honestamente:** a base de engenharia (arquitetura de transporte plugável, parser de sentença NMEA, ponte nativa Capacitor com socket TCP/UDP) é uma fundação real e reaproveitável — o padrão `TransporteProfundidade`/`criarTransporteAtivo` é exatamente o tipo de abstração que um `TransporteMotor` teria que seguir. Mas em termos de protocolo (0183 vs. 2000), de dados cobertos (só profundidade vs. motor/combustível/bateria/alarmes) e de produto (não há tela, não há hardware definido, não há PGN nenhum lido), a distância até o Connect V1 é grande — é essencialmente começar do zero na camada de motor/NMEA 2000, reaproveitando só o esqueleto de "transporte plugável + parser + fallback".

### 1.6 Ocorrências do termo "Review" proibido no código

**Nenhuma.** Busquei `Review`, `Selos & Review`, `Solicitar Review`, `Comprar Review`, `Agendar Review`, `Ver Review` em todo `web/` (código-fonte, exclui builds `.next`/worktrees) e a única ocorrência da palavra "Review" é `capacitor.config.ts:23`, num comentário técnico sobre a **App Store Review Guideline 4.2** da Apple — sem relação com o produto. A tela do selo já usa a linguagem correta da correção 07 ("Solicitar avaliação presencial", nunca "Solicitar Review"). O código está limpo desse termo — **não há renomeação pendente no código**, só a decisão de produto pendente (desdobrar Verified/Gold de fato, ver 1.1).

---

## 2. Tabela item a item — PRD Master §30 a §84

### Selos e confiança (§30–43)

| # | Requisito | Status | Evidência | Falta |
|---|---|---|---|---|
| 30 | Hub conjunto Verified/Gold, diferença clara | PARCIAL | Existe 1 tela (`/barco/selo`) que já avisa "não é vistoria física", mas não há 2 selos concedidos separadamente — ver 1.1 | Desdobrar em 2 entidades reais |
| 31 | Verified conquistado por uso/completude digital | PRONTO (como conceito, mal-rotulado) | `lib/domain/selo.ts` `avaliarSelo` — 7 critérios digitais | Renomear de "Selo Ouro" para "Verified" quando o Gold for criado |
| 32 | Visual do Verified: navy/preto/prata, sem dourado | DIVERGENTE | UI usa ícone "selo" com acento dourado (`--acao`, cor de destaque do app) — não há distinção visual dedicada | Aplicar paleta prata/navy específica |
| 33 | Gold é presencial, não é versão paga do Verified | AUSENTE (não implementado como selo separado) | Não há segundo selo nem tabela de aprovação/avaliação | Construir o fluxo completo (ver 1.1) |
| 34 | Visual do Gold: medalhão navy/dourado, âncora, data, validade | AUSENTE | Não existe badge/medalhão Gold distinto | — |
| 35 | Modal do Gold com hubs avaliados, estados ✓/■/N-A, consultor, versão do protocolo | AUSENTE | Não encontrado nenhum modal desse tipo | — |
| 36 | "Commander Review" é nome do serviço presencial (PRD Master original) | SUPERADO pela correção 01 | Correções já removem esse nome; código nunca usou "Review" (ver 1.6) | — |
| 37 | Quem pode solicitar (proprietário/vendedor/interessado), barco não precisa estar cadastrado | PARCIAL | Só o fluxo "proprietário solicita para o próprio barco" existe (`lib/acoes/selo.ts`, checa `papel === "PROP"`); não há fluxo "Outra embarcação" nem "interessado/comprador" | Implementar "Minha embarcação" vs. "Outra embarcação" (correção 09) |
| 38 | Pagamento EU/INTERESSADO com link/QR Code | AUSENTE | `solicitarAvaliacao()` só grava evento + tenta e-mail; não há cobrança nenhuma associada ao pedido de avaliação | Todo o fluxo de pagamento da avaliação presencial |
| 39 | Preços por porte (R$1.990–5.990+), configuráveis, não hardcoded | AUSENTE | Nenhuma tabela/config de preço de avaliação encontrada | — |
| 40 | Gold aprovado → 6 meses de Premium | AUSENTE | Depende de (a) Gold existir e (b) Premium existir — nenhum dos dois existe | — |
| 41 | Protocolo Commander (checklist com N/A) | AUSENTE | Não encontrado — PRD já marca como 🟡 pendente de checklist técnico final | — |
| 42 | Expansão internacional em lotes regionais | AUSENTE (esperado) | PRD marca como 🔵 implementação posterior; nada a cobrar aqui | — |
| 43 | Free→Premium→Verified→Gold, Free com "app parece completo" + limite de uso | AUSENTE | Ver 1.2 — não há Free nem paywall | — |

### Comercial e financeiro (§44–46)

| # | Requisito | Status | Evidência | Falta |
|---|---|---|---|---|
| 44 | Tela de assinatura completa (plano, valor, benefícios, próxima cobrança, forma de pagamento, histórico, cancelamento, upgrade) | PARCIAL | `menu/assinatura/page.tsx` cobre plano/valor/próxima cobrança/faturas/cancelamento; "benefícios" é só a descrição curta do plano; "forma de pagamento usada" não é mostrada; "upgrade" não existe (só 1 nível pago) | Upgrade, lista explícita de benefícios, forma de pagamento atual |
| 45 | Gastos = controle financeiro (não é banco/carteira), total do mês, por categoria, histórico, evolução | PRONTO | `web/app/(app)/barco/gastos/page.tsx` + `lib/domain/gastos.ts` (`resumoGastos`) — total do mês, agrupamento, `GraficoMesesGastos` | — |
| 46 | Manutenção com custo alimenta Gastos automaticamente | PRONTO | Mesmo dado: `eventos.custo_centavos` é a fonte única tanto do Diário quanto de Gastos — não há duplicação, é o mesmo registro | — |

### Comandantes e prestadores (§47–51)

| # | Requisito | Status | Evidência | Falta |
|---|---|---|---|---|
| 47 | Perfil profissional do Comandante: foto, nome, localização, certificações, especialidades, avaliação, experiência, disponibilidade, vagas, diárias, histórico, avaliações | PARCIAL | `perfis_comandante` (schema remoto): `nome_publico, categoria, cidade, bio, telefone, disponibilidade, visivel, verificado`. Form em `marketplace/perfil/page.tsx` cobre nome/categoria(habilitação)/cidade/disponibilidade/telefone/bio | Sem foto, sem localização geo, sem lista de especialidades, sem rating/avaliações, sem vagas/diárias/histórico de trabalhos |
| 48 | Verificação documental do comandante, selo diferente do Verified do barco | PRONTO (mecanismo) / PARCIAL (operação) | `perfis_comandante.verificado`, protegido por trigger `bloquear_selo_verificado()` (só `service_role` escreve) — sistema tecnicamente correto e já separado do selo da embarcação | UI hoje mostra sempre "Documentação declarada" (`marketplace/page.tsx:49`) — não há operação/fluxo de verificação ainda, só o texto "será emitido quando a validação entrar em operação" |
| 49 | Vagas e Diárias no Marketplace, preço inicial R$350, comissão 10% configurável | AUSENTE | Nenhuma tabela/tela de vagas ou diárias | — |
| 50 | Prestadores: perfil profissional (mecânico, eletricista, fibra...), proprietário publica demanda | AUSENTE (DIVERGENTE de nome) | "Prestador" no código hoje = campo `contato_id` opcional num evento (`lib/acoes` e `barco/contatos`) — é uma agenda de contatos pessoal do proprietário, não um perfil público nem um sistema de demanda/resposta | Todo o módulo |
| 51 | Serviços — achar quem resolve um problema, não confundir com Explorar | AUSENTE | Nenhuma tela/rota "Serviços" encontrada | — |

### Explorar, Marketplace e Parceiros (§52–61)

| # | Requisito | Status | Evidência | Falta |
|---|---|---|---|---|
| 52 | Explorar — mapa de marina/posto/pousada/restaurante/loja | PARCIAL / DIVERGENTE de estrutura | Ver 1.4 — a função vive dentro de `/navegar`, não como aba própria; falta categoria loja | Tela dedicada + categoria loja |
| 53 | Marketplace — oportunidades/vagas/diárias/"COMPRO" | DIVERGENTE | Ver 1.3 — `/marketplace` hoje é a vitrine de Comandantes | Construir o conceito real do PRD |
| 54 | Marketplace orientado por necessidade, não feed publicitário | N/A (não implementado) | — | — |
| 55 | Conta/painel tipo PARCEIRO | PRONTO | `web/app/(parceiro)/parceiro/page.tsx`, tabela `parceiros` com RLS própria, autoatendimento | — |
| 56 | Marina: nome, localização, fotos, contato, horários, estrutura, vagas, diárias, preços, serviços, posto próprio, diesel | PARCIAL | Tabela cobre nome/sobre/telefone/email/horario/lat/lng/fotos/preco_diaria/preco_diesel/calado_max/poita | Sem "estrutura"/"serviços" como campos próprios (cabe em `sobre` como texto livre) |
| 57 | Posto: localização, combustíveis, preço, horário, contato, serviços, última atualização | PARCIAL | `preco_diesel_centavos`, `precos_atualizados_em` (última atualização, §61) existem; só cobre diesel, não outros combustíveis | Múltiplos combustíveis |
| 58 | Pousada: vaga, poita, quantidade, calado, preço, traslado, check-in náutico, horários | PRONTO | `tem_poita, qtd_poitas, calado_max_m, preco_diaria_centavos, traslado_incluso, horario` — todos presentes | Check-in náutico como campo específico não visto |
| 59 | Restaurante: vaga, poita, quantidade, calado, vaga paga/cortesia, culinária, faixa de preço, horários | PRONTO | `vaga_cortesia, culinaria` presentes além dos campos comuns | — |
| 60 | Loja náutica: nome, localização, contato, fotos, categorias de produtos, serviços, marcas | AUSENTE | `categoria` do parceiro só aceita `marina/posto/pousada/restaurante` (constraint do banco e do form) — "loja" não está implementada apesar de o PRD marcar como "✅ adicionada ao modelo" | Adicionar categoria + campos específicos |
| 61 | "Atualizado há X horas/dias", sinalizar dado antigo | PRONTO (parcial) | Coluna `precos_atualizados_em` existe e é atualizada por trigger a cada mudança de preço/disponibilidade | Não vi a UI exibindo "atualizado há X" — só a coluna no banco; teria que checar componente do card do parceiro no mapa para confirmar renderização |

### Mapa, meteorologia, alertas, atendimento (§62–66)

| # | Requisito | Status | Evidência | Falta |
|---|---|---|---|---|
| 62 | Mapa (Google/Mapbox), pins por categoria, PIN→CARD→PERFIL, ações (rota, ligar, contato) | PRONTO | `components/mapa/navegar-mapa.tsx`, `card-parceiro.tsx`, `escolher-pino-parceiro.tsx`, ícones por categoria em `lib/mapa/pino-parceiro.ts` | — |
| 63 | Mar agora/meteorologia (vento, ondas, alertas) | PARCIAL | `eventos.mar_onda_m`, `eventos.mar_vento_kt` gravam condição do momento (Open-Meteo) por evento; não vi um painel "boletim do mar" dedicado além do que `barco/local` menciona ("Defina para ligar o boletim do mar") | Confirmar se existe painel de boletim consolidado, ou só o registro retroativo por evento |
| 64 | Alertas de motor/manutenção/documentos/segurança/gerador/ocorrências/meteorologia/Review/Gold/assinatura | PARCIAL | `alertas_enviados.janela` cobre `d30,d15,d5,vencido,h_margem,h_vencido,mar_ruim,motor_parado` — cobre documento/manutenção/motor parado/mar ruim; não cobre Gold/assinatura/ocorrências (que também não existem como entidade, ver §76) | Alertas de Gold/assinatura |
| 65 | Chat Commander (WhatsApp Business/Zendesk/Intercom) | AUSENTE | Nenhuma integração de chat encontrada | — |
| 66 | Seguro náutico — lembrete + lead pra corretora | AUSENTE | Nenhuma menção a seguro como funcionalidade (só como categoria de documento monitorável) | — |

### Commander Connected / Connect (§67–69, ver também seção 3 abaixo)

| # | Requisito | Status | Evidência |
|---|---|---|---|
| 67–69 | Camada opcional NMEA 2000, não substitui MFDs, piloto 10-25 barcos | AUSENTE — ver análise técnica completa na seção 1.5 e seção 3 | — |

### Princípios de arquitetura e UX (§70–76)

| # | Requisito | Status | Evidência |
|---|---|---|---|
| 70 | UX evita termos internos ("gerar checkout" etc.) | PRONTO | Vi consistentemente "Continuar para pagamento", "Registrar manutenção", "Adicionar equipamento" na UI — nenhum termo técnico vazando |
| 71 | Ações rápidas (+Registrar manutenção, +Novo Diário, +Solicitar avaliação) | PARCIAL | Botões de ação rápida existem espalhados por tela (`SecaoPagina acao=`, botão "Registrar" em Gastos) mas não vi um bloco único de "ações rápidas" agregado (ex. na Home/`hoje`) |
| 72 | Relacionamento entre dados (Diário→Ocorrência→Hub→Manutenção→Gasto→Histórico→Resumo) | PARCIAL | O núcleo existe via tabela única `eventos` (mesmo registro serve diário/manutenção/gasto/histórico — arquitetura inteligente e já relacional), mas **não existe o conceito "Ocorrência" com ciclo de vida** (ver §76) — a cadeia para no meio |
| 73 | Entidades de backend (`Review, ReviewProtocol, VerifiedStatus, GoldStatus, Transfer, Subscription, Payment, ProfessionalProfile, Job, ServiceRequest, MarketplacePost, Partner, PartnerLocation`...) | PARCIAL | Existem: `Subscription`≈`assinaturas`, `Payment`≈dados do Asaas (não replicado em tabela própria), `ProfessionalProfile`≈`perfis_comandante`, `Partner`≈`parceiros`. **Não existem**: `Review/GoldStatus/VerifiedStatus/Transfer/Job/ServiceRequest/MarketplacePost/PartnerLocation` (confirmado via `list_tables` no projeto remoto — 19 tabelas ao todo, nenhuma com esses nomes ou equivalentes) |
| 74 | Anexos vinculados ao registro (não soltos em "arquivos") | PRONTO | `documentos.item_monitorado_id`, `eventos.anexo_path`, `fotos.embarcacao_id` — tudo vinculado, sem pasta solta |
| 75 | Auditoria (quem criou/editou, origem) | PARCIAL | `criado_por` existe em `eventos, fotos, convites, viagens`; não vi coluna "editado_por"/log de edição, e "origem" só existe como `importado_do_plotter`/`origem_hash` para GPX, não genérico |
| 76 | Estados com ciclo (Ocorrência ABERTA→EM ACOMPANHAMENTO→RESOLVIDA; Documento OK→PRÓXIMO→CRÍTICO→VENCIDO; Gold INATIVO→ATIVO→VENCENDO→EXPIRADO) | PARCIAL/AUSENTE | Documento: PRONTO — `calcularSemaforo` já produz um estado com ciclo (ok/atencao/vencido), é a lógica mais madura do app. **Ocorrência: AUSENTE** — não existe tabela/campo de status para ocorrência (o `eventos.tipo='avaria'` não tem workflow); é esperado, pois o próprio PRD marca "Histórico/Ocorrências: tela central definitiva" como 🟡 pendente de fechar (§79.4). **Gold: AUSENTE** — decorre de 1.1 |

### Admin, roadmap e regras finais (§77–84)

| # | Requisito | Status | Evidência |
|---|---|---|---|
| 77 | Admin Commander (backoffice: usuários, embarcações, assinaturas, pagamentos, reviews/gold, consultores, verified, parceiros, profissionais, denúncias, preços, protocolos, config) | AUSENTE | Nenhuma rota `/admin` nem painel de backoffice encontrado em `app/` — toda operação hoje depende de acesso direto ao Supabase Studio |
| 78 | Checklist "o que está fechado" (motores/casco/elétrica/hidráulica/segurança/equipamentos/doc/fotos/contatos/manutenções/ocorrências/diário/horas/gastos/resumos/transferência/hub selos/verified×gold/review/protocolo/pagamento/serviços/explorar/marketplace/parceiros/comandante) | Ver linhas acima — a maior parte de gestão técnica (motores, casco, elétrica, equipamentos, documentação, fotos, contatos, gastos) está PRONTA; **Hidráulica e Segurança como hubs dedicados não existem** — o `CHECK` de `itens_monitorados.categoria` no banco só aceita `documento, deck, fibra, inox, vidros, estofados, casco_outros` (confirmado no schema remoto) e `equipamentos.tipo` só aceita `motor, gerador, bateria, outro` — nenhuma categoria "hidraulica"/"seguranca" existe hoje, mesmo sendo hub "✅ fechado" no PRD | Criar as categorias no banco + telas |
| — | Transferência de propriedade (aparece em §78 como "✅ fechado" e no menu correção 03) | AUSENTE | Não encontrei rota, action nem coluna relacionada a "transferir"/"transferência" em todo `web/` (só 2 falsos-positivos: "prestadores" na política de privacidade) | Módulo inteiro |
| 79 | "O que ainda precisa ser fechado" (dashboard, saúde do barco, diário final, histórico/ocorrências, critérios Verified/Gold, protocolo, planos, permissões por plano, gateway definitivo, mapa, meteorologia, notificações) | N/A — decisões de negócio pendentes no próprio PRD, listadas na seção 4 abaixo | — |
| 80 | Fora do escopo (Jet Ski, cotas, Connected, hardware, reserva completa) | Corretamente não implementado | Confirma escopo respeitado |
| 81–84 | Ordem de blocos, regra pro programador, objetivo e posicionamento | Diretrizes de processo/produto, não testáveis por código | N/A |

---

## 3. PRD de Correções — auditoria das 20 correções

Resultado resumido: **o código já está em conformidade com todas as correções de nomenclatura** — a razão é simples: as funcionalidades de Gold/Review/Protocolo praticamente não foram implementadas ainda, então não havia "Commander Review" pra corrigir no código. As correções pendentes são, na prática, **decisões de produto a implementar do zero seguindo já o nome certo (Gold)**, não uma faxina de string.

| Correção | Item | Status no código |
|---|---|---|
| 01–02 | Não existe "Commander Review" como produto/nome de serviço separado | PRONTO — nunca foi criado |
| 03 | Estrutura da EMBARCAÇÃO com Verified/Gold/Transferir como itens de menu | AUSENTE — só existe "Selo Ouro" único; Transferir não existe (ver §78) |
| 04 | Hub de confiança não pode se chamar "Selos & Review" | PRONTO — tela se chama "Selo Ouro" (nome final ainda em aberto, mas não usa "Review") |
| 05–06 | Verified digital / Gold presencial, dois conceitos distintos | PARCIAL — ver 1.1, ainda fundidos numa tela só |
| 07 | CTAs corretos ("Solicitar avaliação", nunca "Solicitar Review") | PRONTO — confirmado em `lib/acoes/selo.ts` e `barco/selo/page.tsx` |
| 08 | Pagamento entendido como pagamento da avaliação Gold | AUSENTE — não há pagamento associado ao pedido de avaliação hoje |
| 09 | "Minha embarcação" vs. "Outra embarcação" no pedido de Gold | AUSENTE |
| 10 | Protocolo Commander = metodologia, Gold = selo | Conceitual, nenhum dos dois implementado |
| 11 | "Relatório Commander Gold", nunca "Relatório do Review" | N/A — nenhum relatório desse tipo existe ainda |
| 12 | Modal do Gold com texto/dados específicos | AUSENTE |
| 13 | Nomenclatura oficial COMMANDER › VERIFIED / GOLD, nada entre os dois | Código não contradiz, mas também não implementa os dois como entidades separadas |
| 14 | Gold não depende do Verified | N/A — nenhum dos dois valida dependência hoje (nenhum bloqueio existe) |
| 15 | Preços apresentados como "Commander Gold", configuráveis | AUSENTE — nenhuma tabela de preço de avaliação |
| 16 | Gold aprovado + 6 meses Premium | AUSENTE |
| 17 | Expansão internacional usa "Gold", nunca "Review" | N/A — feature não implementada (esperado, é 🔵 futuro) |
| 18 | Backend pode ter `GoldApplication/GoldEvaluation` internamente, nunca expor "Review" ao cliente | N/A — nenhuma entidade dessas existe ainda no banco |
| 19 | Admin com módulo "Commander Gold" (Solicitações/Pagamentos/Avaliações/Agendamentos/Consultores/Protocolos/Aprovados/Reprovados/Ativos/Expirados) | AUSENTE — nem o Admin em si existe (§77) |
| 20 | Regra mestre: qualquer "Commander Review" remanescente deve virar "Commander Gold" | PRONTO — não sobrou nenhuma ocorrência pra corrigir (ver 1.6) |

---

## 4. Já entregue

- Gestão técnica do barco: motores, elétrica, casco (parcial — só as sub-categorias de casco), documentação com semáforo de vencimento, fotos, contatos, diário de bordo, gastos — todos com dados reais no banco de produção e RLS habilitada.
- Integração Gasto ↔ Manutenção — por arquitetura, não por sincronização (mesma linha `eventos`, elegante e sem risco de divergência).
- Assinatura via Asaas funcionando de ponta a ponta para 1 plano pago (fundador mensal/anual): checkout hospedado, webhook, histórico de faturas, cancelamento.
- Vitrine de Comandantes (rotulada "Comandantes", ainda na URL `/marketplace`) com WhatsApp direto e campo `verificado` protegido por trigger de banco.
- Painel de Parceiro autoatendido (Marina/Posto/Pousada/Restaurante) com mapa, pins por categoria, limite de 1 atualização de preço/dia, contador de visualizações.
- Base de arquitetura para dados de bordo em tempo real (transporte plugável Signal K + esqueleto de socket nativo Capacitor Android/iOS) — ainda restrita a profundidade (sondagem colaborativa), mas é o padrão certo para estender no dia do Connect.
- Vocabulário de UX (§70) e as 20 correções de nomenclatura do PRD de Correções — o código nunca introduziu "Commander Review" e já usa "Solicitar avaliação presencial".

## 5. Falta e é pequeno

- Categoria "Loja Náutica" no cadastro de Parceiro (§60) — adicionar ao `CHECK` da coluna `categoria` + opção no form; a estrutura já suporta.
- Categorias "Hidráulica" e "Segurança" em `itens_monitorados.categoria`/`equipamentos.tipo` (§78) — mesma mecânica das categorias de casco já existentes, só faltam as opções.
- Renomear a rota `/marketplace` para algo como `/comandantes` (o rótulo do bottom-nav já mudou, a URL não) — cosmético, mas evita confusão quando o Marketplace real (§53) for construído com esse nome.
- Exibir "forma de pagamento atual" e lista de benefícios na tela de assinatura (§44) — dado provavelmente já disponível via API do Asaas, falta puxar e mostrar.
- "Atualizado há X horas" na UI do card do parceiro (§61) — a coluna `precos_atualizados_em` já existe no banco, falta confirmar/implementar a renderização relativa no componente.

## 6. Falta e é grande

- **Desdobrar Verified e Gold em duas entidades reais** (hoje é uma tela híbrida) — inclui: segundo selo com visual próprio, workflow completo do Gold (solicitar → pagar → agendar → avaliação presencial → Protocolo Commander → aprovar/reprovar → conceder selo com validade), suporte a "minha embarcação" vs. "outra embarcação", preços configuráveis por porte.
- **Modelo comercial Free/Premium/paywall** (§43–44) — hoje é binário (assinante fundador vs. não-assinante, sem diferença de acesso). Envolve: plano Free com limites reais, gate de feature por plano, tela de upgrade, concessão automática de 6 meses Premium ao aprovar Gold.
- **Marketplace real** (§49, §53–54) — oportunidades, vagas, diárias, "COMPRO X", prestador respondendo demanda. Não existe nenhuma peça disso hoje (nem tabela).
- **Módulo de Prestadores** (§50) — perfil profissional público por especialidade + publicação/resposta de demanda. Hoje "prestador" é só um contato pessoal do proprietário.
- **Tela "Serviços"** (§51) e **tela "Explorar" dedicada** (§52) — separadas de `/navegar` e do futuro Marketplace.
- **Admin Commander / backoffice** (§77) — inexistente; toda operação depende de acesso direto ao banco hoje.
- **Transferência de embarcação** — módulo inteiro ausente, apesar de listado como "✅ fechado" em §78.
- **Ocorrências como entidade com ciclo de vida** (§76, §72) — hoje é só um `tipo='avaria'` dentro de eventos, sem status; é pré-requisito para a cadeia relacional completa que o PRD descreve em §72.
- **Commander Connect** — ver distância técnica detalhada na seção 1.5: protocolo diferente (0183 vs. 2000), sem parser de motor, sem hardware definido, sem tela "Em breve" no app.
- **Chat Commander** e **Seguro náutico** (§65–66) — nenhuma integração iniciada.

## 7. Decisões de negócio que só o dono pode tomar

- **Operação presencial do Gold**: quem são os "consultores náuticos autorizados"? É equipe própria ou terceirizada por região? Isso muda a arquitetura do Admin (§19 da correção: módulo "Consultores").
- **Preços definitivos**: o PRD já traz uma tabela de referência (R$1.990 a R$5.990+), mas confirma que "os critérios mínimos finais para aprovação Gold ainda serão definidos" (§41) — decisão de produto/comercial, não técnica.
- **Gateway de pagamento definitivo**: hoje é Asaas, funcionando; o PRD (§44) ainda lista "gateway ainda precisa ser escolhido definitivamente" — se a decisão for trocar, é retrabalho grande; se for manter Asaas, isso pode ser fechado agora.
- **Estrutura de planos Free/Premium/Enterprise** (§79.8): quantos assentos por plano, o que fica atrás do paywall, preço do Premium "normal" (hoje só existe o plano promocional de fundador).
- **Critérios exatos de perda do Verified** (§79.5): o PRD fala em "conquista **e perda/manutenção**" — hoje o checklist só cresce, não há regra de "o barco perdeu o selo porque um documento venceu", por exemplo.
- **Responsabilidade jurídica da verificação de comandante** (§48): o próprio PRD marca que isso "deverá ser validada antes do lançamento" — decisão jurídica/de risco, não de engenharia.
- **Comissão e preço-piso do Marketplace de vagas/diárias** (§49: R$350 e 10% "estudados", não fechados).
- **Mapbox vs. Google Maps** (§62) — decisão técnica com implicação comercial (custo por chamada), listada como pendente no próprio PRD.
- **API de meteorologia** (§63: Open-Meteo vs. StormGlass vs. Windy) — trade-off de custo/qualidade de dado, não é decisão que o código deva tomar sozinho.
- **Hardware do Connect**: caixa própria vs. gateway de terceiro com identidade Commander — decisão de investimento/parceria, anterior a qualquer linha de código do Connect V1.
