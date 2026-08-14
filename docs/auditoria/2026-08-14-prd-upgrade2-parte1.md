# Auditoria PRD Master — Upgrade 2 (Parte 1: seções 1–29)

Auditoria item por item do PRD (`docs/prd/upgrade2-master.txt`) contra o código real do Commander
(`C:\Users\erick\GEST-NAV`, Next.js 16 + Supabase, projeto `khgjtxvmduizyooqaoox`). Cobre da seção 1
(Visão) até a seção 29 (Conteúdo dos Resumos) — para antes do Hub Selos & Review (seção 30 em diante).

Legenda de Status: **PRONTO** (existe e bate com o PRD) · **PARCIAL** (existe algo, mas incompleto)
· **AUSENTE** (não encontrado) · **DIVERGENTE** (existe, mas funciona diferente do que o PRD descreve).

---

## 1. Visão do Commander

| Requisito | Status | Evidência | O que falta |
|---|---|---|---|
| Núcleo: Motores, Casco, Elétrica, Hidráulica, Segurança, Equipamentos, Documentação, Manutenções, Ocorrências, Diário, Histórico técnico, Gastos, Relatórios, Verified, Review, Gold | **PARCIAL** | Motores/Casco/Elétrica/Documentação/Diário/Gastos existem (ver seções 11–29 abaixo); Hidráulica, Segurança, Ocorrências (como entidade com estado) e Relatórios/Resumos estão ausentes ou embrionários — ver seções 15, 16, 17, 22, 28. | Hidráulica, Segurança, Ocorrências com estado, Resumos completos |
| Ecossistema ao redor (Comandantes, Prestadores, Serviços, Parceiros, Marinas, Postos, Explorar, Marketplace, Vagas) | **PARCIAL** (fora do escopo desta parte) | Rotas existem: `web/app/(app)/marketplace`, `web/app/(app)/rede`, `web/app/parceiros`, `web/app/(parceiro)/parceiro`, tabela `public.parceiros`. Auditoria detalhada é da parte 2 (seções 47+). | — |
| Arquitetura preparada para Commander Connected sem dependência dele | **PARCIAL** | Não encontrado indício direto (nenhum stub, flag ou tabela `connected*`). Não é uma contra-evidência forte — é um requisito de "não travar", difícil de falsear por busca textual. | Confirmar com o time se há decisão arquitetural registrada |

---

## 2. Princípio central — "seu barco tem memória agora"

| Requisito | Status | Evidência | O que falta |
|---|---|---|---|
| Usuário → acesso/permissão → Embarcação → histórico (embarcação é entidade própria, sobrevive à troca de dono) | **PRONTO** | Todas as tabelas de dados técnicos têm FK em `embarcacao_id`, nunca em `usuario_id`: `equipamentos`, `itens_monitorados`, `eventos`, `documentos`, `fotos`, `contatos` (confirmado via `list_tables` no projeto `khgjtxvmduizyooqaoox`). O vínculo usuário↔barco é modelado à parte em `public.vinculos` (`usuario_id`, `embarcacao_id`, `papel`). `web/lib/consultas.ts` (`carregarPainel`) resolve o barco atual sempre a partir do vínculo, nunca do dono direto. | — |

---

## 3. Perfis do sistema — Proprietário (PROP)

| Requisito (capacidade do PROP) | Status | Evidência | O que falta |
|---|---|---|---|
| Criar/editar embarcação | PRONTO | `web/app/(app)/barco/editar/page.tsx`, `web/lib/acoes/embarcacao.ts` | — |
| Cadastrar motores / atualizar horas | PRONTO | `web/app/(app)/barco/equipamento/novo/page.tsx`, `web/lib/acoes/equipamentos.ts`, `web/lib/acoes/leituras.ts` | — |
| Registrar manutenções | PRONTO | `web/lib/acoes/itens.ts`, `web/app/(app)/barco/itens/novo` | — |
| Registrar ocorrências | **AUSENTE** | Nenhuma ocorrência de "ocorrencia" como entidade em `web/` (busca `ocorrencia\|ocorrência` no código: 0 resultado). Existe apenas `eventos.tipo = 'avaria'`, sem estado. Ver seção 22. | Entidade Ocorrência com estado |
| Gerenciar documentação | PRONTO | `web/app/(app)/barco/documentos/page.tsx`, `web/lib/acoes/documentos.ts` | — |
| Gerenciar segurança | **AUSENTE** | Nenhuma rota, tabela ou categoria "segurança"/"seguranca" no domínio de embarcação (as poucas ocorrências do termo no código são sobre rate-limit em `lib/seguranca/limitador.ts`, não o hub). Ver seção 16. | Hub Segurança inteiro |
| Gerenciar equipamentos | **PARCIAL** | `equipamentos.tipo` só aceita `motor/gerador/bateria/outro` (`equipamentos_tipo_check`) — cobre motor/gerador/bateria, mas não um hub geral de "equipamentos a bordo" (colete, bote, VHF etc.) como o PRD pede na seção 17. | Hub Equipamentos genérico |
| Registrar Diário de Bordo | PRONTO | `web/app/(app)/diario/novo/page.tsx` | — |
| Consultar histórico | PRONTO (mesclado com Diário) | `web/app/(app)/diario/page.tsx` funciona como feed histórico com filtros | Ver ressalva na seção 25 |
| Consultar gastos | PRONTO | `web/app/(app)/barco/gastos/page.tsx` | — |
| Gerar resumos | **AUSENTE** (como ação do usuário) | Não há botão/fluxo "gerar resumo" na UI; o único resumo periódico é um cron de e-mail (`web/app/api/relatorio/mensal/route.ts`), disparado pelo servidor, não pelo PROP. Ver seção 28. | Fluxo "Gerar resumo" acionado pelo usuário |
| Transferir embarcação | **AUSENTE** | Busca por `transferir\|transferência\|transfer` no código não retorna nenhuma feature de troca de titularidade (os únicos matches são texto de política de privacidade e o botão de "compartilhar" de uma saída, que é outra coisa). Ver seção 27. | Fluxo inteiro de transferência |
| Convidar Comandante / gerenciar permissões | PRONTO | `web/app/(app)/menu/tripulacao/page.tsx`, `web/lib/acoes/convites.ts`, `web/lib/acoes/vinculos.ts` | — |
| Utilizar Serviços/Explorar/Marketplace, gerenciar assinatura | Fora do escopo desta parte | — | Auditar na parte 2 |

