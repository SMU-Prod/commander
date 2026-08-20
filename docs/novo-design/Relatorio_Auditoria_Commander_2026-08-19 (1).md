# Relatório de Auditoria Funcional e UX — Commander

**Data:** 19 de agosto de 2026  
**Ambiente:** `https://commander-tau.vercel.app`  
**Sessão auditada:** usuário Dev com acessos de Proprietário, CEO/Super Admin e Partner/Marina  
**Objetivo:** percorrer todas as áreas acessíveis, inspecionar e preencher formulários, testar fluxos que dependem de gravação e identificar problemas antes da elaboração do PRD de correção.

## 1. Conclusão executiva

O Commander já possui uma arquitetura de produto extensa e diferenciada: dossiê técnico do barco, manutenção, Diário, Agenda, Financeiro, Marketplace, parceiros, Commander Gold e operação Enterprise. O problema principal não é falta de função. O problema é que várias funções foram colocadas na mesma tela ou construídas sobre o mesmo formulário, mesmo quando tratam de objetos completamente diferentes.

**Avaliação geral:** o produto está conceitualmente forte, mas ainda não está pronto para ser entregue a um proprietário comum sem acompanhamento. Um usuário náutico entenderá a intenção do sistema, porém poderá:

- cadastrar informações incorretas sem receber bloqueio;
- encontrar campos de motor ao cadastrar documento, casco, hidráulica ou segurança;
- não saber se está criando um item, uma manutenção ou um registro histórico;
- abrir estados impossíveis, como uma votação para zero cotistas;
- acreditar que um custo entrou no Financeiro quando ele não entrou;
- selecionar ações que só falham depois do envio;
- sentir que as páginas são longas, pesadas e “emboladas”.

O maior ganho não virá de trocar apenas cores, cards ou tipografia. A correção precisa começar pela **arquitetura dos dados e dos formulários**, depois reorganizar cada tela em camadas simples.

## 2. Escopo realmente auditado

Foram navegados e inspecionados os seguintes conjuntos de funções:

- Início, notificações e menu geral;
- Barco, edição da embarcação e localização;
- Motores, equipamentos, sistemas internos e horímetros;
- Casco, Elétrica, Hidráulica, Segurança e equipamentos gerais;
- Documentos, fotos, contatos, ocorrências, mapa, histórico, resumos, selos, Connect e transferência de propriedade;
- Diário de Bordo: manutenção, abastecimento, navegação, avaria, docagem, outro e leitura de horas;
- Agenda e compromisso vinculado a manutenção/documento;
- Financeiro: visão geral, lançamentos, entrada, despesa, recorrentes, relatórios e detalhe;
- Tripulação, comandantes, cotistas e atualizações;
- Marketplace: profissional, tripulação, produto, vaga de marina, caminhão de combustível e disponibilidade profissional;
- Explorar, prestadores, comandantes e perfil público de parceiro;
- Partner/Marina: dashboard, perfil, fotos, vagas, localização, conta e oportunidades;
- Enterprise: Pátio, Mecânica, Afazeres, Estoque, Combustível e Frota;
- Admin: administradores, usuários, embarcações vinculadas, Partners, publicidade, taxonomia, Gold, consultores, Marketplace, avaliações, logs, Connect e sondagem;
- Planos de Proprietário, Captain e Partner;
- Onboarding e importação de frota por planilha.

Também foram criados registros temporários identificados com `[TESTE AUDITORIA]` para abrir estados posteriores ao salvamento.

### Limitação da auditoria

Não foi possível comprovar a experiência completa de usuários logados exclusivamente como Cotista, Tripulação, Comandante, Suporte, Comercial ou Vistoriador Gold, pois a sessão disponível é a conta Dev/CEO. Também não foram testados pagamento real, recebimento de e-mail, upload de documentos reais, GPS real ou integração física NMEA/Signal K.

## 3. Testes com gravação realizados

