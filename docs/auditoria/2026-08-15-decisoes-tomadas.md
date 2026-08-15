# Decisões tomadas em 15/08/2026 — os 6 conflitos e o resto do PRD FINAL

O dono disse **"RESOLVA TUDO"** depois de ler a auditoria
`2026-08-15-prd-final-vs-codigo.md`, que listava 6 conflitos entre o código em produção
e o PRD FINAL, e mais ~52 requisitos ausentes.

Este documento registra **o que foi decidido e por quê**, para que discordar depois seja
barato: cada decisão tem o critério que a sustentou, não só o resultado.

---

## O fato que tornou tudo seguro

Antes de tocar em qualquer coisa comercial, conferi o banco de produção:

| Métrica | Valor |
|---|---|
| Assinaturas (total) | **0** |
| Assinaturas ativas | **0** |
| Admins (`is_admin`) | **0** |
| Usuários | 2 |
| Embarcações | 2 |
| Registros de Diário | 9 |

**Ninguém está pagando e ninguém tem acesso administrativo.** Trocar preço, estrutura de
plano e modelo de admin agora não retira nada de ninguém. Se houvesse um único assinante
no plano fundador, a decisão 2 abaixo seria outra — e é por isso que essa checagem veio
antes, não depois.

---

## Critério geral aplicado

**O PRD FINAL vence.** Ele se declara *"FEATURE FREEZE FUNCIONAL"* e diz explicitamente:
*"Decisões anteriores que conflitem com este PRD devem ser consideradas substituídas."*
Onde o código divergia por decisão antiga, o documento novo prevalece. Onde o código
divergia por **interpretação minha**, corrigi e disse qual foi o erro.

Uma exceção consciente ao "PRD vence": onde ele manda algo que depende de módulo
inexistente, o ponto fica marcado em vez de fabricado. Chip que abre sala vazia e zero
fabricado em painel executivo são piores que a ausência honesta.

---

## Conflito 1 — Saúde da Embarcação: sai a porcentagem

**Decisão: seguir o PRD.** Sem número, sem barra, sem anel proporcional.
Rótulos passam a ser **SAUDÁVEL / ATENÇÃO / AÇÃO NECESSÁRIA**, com a régua declarativa do
§5 (o pior estado relevante prevalece), no lugar da nota 0–100 com faixas
Ótimo/Bom/Atenção/Crítico.

**Por quê:** o PRD proíbe porcentagem em três lugares independentes (§1.1, §27.2 e §28),
o que não é descuido de redação — é ênfase. E a razão de produto é sólida: "82%" convida
o dono a ler como nota de aprovação, e o próprio PRD lembra em §5 que o status *"não
representa declaração de navegabilidade"*. Um rótulo não carrega essa ambiguidade.

**O que foi preservado:** os pesos (`PESO_CATEGORIA`, severidades) **continuam vivos**,
mas só para **ordenar** o bloco "Precisa da sua atenção", que o §3.4 pede *"ordenado por
criticidade"*. Ou seja: a fórmula fechada em 14/08 saiu da **exibição** e ficou na
**ordenação**. Nada daquele trabalho foi jogado fora.

**Custo honesto:** é a segunda vez que a Saúde muda de modelo (onda 16 inventou → 14/08 o
dono fechou a dedução → 15/08 o PRD substituiu). O histórico das três etapas ficou escrito
no topo de `lib/domain/saude.ts` justamente para que a terceira mudança, se vier, seja
consciente.

## Conflito 2 e 3 — Preços e os sete planos

**Decisão: adotar a tabela do §2 integralmente.** Commander R$ 49,90 · Commander Pro
R$ 69,90 · Captain Pro R$ 24,90 · Partner Prestador/Loja R$ 24,90 · Marina/Posto grátis ·
Restaurante/Pousada grátis inicialmente · Enterprise só como "Em breve".

**O plano fundador (R$ 69,99) foi aposentado.** O PRD FINAL não o menciona em lugar
nenhum, e havia **0 assinaturas** — ele nunca chegou a valer para ninguém. O mecanismo de
"preço promocional temporário" foi preservado porque o §2.1 tem uma promoção real
(migração de concorrente: R$ 24,90/mês por 3 meses) que precisa exatamente disso.

**Por quê:** preço é decisão comercial e normalmente eu não a tomaria. Duas coisas a
tornaram tomável: o PRD lista os valores em §28 sob o título literal *"Decisões
congeladas"*, e o banco confirma que ninguém é afetado.

## Conflito 4 — Free com 2 Diários

