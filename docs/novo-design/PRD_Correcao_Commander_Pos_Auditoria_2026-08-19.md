# PRD de Correção do Commander — Pós-Auditoria

**Versão:** 1.0  
**Data:** 19 de agosto de 2026  
**Documento de origem:** `Relatorio_Auditoria_Commander_2026-08-19.md`  
**Status:** pronto para implementação faseada  
**Produto:** Commander — gestão técnica, operacional e financeira de embarcações

## 1. Objetivo

Corrigir os problemas funcionais, de dados e de experiência encontrados na auditoria do ambiente publicado, preservando as decisões já aprovadas dos Upgrades 1 e 2 e mantendo o Upgrade 3/Enterprise como domínio separado.

Este PRD deve ser executado por fases. A IA de programação não deve alterar simultaneamente todos os módulos nem fazer uma reescrita geral do aplicativo.

## 2. Resultado esperado

Ao final das fases:

- cada objeto do barco terá cadastro próprio;
- documentos, itens de segurança e componentes não serão armazenados como manutenção;
- motores e horímetros terão fluxo confiável;
- formulários impedirão dados vazios ou inválidos;
- Estoque e Combustível gerarão custos rastreáveis na Frota;
- votações respeitarão a existência e o estado dos cotistas;
- telas serão divididas em resumo, listas, detalhes e formulários próprios;
- nenhuma imagem fictícia será apresentada como se fosse o ativo real do proprietário;
- permissões, autoria e histórico serão preservados.

## 3. Regras já aprovadas que não podem ser quebradas

### 3.1 Separação dos Upgrades

- Upgrade 2: proprietário, barco, hubs técnicos, Diário, Agenda, Financeiro, ocorrências, parceiros, Explorar e Marketplace.
- Upgrade 3: cotas/cotistas, Sócios, Enterprise, Pátio, Mecânica corporativa, Afazeres, Estoque, Combustível e Frota.
- Não misturar cobrança de cotas, mensalidade de cotista ou venda de cota no Financeiro Enterprise.
- Financeiro Enterprise é exclusivamente administrativo-operacional.

### 3.2 Hierarquia de acesso

- Proprietário é a autoridade principal da embarcação.
- Comandante recebe permissões concedidas pelo proprietário.
- Tripulante operacional não pode delegar permissões nem receber autoridade superior à de quem o convidou.
- Permissão por hub: Sem acesso, Visualizar ou Editar.
- Remover acesso não remove autoria nem histórico.
- Limite atual: até dois acessos de tripulação por embarcação nos planos Commander e Commander Pro.

### 3.3 Planos mantidos neste PRD

- Free: uma embarcação e dois registros completos de Diário; restante em demonstração/paywall.
- Commander: R$ 49,90/mês, uma embarcação e até dois acessos.
- Commander Pro: R$ 69,90/mês. O limite deve permanecer configurável enquanto a decisão comercial entre quatro e cinco embarcações é finalizada; não codificar o número em múltiplos componentes.
- Este PRD não altera preço nem abre cobrança.

### 3.4 Horas de motor

- O Commander não calcula horímetro usando a duração da saída.
- A leitura é manual e individual por motor/gerador.
- O sistema pode sugerir a atualização após uma saída, mas o usuário informa o valor visto no painel.

### 3.5 Fotos

- Nunca gerar fotografia fictícia para representar o barco, motor, peça, colete, extintor ou equipamento real do usuário.
- Antes do upload, usar ícone ou ilustração técnica neutra.
- O estado vazio deve solicitar uma foto real.

## 4. Estratégia de implementação

### Fase 0 — Correções emergenciais

Corrigir sem reestruturar todo o produto:

1. encoding e hidratação;
2. leitura de horímetro;
3. validação numérica e obrigatoriedade;
4. Agenda sem destinatários;
5. votação com zero cotistas;
6. estado encerrado do Marketplace;
7. permissão administrativa do Connect;
8. textos e pluralização.

### Fase 1 — Separação dos modelos de dados