---

## 4. Comandante (CMDT)

| Requisito | Status | Evidência | O que falta |
|---|---|---|---|
| Conta própria vinculada ao e-mail | PRONTO | `public.vinculos.papel` restrito a `('PROP','CMDT')` via check constraint; `public.profiles` é 1:1 com `auth.users` | — |
| Dois conceitos independentes: acesso operacional a embarcações × perfil profissional no Marketplace | PRONTO (estrutura) | Acesso operacional = `vinculos` (por embarcação). Perfil profissional = tabela `public.perfis_comandante` (PK `usuario_id`, independente de qualquer embarcação, campos `visivel`/`verificado`). São de fato duas tabelas/conceitos separados. | Auditoria funcional do perfil profissional fica pra parte 2 (seção 47+) |

---

## 5. Permissões do Comandante — a matriz

**Achado principal desta seção — corrige a afirmação do orquestrador.** A alegação "já temos matriz de
permissões idêntica à do PRD" está **incorreta**: a matriz implementada tem 9 áreas, o PRD pede 13.

| Área da matriz do PRD | Existe na matriz implementada? | Evidência |
|---|---|---|
| Visão Geral | Sim, como `embarcacao` | `web/lib/domain/permissoes.ts:2` |
| Motores | Sim, `motores` | idem |
| Casco | Sim, `casco` | idem |
| Elétrica | Sim, `eletrica` | idem |
| **Hidráulica** | **Não existe** | Não há aba `hidraulica` em `ABAS` (`web/lib/domain/permissoes.ts:1-4`) |
| **Segurança** | **Não existe** | idem |
| **Equipamentos** (como área própria, distinta de motores/elétrica) | **Não existe** | idem — equipamentos "outro" caem sob a aba `eletrica` (ver `aba_do_equipamento` em `supabase/migrations/010_matriz_no_banco_e_integridade.sql:7-10`) |
| Documentos | Sim, `documentos` | `web/lib/domain/permissoes.ts:3` |
| Fotos | Sim, `fotos` | idem |
| Contatos | Sim, `contatos` | idem |
| Diário de Bordo | Sim, `diario` | idem |
| **Histórico** (como área própria) | **Não existe** | Histórico é mesclado dentro de `diario`, sem controle de acesso separado |
| Gastos | Sim, `gastos` | idem |

Status consolidado da seção: **DIVERGENTE**. A matriz existe, é aplicada de ponta a ponta (RLS no banco via
`public.aba_alvo`/`public.permissao`, `supabase/migrations/010_matriz_no_banco_e_integridade.sql:12-38`, e no
front via `podeVer`/`podeEditar` em `web/lib/domain/permissoes.ts:56-62`), mas cobre 9 das 13 áreas do PRD.
Faltam Hidráulica, Segurança, Equipamentos e Histórico como linhas próprias — consequência direta de esses
hubs não existirem ainda (seções 15–17, 25).

| Requisito | Status | Evidência | O que falta |
|---|---|---|---|
| Proprietário define o acesso | PRONTO | `web/app/(app)/menu/tripulacao/[id]/page.tsx` (tela "área por área, ver/editar"), `web/lib/acoes/vinculos.ts` (`salvarMatriz`, `aplicarPreset`) | — |
| Áreas financeiras/administrativas podem ficar só com o proprietário | PRONTO | `gastos` é uma aba controlável independentemente; presets `completo`/`operacional` em `web/lib/domain/permissoes.ts:28-40` mostram `operacional` sem `gastos` | — |

---

## 6. Tripulação autorizada

| Requisito | Status | Evidência | O que falta |
|---|---|---|---|
| Proprietário/comandante pode autorizar usuários específicos | PRONTO | `web/app/(app)/menu/tripulacao/page.tsx` (convites com nível operacional/completo), ajuste fino em `.../tripulacao/[id]/page.tsx` | — |
| Interface deve avisar que não é recomendado dar permissão de alteração pra toda a tripulação | **AUSENTE** | Não encontrado texto de aviso nesse sentido em `web/app/(app)/menu/tripulacao/page.tsx` nem em `.../tripulacao/[id]/page.tsx`. Existem apenas descrições neutras dos presets ("Operacional — registra horas e serviços, sem custos e documentos" / "Completo — vê e edita tudo"), sem a recomendação explícita do PRD. | Copy de aviso |
| Lógica comercial de quantidade de acessos por plano | **AUSENTE** | Nenhum limite de nº de convites/vínculos encontrado em `web/lib/acoes/convites.ts` nem em `web/lib/domain/planos.ts` | Trava por plano |