**Decisão: 2, como o PRD fecha em §2.3 e §28.**

**Este era um erro meu.** O PRD anterior dizia *"ex.: até 2 Diários"* e eu li o "ex.:" como
sugestão, implementando 20 na onda 38. O FINAL fecha em 2, sem "ex.".

**Regra de transição:** quem já tem mais de 2 registros **mantém todos**. O limite só vale
para criação nova. Isso não é gentileza — é o §23: *"preservando dados e histórico;
recursos pagos ficam bloqueados, não apagados"*.

## Conflito 5 — Aba Serviços eliminada

**Decisão: remover, com redirecionamento.** O §10 elimina a aba e o §27.2 transforma isso
em critério de aceite. Prestadores e empresas passam a ser encontrados no **Explorar**;
demandas ficam no **Marketplace**.

Ninguém cai em 404: os links antigos redirecionam para o destino correto.

## Conflito 6 — Admin com papéis e escopo

**Decisão: substituir `is_admin boolean` por papéis** — CEO/Super Admin, Suporte,
Comercial e Gold/Vistoriador. O §22 é literal: *"Admin deve operar por permissões de
função, não por simples 'admin=true'"*.

**O ponto que mais importa** é o escopo regional do Vistoriador: o §21 diz que ele acessa
*"somente as regiões autorizadas"* e *"não concede acesso nacional irrestrito"*. Isso é
regra de acesso a dado, então mora na RLS — um vistoriador de Angra não pode ler vistoria
de Salvador nem por chamada direta à API.

Os logs administrativos (§21.3) são **não apagáveis por administrador comum**, garantido
por RLS e revoke, não por convenção.

---

## Decisões menores tomadas junto

**Agenda ganha área própria** na matriz de permissões, com os vínculos existentes herdando
o valor de `diario` para ninguém perder acesso (mesmo padrão da migration 032, quando
`historico` herdou de `diario`).

**Agenda NÃO entra no menu de baixo**, apesar de o PRD chamá-la de "aba oficial". Lá cabem
5 itens e o próprio código já documenta que "Comandantes" não cabe em 11px. Trocar qual
das cinco sai é decisão de produto que ninguém pediu; o atalho da Início e o Menu resolvem
o acesso.

**Avaliação só existe depois de negócio confirmado bilateralmente** (§14) — e essa trava
está na RLS, porque é ela que sustenta a credibilidade do selo "Negócio confirmado pelo
Commander". Se a trava vivesse só na tela, o selo seria decorativo.

**Preço do Gold por porte é dado configurável, não constante no código** — o §20 exige
isso (*"Preço não deve ser hardcoded; configurável no Admin/Comercial"*), e a tabela do
§16 entra como valor inicial. "81+ pés — sob consulta" é um **estado**, não um preço: não
gera cobrança automática.

---

## O que continua fora, e por quê

| Item | Motivo |
|---|---|
| **Commander Enterprise** | §26 coloca no Upgrade 3; PRD manda exibir só como "reservado/Em breve" |
| **Jet Ski, cotas e cotistas** | §26 — Upgrade 3 |
| **Comissão do Marketplace** | §11.6 é explícito: *"Não cobrar comissão sobre transações no Upgrade 2"* |
| **Checklist técnico do Protocolo Gold** | §16: *"será desenvolvido separadamente pelo fundador e não precisa ser inventado pelo programador"* |
| **Commander Connect / telemetria** | §26 — Upgrade 3 |
| **Chat Commander e Seguro náutico** | Dependem de parceiro externo; nenhuma integração iniciada |
| **Cartas náuticas da Marinha** | A própria Marinha declara os GeoTIFF como *"fins acadêmicos, não devem ser usados como auxílio à navegação"*. Embutir em app comercial pago exige parecer jurídico — não é decisão de engenharia |
| **Base regulatória (NORMAM/UE/IMO)** | Módulo grande **e** exposição jurídica: se o app afirmar conformidade e errar, a responsabilidade é do dono |

---

## O que eu NÃO verifiquei

Vale dizer com todas as letras, porque a diferença importa: **as telas novas não foram
abertas no navegador com sessão real**. A verificação foi tipo (`tsc`), unitária (Vitest) e
de banco (SQL contra a RLS de produção, em transação revertida). Financeiro, Agenda,
Marketplace, Avaliações e os painéis de Admin nunca renderizaram para um usuário logado.

Isso significa que erro de layout, de estado vazio e de fluxo entre telas **não teria sido
pego**. Um passe no emulador com login real continua pendente.