Criar entidades próprias para:

- plano de manutenção;
- documento;
- item de segurança;
- componente do casco;
- componente hidráulico;
- componente elétrico;
- equipamento;
- foto/anexo.

Migrar gradualmente os registros existentes sem apagar histórico.

### Fase 2 — Integração Enterprise e Financeiro

- custo de estoque;
- custo médio do combustível;
- eventos financeiros automáticos;
- procedência e idempotência;
- estados corretos de orçamento/votação;
- vínculo entre orçamento, serviço, unidade e cotistas.

### Fase 3 — Reorganização visual

- página do Barco;
- detalhe do Motor;
- Segurança, Casco, Hidráulica, Elétrica e Documentos;
- Partner/Marina;
- Mecânica Enterprise.

### Fase 4 — Papéis, dispositivos e integrações

- testes separados de Cotista, Comandante, Tripulação, Suporte, Comercial e Vistoriador;
- uploads reais;
- e-mail;
- GPS;
- Signal K/NMEA;
- pagamentos.

## 5. Fase 0 — Especificação detalhada

## 5.1 FIX-001 — Corrigir encoding e inconsistência de renderização

**Rotas afetadas:** `/mecanica`, `/atualizacoes` e qualquer componente compartilhado que mostre caracteres corrompidos.

### Requisitos

- aplicação, banco, servidor e respostas devem trabalhar em UTF-8;
- garantir `<meta charset="utf-8">` no documento raiz;
- remover conversões manuais duplicadas entre UTF-8 e Latin-1;
- o texto renderizado no servidor deve ser idêntico ao texto após hidratação;
- adicionar teste com: `Mecânica`, `Atualizações`, `Diagnóstico`, `Orçamento`, `Não aprovação`, `Embarcação`.

### Critérios de aceite

- nenhum `Ã`, `Â` ou caractere equivalente aparece nas rotas auditadas;
- não ocorre mudança do texto após hidratação;
- snapshot do servidor e snapshot do navegador contêm os mesmos textos.

## 5.2 FIX-002 — Criar leitura de horímetro estruturada

**Rotas:**

- origem: `/barco/equipamento/:id`;
- nova rota recomendada: `/barco/equipamento/:id/horimetro/novo`.

### Campos

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| equipamento_id | UUID oculto | Sim | Pertence à embarcação ativa |
| leitura_horas | decimal | Sim | >= 0, no máximo uma casa decimal |
| data_hora | datetime | Sim | Padrão: agora |
| origem | enum | Sim | manual, pos_saida, connect |
| observacao | texto curto | Não | Máximo 300 caracteres |

### Regras

- bloquear leitura menor que a leitura atual;
- permitir correção administrativa somente com motivo obrigatório e trilha de auditoria;
- salvar evento de histórico `leitura_horimetro`;
- atualizar o valor atual do equipamento na mesma transação;
- o botão “Informar leitura” nunca deve abrir o formulário genérico do Diário;
- remover suporte ao tipo vazio `leitura_horas` no formulário genérico.

### Critérios de aceite

- clicar em “Informar leitura” abre o motor correto;
- informar 120,5 atualiza o motor e cria histórico;
- informar 119 após 120,5 é bloqueado;
- falha na gravação do histórico desfaz a atualização do motor.

## 5.3 FIX-003 — Validação comum de números, dinheiro e datas

### Componentes reutilizáveis

- `DecimalInput` para metros, horas, litros e quantidades;
- `IntegerInput` para ano, quantidade inteira e ordem;
- `MoneyInputBRL` para valores;
- `PercentInput` para combustível;
- `PhoneInputBR` para telefone;
- validadores equivalentes no servidor.

### Regras mínimas

| Dado | Regra |
| --- | --- |
| Ano da embarcação/equipamento | inteiro entre 1900 e ano atual + 1 |
| Comprimento, boca e calado | decimal maior que zero |
| Potência | decimal maior que zero |
| Horas | decimal maior ou igual a zero |
| Combustível percentual | inteiro entre 0 e 100 |
| Litros e capacidade | decimal maior que zero |
| Quantidade de estoque | decimal maior ou igual a zero |
| Estoque mínimo | decimal maior ou igual a zero |
| Porte em pés | decimal maior que zero |
| Valor monetário | decimal maior ou igual a zero |
| Intervalo de datas | data final >= data inicial |