---

## 7. Identidade visual

| Requisito | Status | Evidência | O que falta |
|---|---|---|---|
| Logo com os dois M espelhados | PRONTO (não verificado visualmente, mas componente existe) | `web/components/logo.tsx` (usado em `web/app/(app)/menu/page.tsx:24`) | — |
| Paleta Navy profundo + Dourado + Branco/off-white | PRONTO | `web/app/globals.css`: `--fundo:#0b1d2d` (navy), `--acao:#d4af37` (dourado), tokens repetidos no tema claro e no `[data-theme="dark"]` | — |
| Light Mode padrão / Dark Mode opcional, mesmos componentes | PRONTO | `web/app/globals.css:29` (`[data-theme="dark"]`), `web/components/theme-toggle.tsx`, texto em `web/app/(app)/menu/page.tsx:56` ("O modo claro é o padrão — feito para leitura sob sol forte na marina") | — |
| Estados visuais 🟢 OK / 🟡 ATENÇÃO / 🔴 CRÍTICO, vermelho reservado pra problema real | PRONTO | `web/lib/domain/semaforo.ts:1,39` (`StatusFarol = "ok"\|"atencao"\|"vencido"`), componente `web/components/farol.tsx` usado consistentemente em Motores/Casco/Documentos | — |

---

## 8. Estrutura principal

| Requisito | Status | Evidência | O que falta |
|---|---|---|---|
| CONTA: Dashboard, Minha Conta, Gerenciar acessos | PRONTO | `/hoje` (dashboard), `web/app/(app)/menu/perfil`, `web/app/(app)/menu/tripulacao` | — |
| EMBARCAÇÃO: Visão Geral, Motores, Casco, Elétrica, **Hidráulica, Segurança**, Equipamentos, Documentação, Fotos, Contatos, Diário, Histórico/Ocorrências, Resumos, Selos&Review, Gastos, Transferir | **PARCIAL** | Rotas reais sob `web/app/(app)/barco/`: `page` (visão geral), `equipamento` (motores/elétrica), `eletrica`, `itens` (casco+doc), `documentos`, `fotos`, `contatos`, `gastos`, `selo`. **Não existem**: rota/hidráulica, rota/segurança, rota "Resumos", rota "Transferir". "Histórico/Ocorrências" está fundido em `/diario`. | Hidráulica, Segurança, Resumos, Transferir como rotas próprias |
| ECOSSISTEMA: Serviços, Explorar, Marketplace, Parceiros | Fora do escopo desta parte | `web/app/(app)/marketplace`, `web/app/(app)/rede`, `web/app/parceiros` existem como rotas | Auditoria funcional na parte 2 |

---

## 9. Visão Geral da Embarcação

| Requisito (campo) | Status | Evidência |
|---|---|---|
| Nome, Foto principal, Ano, Estaleiro, Modelo, Comprimento, Boca, Calado, Material do casco, Número do casco, TIE, Capitania, Propulsão, Marina/base | **PRONTO** — cobertura 1:1 | Tabela `public.embarcacoes`: colunas `nome, foto_capa_path, ano, estaleiro, modelo, comprimento_m, boca_m, calado_m, casco_material, casco_numero, tie, capitania, propulsao, marina` (confirmado via `list_tables`). Renderizado em `web/app/(app)/barco/page.tsx:239-256` (bloco "Dados gerais") e editado em `web/app/(app)/barco/editar/page.tsx`. |
| "Tela deve funcionar como porta de entrada da embarcação" | PRONTO | `web/app/(app)/barco/page.tsx` concentra motores, elétrica, casco, documentos, ferramentas e dados gerais numa página só | — |

---

## 10. Dashboard / Saúde da Embarcação

**Achado principal desta seção — confirma a suspeita do orquestrador.** O PRD é explícito: *"A fórmula
definitiva de cálculo NÃO está fechada. O programador pode preparar arquitetura/componentes, mas não deve
inventar pesos ou algoritmo."* O código em produção já inventou pesos e algoritmo.

| Requisito | Status | Evidência | O que falta / conflito |
|---|---|---|---|
| Dashboard consolida hubs (estado geral, manutenções vencidas/próximas, docs vencidos, segurança, ocorrências abertas, horas de motor, última utilização, atividades, pendências, Verified/Gold, atalhos) | **PARCIAL** | `/hoje` (`web/app/(app)/hoje/page.tsx`) cobre: horas de motor, próxima revisão, status de documentos, alertas de vencimento, gastos do mês, tripulação, mar agora, atalhos. **Não cobre**: segurança (hub não existe), ocorrências abertas (conceito não existe), Verified/Gold (fora do escopo desta parte, mas não hookado em `/hoje`). | Segurança, ocorrências abertas, Verified/Gold no dashboard |
| Indicador visual de saúde deve existir, MAS a fórmula não está fechada — dev não deve inventar pesos/algoritmo | **DIVERGENTE — conflito real com o PRD** | `web/components/anel-status.tsx` (o "AnelStatus" de `/hoje`) já implementa uma fórmula fechada e testada: `percentual = round(emDia/total*100)` (`web/lib/domain/semaforo.ts:174-184`, função `resumoStatusGeral`), com faixas de rótulo hardcoded — `web/lib/domain/semaforo.ts:145-150`: ≥90 "Ótimo", ≥70 "Bom", ≥40 "Atenção", senão "Crítico" (`rotuloAnel`, linha 155-157). Testado em `web/lib/domain/semaforo.test.ts`. | Esse anel é exatamente o "peso/algoritmo" que o PRD pede pra NÃO inventar. Reportar ao orquestrador/PO: ou (a) o PRD precisa reconhecer esse anel como a decisão já tomada, ou (b) o anel precisa ser revisto/descontinuado até a fórmula ser fechada oficialmente. |

