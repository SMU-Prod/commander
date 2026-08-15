# COMMANDER — PRD CONSOLIDADO
### Documento único · Upgrade 2 · Consolidado em 15/08/2026

---

## 0. O que é este documento, e por que ele existe

Existiam **cinco** documentos soltos, escritos em momentos diferentes, que se
corrigiam parcialmente uns aos outros. Ninguém conseguia responder "qual é a
regra hoje?" sem abrir os cinco e cruzar na cabeça. Pior: dois deles davam
respostas diferentes para a mesma pergunta (preço, limite do Free, aba
Serviços), e a versão que estava implementada seguia a resposta antiga.

Este documento é a fusão dos cinco. **A partir dele, ele é a fonte única.**

### As fontes, na ordem em que foram escritas

| # | Documento | Linhas | O que é |
|---|---|---|---|
| 1 | `upgrade2-master.txt` | 2.141 | O PRD Master original — o mais **detalhado** (84 seções). Campo por campo de cada hub. |
| 2 | `upgrade2-correcoes.txt` | 377 | 20 correções sobre o Master. Não substitui: **corrige**. Quase todo sobre o "Commander Review", que foi abolido. |
| 3 | `commander-connect.txt` | 112 | O Commander Connect (NMEA 2000). Assunto próprio. |
| 4 | `conversa-bruta.txt` | 225 | A conversa crua com as decisões e **o porquê** de cada uma. Não é especificação, é a memória do raciocínio. |
| 5 | `upgrade2-master-final.txt` | 626 | O mais **recente**. Declara-se *"FEATURE FREEZE FUNCIONAL"* e diz: *"decisões anteriores que conflitem com este PRD devem ser consideradas substituídas"*. |

### Regra de precedência (foi isto que faltava)

Quando dois documentos discordam:

1. **O FINAL (5) vence** — ele mesmo declara isso.
2. **As Correções (2) vencem sobre o Master (1)** — é a função delas.
3. **O Master (1) preenche o que o FINAL não repete.** Esta é a parte que se
   perdia: o FINAL é um *upgrade*, não uma reescrita. Ele não repete a lista de
   campos de cada hub porque ela não mudou. Quem lê só o FINAL acha que o
   detalhe sumiu — não sumiu, continua valendo.
4. **A conversa bruta (4) não decide nada sozinha**, mas explica o porquê. Onde
   ela é a única fonte de uma decisão, está marcado como tal.

> **Como ler as marcas neste documento**
> `[M]` veio do Master · `[C]` veio das Correções · `[F]` veio do FINAL ·
> `[CV]` veio da conversa bruta · `[CN]` veio do Commander Connect
> `⚠️` = ponto que ainda precisa de decisão do dono

---

## 1. Visão e princípios

O Commander é plataforma de **gestão** e **ecossistema** náutico: centraliza a
vida operacional e técnica da embarcação e conecta o proprietário a pessoas,
parceiros e oportunidades do mercado. `[F]`

**Princípio de arquitetura — o mais importante do documento:** a **EMBARCAÇÃO é
uma entidade própria**. Usuários recebem *acesso* a ela. O histórico técnico não
é conteúdo da conta do proprietário; é do barco. É isso que permite transferir o
barco preservando a memória técnica. `[M][F]`

### 1.1 Princípios de UX (todos são critério de aceite)

- **Nunca usar porcentagem para "Saúde da Embarcação".** `[F][CV]`
- **Vermelho + "!" é reservado a alerta crítico**, principalmente Segurança. `[M][F][CV]`
- Evitar linguagem interna de software ("gerar checkout", CRUD, objeto). Linguagem de cliente. `[F]`
- Registros importantes preservam **autoria e data/hora**. `[F]`
- **Evitar dupla digitação**: se um hub já conhece o dado, os outros reutilizam. `[F]`
- **Free é demonstração interativa, não versão paralela do app.** `[F]`

---

## 2. Perfis, planos e paywalls `[F]` — substitui qualquer preço anterior

| Perfil / Plano | Preço | Regra principal |
|---|---|---|
| Proprietário Free | R$ 0 | 1 embarcação; **2 Diários completos**; resto em demonstração/paywall |
| **Commander** | **R$ 49,90/mês** | 1 embarcação; até 2 acessos de tripulação; gestão completa |
| **Commander Pro** | **R$ 69,90/mês** | Até 4 embarcações; até 2 acessos por embarcação; visão consolidada |
| Captain Free | R$ 0 | Acesso operacional conforme permissões; carreira profissional bloqueada |
| **Captain Pro** | **R$ 24,90/mês** | Perfil profissional, Marketplace, candidaturas, disponibilidade, Explorar completo |
| Partner — Prestador | **R$ 24,90/mês** | Perfil ativo, Explorar, oportunidades, propostas, histórico comercial |
| Partner — Loja Náutica | **R$ 24,90/mês** | Perfil ativo, Explorar, demandas de produto |
| Partner — Marina | Grátis | Perfil completo + Marketplace **de vagas**. Destaques pagos à parte |
| Partner — Posto | Grátis | Perfil completo + Solicitações de Caminhão. Destaques à parte |
| Partner — Restaurante | Grátis inicialmente | Perfil no Explorar + cardápio em imagens |
| Partner — Pousada/Hotel | Grátis inicialmente | Perfil no Explorar + acomodações |
| Commander Enterprise | A definir | **Exibir só como "reservado / Em breve"** — Upgrade 3 |