### Mensagens

- não usar somente “valor inválido”;
- exemplo: `Informe um comprimento maior que zero, em metros.`;
- manter valor digitado após erro;
- focar o primeiro campo inválido.

### Critérios de aceite

- `ano errado`, `-20 metros`, `muito`, porcentagem 120 e valor negativo são bloqueados no cliente e servidor;
- vírgula e ponto são aceitos na entrada brasileira e normalizados no armazenamento;
- nenhum cálculo usa string monetária.

## 5.4 FIX-004 — Campos obrigatórios do Enterprise

### Pátio

- horas na saída: obrigatório;
- combustível na saída: obrigatório;
- horas na chegada: obrigatório;
- combustível na chegada: obrigatório;
- retorno não pode ter horímetro inferior ao da saída;
- condição antes/depois: opcional;
- problema marcado exige descrição.

### Mecânica

- abrir serviço exige problema informado e data de entrada;
- concluir exige conserto feito;
- se valor informado, deve ser válido e não negativo;
- orçamento exige serviço proposto, fornecedor, valor e validade;
- orçamento deve estar vinculado a uma unidade e, opcionalmente, a um serviço.

### Afazeres

- título obrigatório;
- destino obrigatório;
- prazo opcional;
- se ligado a unidade, unidade obrigatória.

### Estoque

- nome, categoria, unidade e quantidade inicial obrigatórios;
- retirada exige quantidade positiva e unidade de destino;
- retirada não pode deixar saldo negativo;
- ajuste exige motivo.

### Combustível

- tanque exige nome, tipo de combustível e capacidade;
- saldo inicial entre zero e capacidade;
- entrada exige litros e custo total ou preço por litro;
- saída exige litros e unidade ou destino livre;
- medição divergente exige motivo.

## 5.5 FIX-005 — Bloquear votação sem cotistas

### Domínio

Estados de orçamento:

- rascunho;
- aguardando_publicacao;
- em_votacao;
- aprovado;
- reprovado;
- encerrado_sem_quorum;
- cancelado;
- expirado.

### Regras

- Mecânica pode criar orçamento, mas não publica diretamente para cotistas sem ação autorizada do ADM;
- botão de publicar votação disponível apenas para ADM autorizado;
- exigir pelo menos um cotista ativo com acesso à unidade;
- congelar a lista de eleitores elegíveis ao publicar;
- cada voto contém cotista, decisão, data/hora e versão da votação;
- decisão disponível ao cotista: `Aprovar` ou `Não aprovar`;
- resultado e contadores devem ser derivados dos votos, não digitados;
- `0/0` nunca é uma votação válida;
- ao encerrar, o rótulo não pode continuar `Em votação`.

### Critérios de aceite

- unidade com zero cotistas não exibe ação de publicar;
- tentativa direta pela API retorna erro de regra de negócio;
- encerramento muda estado e texto na mesma transação;
- histórico registra autor e horário.

## 5.6 FIX-006 — Agenda sem destinatários

### Regras

- se apenas o proprietário possui acesso, habilitar somente `Só pra mim`;
- `Compartilhado` e `Atribuído a alguém` ficam desabilitados;
- mostrar: `Convide um comandante ou tripulante para compartilhar compromissos.`;
- CTA: `Convidar tripulação` → `/tripulacao`;
- quando houver pessoas elegíveis, selecionar pelo menos uma para Compartilhado;
- Atribuído exige exatamente um responsável;
- o servidor deve continuar validando a regra.

### Critérios de aceite

- o usuário não consegue selecionar um estado impossível;
- nenhuma submissão falha por ausência de um campo que não apareceu.

## 5.7 FIX-007 — Marketplace encerrado

### Regras

