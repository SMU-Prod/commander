# Upgrade 3 em ondas — Cotas Enterprise e 3D do Motor

> Decisão do dono, 18/08/2026: os dois PRDs **não são produtos novos**. São
> ondas dentro do Commander. E o 3D é **só do motor** — não do barco.

Este documento traduz `PRD-UPGRADE-3-COTAS.docx` e `PRD-3D-ENGINE.pdf` em
ondas do projeto, dizendo em cada uma **o que já existe** e **o que é novo**.
Nada aqui inventa escopo: cada onda aponta a seção do PRD que a manda existir.

A última onda entregue foi a **63** (dourado como confete, escala de
gravidade, campo de arquivo). O Upgrade 3 começa na **64**.

---

## O que o código já tem — e que muda o tamanho do trabalho

Antes de estimar qualquer coisa, o levantamento do que está de pé:

| O PRD pede | Estado hoje |
|---|---|
| Plano Enterprise | **Já existe** como `commander_enterprise` em `lib/domain/planos.ts`, com `disponibilidade: "em_breve"` e o comentário "Definição no Upgrade 3". Falta preço, faixas e capacidade. |
| Múltiplas unidades por conta | **Já existe** — Commander Pro faz 4 embarcações com visão consolidada (`limiteEmbarcacoes`, `financeiro_consolidado`). Enterprise estica o mesmo mecanismo até 40. |
| Interface por tipo de embarcação (Jet ≠ lancha) | **Fundação existe** — `embarcacoes.tipo` (enum `tipo_embarcacao`, migration 056). Falta a interface específica de PWC. |
| Avarias | **Já existe** — `ocorrencias`, com estado, gravidade, anexo, autor e histórico. |
| Agenda operacional | **Já existe** — área `agenda` na matriz de permissões, com tela. |
| Financeiro por unidade | **Já existe** — lançamentos, recorrentes, relatórios, consolidado. |
| Documentos, fotos, histórico, contatos | **Já existem**, todos com permissão por área. |
| Permissões por área | **Já existe** — 15 áreas em `ABAS`, jsonb por vínculo, aplicado no banco via `permissao()` (não só escondendo botão). É exatamente o que o §22 do PRD Enterprise exige. |
| Perfis ADM Geral / ADM / Operações / Mecânica / Cotista | **NÃO existe.** `vinculos.papel` hoje é só `PROP \| CMDT`. |
| Módulo Afazeres | **NÃO existe.** O §20 do PRD Enterprise diz "reaproveitar módulo de Afazeres já existente" — não há nenhum no código. É construção, não reaproveitamento. |
| Régua de aprovação por usuário/ação | **NÃO existe.** |
| Estoque, Combustível/tanque, Mecânica, Orçamentos, Votação | **NÃO existem.** |
| Hierarquia Fabricante → Família → Modelo → Componente → Part Number | **NÃO existe.** `equipamentos.marca` e `.modelo` são texto livre. |

Duas correções que o PRD de Cotas precisa receber: **Afazeres não existe** (é
onda nova, não adaptação) e **os cinco perfis não existem** (o `papel` de
hoje tem dois valores).

---

## Bloco A — 3D do Motor (ondas 64 a 68)

O 3D é uma camada **dentro da ficha do motor** (`/barco/equipamento/[id]`).
Regra que o §1 e o §27 do PRD repetem e que vale como trava de todas estas
ondas: **a ausência de modelo 3D nunca pode impedir o módulo Motor de
funcionar.** Se o 3D quebrar, some o botão — nada mais.

### Onda 64 — A hierarquia de peça (PRD 3D §16) — **ENTREGUE 18/08/2026**

Migrations 057 (estrutura + RLS) e 058 (semente: 12 fabricantes, 13
famílias, 23 modelos, 144 componentes). `lib/domain/catalogo-motor.ts` com
28 testes. Seletor de catálogo no cadastro e na edição do motor, identidade
na ficha, campo "Código da peça" no item monitorado.

**Decisão registrada:** `part_number_oem` e os intervalos de manutenção
nascem NULOS na semente. Código OEM inventado faria o dono comprar a peça
errada; intervalo chutado num app que existe pra avisar de manutenção
estraga motor. Os dois vêm do manual — ou seja, do levantamento da onda 65
— ou não vêm. O que foi semeado é a estrutura mecânica, que é fato: um D6
tem filtro de óleo, impelidor, trocador de calor e anodo.


A única onda do bloco que **não depende de você nem de terceiro**, e a que
dá valor mesmo se o 3D nunca sair.

O §16 é explícito: *"o banco de manutenção não pode depender do 3D"*. Hoje
um motor é `marca: "Volvo Penta"`, `modelo: "D6-440"` em texto livre — dois
donos digitam diferente e o app não sabe que é o mesmo motor. A onda cria o
catálogo (Fabricante → Família → Modelo → Variante/Ano) e deixa
`equipamentos` apontar pra ele, **sem perder o texto livre**: motor já
cadastrado continua funcionando, e o catálogo é um vínculo opcional por
cima.