**Razão dos poucos acessos, para usar no próprio anúncio:** *"você não dá a
chave da sua casa para todos"*. `[CV]`

### 2.1 Promoção de migração de concorrente `[F][CV]`
- R$ 24,90/mês por **3 meses**.
- Nos mesmos 3 meses: **20% de desconto** na avaliação Commander Gold.
- Depois: preço normal do Commander.
- **Não acumula** com a entrada direta pelo Gold.

### 2.2 Entrada direta pelo Gold `[F][C16]`
- Não assinante contrata a avaliação Gold pelo preço integral.
- Aprovada a embarcação: **6 meses de Commander incluídos**.
- Ao fim dos 6 meses, cobrança normal se continuar.

> ⚠️ **Pendência:** a conversa bruta menciona *"se adquirir o selo de ouro antes
> do plano, 30% de desconto"* `[CV]`, número que **não aparece** no FINAL. Ou foi
> substituído pelos 6 meses grátis, ou é um terceiro benefício. **Precisa de
> decisão.**

### 2.3 Free — comportamento detalhado `[F][CV]`
- Cadastra 1 embarcação e preenche dados básicos.
- Cria e consulta **exatamente 2** Diários completos.
- Navega pelos hubs **sem consumir a gestão**: cadeado + proposta de upgrade.
- Explorar: alguns Partners aleatórios só com **foto + nome**; qualquer detalhe,
  contato ou ação comercial bloqueado.
- Marketplace: preenche o fluxo da demanda, mas **Publicar** aciona o paywall.
- Agenda e Financeiro: vê a estrutura, não cria.
- **Não adiciona tripulação.**

---

## 3. Navegação e dashboards `[F]`

**Proprietário:** Dashboard · Embarcação · Agenda · Financeiro · Explorar ·
Marketplace · Minha Conta/Assinatura/Acessos

**Captain:** Início · Embarcações · Diário · Agenda · Marketplace · Explorar ·
Perfil Profissional · Minha Conta

**Partner:** o menu muda conforme o tipo. O nome exibido é **o tipo real**
("Prestador de Serviço", "Loja Náutica", "Marina"). *"Commander Partner"* é o
nome do plano/ecossistema B2B, não o rótulo na tela. `[F][CV]`

### 3.4 Dashboard do proprietário
Cabeçalho da embarcação (foto, nome, modelo, base) · **Saúde** (SAUDÁVEL /
ATENÇÃO / AÇÃO NECESSÁRIA, sem porcentagem) · bloco **"Precisa da sua atenção"**
ordenado por criticidade · cards dos 7 hubs · última navegação, ocorrências
abertas, próxima manutenção, próximo vencimento, atividade recente · ações
rápidas (Novo Diário, Registrar manutenção, Registrar ocorrência, Atualizar
horas) · publicidade **no máximo uma unidade por vez**, carrossel de até 5,
sempre **abaixo** da área operacional. `[F][CV]`

> ⚠️ **Ponto levantado em 15/08 e ainda aberto:** o Diário de Bordo é descrito
> como o coração do app, mas hoje é um atalho pequeno no dashboard e **não tem
> vaga no menu inferior**, enquanto "Comandantes" (vitrine) tem. A pergunta não é
> se cabem 6 abas — é **quais 5 merecem a vaga**. **Precisa de decisão.**

---

## 4. Embarcação e hubs técnicos
*(o FINAL resume; o detalhe campo a campo vem do Master e continua valendo)*

### 4.1 Dados gerais `[M][F]`
Nome, foto, ano, estaleiro, modelo, comprimento, boca, calado, material e número
do casco, TIE, capitania, propulsão, marina/base.

### 4.2 Motores `[M][F]`
- Cada motor é **entidade independente** (BB e BE separados).
- Identificação: marca, modelo, serial, identificação interna, ano, potência,
  combustível, posição.
- **Horas atuais e histórico são informados manualmente** ou por integração
  futura. **O Diário NUNCA soma horas automaticamente.** `[CV]` — ver §6.