---

## 11. Motores

**Confirma a afirmação do orquestrador**, com ressalva de sub-estrutura.

| Requisito | Status | Evidência | O que falta |
|---|---|---|---|
| Cada motor é entidade independente (ex.: BB/BE), com horas/manutenção/histórico próprios | **PRONTO** | `public.equipamentos` (`tipo='motor'`, `posicao` check `'BB'\|'BE'\|'central'`), `horas_atuais`, `ultima_leitura`. Histórico via `eventos.equipamento_id`, manutenção via `itens_monitorados.equipamento_id`. UI: `web/app/(app)/barco/equipamento/[id]/page.tsx` (uma ficha por motor, com abas de irmãos na linha 116-127 quando há mais de um). | — |
| Identificação: Marca, Modelo, Nº série, Identificação interna, Ano, Potência HP, Combustível, Posição | **PRONTO** | Colunas correspondentes em `equipamentos`; formulário em `web/app/(app)/barco/equipamento/novo/page.tsx:35-68` | — |
| Horas: atuais, data da leitura, histórico, última atualização, média de uso | **PRONTO** | `horas_atuais`/`ultima_leitura` na tabela; histórico via `eventos.tipo='leitura_horas'`; média calculada em `web/lib/domain/uso.ts` (`mediaHorasPorSemana`), usada em `equipamento/[id]/page.tsx:73-75` | — |
| Manutenção: última revisão (data/horas/serviços), próxima revisão com data E horas como critérios independentes, vence no que ocorrer primeiro | **PRONTO** (regra), **PARCIAL** (estrutura de "serviços executados") | Regra "o que vencer primeiro" implementada em `web/lib/domain/semaforo.ts:53-76` (`calcularSemaforo` combina `statusHoras` e `statusData`, pega o pior). Mas "serviços executados" da última revisão não é um campo estruturado — é o texto livre `eventos.descricao`. | Estrutura de "serviços executados" |
| Óleo (especificação, quantidade, última troca, horas da troca, próxima troca) como sub-entidade própria | **PARCIAL/DIVERGENTE** | Não existe uma entidade "Óleo" — é modelado como um `itens_monitorados` genérico qualquer, com campos livres `especificacao`/`quantidade` (texto), sem tipagem "é óleo". Visível em `equipamento/[id]/page.tsx:259-264` (regra montada por concatenação de texto). | Estrutura tipada de Óleo |
| Filtros (Óleo/Combustível/Ar/Outros) com manutenção própria | **AUSENTE** (como categoria estruturada) | Mesma observação acima — o usuário pode nomear um item "Filtro de óleo" livremente, mas não há enum/categoria "filtro" nem subtipo | Categorias de filtro |
| Histórico: data, horas, serviço, prestador, valor, observação, anexo | **PRONTO** | `eventos`: `data, horas_no_momento, descricao, contato_id, custo_centavos, anexo_path`. Renderizado em `equipamento/[id]/page.tsx:301-325` | — |

---

## 12. Alertas de motor

| Requisito | Status | Evidência |
|---|---|---|
| Avisar revisão próxima/vencida, troca próxima/vencida, com antecedência parametrizável | **PRONTO** | `web/lib/domain/alertas.ts:5-17` (`janelaDoAlerta`) implementa janelas `d30/d15/d5/vencido` (dias) e `h_margem/h_vencido` (horas), espelhando exatamente a tabela `alertas_enviados.janela` no banco (check constraint com os mesmos valores + `mar_ruim`/`motor_parado`). Texto de notificação em `web/lib/domain/alertas.ts:25-42` já usa o padrão "Faltam X horas para a próxima revisão do Motor BB" pedido no PRD (§12, "Exemplo"). |

---

## 13. Casco

| Requisito | Status | Evidência | O que falta |
|---|---|---|---|
| Categorias: Deck, Fibra, Inox, Vidros, Estofados, Outros | **PRONTO** | `web/lib/domain/diario.ts:5-10` (`CATEGORIAS_CASCO`), espelhado no banco: `itens_monitorados.categoria` check `in ('documento','deck','fibra','inox','vidros','estofados','casco_outros')` (`supabase/migrations/003_fase2.sql:22`) | — |
| Cada categoria com Estado, Última intervenção, Avarias, Manutenções, Ocorrências, Fotos, Anexos, Histórico | **PARCIAL** | Estado (farol) + manutenções + histórico: PRONTO, via `itens_monitorados` + `eventos.categoria`. "Ocorrências" por categoria: **ausente** (não existe o conceito, seção 22). Fotos/anexos por categoria específica: as fotos são por álbum geral (seção 19), não vinculadas a uma categoria de casco. | Ocorrências e fotos vinculadas à categoria |
| "Não criar apenas campos soltos — cada registro alimenta o histórico daquele componente" | **PRONTO** | `eventos` com `categoria` preenchida aparece no filtro "Casco" do Diário (`web/lib/domain/diario.ts:42-43`, `ehCasco`) e na ficha do item | — |