`itens_monitorados` (que já é o "componente com plano de manutenção") ganha
`part_number_oem` e o vínculo opcional com o componente do catálogo. Isso
fecha a corrente do §30 — componente → peça → status → manutenção →
histórico — **sem uma linha de 3D**.

Entrega: catálogo com as famílias do §23 (Volvo D4/D6/D8/D11/D13, Mercury
115–450 e Verado, Yamaha F150–F450, MerCruiser), busca no cadastro de motor,
Part Number na ficha do item.

### Onda 65 — Levantamento de licença (PRD 3D §19 a §22) — **pesquisa, não código**

O §19 é uma trava jurídica com todas as letras: *não assumir que arquivo
disponível para download pode ser copiado, convertido, hospedado,
redistribuído ou exibido comercialmente*. O §22 pede a entrega como planilha
classificada 🟢 apto / 🟡 autorização necessária / 🔴 não utilizar / ⚪ não
encontrado.

Eu levanto e entrego a planilha. **A decisão do que pode ser usado é sua** —
é risco jurídico do Commander, não escolha técnica. Nenhuma fonte entra no
app sem o seu 🟢.

Sem esta onda, a 66 não tem o que importar legalmente.

### Onda 66 — Visualizador nível 1 e o ciclo da solicitação (§5 a §11, §12 nível 1)

Os quatro estados do §3 (disponível / importado / aguardando integração /
não disponível), o botão `ABRIR EM 3D` na ficha do motor, o visualizador com
girar/zoom/pan/reset/fullscreen/touch, e o pipeline de importação
(validação → conversão → otimização → GLB) rodando no servidor — o §25 é
claro que o STEP original não vai pro celular.

Junto vem o `SOLICITAR MODELO 3D` do §7 com os campos já preenchidos, o
ranking do §8 (com a trava contra inflar pedido repetido) e a notificação do
§9 quando o modelo chega.

Depende de: onda 65 (licença) e do **GLB que você ia gerar**.

### Onda 67 — Hotspots e peça clicável (§12 níveis 2 e 3, §13 a §15)

O §13 explica por que hotspot vem antes de mesh clicável: a maioria dos
arquivos CAD não tem a peça separada de forma utilizável. Então: hotspot
posicionado sobre o componente (com `component_id` apontando pro item
monitorado da onda 64) e, quando o asset permitir, o mapeamento
mesh → componente.

O toque na peça abre o painel do §15: status, part number, última troca,
horas, próxima, e as ações `VER HISTÓRICO` / `REGISTRAR MANUTENÇÃO` /
`DOCUMENTAÇÃO`. É aqui que o 3D deixa de ser enfeite e vira interface de
manutenção.

Exploded view (nível 4) o próprio §12 dispensa do MVP.

### Onda 68 — Admin 3D Library (§17, §18, §29)

Painel administrativo: Modelos, Solicitações (o ranking), Fontes, Licenças,
Assets, Componentes, Hotspots. Mais as métricas do §29.

---

## Bloco B — Cotas Enterprise (ondas 69 a 77)

O PRD já vem faseado em P0/P1/P2 (§24) e as ondas seguem essa fase.

### Onda 69 — Conta empresarial, perfis e aprovação (P0, §3, §22) — **ENTREGUE 18/08/2026**

Migration 059. `lib/domain/enterprise.ts` com 26 testes. Cinco papéis como
presets da matriz que já existe, régua de aprovação por vínculo, trilha de
auditoria append-only, e as cinco faixas de preço Enterprise no catálogo
(travadas para venda).


A onda que destrava todas as outras. Três coisas:

Os **cinco perfis** — hoje `papel` tem dois valores (`PROP`, `CMDT`) e o
Enterprise pede ADM Geral, ADM, Operações, Mecânica, Cotista. Aqui a boa
notícia é que a matriz de 15 áreas com jsonb por vínculo, aplicada no banco,
já é a máquina certa: o perfil vira um preset de permissões, como
`completo`/`operacional` já são hoje.

A **régua de aprovação** do §3 — sem aprovação / somente críticos / tudo
exige aprovação, configurável por usuário e por ação. Com a regra que não
tem exceção: publicação da Mecânica pro cotista **sempre** passa pelo ADM,
mesmo com mecânico de confiança.

A **auditoria** do §22 — autor e data/hora em todo lançamento, antes/depois
nas alterações relevantes, quem aprovou e quando, quem publicou. E, escrito
no próprio PRD: permissão aplicada no backend, não escondendo botão. Isso o
Commander já faz e é o padrão a manter.

Junto: ativar `commander_enterprise` com as faixas do §2 (5/10/20/30/40
unidades, R$ 199,90 a R$ 999,90), que hoje está com preço `null`.

### Onda 70 — Commander Jet e o pátio (P0, §5, §6) — **ENTREGUE 18/08/2026**