- Próxima revisão tem data **e** horas independentes: **vence quando qualquer um
  dos dois for atingido primeiro**.
- **Óleo**: especificação, quantidade, última troca, horas da troca, próxima troca.
- **Filtros**: óleo, combustível, ar, outros — cada um com status próprio.
- Histórico por evento: data, horas, serviço, prestador, valor opcional,
  observação, anexo.
- Anexos: nota fiscal, relatório, manual, garantia, fotos.

### 4.3 Casco `[M][F]`
Categorias: Deck, Fibra, Inox, Vidros, Estofados, **Outros**. Cada uma com
estado, última intervenção, avarias, manutenções, ocorrências, anexos, histórico.

### 4.4 Elétrica `[M][F]`
- **Baterias**: tipo, quantidade, data da última troca, observações, histórico.
- **Gerador**: marca, modelo, serial, horas, última e próxima manutenção — mesma
  regra "horas OU data, o que ocorrer primeiro".
- **Sistema/painel de bordo**: cadastro das informações pertinentes.

### 4.5 Hidráulica `[M][F]`
Água doce, Grey Water, Black Water e componentes cadastráveis. Cada um com
estado, manutenção, ocorrência, observação, histórico.

### 4.6 Segurança `[M][F]`
Itens com quantidade, validade, último teste, manutenção, estado, anexos,
ocorrências. **Alerta crítico de Segurança usa vermelho + "!" e sobe para o
Dashboard.**

### 4.7 Equipamentos `[M][F]`
Área **flexível**: o que existir a bordo e o dono quiser acompanhar. Nome,
categoria, marca, modelo, serial, instalação, estado, manutenção, prestador,
observações, fotos/documentos, histórico. *Itens não aplicáveis simplesmente não
precisam existir.*

### 4.8 Documentação `[M][F]`
Tipos: TIE, seguro, vistoria, licenças, certificados, propriedade e outros
cadastráveis. Campos: tipo, número, emissor, emissão, validade, arquivo,
observação, status. **Alertas: 30, 15, 5 dias e vencido.**

### 4.9 Fotos e contatos `[M][F]`
- **Álbuns**: Exterior, Interior, Convés, Documentação visual, **Outros**.
  Limite de armazenamento por plano em fase posterior; havendo limite, mostrar
  espaço usado, disponível e upgrade.
- **Contatos** (lista **pessoal** de confiança): nome, empresa, especialidade,
  telefone, e-mail, observações, avaliação pessoal, histórico de serviços.
  *Não precisam ter conta no Commander.*

---

## 5. Saúde, alertas e notificações `[F]`

| Estado | Regra |
|---|---|
| **SAUDÁVEL** | Nenhum item crítico vencido e nenhuma ocorrência crítica aberta |
| **ATENÇÃO** | Existe item próximo do limite ou pendência não crítica |
| **AÇÃO NECESSÁRIA** | Existe ao menos uma pendência crítica |

**O pior estado relevante prevalece. Nunca porcentagem.**

> A Saúde é baseada **somente** no que está registrado no Commander e **não
> representa declaração de navegabilidade**. Esta frase precisa aparecer na tela.

**5.1 Manutenção por horas:** antecedência **configurável** pelo usuário/prestador.
50 horas é sugestão padrão, **não regra universal**.

**5.2 Central de Notificações:** sino com contador. Filtros: Todas, Embarcação,
Agenda, Marketplace, Financeiro. Três níveis — **críticas** (in-app + push, com
destaque), **importantes** (push quando exigem ação ou envolvem outra pessoa),
**informativas** (normalmente só in-app). E-mail para conta, segurança,
assinatura, Gold e comunicações formais. **Notificações respeitam as permissões
do usuário.** Oportunidades semelhantes são **agrupadas** para evitar spam.

---

## 6. Diário de Bordo — o coração do app `[M][F][CV]`

**Abertura:** data, hora de saída, **local de saída**, destino/rota, comandante,
tripulação/ajudante, **passageiros**.

**Checklist operacional:** Motores, Casco, Elétrica, Hidráulica, Segurança —
com atalho **"Tudo OK"**.

**Durante:** ocorrência, foto, abastecimento, observação.

**Encerramento:** hora e local de chegada, observações, abastecimento, checklist
final, ocorrências.

### A regra do horímetro — repetida em três documentos, então é séria
O Commander calcula **somente o TEMPO DE PASSEIO** entre abertura e
encerramento. No fechamento pergunta: *"Deseja atualizar as horas dos motores?
SIM/NÃO"*. Se SIM, o usuário **digita manualmente** e confirma.