Foram testados os seguintes fluxos reais no ambiente:

- saída e retorno no Pátio, incluindo geração automática de ocorrência;
- abertura e conclusão de serviço na Mecânica;
- criação de orçamento e votação de cotistas;
- criação, início e conclusão de tarefa;
- cadastro e retirada de item de estoque vinculada a unidade e serviço;
- criação de tanque, entrada e saída de combustível para uma unidade;
- criação de navegação no Diário e atualização posterior dos dois horímetros;
- tentativa de compromisso compartilhado e criação particular na Agenda;
- publicação e encerramento de pedido no Marketplace;
- cadastro e exclusão de item de segurança.

Os registros públicos ou que afetavam alertas foram encerrados, anulados ou excluídos quando a função existia. Alguns históricos permanecem porque o próprio Commander não oferece exclusão, o que é correto para trilhas de auditoria. Permaneceram identificados como teste: movimento do Pátio, navegação do Diário, tarefa concluída, serviço/orçamento mecânico, item/movimento de estoque e tanque/movimentos de combustível.

## 4. Problemas críticos — corrigir antes de uso com clientes

### C-01 — Um único formulário de “manutenção” está sendo usado para objetos diferentes

O mesmo formulário aparece ao cadastrar:

- manutenção de motor;
- item de casco;
- item de hidráulica;
- item de segurança;
- manutenção geral;
- e até ao editar documentos como Seguro e TIE.

Por isso, um usuário que tenta cadastrar colete, extintor, documento ou item do casco encontra campos como:

- especificação `15W40`;
- quantidade `4 L`;
- código OEM da peça;
- “É óleo ou filtro de motor?”;
- intervalo em horas;
- horas no último serviço.

**Impacto:** dados semanticamente errados, confusão extrema e impossibilidade de evoluir cada hub corretamente.

**Correção necessária:** criar esquemas e formulários separados para Documento, Item de Segurança, Componente do Casco, Sistema Hidráulico e Plano de Manutenção.

### C-02 — “Informar leitura” do motor está quebrado

O botão do motor abre `/diario/novo?tipo=leitura_horas&alvo=...`, porém o formulário carregado é o registro genérico do Diário. O campo oculto `tipo` fica vazio e não existe campo estruturado de horímetro. Aparecem apenas Data e Descrição.

**Impacto:** o principal atalho do detalhe do motor não executa sua função.

**Correção necessária:** criar formulário específico de leitura com equipamento, leitura atual, data/hora, origem e validação contra regressão do horímetro.

### C-03 — Campos essenciais do Enterprise não são obrigatórios

Nas páginas Mecânica, Afazeres, Estoque, Combustível e Pátio, quase todos os campos operacionais estão sem `required` e muitos são texto livre.

Exemplos possíveis hoje:

- serviço mecânico sem problema informado;
- orçamento sem serviço, fornecedor ou valor;
- tarefa sem título;
- item de estoque sem nome ou quantidade;
- tanque sem nome, combustível ou capacidade;
- saída/retorno com números inválidos.

**Impacto:** registros incompletos e relatórios não confiáveis.

### C-04 — Votação pode ser aberta com zero cotistas

Foi criado um orçamento em uma unidade configurada com `0` cotistas. Mesmo assim, o sistema exibiu “Abrir votação dos cotistas” e permitiu criar uma votação `0/0` com o texto “Nenhum cotista com acesso para votar”. Após encerrar, o card continuou mostrando “Em votação”, embora também mostrasse “Apurada em 19/08/2026”.

**Impacto:** estado de negócio impossível e resultado incoerente.

**Correção necessária:** bloquear votação se não houver cotistas ativos; separar estados Rascunho, Publicada, Aguardando votos, Aprovada, Reprovada, Encerrada sem quórum e Cancelada.

### C-05 — Combustível/Estoque não alimentaram o Financeiro como prometido

O sistema registrou:

- entrada de 100 L por R$ 600;
- saída de 50 L para a unidade `teste`;
- consumo calculado de 50 L/h;
- retirada de um filtro do Estoque vinculada à unidade e ao serviço mecânico.

Mesmo assim, o Financeiro e o Custo da Frota permaneceram sem novos lançamentos e sem procedência registrada. A própria tela da Frota afirma que saídas de Estoque e Combustível entram no Financeiro com procedência.

**Impacto:** divergência entre operação, estoque, tanque e custo consolidado.

**Correção necessária:** definir evento contábil claro, custo unitário/médio, idempotência e vínculo obrigatório com unidade, origem e movimento.

### C-06 — Textos chegam corrompidos em áreas importantes

Foram encontrados textos como:

- `MecÃ¢nica`;
- `AtualizaÃ§Ãµes`;
- `DiagnÃ³stico`;
- `OrÃ§amento`;
- `nÃ£o publicado`.

Em algumas interações o texto voltou a aparecer corretamente após nova renderização, indicando possível inconsistência entre renderização do servidor e hidratação no cliente.

**Impacto:** aparência de sistema quebrado e risco de conteúdo inconsistente.

### C-07 — Administração não consegue ler os interesses do Connect

O painel Admin informa explicitamente que o questionário grava, mas a lista não pode ser lida por nenhum papel administrativo por falta de permissão no banco.

**Impacto:** a função de pesquisa de demanda existe, mas o negócio não consegue usar os resultados.

### C-08 — Agenda oferece opção impossível

Mesmo sem nenhuma outra pessoa vinculada à embarcação, o seletor oferece “Compartilhado” e “Atribuído a alguém”. Ao enviar como compartilhado, o servidor responde “Escolha com quem compartilhar”, mas não existe pessoa ou controle disponível.

**Impacto:** erro previsível apresentado somente depois do envio.

**Correção necessária:** desabilitar opções indisponíveis, explicar o motivo e oferecer CTA “Convidar tripulação”.

### C-09 — Validação numérica insuficiente

Foi possível preencher e o navegador considerou válidos:

- Ano: `ano errado`;
- Comprimento: `-20 metros`;
- Boca: `muito`.

O mesmo padrão aparece em potência, horas, quantidade, litros, capacidade, estoque, valores e porte em pés.

**Impacto:** cálculos, alertas e relatórios podem ser contaminados por texto ou valores negativos.

## 5. Problemas de alta prioridade por módulo

### 5.1 Barco e motores

- A página principal do Barco concentra muitos blocos e atalhos, sem hierarquia suficiente entre saúde, identificação, hubs e administração.
- O formulário de equipamento não muda de verdade conforme o tipo. Gerador, Baterias, Painel e Outro continuam recebendo campos e exemplos de motor.
- “Quantidade” é confuso para um motor tratado como equipamento individual.
- Marca, modelo, ano, potência e horas são opcionais e sem validação adequada.
- O detalhe do motor coloca Visão geral, Manutenções, Sistemas, Histórico, Alertas e Dados na mesma página longa. As “abas” são apenas âncoras para blocos da mesma tela.
- A função de Sistema é útil, mas usa nome livre; deveria oferecer biblioteca inicial por tipo de equipamento com opção “Outro”.
- A foto do motor é opcional, mas não existe um estado vazio orientando claramente qual foto real o proprietário deve enviar.

### 5.2 Segurança, Casco, Elétrica e Hidráulica

- Segurança promete controlar quantidade, validade e último teste, mas direciona para o formulário genérico de manutenção.
- O item de segurança criado não ofereceu foto, certificado, fabricante, modelo, localização a bordo ou registro do último teste.
- Hidráulica usa o mesmo formulário para Água doce, Grey Water e Black Water.
- Casco usa o mesmo formulário com exemplos de óleo/filtro.
- Elétrica funciona apenas como uma lista muito simples de equipamentos e contato; falta modelo próprio para baterias, bancos, capacidade, tensão, instalação, teste e substituição.