- estados: rascunho, aberto, em_negociacao, resolvido, cancelado, expirado;
- pedido resolvido/cancelado não aparece nas listas abertas nem gera novos avisos;
- remover textos de pedido ativo do detalhe encerrado;
- detalhe encerrado deve mostrar motivo, autor e data do encerramento;
- contato deixa de ser revelado a novas pessoas após encerramento;
- respostas anteriores permanecem no histórico conforme a regra de privacidade.

### Critérios de aceite

- após cancelar, o detalhe não diz `Seu pedido está publicado`;
- nenhum Partner novo recebe ou visualiza o pedido como oportunidade aberta.

## 5.8 FIX-008 — Leitura administrativa do Connect

### Requisitos

- criar política/função de banco para leitura agregada e autorizada;
- CEO/Super Admin: acesso nacional;
- perfis autorizados específicos: somente escopo necessário;
- não abrir acesso aos dados técnicos completos da embarcação;
- registrar visualização/exportação sensível no log administrativo;
- exibir contadores e lista de interesses sem erro de permissão.

## 5.9 FIX-009 — Textos e pluralização

- corrigir `2 embarcaçãoões` para `2 embarcações`;
- criar helper de pluralização para unidade, embarcação, cotista, proposta e ocorrência;
- revisar linguagem por papel: proprietário não deve ver `Região que você atende` em preferências pessoais;
- não mostrar termos internos de desenvolvimento ao cliente final.

## 6. Fase 1 — Novo modelo de objetos do barco

## 6.1 Princípio central

Uma coisa física ou documental não é uma manutenção. A manutenção é um plano ou evento vinculado a essa coisa.

### Relações

```text
Embarcação
├── Equipamentos
│   ├── Motor
│   ├── Gerador
│   ├── Bateria/Banco
│   ├── Painel
│   └── Outro equipamento
├── Componentes
│   ├── Casco
│   ├── Elétrica
│   └── Hidráulica
├── Itens de segurança
├── Documentos
├── Planos de manutenção
├── Fotos/Anexos
├── Ocorrências
└── Eventos de histórico
```

## 6.2 Entidade `maintenance_plan`

| Campo | Regra |
| --- | --- |
| id | UUID |
| boat_id | obrigatório |
| subject_type | boat, equipment, component, safety_item |
| subject_id | obrigatório conforme subject_type |
| name | obrigatório |
| specification | opcional |
| part_number | opcional |
| interval_hours | opcional, > 0 |
| interval_months | opcional, > 0 |
| fixed_due_date | opcional |
| last_service_date | opcional |
| last_service_hours | somente para ativo com horímetro |
| status | calculado |

Pelo menos um vencimento deve existir: horas, meses ou data fixa.

Campos de óleo/filtro só aparecem quando o assunto é Motor ou Gerador.

## 6.3 Entidade `document`

### Campos

- tipo: TIE, Seguro, Nota fiscal, Manual, Certificado, Licença, Outro;
- nome;
- número;
- órgão/emissor;
- emissão;
- validade;
- arquivo;
- observação;
- status calculado;
- visibilidade/permissão.

### Regras

- TIE não deve existir simultaneamente como texto solto e documento divergente;
- manter um único registro canônico;
- novo documento em tela própria ou painel acionado por botão;
- edição nunca mostra campos de óleo, filtro, OEM ou horas.

## 6.4 Entidade `safety_item`

### Categorias

- Salvatagem;
- Combate a incêndio;
- Sinalização;
- Primeiros socorros;
- Comunicação de emergência;
- Outro.

### Campos

| Campo | Obrigatório | Observação |
| --- | --- | --- |
| categoria | Sim | Taxonomia |
| nome | Sim | Ex.: Colete classe III |
| quantidade | Sim | Inteiro positivo |
| localização | Sim | Ex.: armário de popa |
| fabricante | Não |  |
| modelo | Não |  |
| número de série | Não |  |
| validade | Condicional | Quando aplicável |
| último teste | Condicional | Quando aplicável |
| próximo teste | Condicional | Quando aplicável |
| foto real | Não | Estado vazio orientado |
| certificado | Não | Imagem ou PDF |
| observações | Não |  |