> **NUNCA inferir nem somar horas de motor pela duração do passeio.** `[CV]`:
> *"definimos que NÃO MEXE COM HORA... hora de motor SOMENTE SE PREENCHER
> MANUALMENTE"*. Motor não gira o passeio inteiro — fundeio, almoço, parada. Somar
> antecipa troca de óleo e distorce a Saúde.

**Ocorrências do Diário** são encaminhadas ao hub correspondente e mantêm
referência ao Diário de origem.

**Cada Diário finalizado tem relatório independente permanente.** Existe
**Relatório Mensal do Diário**, separado do Resumo Mensal geral. `[CV]`

---

## 7. Histórico, ocorrências e memória técnica `[F]`

Duas visualizações: **Linha do Tempo** e **Ocorrências**.

**Ciclo da ocorrência:** ABERTA → EM ACOMPANHAMENTO → RESOLVIDA. Pode também ser
**anulada com registro** quando criada por engano.

- Ocorrência pode gerar manutenção/reparo, custo e resolução.
- Cada hub mostra uma **visão filtrada do mesmo histórico central** — não duplicar.
- Registros finalizados **não são apagados silenciosamente**; rascunhos podem.
- **Remover o acesso de um usuário nunca apaga o que ele criou.** Autoria e data
  permanecem no histórico da embarcação.

---

## 8. Agenda `[F][CV]`

Aba oficial. **O usuário não "cria uma agenda", cria compromissos.**

- **Agenda normal**: só o que ele criou ou compartilharam com ele. Limpa.
- **Agenda Detalhada**: acrescenta camadas técnicas com filtro — manutenções
  programadas, documentos, segurança, tarefas, serviços e financeiro.
- *"A agenda não pode estar poluída com os afazeres do cotidiano"* `[CV]` —
  histórico do que já foi feito não polui a agenda normal.
- Visualizações: **Mês, Semana e Lista**.
- Compromisso pode ser particular, compartilhado ou atribuído.
- Caso de uso literal: o proprietário cria **"Saída sábado — 08:00"** e
  compartilha; aparece na agenda do comandante. `[CV]`
- Comandante só cria/compartilha se tiver **"Gerenciar eventos da embarcação"**.
- **Receber um compromisso não concede acesso ao hub relacionado.**

---

## 9. Financeiro e Carteira da Tripulação `[F][CV]`

> Contexto competitivo declarado: *"ONSAILING É FORTE NO FINANCEIRO, PRECISAMOS
> SER BOM TAMBÉM. Não precisamos ser melhores, mas no mínimo igual."* `[CV]`

### 9.1 Financeiro
Subabas: **Visão Geral · Lançamentos · Recorrentes · Relatórios**.
Ações universais **+ Despesa** e **+ Entrada** — o Financeiro **nunca depende de
integração de hub**.

Campos: categoria, descrição, valor, data, pago/pendente (ou recebido/pendente),
fornecedor/origem opcional, forma de pagamento opcional, comprovante, observação.

Categorias sugeridas: Marina/Vaga · Combustível · Manutenção · Tripulação ·
Seguro · Documentação/Taxas · Limpeza/Conservação · Peças/Equipamentos ·
Transporte · Outros.

Hubs onde fizer sentido mostram **"Adicionar ao Financeiro"** — a ação cria **o
mesmo lançamento central, não uma cópia**.

> **Orçamento/proposta não é despesa.** Só gasto efetivado entra.

### 9.2 Recorrentes
Semanal, mensal, trimestral, semestral, anual. Um vencimento **não** é
automaticamente pago — o usuário marca. Alteração de valor permite *"somente
este"* ou *"este e os próximos"*.

### 9.3 Relatórios
Mensal, anual e período personalizado: despesas, entradas, saldo, recorrentes vs
variáveis, por categoria, média mensal, maior categoria, comparação entre
períodos. **Commander Pro: visão consolidada de todas as embarcações + filtro
individual.**

### 9.4 Carteira da Tripulação
> **O Commander não guarda, transfere nem movimenta dinheiro.** É controle
> contábil de valores informados. Isto precisa estar dito **na tela**.

- Só o **proprietário** cria/libera uma Carteira, para um tripulante específico
  numa embarcação específica. Independe de Captain Free ou Pro.
- Repasse registrado **não vira despesa** — vira saldo sob responsabilidade do
  tripulante. `[CV]`
- Gasto do tripulante reduz o saldo **e** alimenta o Financeiro da embarcação.
- Proprietário escolhe: comprovante obrigatório ou opcional; e **Registro Direto**
  ou **Aprovação do Proprietário**.
- Pode haver devolução de saldo, confirmada pelo proprietário.
- **Financeiro completo e Carteira são permissões independentes.**

---

## 10. Explorar Parceiros `[F][CV]`

**Não existe aba "Serviços".** Prestadores e empresas são encontrados aqui.