---

## 14. Elétrica

| Requisito | Status | Evidência | O que falta |
|---|---|---|---|
| Área própria | **PRONTO** (como rota), **DIVERGENTE** (como permissão — ver seção 5) | `web/app/(app)/barco/eletrica/page.tsx` | Área própria na matriz de permissões |
| Baterias: Tipo, Quantidade, Data última troca, Observações, Histórico | **PARCIAL** | `equipamentos.tipo='bateria'` tem `quantidade`, `observacoes`, histórico via `eventos`. **Não tem** um campo "tipo de bateria" (AGM/gel/lítio) — só o tipo genérico do equipamento. "Data da última troca" só existe como um `itens_monitorados` genérico avulso, não campo dedicado. | Campo "tipo de bateria" |
| Gerador: Marca, Modelo, Serial, Horas, Última/Próxima manutenção (horas OU data, o que vier primeiro) | **PRONTO** | Mesmos campos genéricos de `equipamentos` (compartilhados com motor) cobrem marca/modelo/serial/horas; regra "o que vencer primeiro" é a mesma `calcularSemaforo` da seção 11 | — |
| Sistema/painel de bordo — cadastro das informações pertinentes | **AUSENTE** | Não encontrado campo ou tela específica para "painel de bordo" | Cadastro de painel de bordo |
| Histórico: toda intervenção elétrica relevante registrada | **PRONTO** | `eventos.equipamento_id` para gerador/bateria, mesma mecânica dos motores | — |

---

## 15. Hidráulica

| Requisito | Status | Evidência |
|---|---|---|
| Hub separado, categorias Água doce / Grey Water / Black Water, componentes cadastráveis com estado/manutenção/ocorrência/observação/fotos/histórico | **AUSENTE — confirma a suspeita do orquestrador** | Nenhuma rota (`web/app/(app)/barco/` não tem `hidraulica`), nenhuma categoria no check constraint de `itens_monitorados.categoria` (só casco+documento, ver seção 13), nenhuma tabela ou coluna com "hidraulic" no schema (`list_tables` do projeto `khgjtxvmduizyooqaoox`), nenhum resultado pra "hidraulica" em `web/` fora de arquivos de mapa (`rota.worker.ts` etc., que são sobre roteamento náutico, não o hub). |

---

## 16. Segurança

| Requisito | Status | Evidência |
|---|---|---|
| Área crítica: itens de segurança com quantidade/validade/último teste/manutenção/estado/observação/anexo/ocorrência; regra de UX do "!" vermelho reservado a alerta crítico | **AUSENTE — confirma a suspeita do orquestrador** | Nenhuma rota, tabela, categoria ou componente de "segurança" como hub de embarcação. As únicas ocorrências do termo no código (`web/lib/seguranca/limitador.ts`) são sobre rate-limiting de infraestrutura, sem relação com o hub do PRD. A regra de farol vermelho-só-pra-crítico (seção 7) está implementada de forma geral (`StatusFarol`), mas não há tela de Segurança para aplicá-la. |

---

## 17. Equipamentos

| Requisito | Status | Evidência | O que falta |
|---|---|---|---|
| Área flexível para equipamentos a bordo (nome, categoria, marca, modelo, serial, data de instalação, estado, manutenção, prestador, observações, fotos, documentos, histórico) | **PARCIAL/DIVERGENTE** | Existe `equipamentos.tipo='outro'` (`web/app/(app)/barco/equipamento/novo/page.tsx:39`), que reaproveita a mesma ficha de motor/gerador (marca, modelo, serial, ano, potência HP, combustível — campos pensados pra motor, não para "colete salva-vidas" ou "bote inflável"). Fica agrupado sob a aba/permissão "Elétrica" (`aba_do_equipamento`, seção 5), não como hub próprio. Não há campo "data de instalação" nem "categoria" livre de equipamento. | Hub Equipamentos com campos próprios (não herdados de motor) |

---

## 18. Documentação

| Requisito | Status | Evidência | O que falta |
|---|---|---|---|
| Central documental (TIE, Seguro, Vistoria, Licença, Certificados, Doc. propriedade, outros) | **PRONTO** (como lista de sugestões) | `web/app/(app)/barco/documentos/page.tsx:124-129` — `datalist` com "Seguro da embarcação, TIE, Vistoria da Marinha, Licença de navegação, Certificado de segurança, Documento de propriedade" | — |
| Campos: Tipo, Número, Emissor, Data de emissão, Validade, Arquivo, Observação, Status | **PARCIAL** | Tabela `public.documentos` só tem `nome, arquivo_path, validade` (confirmado via `list_tables`); "Tipo/Número/Emissor/Data de emissão/Observação" **não existem** como colunas — o "tipo" é só o texto livre do nome. Status existe via `itens_monitorados` + `calcularSemaforo`, não na tabela `documentos` em si. | Número, Emissor, Data de emissão, Observação estruturados |
| Alertas 30/15/5 dias e vencido | **PRONTO** | `web/lib/domain/alertas.ts:10-13` (`janelaDoAlerta`), retorna exatamente `d30`/`d15`/`d5`/`vencido`; janelas também no check constraint de `alertas_enviados.janela` no banco | — |