### 5.3 Documentos e fotos

- A tela Documentos mistura consulta dos documentos existentes, upload individual e formulário completo de novo documento na mesma página.
- Editar Seguro ou TIE leva ao formulário de manutenção, com campos de óleo e peça.
- TIE aparece como dado textual da embarcação e também como documento monitorado, criando duplicidade.
- Fotos permite apenas um arquivo por vez.
- Não foi encontrada uma função clara para selecionar a foto de capa do barco.
- Faltam orientações específicas por álbum e por objeto.

### 5.4 Diário de Bordo

- Quase todos os tipos podem ser enviados com campos essenciais vazios.
- Abastecimento registra litros e detalhes em texto livre, sem litros estruturados, tipo de combustível, preço por litro, fornecedor e tanque cheio.
- Navegação usa passageiros separados por vírgula, em vez de pessoas estruturadas.
- A saída não possui campos iniciais de combustível, água, horas de gerador ou fotos, previstos para um check-in/check-out mais confiável.
- Avaria e Ocorrência parecem dois caminhos concorrentes para o mesmo problema.
- Docagem reutiliza estrutura semelhante à avaria e oferece “renovar manutenção”, sem modelo específico de entrada/saída, estaleiro, serviços, fotos e custos.
- Os controles do checklist rápido apresentaram texto visual inconsistente na inspeção e não deixaram claro o estado selecionado.
- O fluxo pós-saída para atualização de horímetros funcionou corretamente e respeitou a regra de não calcular horas do motor pela duração da navegação.

### 5.5 Agenda

- Não há data/hora final, recorrência, lembrete ou bloqueio da embarcação para reserva.
- Não existe responsável quando não há outra pessoa vinculada, mas as opções permanecem ativas.
- O vínculo com manutenção/documento funciona e leva corretamente ao item relacionado.
- O detalhe oferece editar, concluir e excluir, o que funcionou corretamente.

### 5.6 Financeiro

- Entrada e Despesa usam praticamente as mesmas categorias; categorias como Seguro, Marina e Manutenção não fazem sentido como origem de receita padrão.
- Valor é campo de texto.
- Não há indicação clara de competência versus pagamento, parcelamento ou rateio.
- Um lançamento pode trocar de Despesa para Entrada durante a edição, operação de alto risco sem histórico visível na tela.
- Relatórios usam seletores de mês/ano com identificação visual fraca.
- A integração Enterprise com Estoque e Combustível falhou no teste gravado.

### 5.7 Marketplace, prestadores e comandantes

- Os seis tipos de pedido possuem boa base de região e categoria, mas pés, litros e experiência são texto sem limites.
- O pedido encerrado continuou exibindo texto dizendo que estava publicado e apareceria quando alguém se cadastrasse.
- O formulário de perfil de Prestador inclui campos de tripulação, como função a bordo, anos de experiência e porte máximo, misturando dois modelos de profissional.
- Certificações são texto livre, sem documento, validade ou verificação.
- “Região que você atende” aparece em contexto de proprietário que escolhe interesses, linguagem de papel incorreta.
- O Partner/Marina possui um único formulário muito longo com tipo de negócio, mapa, ícone, cor, vagas secas, vagas molhadas, estrutura, poitas, contatos, descrição, visibilidade e fotos.
- O perfil público da Marina mostrou somente contato, mesmo existindo dezenas de campos no cadastro. O preenchimento e a apresentação pública não têm uma relação visual clara.

### 5.8 Enterprise