Experiência principal: **cards quadrados/visuais** com foto, nome, categoria e
localização básica — *"cards quadradinhos com fotos que eles colocam"* `[CV]`.
Clique abre o perfil completo para quem é elegível.

Filtros: Todos · tipo de Partner · categoria/atividade · região.
**Categorias e regiões são padronizadas e compartilhadas com o Marketplace.**

Partner tem **um tipo principal** e pode ter **atividades complementares** sem
duplicar perfil.

Free: alguns Partners aleatórios com **foto + nome apenas**.

---

## 11. Marketplace `[F][CV]`

**Orientado por DEMANDA.** Não é feed para empresas anunciarem produto aleatório.

### 11.1 Os cinco tipos
| Tipo | Exemplo | Quem recebe |
|---|---|---|
| Preciso de profissional | eletricista em Angra | Prestadores por categoria + região |
| Preciso de tripulação | marinheiro sábado | Captains compatíveis |
| Compro / Procuro | rádio VHF | Lojas e Partners da categoria |
| Vaga para embarcação | vaga molhada para 80 pés | Marinas por região e capacidade |
| Solicitar caminhão | 1.500 L de diesel | Postos por combustível + região |

### 11.2 Formulários estruturados
Categorias, funções, regiões e campos **padronizados**. Texto livre é só
observação curta. *"Tem que preencher formulários prontos, nada de escreverem o
que querem"* `[CV]`.

**O Commander gera o título/cartão do anúncio a partir dos campos.**

Expiração: sem data específica → 30 dias; com data → o prazo da própria demanda.

### 11.3 Ofereço / Estou disponível
Só **Captain Pro** publica disponibilidade profissional estruturada.

### 11.4 Matching
**Simples e determinístico:** categoria/atividade + região + requisitos
específicos. O parceiro escolhe **no cadastro** suas regiões e áreas de
atuação — *"e aí aparece pra eles"* `[CV]`.

### 11.5 Propostas e candidaturas
Campos próprios por tipo (serviço, tripulação, produto, marina, posto).

### 11.6 Fechamento e histórico comercial
Solicitação → Proposta/Candidatura → Em negociação → Negócio realizado →
**Confirmação bilateral**. Um lado marca, o outro confirma ou nega. Valor final é
opcional e pode diferir do proposto.

Após confirmação: libera **avaliação** e oferece **"Adicionar ao Financeiro"**.

> **Não cobrar comissão no Upgrade 2.** Primeiro construir histórico comprovável
> de valor gerado.

---

## 12. Captain e carreira profissional `[F][CV]`

- Proprietário convida comandante → a conta vinculada funciona como **Captain
  Free**. Se já existir conta, **apenas vincular**; não duplicar usuário.
- **Captain Free opera a embarcação conforme as permissões do proprietário —
  isso não depende de Captain Pro.** É a regra que impede o pedágio no trabalho.
- **Captain Pro (R$ 24,90)** desbloqueia a camada profissional: perfil ativo,
  Explorar completo, Marketplace, candidaturas, disponibilidade, avaliações,
  histórico de trabalhos.
- **Captain Pro nunca concede acesso adicional à embarcação por si só.**
- Perfil: foto, função, região, experiência, certificações, embarcações/portes,
  disponibilidade, avaliações, trabalhos confirmados.

---

## 13. Commander Partner por tipo `[F][CV]`

**13.1 Prestador — R$ 24,90** · Início | Marketplace | Explorar | Meu Perfil |
Minha Conta. Dashboard com oportunidades compatíveis, propostas, negociações,
visualizações. Pode ativar **"Também vendo produtos"**.

**13.2 Loja Náutica — R$ 24,90** · com "Minha Loja". **Sem catálogo, estoque ou
carrinho no Upgrade 2.** Cadastra categorias e marcas; responde a demandas de
compra. Pode ativar **"Também presto serviços"** — *"aí eles vão poder se
candidatar ao pedido"* `[CV]`.

**13.3 Marina — grátis** · perfil com acesso náutico, estrutura, atracação.
**Vagas secas/molhadas**: total, disponíveis (informadas manualmente), porte
máximo, diária/mensal, preços opcionais. *"Informação de disponibilidade é
declarada pela Marina; não é estoque nem reserva transacional."* Marketplace da
Marina mostra **apenas demandas de vaga**.

**13.4 Posto — grátis** · função especial **Solicitações de Caminhão** (preço/L,
quantidade, data/período, taxa de deslocamento, estimativa). *"Não precisa
receber o Marketplace geral."*

**13.5 Restaurante — grátis inicialmente** · fotos separadas em estabelecimento e
**Cardápio (galeria de imagens, não cadastro de pratos)**. Sem reserva,
pagamento ou pedido.