---

## 19. Fotos

| Requisito | Status | Evidência | O que falta |
|---|---|---|---|
| Álbuns: Exterior, Interior, Convés, Documentação visual, **Outros** | **PARCIAL** | `web/app/(app)/barco/fotos/albuns.ts:3` — `ALBUNS = ["exterior","interior","conves","documentacao"]`. Falta o álbum **"Outros"**. Confirmado também no banco: `fotos.album` check `in ('exterior','interior','conves','documentacao')` (`supabase/migrations/013_fotos.sql:4`) — sem `'outros'`. | Álbum "Outros" |
| Limite de armazenamento por plano (espaço usado/disponível/upgrade) | **AUSENTE** | Não encontrado em `web/lib/domain/fotos*`, `web/lib/acoes/fotos.ts` nem em `web/lib/domain/planos.ts` | Cota de armazenamento |

---

## 20. Contatos

| Requisito (campo) | Status | Evidência | O que falta |
|---|---|---|---|
| Nome, Telefone, Especialidade, Avaliação pessoal | PRONTO | Tabela `public.contatos`: `nome, especialidade, telefone, avaliacao` (check 1–5). UI: `web/app/(app)/barco/contatos/page.tsx:86-98` (form) e `:69-77` (avaliação por estrelas) | — |
| **Empresa** | **AUSENTE** | Não há coluna `empresa` em `contatos` nem campo no formulário | Campo Empresa |
| **E-mail** | **AUSENTE** | Não há coluna `email` em `contatos` nem campo no formulário | Campo E-mail |
| **Observações** | **AUSENTE** | Não há coluna `observacoes` em `contatos` nem campo no formulário | Campo Observações |
| Histórico de serviços vinculados | PRONTO | `web/app/(app)/barco/contatos/page.tsx:24-31` conta `eventos.contato_id` por contato e mostra "X serviços neste barco" | — |
| Contato não precisa ter conta pública no Commander | PRONTO | `contatos` é tabela independente de `profiles`/`auth.users`, sem FK obrigatória pra usuário | — |

---

## 21. Manutenção — regra transversal

| Requisito | Status | Evidência | O que falta |
|---|---|---|---|
| Manutenção aparece no componente, no histórico, nos relatórios e nos gastos (quando tem custo) | **PARCIAL** | Componente → histórico → gastos: PRONTO (mesmo evento em `eventos` alimenta a ficha do equipamento, o feed do Diário — `web/app/(app)/diario/page.tsx` — e Gastos — `web/app/(app)/barco/gastos/page.tsx`, via `custo_centavos`). "Nos relatórios": só parcialmente, porque o único relatório existente é o e-mail mensal (seção 28), que soma `totalGastosCentavos` mas não lista manutenções nominalmente. | Manutenções nominadas nos relatórios |

---

## 22. Ocorrências — regra transversal

**Achado principal desta seção — corrige a afirmação do orquestrador.** A alegação "ocorrências já
nascem do Diário e caem no setor certo" está **incorreta**: o conceito de Ocorrência, com estado
(Aberta/Em acompanhamento/Resolvida), **não existe** no código.

| Requisito | Status | Evidência | O que falta |
|---|---|---|---|
| Ocorrência nasce ligada a um setor (ex.: luz de navegação falhou no Diário → cria ocorrência em Elétrica automaticamente) | **AUSENTE** | Busca por `ocorrencia`/`ocorrência` em todo `web/`: **0 resultados**. O que existe é `eventos.tipo = 'avaria'` (check constraint em `eventos`), um tipo de evento entre outros (`manutencao, abastecimento, navegacao, avaria, docagem, leitura_horas, outro`), sem vínculo automático a um "setor" além do campo opcional `categoria`/`equipamento_id` que qualquer evento já tem. Não há criação automática de nada a partir de um evento "avaria" — o usuário escolhe manualmente "onde no barco" no formulário (`web/components/campos-navegacao-evento.tsx:229-259`). | Entidade Ocorrência real |
| Estados: Aberta / Em acompanhamento / Resolvida | **AUSENTE** | Nenhuma coluna de status desse tipo em `eventos` nem em nenhuma outra tabela (schema completo verificado via `list_tables`) | Máquina de estados |
| Quando resolvida, evento permanece no histórico | N/A (não há o que resolver) | — | — |

---

## 23. Diário de Bordo