Manutenções/inspeções são vinculadas ao item, não substituem o cadastro do item.

## 6.5 Componentes de Casco

### Categorias

- Deck;
- Fibra;
- Inox;
- Vidros;
- Estofados;
- Pintura/gelcoat;
- Apêndices;
- Outro.

### Campos

- nome;
- categoria;
- localização/zona;
- material;
- fabricante/modelo quando aplicável;
- condição atual;
- foto real;
- observação;
- planos de manutenção vinculados.

Não mostrar campos de óleo/filtro.

## 6.6 Componentes Hidráulicos

### Sistemas

- Água doce;
- Grey Water;
- Black Water;
- Água salgada;
- Porão/drenagem;
- Outro.

### Campos

- nome;
- sistema;
- tipo de componente: tanque, bomba, vaso, válvula, mangueira, filtro, sensor, outro;
- capacidade quando aplicável;
- fabricante/modelo;
- localização;
- condição;
- foto real;
- manutenção vinculada.

## 6.7 Componentes Elétricos

### Tipos

- Bateria;
- Banco de baterias;
- Carregador;
- Inversor;
- Painel;
- Alternador;
- Gerador;
- Sensor;
- Outro.

Campos condicionais por tipo: tensão, capacidade Ah, química, quantidade, data de instalação, fabricante, modelo, série e último teste.

## 6.8 Equipamento dinâmico por tipo

O formulário `/barco/equipamento/novo` deve mudar conforme `tipo`.

### Campos comuns

- tipo;
- nome/identificação;
- zona;
- posição quando aplicável;
- fabricante;
- modelo;
- série;
- ano;
- foto real;
- observação.

### Motor

- potência HP;
- combustível;
- horímetro;
- posição BB/BE/Central;
- catálogo opcional.

### Gerador

- potência kW;
- combustível;
- horímetro;
- tensão/frequência;
- não usar placeholder `Motor 1`.

### Bateria/Banco

- tensão;
- capacidade Ah;
- química;
- quantidade;
- data de instalação;
- não mostrar combustível ou horímetro.

### Outro

- não mostrar potência HP, combustível ou horas por padrão;
- permitir ativar `Este equipamento possui horímetro`.

## 7. Fotos e anexos

## 7.1 Entidade comum

`asset_media`:

- id;
- boat_id;
- subject_type;
- subject_id;
- kind: foto, documento, certificado;
- storage_key;
- caption;
- uploaded_by;
- uploaded_at;
- source_role;
- is_cover;
- mime_type;
- file_size;
- width/height para imagem.

## 7.2 Estado vazio obrigatório

Exemplo do Motor BB:

```text
[ícone técnico de motor]
Foto real do Motor BB ainda não adicionada
Fotografe o conjunto instalado e a plaqueta de identificação.
[Adicionar foto real]
```

### Regras

- nunca usar foto criada por IA como se fosse o ativo;
- permitir foto geral e foto da plaqueta;
- permitir múltiplos uploads quando o objeto aceitar álbum;
- permitir escolher capa do barco;
- mostrar autoria da imagem;
- validar JPG, PNG e WebP; PDF apenas em documento/certificado;
- definir limite de tamanho configurável;
- remover metadados sensíveis quando necessário, preservando orientação.

## 8. Fase 2 — Enterprise e Financeiro

## 8.1 Estoque com custo

Adicionar ao item:

- custo unitário atual;
- método de custo: custo médio ponderado inicialmente;
- fornecedor padrão;
- código interno/OEM quando aplicável.

### Entrada

- quantidade;
- valor total ou unitário;
- fornecedor;
- data;
- comprovante opcional.

Recalcular custo médio em uma transação.

### Retirada

- quantidade;
- unidade obrigatória;
- serviço opcional;
- motivo;
- custo calculado pelo custo médio;
- criar lançamento operacional na unidade.