**13.6 Pousada/Hotel — grátis inicialmente** · acomodações, valores opcionais,
check-in/out, acesso pelo mar. Sem calendário, booking ou pagamento.

---

## 14. Avaliações e contestações `[F]`

- **Somente após negócio confirmado bilateralmente no Commander.**
- 1 a 5 estrelas + comentário opcional.
- Perfil mostra média, quantidade e **"Negócio confirmado pelo Commander"**.
- **Uma resposta por avaliação**, com textos **padronizados** (§14.1 do FINAL traz
  as 12 frases literais — usar exatamente).
- Cliente edita a própria avaliação por **até 30 dias**.
- Nota **1 ou 2** libera **"Contestar avaliação"** (8 motivos literais em §14.2).
- Contestação **não remove automaticamente**. Admin analisa: **Manter** ou
  **Ocultar por violação**. **Admin nunca altera a nota.**
- Avaliado pode marcar **"Problema solucionado"**; cliente confirma ou nega. A
  nota **não muda automaticamente**.

---

## 15. Commander Verified `[C05][F]`

Verificação **digital** de cadastro e acompanhamento. **Não** representa inspeção
presencial, certificação técnica nem navegabilidade.

**Pilares:** motores cadastrados · manutenções acompanhadas · segurança
cadastrada · documentação acompanhada · histórico ativo.

**Sem porcentagem** — mostrar requisitos atendidos e o que falta.
**Visual:** navy/preto + prata, escudo + check, **sem dourado**.

Requisito deixou de ser atendido → **"Atualização necessária — 15 dias"** `[CV]`.
Regularizou no prazo, mantém. Não regularizou, **suspenso**. Ao corrigir,
reavaliação automática e reativação.

> **Ocorrência aberta não remove o Verified.** O selo mede **acompanhamento**,
> não ausência de defeitos.

---

## 16. Commander Gold `[C01–C20][F]`

> **REGRA MESTRE `[C20]`:** existem **apenas dois** selos — VERIFIED e GOLD.
> **Não existe "Commander Review".** Qualquer ocorrência do termo em documento
> antigo deve ser lida como "Commander Gold" ou "avaliação presencial para o
> Commander Gold". Nunca usar em botão, menu ou texto de cliente.

**Fluxo:** Solicitar Gold → pagamento → agendamento → avaliação presencial →
**Protocolo Commander** → análise → aprovado/reprovado → Gold ativo.

- **Gold = selo. Protocolo Commander = método.** Nada entre os dois. `[C10]`
- **Gold não depende de Verified.** `[C14]`
- Pode ser solicitado por proprietário, **vendedor** ou interessado/comprador,
  inclusive para **embarcação ainda não cadastrada**. `[C09]`
- **Quem paga:** EU → pagamento direto; INTERESSADO → link/QR. `[C08]`
- **Modal do Gold** `[C12]`: itens avaliados (motores, casco, elétrica,
  hidráulica, segurança, equipamentos, documentação, histórico) com estados
  ✓ Avaliado / ■ Atenção / N/A; data, validade, consultor, versão do Protocolo;
  CTA **Ver Relatório**.
- Expansão internacional usa **"COMMANDER GOLD — {região}"**, nunca "Review". `[C17]`

### Preços de referência `[C15][F]`
| Porte | Avaliação |
|---|---|
| Até 30 pés | R$ 1.990 |
| 31–40 pés | R$ 2.490 |
| 41–50 pés | R$ 3.490 |
| 51–60 pés | R$ 4.490 |
| 61–80 pés | R$ 5.990 |
| 81+ pés | **Sob consulta** (estado, não preço — não gera cobrança automática) |

Preço **não deve ser hardcoded**: configurável no Admin/Comercial.

> **O checklist técnico do Protocolo Commander será desenvolvido separadamente
> pelo fundador e não deve ser inventado pelo programador.** `[F]`

---

## 17. Transferência de propriedade `[M][F]`

**Acompanha o barco:** dados técnicos, motores, horas, manutenções, ocorrências
técnicas, relatórios, Gold, documentos técnicos compartilháveis.

**NÃO acompanha:** dados pessoais, **passageiros**, custos privados, informações
financeiras pessoais, dados sensíveis do proprietário anterior.

> Objetivo: preservar a **memória técnica** da embarcação sem transferir a **vida
> privada** do dono anterior.

---

## 18. Resumos `[F]`
Mensal, Semestral e Anual — um único modelo excelente. Consolida diários/uso,
horas, manutenções, ocorrências, casco, elétrica, hidráulica, segurança,
equipamentos, documentação, abastecimentos e gastos.
**Relatório Mensal do Diário é separado do Resumo Mensal geral.** O Financeiro
tem relatórios próprios.

---

## 19. Permissões e delegação `[F]`