- Pátio funcionou bem ao ligar saída, retorno, consumo e ocorrência.
- A ocorrência automática trouxe título e setor corretos e manteve trilha de auditoria ao ser anulada.
- Mecânica mistura lista, detalhe, abertura de serviço, orçamentos e votação na mesma página.
- Há versões duplicadas do formulário de edição do serviço no DOM para layouts diferentes; uma delas fica oculta. Isso aumenta risco de inconsistência e dificulta acessibilidade/testes.
- Orçamento não demonstra vínculo visual inequívoco com o serviço selecionado.
- Tarefa percorreu corretamente Aberto → Em andamento → Concluído.
- Estoque não possui custo unitário no cadastro, embora a retirada deva alimentar o Financeiro.
- Combustível calculou corretamente saldo, percentual e consumo da unidade, mas não gerou custo consolidado.
- Importação de Frota foi um dos melhores fluxos testados: detectou horas negativas, linha sem nome, separou erros e só mostrou o botão de importação quando existia linha válida.

### 5.9 Administração

- O painel tem boa separação conceitual de papéis e preserva logs.
- A lista de usuários tem nomes duplicados sem e-mail ou outro identificador, dificultando selecionar a pessoa correta.
- Foi exibido o erro de plural `2 embarcaçãoões`.
- O Admin reconhece que sete planos ainda não estão modelados, portanto métricas de plano estão incompletas.
- Connect está bloqueado por permissão de banco.
- Taxonomia é funcional, mas a página exibe muitos formulários de edição de uma vez.
- Preços de Gold e Publicidade são texto livre, sem máscara monetária robusta.
- Consultor Gold usa Região como texto livre, embora o restante do produto use taxonomia de regiões.

### 5.10 Onboarding e planos

- Onboarding aceita apenas 1 ou 2 motores. Não contempla zero, motor auxiliar de veleiro, três ou mais motores, ou configurações diferentes.
- Não há foto do barco, dimensões ou configuração técnica suficiente no onboarding.
- Commander Pro aparece como até 4 embarcações, enquanto decisões anteriores do produto já consideraram 5; é necessário fechar uma única regra comercial.
- O plano pessoal Captain aparece por R$ 24,90/mês. Essa informação deve ser comparada com a decisão comercial final antes do PRD.
- A página de assinatura mistura produto já utilizável com “contratação abre em breve”, sem explicar com precisão qual acesso atual é cortesia, teste ou plano futuro.

## 6. Regra obrigatória para fotos

A proposta do proprietário está correta: **o Commander não deve criar uma fotografia fictícia para representar um motor, peça, colete, documento ou barco específico**.

### Estado sem foto recomendado

Enquanto o proprietário não enviar uma imagem real, mostrar:

- ícone ou ilustração técnica neutra correspondente ao tipo do item;
- título, por exemplo: `Foto real do Motor BB ainda não adicionada`;
- texto curto: `Fotografe a plaqueta e o conjunto instalado para facilitar manutenção e identificação.`;
- ação primária: `Adicionar foto real`;
- ação secundária, quando útil: `Ver exemplo do enquadramento`.

### Regras

- Não usar imagem gerada que pareça ser o equipamento real do usuário.
- O ícone é estado vazio, não evidência do ativo.
- Identificar fotos como “Enviada pelo proprietário”, “Enviada pela equipe” ou “Documento do fabricante”, quando aplicável.
- Permitir substituir, remover e escolher foto de capa.
- Em motores e equipamentos, solicitar preferencialmente duas fotos: visão geral instalada e plaqueta/número de série.
- Em segurança, permitir foto do item e foto/arquivo do certificado ou inspeção.
- Em documentos, usar miniatura real somente depois do upload; antes disso, usar ícone de documento.

## 7. Direção de organização visual

O aplicativo deve abandonar o padrão “tudo aberto na mesma página”. A estrutura recomendada para Casco, Motor, Segurança, Documento e demais hubs é:

1. **Cabeçalho compacto:** nome, estado, foto real ou ícone vazio, localização e ação principal.
2. **Resumo:** três a cinco indicadores realmente importantes.
3. **Navegação por abas reais:** Visão geral, Manutenções, Documentos/Fotos e Histórico.
4. **Lista limpa:** cards ou linhas com estado, próximo vencimento e ação contextual.
5. **Criação em página ou painel próprio:** nunca manter um formulário completo permanentemente abaixo da lista.
6. **Campos progressivos:** mostrar somente os campos compatíveis com o tipo escolhido.