## 8.2 Combustível com custo médio

### Entrada no tanque

- litros;
- valor total ou preço por litro;
- fornecedor;
- data;
- recalcular custo médio do saldo.

### Saída para unidade

- litros;
- unidade;
- custo = litros × custo médio no momento;
- criar lançamento na categoria Combustível;
- vincular `fuel_movement_id`.

### Proteções

- não permitir saldo negativo;
- não permitir saldo acima da capacidade sem confirmação administrativa e motivo;
- movimento e lançamento financeiro na mesma transação;
- chave idempotente impede lançamento duplicado.

## 8.3 Lançamento financeiro com procedência

Adicionar:

- `origin_type`: manual, estoque, combustivel, mecanica, documento, ocorrencia;
- `origin_id`;
- `boat_id`;
- `fleet_id` quando aplicável;
- `created_by`;
- `paid_at`/competência;
- `audit_metadata`.

### Regras

- lançamento automático não pode trocar livremente de Despesa para Entrada;
- correção cria histórico;
- excluir origem não apaga silenciosamente lançamento; usar estorno ou cancelamento auditável;
- Frota agrega apenas custos operacionais das unidades.

## 8.4 Mecânica

Separar a página em:

- lista de serviços;
- detalhe do serviço;
- orçamentos do serviço;
- votação;
- histórico.

### Serviço

- problema informado;
- diagnóstico;
- unidade;
- entrada;
- estado;
- responsável/oficina;
- conserto realizado;
- horas de mão de obra;
- valor final;
- peças consumidas;
- fotos/anexos;
- histórico.

### Estados

- Em diagnóstico;
- Aguardando orçamento;
- Aguardando aprovação;
- Aguardando peça;
- Em conserto;
- Concluído;
- Cancelado.

Concluir com valor final cria custo de Manutenção uma única vez.

## 9. Fase 3 — Arquitetura de telas

## 9.1 Padrão de detalhe de hub

Toda tela de detalhe deve ter:

1. cabeçalho compacto;
2. foto real ou estado vazio com ícone;
3. estado e alertas;
4. até cinco indicadores;
5. abas reais;
6. ação principal;
7. menu de ações secundárias.

As abas devem trocar o conteúdo, não apenas rolar a mesma página.

## 9.2 Detalhe do Motor

### Cabeçalho

- Motor BB;
- marca/modelo;
- foto real/ícone;
- estado;
- posição e zona;
- CTA `Informar leitura`.

### Abas

- Visão geral;
- Manutenções;
- Sistemas;
- Documentos e fotos;
- Histórico.

### Visão geral

- horímetro atual e autoria da última leitura;
- próxima manutenção;
- potência/combustível/ano/série;
- alertas ativos;
- não repetir todas as listas das outras abas.

## 9.3 Segurança

### Resumo

- válidos;
- atenção;
- vencidos;
- sem informação.

### Lista

- foto/ícone;
- nome;
- quantidade;
- localização;
- validade/próximo teste;
- estado.

CTA `Cadastrar item de segurança`, nunca `Nova manutenção`.

## 9.4 Documentos

- lista principal sem formulário aberto permanentemente;
- CTA `Adicionar documento`;
- upload/substituição dentro do detalhe do documento;
- filtros: Todos, Vencidos, Atenção, Em dia, Sem arquivo;
- miniatura somente do arquivo real;
- nenhum campo de motor ou peça.

## 9.5 Barco

Organizar em:

- identidade e foto de capa;
- Saúde da embarcação;
- Motores;
- hubs técnicos;
- documentos e vencimentos;
- ocorrências recentes;
- ações administrativas em menu separado.

Não exibir todos os formulários ou históricos na página inicial do Barco.

## 9.6 Partner/Marina

Dividir cadastro em etapas:

1. tipo e identificação;
2. região e mapa;
3. serviços/estrutura;
4. vagas, somente para Marina;
5. contato;
6. fotos;
7. prévia e publicação.