Hierarquia: **Proprietário → Comandante principal → Tripulante operacional**.
Concessão por hub: **Sem acesso | Visualizar | Editar**.

Exclusivo do proprietário: plano/assinatura, transferência, gestão final de
acessos, criação de Carteira, permissões sensíveis.

- Com **"Gerenciar tripulação"**, o Captain adiciona Tripulante Operacional
  **somente** à embarcação a que já tem acesso.
- **Até 2 acessos por embarcação. Convite pendente ocupa vaga.**
- **Ninguém delega permissão maior que a própria.** Algumas não são delegáveis
  nem quando o Captain as tem: Financeiro completo, Carteira, plano, Gold,
  transferência, gestão do proprietário.
- **Remover vínculo remove acesso, nunca histórico.**
- A interface deve avisar que **não é recomendado conceder edição a toda a
  tripulação**. `[M]`

---

## 20. Publicidade e destaques `[F][CV]`

Regra única para **qualquer** Partner, pago ou gratuito.

Produtos: **Destaque no Explorar** · **Destaque superior** · **Patrocínio no
Dashboard**.

- **Preço configurável no Admin/Comercial, nunca hardcoded.**
- Dashboard: **um espaço visível por vez**, carrossel de até 5, **abaixo da área
  operacional**, identificado como **"Patrocinado"**. *"Obviamente sem poluir o
  dash"* `[CV]`.
- Segmentação mínima: **região**; categoria quando aplicável.
- **Publicidade nunca interfere na nota/reputação do Partner.**

> ⚠️ **Aberto:** o proprietário paga assinatura **e mesmo assim vê anúncio**. É o
> que este documento desenha. Se plano pago deve remover publicidade, a decisão
> é do §2. **Precisa de decisão.**

---

## 21. Admin Commander `[F][C19]`

Painel interno separado. O **CEO/Super Admin** é a conta-mãe que cria e gerencia
os demais administradores.

| Função | Escopo |
|---|---|
| **CEO / Super Admin** | Acesso total; cria/edita/suspende admins; métricas executivas; configurações críticas |
| **Suporte** | Usuários, embarcações, planos/status, chamados; **sem** configurações estratégicas críticas |
| **Comercial** | Partners, destaques, campanhas, publicidade, métricas comerciais |
| **Gold / Vistoriador** | Vistorias **somente nas regiões autorizadas**; agenda e registros de visita. **Não concede acesso nacional irrestrito** |

**21.1 Dashboard CEO:** receita/MRR, assinantes, novos, cancelamentos/churn;
embarcações ativas; planos por status; Partners ativos e gratuitos; pedidos,
propostas, negócios confirmados, volume informado, ticket médio; Gold
solicitados/pagos/agendados/ativos/expirados; publicidade (ativa, impressões,
cliques); regiões e categorias com maior atividade.

**Gold no Admin `[C19]`:** Solicitações · Pagamentos · Avaliações · Agendamentos ·
Consultores · Protocolos · Aprovados · Reprovados · Ativos · Expirados.

**21.2 Conteúdo padronizado:** o Admin controla categorias, marcas, regiões,
funções e tipos de Partner. Usuário pode **solicitar** inclusão; evitar duplicata
livre.

**21.3 Logs:** toda ação administrativa relevante registra quem, quando, função,
ação, entidade e mudança de status. **Logs não são apagáveis por administradores
comuns.**

---

## 22. Dados, auditoria e segurança `[F]`

- Toda alteração relevante registra **usuário e data/hora**.
- Anexo fica vinculado ao registro certo (a NF da revisão pertence à manutenção
  do Motor BB).
- **Isolamento entre embarcações e contas é obrigatório no backend.**
- Dados financeiros pessoais não são expostos por padrão a Captains/tripulantes.
- Carteira registra responsabilidade contábil, **nunca saldo bancário**.
- **Partner não recebe telefone/dados sensíveis do proprietário antes do ponto de
  liberação previsto no fluxo.**
- **Admin opera por permissões de função, não por "admin = true".**

---

## 23. Assinatura e ciclo de cobrança `[F]`

Modelar os estados **independentemente do gateway**.

Aprovado → ativa → libera na hora. Recusado → notificação + "problema de
pagamento" + reprocessamento. **Tolerância configurável, não hardcoded**, com
aviso claro antes de bloquear. Falha persistente/cancelamento → volta ao Free
aplicável, **preservando dados**; recursos pagos ficam **bloqueados, não
apagados**. Reativação restabelece.

**Downgrade Pro → Commander: não apagar embarcações excedentes**; bloquear a
gestão delas e exigir a escolha da ativa. Histórico de faturas em Minha Conta.

---

## 24. Estados vazios, erros e padrões UX `[F]`