| Requisito | Status | Evidência | O que falta |
|---|---|---|---|
| Abertura: Data, Hora de saída, **Local de saída**, Destino/rota, Comandante, Tripulação/ajudante, **Passageiros** | **PARCIAL** | `web/components/campos-navegacao-evento.tsx:166-226` (tipo "navegacao"): tem Data, Hora de saída/retorno, Destino, checkboxes de Tripulação (`tripulacao[]` em `eventos`). **Não tem** "Local de saída" (só destino) nem "Passageiros" como lista separada da tripulação. | Local de saída, Passageiros |
| Final: Hora de chegada, Duração, Observações, Abastecimento, Ocorrências, Fotos/anexos, Checklist rápido | **PARCIAL** | Hora de chegada/Duração/Observações: PRONTO (`hora_retorno`, `duracaoHoras` em `web/lib/domain/bordo.ts:25-33`). Abastecimento é tipo de evento separado, não parte do fechamento da saída. Ocorrências: ausente (seção 22). Fotos/anexos: só em tipos não-navegação (`campoAnexo`, linha 42-51, condicionado por `TIPOS_COM_CUSTO_ANEXO`, que **exclui** `navegacao`). **Checklist rápido por hub não existe.** | Ocorrências, anexo em saídas, checklist |
| Diário conversa com Motores/Casco/Elétrica/Hidráulica/Segurança, com "✓ OK / observação" por hub e atalho "✓ OK GERAL" | **AUSENTE — divergência importante** | O formulário de "Novo registro" (`web/components/campos-navegacao-evento.tsx`) é um seletor de 6 tipos de evento (Manutenção/Abastecimento/Navegação/Avaria/Docagem/Outro), não um checklist por hub. Não existe nenhum componente com "OK/observação" por Motores/Casco/Elétrica/Hidráulica/Segurança, nem um botão "OK GERAL". | O checklist inteiro descrito na seção 23 |
| Regra fundamental: ocorrência do Diário vai automaticamente pro hub com data/origem/descrição/anexo | **AUSENTE** | Depende de Ocorrências (seção 22), que não existe | Depende da seção 22 |

---

## 24. Diário → Horas dos motores

| Requisito | Status | Evidência |
|---|---|---|
| Ao finalizar uma saída, sugerir atualização de horas ("Saída registrada: 4h12min. Deseja atualizar as horas dos motores?"), sem ser silenciosa, com confirmação do usuário | **PRONTO** | `web/app/(app)/diario/[id]/horas/page.tsx` — tela dedicada pós-registro de saída: mostra duração calculada (`textoDuracao`), pergunta "Atualizar as horas dos motores?" (linha 53), pré-preenche valor sugerido (`horasSugeridas` em `web/lib/domain/bordo.ts:46-49`) por motor, com botão "Atualizar" e escape explícito "Agora não" (linha 89-91) — exatamente o padrão "nunca silencioso, sempre confirmado" do PRD. |

---

## 25. Histórico / Ocorrências Central

| Requisito | Status | Evidência | O que falta |
|---|---|---|---|
| Visão central consolidando Motores, Casco, Elétrica, Hidráulica, Segurança, Equipamentos, Documentação, Diário, Commander Review, com filtros por Data/Categoria/Tipo/Status | **PARCIAL/DIVERGENTE** | Existe, mas fundida com o Diário: `web/app/(app)/diario/page.tsx` já é o feed cronológico de tudo (`eventos` sem filtro de tipo, agrupado por mês em `agruparPorMes`), com chips de filtro `Tudo/Motores/Elétrica/Casco/Docs/Gastos` (`web/lib/domain/diario.ts:3`, `FiltroDiario`). Não é uma tela separada "Histórico", e faltam: filtro por Hidráulica/Segurança/Equipamentos (hubs não existem), filtro por **Status** (não existe, pois Ocorrências não existe) e Commander Review (fora do escopo desta parte). | Tela própria, filtro por status, hubs faltantes |

---

## 26. Memória técnica

| Requisito | Status | Evidência |
|---|---|---|
| Sistema constrói memória técnica progressiva da embarcação (motores, horas, manutenções, ocorrências técnicas, relatórios, Review, Gold, docs técnicos compartilháveis) — "não é histórico da conta do Pedro, é histórico da embarcação" | **PRONTO** (como princípio arquitetural) | Decorre diretamente da seção 2: todo dado técnico é FK em `embarcacao_id`, nunca em `usuario_id`, então sobrevive à troca de vínculo/dono. Os componentes específicos (ocorrências técnicas, Review, Gold) que alimentariam essa memória têm as lacunas já registradas nas seções 22 e 30+ (fora do escopo desta parte). |

---

## 27. Transferência de propriedade

| Requisito | Status | Evidência |
|---|---|---|
| Fluxo "Gerenciar embarcação → Transferir propriedade", proprietário inicia, dados técnicos (motores/horas/manutenções/ocorrências/relatórios/histórico/Gold/docs técnicos) são transferidos, dados pessoais/privados NÃO são | **AUSENTE** | Nenhuma rota, ação (`web/lib/acoes/*`) ou menção a transferência de titularidade de embarcação encontrada em todo `web/`. `web/app/(app)/barco/page.tsx` não tem link "Transferir" nem em `editar/page.tsx`. |

---

## 28. Resumos

**Confirma parcialmente a suspeita do orquestrador de que "existe algo" — mas está muito aquém do PRD.**

| Requisito | Status | Evidência | O que falta |
|---|---|---|---|
| Área "RESUMOS" na navegação, períodos Mensal/Semestral/Anual, um único modelo (sem "executivo"/"completo"/"premium") | **AUSENTE como área de produto** | Não há rota `web/app/(app)/.../resumos` nem link de navegação pra "Resumos" em `web/app/(app)/barco/page.tsx` ou `web/app/(app)/menu/page.tsx`. O único artefato existente é um endpoint de cron server-to-server, `web/app/api/relatorio/mensal/route.ts`, que dispara **e-mail** (via Resend) automaticamente todo dia 1 pros PROPs — não é uma tela que o usuário acessa, não gera PDF, e só cobre o período **mensal** (sem semestral/anual). | Área "Resumos" na UI, semestral, anual, geração sob demanda |