Campos devem mudar pelo tipo do Partner. Prestador não recebe campos de Marina; Marina não recebe campos profissionais de tripulação.

## 10. Diário e Ocorrências

## 10.1 Campos mínimos por tipo

### Manutenção

- data;
- ativo/componente;
- serviço realizado;
- responsável/prestador;
- custo opcional;
- leitura de horas quando aplicável;
- anexos;
- plano renovado opcional.

### Abastecimento

- data;
- combustível;
- litros;
- preço por litro ou total;
- fornecedor;
- horas dos motores opcional;
- tanque cheio;
- comprovante.

### Navegação

- data;
- saída/retorno;
- origem/destino;
- tripulação estruturada;
- passageiros;
- checklist;
- observações;
- atualização posterior dos horímetros.

### Docagem

- entrada/saída;
- estaleiro;
- motivo;
- serviços;
- fotos antes/depois;
- custos;
- anexos.

## 10.2 Unificação Avaria/Ocorrência

- Avaria no Diário deve criar ou vincular uma Ocorrência;
- não manter dois estados concorrentes;
- ocorrência é o objeto operacional;
- Diário registra o evento cronológico;
- uma ocorrência possui estado, severidade, setor, ativo, descrição, fotos, responsável, custos e histórico.

Estados:

- Nova;
- Em avaliação;
- Orçamento;
- Aguardando reparo;
- Em reparo;
- Resolvida;
- Anulada.

## 11. Agenda

Adicionar de forma faseada:

- data/hora inicial;
- data/hora final;
- dia inteiro;
- responsável;
- compartilhados;
- recorrência;
- lembrete;
- vínculo com item/documento/ocorrência;
- `Bloquear embarcação para reservas` quando o módulo de Sócios estiver ativo.

Privacidade da Agenda de Sócios deve mostrar apenas responsável/reservante e período conforme as regras do Upgrade 3.

## 12. Permissões

### Matriz base

| Ação | Proprietário/ADM | Comandante com editar | Tripulação operacional | Cotista viewer | Mecânica Enterprise |
| --- | --- | --- | --- | --- | --- |
| Editar embarcação | Sim | Se concedido | Não | Não | Não |
| Informar horímetro | Sim | Se concedido | Se concedido | Não | Se atribuído |
| Criar Diário | Sim | Sim | Se concedido | Plano/permissão específica | Não |
| Editar plano de manutenção | Sim | Se concedido | Não | Não | Se atribuído |
| Criar orçamento Enterprise | Sim | Não | Não | Não | Sim |
| Publicar votação | ADM autorizado | Não | Não | Não | Não |
| Votar | Não como ADM, salvo também cotista elegível | Não | Não | Sim | Não |
| Ver Financeiro do proprietário | Sim | Se concedido | Não | Não | Não |
| Ver Financeiro Enterprise | ADM autorizado | Não | Não | Não | Conforme função |

Todas as permissões devem ser validadas no servidor.

## 13. Migração de dados

## 13.1 Proibição

- não apagar a tabela genérica antes da migração completa;
- não perder IDs, autoria, datas, anexos ou histórico;
- não migrar por nome livre sem regra determinística e relatório.

## 13.2 Classificação inicial

Usar o alvo atual:

- `eq:*` → plano de manutenção vinculado a equipamento;
- `cat:seguranca` → candidato a item de segurança ou manutenção de segurança;
- `cat:deck/fibra/inox/vidros/estofados` → componente/plano de casco;
- `cat:hidraulica_*` → componente/plano hidráulico;
- documentos conhecidos Seguro/TIE → entidade Documento.

### Regra de ambiguidade

Se o registro não puder ser classificado com segurança:

- manter registro legado;
- marcar `migration_status = needs_review`;
- disponibilizar fila administrativa de revisão;
- nunca escolher silenciosamente.

## 13.3 Etapas

1. criar novas tabelas;
2. adicionar adaptadores de leitura;
3. duplicar gravação somente onde necessário e por período curto;
4. executar migração idempotente;
5. gerar relatório de contagem antes/depois;
6. validar amostra;
7. trocar leitura para entidades novas;
8. congelar gravação no modelo antigo;
9. remover legado apenas em versão posterior e com backup.