A ficha específica de PWC do §5 (propulsão jet: impeller, wear ring, intake
grate, jet pump) — a fundação é o `embarcacoes.tipo` que já existe.

E o §6, que é o coração operacional: check-out e check-in pelo celular, com
horas, combustível, estado, fotos, hora automática e responsável; a
comparação entre os dois; e a conversão imediata em avaria quando o retorno
acusa problema. Botão grande, poucos passos — é ferramenta de pátio.

### Onda 71 — Cotistas (P0, §13, §16) — **ENTREGUE 18/08/2026**

Convite por link com vagas (1/10 … 10/10), bloqueio ao atingir o limite,
remoção que libera vaga. Viewer da própria unidade. Chat só com a
administradora. Bloqueio por inadimplência com auditoria — lembrando que o
§13 diz que **a cobrança acontece fora do Commander**; o app só reflete o
estado que o ADM marca.

Relatório oficial do §16: gerado **uma vez** pelo ADM e consultado por todos
os cotistas — não é cada viewer gerando o seu.

### Onda 72 — Mecânica, orçamentos e votação (P1, §7, §9)

Módulo de mecânica sem virar ERP de oficina (o §7 avisa). Orçamentos com
fornecedor, peças, valor, validade e anexo. Votação do §9: aprovar / não
aprovar, sem comentário no voto, com auditoria de quem votou e quando.

Trava do §9 que precisa estar visível no produto: o Commander **não executa
pagamento** e **não determina juridicamente o quórum** da empresa.

### Onda 73 — Estoque e Combustível (P1, §10, §11)

Estoque com mínimo, múltiplas bases, movimentação com autor, e baixa
automática quando a peça é usada numa manutenção.

Tanque próprio com entrada, saída com destino obrigatório, e o balanço do
§11: saldo inicial + entradas − saídas = teórico, comparado com a medição
física, e divergência exigindo justificativa com autor e data/hora.

### Onda 74 — Financeiro Enterprise (P1, §12)

Escopo fechado por decisão do PRD: **só operação**. Nada de cobrança de
cotista, venda de cota, receita comercial ou contabilidade societária.

O que entra sozinho: combustível, mecânica confirmada, estoque consumido,
avaria, documentação. Com a regra anti-duplicidade do §12 — ao registrar o
serviço, perguntar se as peças já estão no valor.

### Onda 75 — Plano individual do cotista (P1, §14, §15)

R$ 24,90/mês. Meu Uso, fotos de recebimento/entrega, histórico com
procedência, diário pessoal, relatórios pessoais, envio estruturado ao ADM.

Duas travas de copy que o §14 escreve explicitamente e que valem como regra
de produto: **não usar linguagem de "prova jurídica"** ou garantia contra
cobrança, e deixar claro que o acesso básico da administradora continua
disponível sem assinar nada.

O §15 fecha o ciclo: nada que o cotista envia altera o registro oficial
sozinho — vai pro hub "Atualizações dos Cotistas" e o ADM incorpora ou
arquiva, com procedência preservada.

### Onda 76 — Storage externo (P1, §18)

Google Drive via OAuth 2.0 na conta da empresa, com o Commander guardando
metadados e referência, não o arquivo pesado. O §18 chama isso de "requisito
fundamental" e manda constar como requisito do Upgrade 3, não como ideia
futura. Vídeo de check-in/out é o caso que justifica.

### Onda 77 — Afazeres e importação de frota (§20, §21)

Afazeres é **construção nova**, não adaptação (o PRD supõe que existe). Com
a regra do §20: não gerar tarefa automática pra cada alerta.

Importação de frota por planilha (§21) — empresa com 40 unidades não cadastra
uma a uma.

### P2 — fora das ondas por ora (§24)

Reservas somente leitura quando houver API, Commander Connect compatível,
OneDrive.

---

## Ordem sugerida

A **64** primeiro, sem discussão: é a única que não depende de terceiro, e a
hierarquia de peça melhora a ficha do motor mesmo que o 3D demore.

Depois a decisão é sua e é comercial, não técnica: o bloco B é onde está o
dinheiro (R$ 199,90 a R$ 999,90/mês contra R$ 49,90 do Commander), e o bloco
A é diferenciação do produto que já vendemos.

A **65** (levantamento de licença) pode rodar em paralelo a qualquer coisa,
porque é pesquisa e termina numa planilha pra você decidir.

---

## O que trava, e em quem

| Trava | Depende de |
|---|---|
| Onda 66 em diante | O GLB do motor que você ia gerar |
| Onda 66 em diante | Sua decisão sobre as fontes classificadas na onda 65 |
| Onda 69 | Preço final das faixas Enterprise — o §2 diz que são "faixas preliminares, revisáveis após medir infraestrutura e suporte em clientes-piloto" |
| Onda 76 | Conta Google Cloud e credencial OAuth da empresa |
| Bloco B inteiro | Vercel/Supabase Pro — 40 unidades e centenas de viewers por conta muda a régua de infra |