---

## 29. Conteúdo dos Resumos

| Requisito (o que o resumo deve conter) | Status | Evidência | O que falta |
|---|---|---|---|
| Utilização/Diários, Horas dos motores, Manutenções, Ocorrências abertas/resolvidas, Casco, Elétrica, Hidráulica, Segurança, Equipamentos, Documentação, Abastecimentos, Gastos | **PARCIAL** | `web/lib/domain/relatorio.ts` (`resumoDoMes`) calcula apenas: `horasMotor` (delta de leituras no mês), `totalGastosCentavos` (soma de `custo_centavos`), `saidas` (contagem de eventos `navegacao`), `aVencer` (itens que vencem no mês seguinte). **Não cobre**: manutenções detalhadas, ocorrências (não existem), casco/elétrica/hidráulica/segurança/equipamentos discriminados, documentação, abastecimentos separados de gastos. | A maior parte do conteúdo pedido |
| Semestral/anual com evolução, comparativos, totais do período | **AUSENTE** | Não existe período semestral/anual (seção 28); `web/lib/domain/resumo-ano.ts` (`resumoAno`) existe, mas é usado só no widget "Seu ano no mar" de `/hoje` (saídas/milhas/horas do ano corrente), não é o Resumo Anual do PRD e não tem "evolução"/"comparativo" | Semestral, anual, comparativos |
| "Não inventar informação ausente" | **PRONTO** (princípio já seguido) | `web/app/api/relatorio/mensal/route.ts:21-23` (`resumoVazio`) pula o envio de e-mail quando não há dado real no mês, em vez de mandar um resumo vazio/inventado — mesma filosofia de honestidade vista em `web/lib/domain/semaforo.ts:159-161` (`temInformacaoSuficiente`) | — |

---

## Resumo por status (seções 1–29)

Contagem aproximada de linhas de requisito auditadas nesta parte: **~95 linhas** de requisito distintas
nas 29 seções acima.

- **PRONTO**: ~35
- **PARCIAL**: ~30
- **AUSENTE**: ~22
- **DIVERGENTE**: ~8

(Várias linhas se sobrepõem entre PARCIAL e DIVERGENTE quando um recurso existe mas funciona diferente do
descrito — contadas uma vez pelo status mais específico.)

---

## Já entregue

- Princípio "embarcação como entidade própria" (seção 2) — arquitetura de dados 100% alinhada (tudo por `embarcacao_id`).
- Perfis PROP/CMDT com dois conceitos independentes (operacional × profissional) (seção 4).
- Identidade visual completa: navy/dourado, light/dark, farol de 3 estados (seção 7).
- Visão Geral da embarcação — todos os campos do PRD existem 1:1 (seção 9).
- Motores como entidades independentes com horas/manutenção/histórico próprios (seção 11).
- Alertas de motor com janelas d30/d15/d5/vencido e horas (seção 12).
- Casco com as 6 categorias exatas do PRD (seção 13).
- Alertas de documentação com a mesma graduação 30/15/5/vencido (seção 18).
- Diário → sugestão de atualização de horas dos motores, não-silenciosa (seção 24).
- Regra "vence no que ocorrer primeiro" (horas OU data) aplicada de forma consistente (seções 11, 14).
- Matriz de permissões por embarcação, aplicada tanto na UI quanto em RLS no banco (seção 5, ainda que incompleta em cobertura de áreas).

## Falta e é pequeno

- Álbum "Outros" em Fotos (seção 19).
- Campos Empresa/E-mail/Observações em Contatos (seção 20).
- Texto de aviso sobre não conceder edição pra toda a tripulação (seção 6).
- Campo "tipo de bateria" em Elétrica (seção 14).
- Estrutura tipada de Óleo/Filtros dentro de Motores (seção 11) — hoje é item genérico.
- Cadastro de "Sistema/painel de bordo" em Elétrica (seção 14).
- Local de saída / Passageiros como campos distintos no Diário (seção 23).

## Falta e é grande

- **Hidráulica** — hub inteiro ausente (seção 15).
- **Segurança** — hub inteiro ausente (seção 16).
- **Equipamentos** como hub genérico próprio — hoje é um subtipo reaproveitado de Motores/Elétrica (seção 17).
- **Ocorrências** como entidade com estado (Aberta/Em acompanhamento/Resolvida) — não existe; é a lacuna que mais reduz o valor do "Diário conversa com os hubs" (seções 3, 22, 23, 25).
- **Checklist do Diário por hub** ("✓ OK / observação" por Motores/Casco/Elétrica/Hidráulica/Segurança + "OK GERAL") — não existe (seção 23).
- **Resumos** como área de produto (Mensal/Semestral/Anual, sob demanda, com o conteúdo completo do PRD) — hoje é só um e-mail de cron mensal minimalista (seções 28, 29).
- **Transferência de propriedade** — fluxo inteiro ausente (seção 27).
- **Anel de "Saúde da Embarcação" em `/hoje` já usa fórmula e pesos fechados** que o PRD explicitamente pede pra não inventar ainda — precisa de decisão do PO, não é só um "falta fazer" (seção 10).
- Matriz de permissões tem 9 das 13 áreas do PRD — Hidráulica/Segurança/Equipamentos/Histórico não têm linha própria, como consequência direta dos hubs não existirem (seção 5).