Exemplo para Motor:

- Visão geral: foto real, marca/modelo, posição, horímetro e próxima revisão;
- Manutenções: planos e vencimentos;
- Sistemas: arrefecimento, injeção, elétrica e transmissão;
- Documentos/Fotos: manual, nota, plaqueta e fotos;
- Histórico: leituras, serviços, avarias e alterações.

Exemplo para Segurança:

- resumo por estado: válidos, próximos do vencimento, vencidos e sem informação;
- categorias: Salvatagem, Incêndio, Sinalização, Primeiros socorros e Outros;
- cada item com quantidade, localização, validade, último teste, foto real e certificado;
- manutenção do extintor ou inspeção da balsa como registros vinculados ao item, não como o próprio item.

## 8. O que funcionou bem

- Saída/retorno do Pátio e geração de ocorrência;
- trilha de auditoria de ocorrência anulada;
- estados das tarefas;
- pós-saída do Diário para atualização manual dos horímetros;
- vínculo da Agenda com manutenção/documento;
- validação e prévia da importação de Frota;
- saldo e cálculo de consumo do tanque;
- filtros de ocorrências, Financeiro, Gold e Marketplace;
- separação conceitual dos papéis administrativos;
- privacidade declarada do Marketplace e encerramento do pedido;
- transferência de propriedade explica consequências e exige aceitação do novo dono;
- logs administrativos desenhados como imutáveis.

Esses fluxos devem ser preservados no PRD e refinados, não reconstruídos sem necessidade.

## 9. Priorização recomendada

### Fase 0 — Integridade e bloqueadores

- corrigir encoding;
- corrigir `Informar leitura`;
- separar esquemas dos formulários;
- implementar validação de servidor e cliente;
- corrigir Estoque/Combustível → Financeiro/Frota;
- impedir votação 0/0 e corrigir estados;
- liberar leitura administrativa do Connect;
- corrigir Agenda sem destinatários.

### Fase 1 — Arquitetura de telas

- reconstruir Barco e hubs com resumo + abas reais;
- remover formulários completos das páginas de consulta;
- tornar equipamento dinâmico por tipo;
- criar modelos próprios de Segurança, Documento, Casco, Hidráulica e Elétrica;
- reorganizar Partner/Marina em etapas.

### Fase 2 — Dados estruturados e automações

- Diário estruturado por tipo;
- custos unitários, custo médio e procedência;
- certificações verificáveis;
- fotos reais e documentos por objeto;
- responsáveis, recorrência, lembretes e bloqueios da Agenda;
- unificar Avaria e Ocorrência.

### Fase 3 — Acabamento e expansão de papéis

- acessibilidade, máscaras, mensagens e estados vazios;
- testes reais de Cotista, Tripulação, Comandante, Partner, Suporte e Vistoriador;
- consistência comercial dos planos;
- testes móveis e responsivos finais;
- pagamento, e-mail, uploads, GPS e integrações externas.

## 10. Base para o próximo PRD

O próximo documento deve transformar cada correção aprovada em:

- problema e objetivo;
- papel autorizado;
- rota/tela afetada;
- modelo de dados;
- campos obrigatórios, opcionais e condicionais;
- regras de validação;
- estados e transições;
- permissões;
- integrações e efeitos no Financeiro/alertas;
- comportamento sem foto e com foto real;
- mensagens de sucesso e erro;
- critérios de aceite;
- casos de teste;
- plano de migração dos registros atuais criados pelo formulário genérico.

**Recomendação final:** não pedir à IA de programação apenas para “melhorar o design”. Primeiro deve ser aprovado o novo mapa de objetos e formulários. Caso contrário, o sistema ficará mais bonito, mas continuará armazenando documentos, itens de segurança, componentes e manutenções de maneira misturada.