## 14. Testes obrigatórios

## 14.1 Unitários

- validadores numéricos;
- cálculo de vencimento;
- custo médio de estoque;
- custo médio de combustível;
- estados de votação;
- permissões por hub;
- pluralização;
- normalização monetária.

## 14.2 Integração

- leitura de horímetro + histórico;
- saída do Pátio + retorno + ocorrência;
- entrada de combustível + saída + lançamento financeiro;
- entrada de estoque + retirada + lançamento financeiro;
- serviço concluído + custo único;
- votação com cotistas elegíveis;
- Agenda compartilhada com e sem destinatário;
- cancelamento do Marketplace.

## 14.3 E2E por papel

- Proprietário;
- Comandante com Visualizar;
- Comandante com Editar;
- Tripulação;
- Cotista;
- ADM Enterprise;
- Operações;
- Mecânica;
- CEO/Super Admin;
- Suporte;
- Partner.

## 14.4 Regressão mínima

- login;
- troca de embarcação;
- criação de Diário;
- upload de documento;
- alertas de vencimento;
- Financeiro manual;
- Marketplace;
- Explorar;
- Pátio;
- importação de Frota.

## 15. Observabilidade e auditoria

- log estruturado para falha em automação financeira;
- alerta para movimento operacional sem lançamento esperado;
- log de mudança de estado de votação;
- log de correção regressiva de horímetro;
- métricas de erro por formulário;
- registrar versão da aplicação responsável pela gravação;
- painel administrativo de registros `needs_review` da migração.

## 16. Definição de pronto

Uma fase só está pronta quando:

- código implementado;
- migration revisada e reversível;
- validação no cliente e servidor;
- testes unitários e integração aprovados;
- critérios de aceite demonstrados;
- nenhuma regressão no fluxo anterior;
- textos em português revisados;
- permissão testada com conta do papel correspondente;
- documentação técnica atualizada;
- ambiente de preview validado antes de produção.

## 17. Ordem de execução para a IA de programação

### Lote 1 — sem migration estrutural

1. FIX-001 Encoding;
2. FIX-002 Horímetro;
3. FIX-003 Validação comum;
4. FIX-006 Agenda;
5. FIX-007 Marketplace;
6. FIX-009 Textos.

### Lote 2 — regras de negócio e banco

1. FIX-004 Obrigatoriedade Enterprise;
2. FIX-005 Votação;
3. FIX-008 Connect;
4. testes de permissão.

### Lote 3 — novas entidades

1. Documento;
2. Item de segurança;
3. Plano de manutenção;
4. Componentes de Casco/Hidráulica/Elétrica;
5. Equipamento dinâmico;
6. migração.

### Lote 4 — custos Enterprise

1. Estoque;
2. Combustível;
3. lançamento com procedência;
4. Frota;
5. Mecânica.

### Lote 5 — redesign

1. componente padrão de detalhe;
2. Motor;
3. Segurança;
4. Documentos;
5. Barco;
6. Partner;
7. Mecânica.

## 18. Instrução de execução

Enviar este PRD junto com o relatório de auditoria. Orientar a IA:

```text
Implemente apenas o lote solicitado. Antes de alterar código, liste as rotas,
componentes, tabelas e migrations afetadas. Preserve regras dos Upgrades 1 e 2
e mantenha o Upgrade 3/Enterprise separado. Não apague dados legados. Toda
validação deve existir no cliente e no servidor. Entregue migration reversível,
testes, critérios de aceite executados e resumo dos arquivos alterados. Pare ao
final do lote e aguarde validação antes de iniciar o próximo.
```

## 19. Primeira entrega recomendada

Começar agora pelo **Lote 1**. Ele corrige problemas visíveis e críticos sem exigir a grande migração de objetos. Após publicar o Lote 1 em preview, repetir a auditoria das rotas afetadas antes de iniciar o Lote 2.