| Situação | Comportamento |
|---|---|
| Sem dados | Explicar o valor da área e oferecer a ação principal |
| **Limite atingido** | Explicar o limite + CTA de upgrade; **nunca falhar silenciosamente** |
| Sem permissão | Mensagem de acesso não autorizado **sem revelar dados** |
| Convite pendente | Exibir status; permitir reenviar/cancelar a quem tem autoridade |
| Arquivo inválido | Informar formato/tamanho aceito e **preservar o resto do formulário** |
| Sair sem salvar | Confirmar descarte |
| Exclusão de rascunho | Confirmar |
| Registro técnico finalizado | Preferir **anular/corrigir com histórico** a excluir |
| Sem resultados | Manter filtros visíveis e sugerir ampliar região/categoria |
| Erro de rede | **Preservar o formulário** e permitir tentar de novo |

---

## 25. Commander Connect `[CN]` — Upgrade 3

Conectividade **NMEA 2000** para trazer dados de motor (horas, RPM,
temperatura, combustível, tensão) e automatizar o Diário.

- Protocolo é **NMEA 2000 (CAN, PGNs)** — diferente do NMEA 0183 usado hoje na
  sondagem colaborativa.
- Precisa de gateway (caixa própria ou de terceiro homologado).
- **No app hoje: apenas a tela "Em breve"**, vendendo a visão **sem prometer
  compatibilidade não homologada**.
- O §26 do FINAL coloca telemetria automática **fora do Upgrade 2**.

---

## 26. Fora do escopo — Upgrade 3 `[F]`

Jet Ski · embarcações em cota e cotistas · administradoras de cotas · definição
completa do Commander Enterprise · Commander Connected/hardware/telemetria ·
pagamento e split do Marketplace / comissão automática · e-commerce completo,
estoque, carrinho e catálogo de Loja Náutica · reservas internas de restaurante,
hotel e marina · protocolo técnico detalhado do Gold (documento à parte).

---

## 27. Critérios de aceite `[F]`

- Nada marcado como Upgrade 3 aparece como fluxo concluído no Upgrade 2.
- **Nenhum texto de cliente usa "Commander Review".**
- **Nenhum menu principal usa a antiga aba "Serviços".**
- **Diário nunca altera horímetro sem confirmação e entrada manual.**
- **Saúde nunca exibe porcentagem.**
- Alertas críticos de Segurança usam vermelho + "!".
- **Remoção de acesso nunca apaga histórico.**
- Free bloqueia valor mas **preserva dados criados** e apresenta upgrade claro.
- **Permissões aplicadas na interface E no backend/API.**
- Financeiro funciona sem integração de hub, via lançamento manual universal.
- Negócio só libera avaliação após confirmação bilateral.
- Admin respeita papel e escopo regional.

---

## 28. Decisões que ainda dependem do dono

Estas **não são engenharia**. Estão marcadas com ⚠️ ao longo do documento:

1. **Menu inferior**: o Diário é o coração do app mas não tem vaga fixa, e
   "Comandantes" tem. Quais 5 abas ficam? (§3.4)
2. **Desconto de 30% do Gold antes do plano** — aparece na conversa bruta, some
   no FINAL. Vale ou foi substituído pelos 6 meses? (§2.2)
3. **Plano pago remove publicidade?** Hoje o desenho diz que não. (§20)
4. **Uma assinatura viva por pessoa**: hoje um proprietário com Commander não
   consegue também assinar Captain Pro. O §12 tornou esse caso plausível — dono
   que também comanda o barco de outro.
5. **Migração do limite do Free**: quem já tem mais de 2 Diários mantém (§23 é
   explícito), mas confirmar a leitura.
6. **Consultores do Gold**: são equipe própria ou terceirizada por região? Muda a
   arquitetura do módulo Consultores.
7. **Critérios mínimos de aprovação do Gold** e o Protocolo Commander.

### Fora deste PRD, mas travando trabalho

8. **Cartas náuticas da Marinha (CHM)**: o site bloqueia download automatizado
   por firewall, e a própria Marinha declara que o material **não deve ser usado
   como auxílio à navegação**. Embutir em app comercial pago exige parecer
   jurídico.
9. **Base regulatória (NORMAM, UE, IMO, COLREG, SOLAS, MARPOL, STCW)**: módulo do
   tamanho de vários dos que já existem **e** exposição jurídica — se o app
   afirmar conformidade e errar, a responsabilidade é da empresa. Precisa de
   decisão de escopo e de parecer antes de qualquer linha de código.

---

*Consolidado de cinco documentos em 15/08/2026. Os originais permanecem em
`docs/prd/` para consulta e rastreabilidade. Quando este documento e um original
discordarem, **este vence** — a precedência que o gerou está na seção 0.*
