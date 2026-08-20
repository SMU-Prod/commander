# Sistema de Design Commander — DEFINITIVO

**Fonte:** *Guia de Design e Implementação Visual Commander v1.0*, 19/08/2026,
aprovado pelo dono. Este arquivo é a transcrição normativa dele para dentro do
repositório, com os nomes de token que o código realmente usa.

**Status: NORMATIVO.** Toda tela, componente ou correção visual do Commander
obedece a este documento. O PRD define comportamento; este arquivo define
apresentação e interação. Nenhum módulo cria fonte, ícone, raio, sombra ou cor
nova sem que a linha correspondente apareça **aqui primeiro**.

**Prioridade quando houver conflito:** clareza operacional > consistência >
estética > efeito visual.

## O que este arquivo substitui

| Documento | Situação |
|---|---|
| `docs/referencias/haulix-design-system.md` | **superado na paleta e na atmosfera.** A referência HAULIX é de logística industrial; o Commander é náutico e premium. O que sobrevive dele é disciplina de densidade e contenção, e mesmo isso agora está escrito aqui. |
| A versão anterior deste arquivo (catálogo das seis imagens HAULIX) | **substituída.** Era mapa de adaptação de outro produto. |
| `docs/DESIGN.md` | **continua valendo no que não é visual** — regras de escrita, honestidade de dado (`null` nunca vira zero desenhado), domínio. Onde ele falar de cor, raio, tipografia ou composição, **este arquivo vence**. |
| `docs/superpowers/specs/2026-08-19-arquitetura-quatro-apps.md` | **continua valendo.** É arquitetura de informação (quem vê o quê), não apresentação. Os dois se somam. |

## 1. Princípios não negociáveis

1. Uma tela tem **uma função principal**. Consulta, edição e cadastro não ficam
   expostos ao mesmo tempo.
2. **Resumo primeiro; detalhe depois; formulário só depois de uma ação
   explícita.**
3. **Aba é conteúdo controlado.** Selecionar uma aba mostra o conteúdo dela e
   esconde o resto. Aba usada como âncora de rolagem é defeito — foi
   exatamente o que a `/barco` fazia com oito abas de `scrollWidth 805` contra
   `clientWidth 358`.
4. **Ícone 3D** representa hub, equipamento e placeholder. **Ícone 2D**
   representa navegação, ação, filtro e estado. Nunca misturar na mesma função.
5. **Foto real do proprietário nunca é substituída por fotografia fictícia.**
   Antes do upload, render 3D claramente ilustrativo ou ícone técnico.
6. **Cor identifica sistema e estado.** Nunca é decoração aleatória.
7. Desktop e mobile compartilham tokens, ícones, componentes e linguagem.
   **Só a composição responde ao espaço.**
8. Aparência tecnológica não pode custar legibilidade, acessibilidade,
   desempenho ou compreensão do fluxo.

**PROIBIDO:** verde-limão genérico · fundo preto absoluto · múltiplas fontes ·
famílias de ícone misturadas · formulário sempre aberto · fotografia fictícia
do barco ou do equipamento · brilho neon sem significado.

## 2. Direção visual

Atmosfera de **central de comando de iate**.

- Fundo azul-marinho quase preto, **nunca preto puro**.
- Superfícies translúcidas com textura de vidro escuro e contraste suficiente.
- Bordas luminosas de 1 px e sombras controladas, sem excesso de glow.
- Objetos 3D com luz de recorte na cor do hub e fundo transparente.
- **Dourado Commander reservado para identidade e ação primária**; cor técnica
  pertence ao sistema.
- HUD e telemetria discretos e informativos. Não inventar microdado aleatório.

## 3. Cor

O tema que **abre** é o escuro (`app/layout.tsx` põe `[data-theme="dark"]`
antes da pintura). O claro é preferência de produto (Ajustes → Aparência,
leitura sob sol na marina) e segue a regra de tradução do §3.3.

### 3.1 Tabela do guia — os valores literais

| Grupo | Uso | Token do repositório | Valor |
|---|---|---|---|
| Base | Fundo principal | `--fundo` | `#07111C` |
| Base | Superfície / glass | `--superficie` | `#0B1926` |
| Marca | Ação principal / identidade | `--acao` | `#D6A53A` |
| Motores | Informação técnica | `--hub-motores` | `#2DE3FF` |
| Casco | Estrutura / estabilidade | `--hub-casco` | `#FFB020` |
| Elétrica | Energia / circuitos | `--hub-eletrica` | `#238BFF` |
| Hidráulica | Bombas / tanques | `--hub-hidraulica` | `#8B5CF6` |
| Segurança | Em dia / protegido | `--hub-seguranca` | `#37D67A` |
| Documentos | Arquivo / validade | `--hub-documentos` | `#29D3C2` |
| Manutenção | Atenção / prazo | `--hub-manutencoes` | `#FF9F1C` |
| Crítico | Erro / vencido / excluir | `--crit` | `#FF4D4F` |

**REGRA SEMÂNTICA:** verde é confirmado/em dia (`--ok`, `#37D67A`); âmbar é
atenção/prazo (`--warn`, `#FF9F1C`); vermelho é crítico/erro/exclusão
(`--crit`, `#FF4D4F`). Nunca usar as três apenas como ornamento.

### 3.2 A regra de escopo — o que impede a paleta de virar semáforo quebrado

O guia dá a Segurança o **mesmo verde** de "em dia" e a Manutenções o **mesmo
âmbar** de "atenção". Isso só funciona por causa do §5 do guia — *"cor do hub
apenas no estado ativo ou no card daquele sistema"*:

> **COR DE HUB** vive na moldura do próprio hub: ícone, borda do card dele, aba
> ativa dentro dele. Nunca em outro hub, nunca num valor, nunca numa lista
> genérica.
>
> **COR DE ESTADO** vive no VALOR: número, selo, farol, texto de alerta.

Com esse recorte, verde na moldura de Segurança é **identidade** e verde num
número é **"em dia"** — e os dois nunca disputam o mesmo pixel. Sem ele, a
paleta do guia vira semáforo quebrado.

**Corolário obrigatório: tom de hub não pode virar cor de texto.** A régua dele
é 3:1 (elemento gráfico), não 4,5:1. Hidráulica (`#8B5CF6`) entrega 4,20:1
sobre o vidro — passa como grafismo, reprovaria como texto. Há teste em
`lib/ui/contraste.test.ts` cobrando os oito nos dois temas.

### 3.3 Os tokens que o guia não declara, e a regra que os deriva

| Token | Escuro | Claro | Como foi derivado |
|---|---|---|---|
| `--superficie-2` (cartão aninhado) | `#12263A` | `#E4EAF1` | mesmo matiz do vidro (209°), degrau de ~1,15 de razão de luminância |
| `--superficie-3` (interativo/hover) | `#1B3550` | `#D6DEE7` | idem, próximo degrau |
| `--linha` | `#2C3945` | `#C6D0DA` | o `rgba(216,225,232,.16)` do §5 **composto sobre o vidro**. Fica sólido para o guardião de contraste poder medi-lo — com alfa ele mediria o melhor caso e aprovaria uma separação inexistente |
| `--texto` | `#E8EEF4` | `#07111C` | branco **frio**: a única família clara declarada no guia é o `rgba(216,225,232,…)` da borda |
| `--texto-dim` | `#93A6B8` | `#566472` | mesmo matiz, um degrau de saturação abaixo |
| `--texto-dim-chip` | `#9DAFC0` | `#4F5D6B` | calibrado contra `--superficie-2`, onde `--texto-dim` reprova |
| `--acao-forte` | `#E8C46B` | `#5E4308` | "forte" = mais contraste que o acento; num chão escuro isso é mais claro |
| `--acao-texto` | `#07111C` | `#F8FAFC` | **sempre da cor do chão** |
| `--campo` | `#0A1622` | `#FCFDFE` | um degrau abaixo do vidro, para o campo parecer recuado |
| `--meter` (cartucho de instrumento) | `#040C15` | `#07111C` | navy fixo nos dois temas |
| `--dado` (série de gráfico) | `#7FA8C9` | `#28587F` | azul-aço: nem marca, nem semáforo |
| `--hub-equipamentos` | `#8FA3B8` | `#44566A` | **desvio declarado — ver §12** |

**Regra do tema claro:** o guia é um sistema escuro e não declara tema claro. O
claro sobrevive como preferência de produto, e a regra que o mantém honesto é
**mesmo matiz, luminância do outro lado do chão**. Os oito matizes de hub são
medidos nos próprios hexadecimais do §3.1 (188° · 39° · 212° · 258° · 145° ·
211° · 174° · 35°) e só a luminância desce, até passarem de 3:1.

### 3.4 Orçamento do dourado

Identidade e ação primária, **com moderação** (§9 do guia). A régua da casa que
cobra isso: **no máximo duas peças douradas por tela**, e o dourado ocupando
1–3% da área. "Dourado em todo botão" é o mesmo defeito que "limão em todo
botão".

## 4. Tipografia

| | |
|---|---|
| **Família UI** | Inter. Fallback: `system-ui, -apple-system, "Segoe UI", sans-serif` |
| **Pesos** | 400 regular · 500 medium · 600 semibold · **700 só em métrica e título-chave** |
| **Escala mobile** | 12 rótulo · 14 corpo · 16 componente · 20 subtítulo · 24 título · 28–32 métrica |
| **Escala desktop** | 12 rótulo · 14 corpo · 16 componente · 22 subtítulo · 30–32 título · 32–40 métrica |

- **Máximo de três níveis tipográficos visíveis dentro de um card.**
- Texto funcional sempre horizontal e legível. Nada de letra decorativa ou
  condensada.
- Métrica usa `tabular-nums` para não saltar de largura.
- Contraste mínimo WCAG AA para corpo e controle essencial.

## 5. Espaçamento, forma e superfície

| | |
|---|---|
| **Ritmo** | base 4 px: 4, 8, 12, 16, 24, 32, 48 |
| **Raios** | `--raio-controle` 12 px · `--raio-cartao` 16 px · `--raio-painel` 20 px (herói e drawer) · `--raio-pilula` 999 (só chip e status) |
| **Bordas** | 1 px, padrão `rgba(216,225,232,.16)` (= `--linha`). Cor do hub **apenas** no estado ativo ou no card daquele sistema |
| **Sombras** | uma sombra de profundidade + glow suave opcional. **Nunca empilhar três efeitos** |
| **Glass** | `--superficie` com 78–88% de opacidade e blur 12–20 px quando suportado |
| **Alturas** | `--altura-controle` 44 px (piso de toque, não negocia) · `--altura-campo` 48 px |

**Profundidade vem de SUPERFÍCIE, não de sombra.** A escada tem quatro níveis
(canvas → cartão → aninhado → interativo) e é ela que responde "este bloco está
dentro daquele?". Sombra (`--sombra-2`) responde outra pergunta: "este bloco
está POR CIMA, fora do fluxo?" — menu, bottom sheet, pastilha sobre o mapa,
ação flutuante.

**A separação cartão↔fundo é feita pela BORDA**, de propósito: no escuro o
preenchimento dá 1,068:1 e a borda 1,505:1. É o §2 ("bordas luminosas de 1 px")
dizendo que neste sistema quem desenha o cartão é a borda, e o vidro é quase da
cor do chão.

## 6. Ícones

| | |
|---|---|
| **2D** | menu, voltar, editar, adicionar, excluir, calendário, filtro, anexar, alerta, status |
| **Família 2D** | uma única biblioteca de line icons, traço equivalente a 1,75–2 px, cantos e proporções consistentes |
| **3D** | hubs, equipamentos, sistemas técnicos e estado vazio antes da foto real |
| **Câmera 3D** | perspectiva 3/4 consistente, luz principal superior esquerda, fundo transparente, rim light na cor do hub |
| **Substituição** | havendo foto real, o render 3D some **naquele mesmo slot de mídia** |

**Proibido** misturar sólido, outline, emoji, clipart e 3D na mesma função.

Os renders das imagens do guia são **exemplo de linguagem, não o pacote final
de assets**. A biblioteca definitiva precisa ser exportada em tamanhos e
ângulos padronizados — ver §12, dívida aberta.

## 7. Central Meu Barco (`/barco`)

| | |
|---|---|
| **Desktop** | sidebar compacta · herói do barco · grid **4 × 2** para os oito hubs |
| **Mobile** | header compacto · herói reduzido · grid obrigatório de **duas colunas** · bottom navigation fixa |
| **Hubs** | Motores · Casco · Elétrica · Hidráulica · Segurança · Equipamentos · Documentos · Manutenções |
| **Dados** | saúde geral e alertas essenciais. Não repetir o cabeçalho técnico inteiro em páginas externas ao barco |

## 8. Hubs e abas internas

- Cada tela de hub mantém a **mesma estrutura** e muda só objeto, cor técnica,
  métricas e abas pertinentes.
- Desktop: abas em linha quando couberem. **Não quebrar rótulo em duas linhas.**
- Mobile: faixa horizontal rolável com indicação clara da aba ativa.
- Estado ativo: borda/underline **na cor do hub**, nunca preenchimento neon.
- Trocar de aba mantém o contexto e **substitui o conteúdo central**.
- Formulário não fica dentro da aba enquanto fechado — abre por botão de ação.

### Padrão de detalhe de hub (obrigatório)

1. cabeçalho compacto
2. foto real **ou** estado vazio com ícone
3. estado e alertas
4. **até cinco** indicadores
5. abas reais
6. ação principal
7. menu de ações secundárias

## 9. Telas operacionais (Diário, Agenda, Documentos, Manutenções)

- Listas com cards de densidade média: título, metadado essencial, ação
  secundária discreta.
- Chips de filtro **apenas quando existe seleção real**. Evitar dezenas de
  cápsulas sem hierarquia.
- Ação primária previsível: base do conteúdo no mobile, topo/direita ou base do
  painel no desktop.
- Vermelho **só** em avaria crítica, vencimento, falha ou ação destrutiva.
- Elemento 3D aqui é menor e de apoio. Nunca compete com dado e tarefa.

## 10. Fotografia real e carrossel

### Estado sem foto

Render 3D representativo + ação **"Adicionar foto real"**. Exemplo normativo do
guia:

```
[ícone técnico de motor]
Foto real do Motor BB ainda não adicionada
Fotografe o conjunto instalado e a plaqueta de identificação.
[Adicionar foto real]
```

### Estado com foto

Herói panorâmico, gradiente de leitura, moldura glass, HUD decorativo e ações
**"Trocar foto" / "Ver foto"**. Quando a imagem for do usuário, o componente
pode exibir **"Foto do proprietário"** — o objetivo é distinguir dado real de
ilustração do sistema.

- Nunca apresentar render 3D e foto real do mesmo item ao mesmo tempo.
- Preservar proporção; `object-fit: cover` no herói, visualização integral em
  "Ver foto".
- Gradiente e HUD são **camadas CSS**. Não alterar o arquivo enviado.

### Carrossel 3D

| Fotos | Composição |
|---|---|
| 1 | herói panorâmico estático |
| 2 | foto principal + prévia lateral recuada |
| 3+ | centro dominante + duas laterais em perspectiva |

Desktop: setas, dots, contador *x de n*. Mobile: swipe, dots, contador e
"Deslize para ver". **Autoplay é proibido** — quem muda é o usuário.
Acessibilidade: `aria-label`, foco visível, teclado e `prefers-reduced-motion`.

## 11. Formulários, drawers e modais

| Campos | Superfície |
|---|---|
| até 3 | modal curto ou bottom sheet |
| 4 ou mais | drawer lateral no desktop; tela/sheet dedicado no mobile |

- **Drawer desktop:** 38% da viewport, mínimo 420 px, máximo 560 px, fundo
  contextual escurecido.
- **Campos:** rótulo sempre visível; unidade fora do valor; placeholder é
  exemplo, **nunca** rótulo.
- **Obrigatórios:** asterisco discreto e validação junto ao campo.
- **Salvar:** desabilitado até os requisitos mínimos; loading; sucesso;
  prevenção de duplo envio.
- **Cancelar:** fecha sem gravar; confirmar só se houver alteração não salva.
- **Anexos:** área única para nota, foto ou documento, com tipo, tamanho,
  progresso, erro e remoção.

**Nunca** manter formulário completo permanentemente aberto abaixo de uma
consulta.

## 12. Estados obrigatórios por componente

| Componente | Estados |
|---|---|
| Card | default · hover desktop · pressed mobile · selecionado · desabilitado · loading · erro |
| Botão | primário dourado · secundário outline · destrutivo vermelho · icon-only com tooltip/`aria-label` |
| Input | default · foco · preenchido · inválido · desabilitado · somente leitura |
| Upload | vazio · enviando · concluído · falhou · tipo inválido · arquivo grande |
| Abas | default · ativa · hover · foco · desabilitada · overflow horizontal |
| Lista | com dados · vazia · carregando · erro · fim da paginação |
| Alerta | informação · sucesso · atenção · crítico — **mensagem textual obrigatória além da cor** |
| Skeleton | reproduz a geometria final; sem tela inteira pulsando; timeout com mensagem e "tentar novamente" |

## 13. Responsividade

| Faixa | Regra |
|---|---|
| Mobile 320–767 | bottom navigation · duas colunas de hubs · sheets · abas roláveis |
| Tablet 768–1199 | navegação compacta · grid 2 ou 3 colunas · drawers controlados |
| Desktop 1200+ | sidebar · grid 4 colunas · drawers laterais · mais densidade **sem reduzir fonte** |

- **Herói:** ~16:7 no desktop, ~16:9 no mobile, altura limitada para os hubs
  continuarem alcançáveis.
- **Toque:** alvo mínimo 44 × 44 px, distância mínima de 8 px entre ações
  concorrentes.
- **Safe areas:** notch, barras do sistema e viewport dinâmica.
- Não criar um design para mobile e outro para desktop.
- Não esconder função essencial por falta de espaço — reorganizar por
  prioridade.
- Texto e número **nunca** rasterizados dentro de asset 3D.

## 14. Desempenho e acessibilidade

- Render 3D pré-renderizado em WebP/AVIF com PNG de fallback. WebGL só quando a
  interação justificar.
- Carregar asset por rota, com tamanhos responsivos. Não baixar os oito hubs em
  resolução máxima na abertura.
- Reservar proporção de imagem para o layout não saltar.
- `prefers-reduced-motion`: reduzir perspectiva animada, parallax, glow pulsante
  e transição longa.
- Teclado completo no desktop; foco visível dourado/ciano com contraste.
- **Não depender só de cor**: incluir ícone, texto e estado.
- Imagem real exige alternativo ou descrição contextual; asset decorativo usa
  `alt` vazio.
- Testar contraste, zoom 200%, leitor de tela e aparelho em modo de economia.

**Meta:** parecer avançado sem exigir hardware avançado. Aparelho intermediário
mantém rolagem e interação fluidas.

## 15. Desvios declarados

O guia proíbe criar cor, fonte, ícone, raio ou sombra sem atualizá-lo. Estes
são os pontos em que o repositório se afasta do texto, com o motivo:

### 15.1 `--hub-equipamentos` não existe no guia

O §7 lista **oito** hubs; a tabela de cor do §4 traz **sete**. Equipamentos
ficou sem cor. O valor foi derivado das **imagens**, que o §1 declara normativas
para cor: o card de Equipamentos é o único neutro da grade. Escolhido
`#8FA3B8` (aço) no escuro e `#44566A` no claro.

**Ação pendente:** confirmar com o dono. Se o guia ganhar uma cor oficial para
Equipamentos, ela substitui esta em um commit só.

### 15.2 ~~IBM Plex Mono no numeral de instrumento~~ — DÍVIDA PAGA (onda 112)

**Este desvio não existe mais.** A Plex Mono saiu do app inteiro em 20/08/2026,
depois de o dono olhar o publicado e apontar: *"temos tipografias diferentes
dessas novas"*.

Ele estava certo e o desvio não se sustentava. O argumento original era que a
mono vivia "só no numeral de instrumento" — a medição diz outra coisa: **297
pontos de uso**, e a classe `.rotulo` também a carregava, ou seja ela desenhava
**todo rótulo de seção do app** ("PRECISA DA SUA ATENÇÃO", "SEU ANO NO MAR",
"MOTOR BB", "BOM PRA SAIR"). Monoespaçada maiúscula ao lado de Inter, em toda
tela.

O que ela resolvia — numeral de largura fixa, para o número não saltar ao
mudar — virou `tabular-nums`, que é a utilitária do próprio Tailwind e o
mecanismo que o §5 do guia prescreve ("métricas usam tabular-nums"). A Inter é
variable font e entrega figuras tabulares nativamente.

Efeitos colaterais, os dois bons: **uma família só**, como o §16 pede; e **um
download de fonte a menos** (quatro pesos estáticos), que é o §14 falando de
desempenho.

`lib/ui/tipografia.test.ts` cobra as duas coisas: que `app/layout.tsx` importe
**exatamente uma** família, e que `globals.css` declare `font-family` **num
lugar só** — o `body`. Uma `font-family` dentro de um componente é como a
segunda família entra de volta, e foi assim que `.rotulo` carregou a mono por
cinquenta ondas sem ninguém somar o total.

### 15.2-b (histórico) A justificativa que valeu até a onda 111

O §16 pede "uma única família tipográfica em toda a aplicação", e o §5 oferece
`tabular-nums` como mecanismo para métrica. O repositório mantém **IBM Plex
Mono** em `--pilha-mono-instr`, consumida por `.rotulo` e pelos mostradores de
instrumento (horímetro, sondagem, SOG) — **~200 pontos de uso em 90 arquivos**.

Motivo de manter: é fonte de **numeral de instrumento**, não segunda família de
display; o critério do §16 existe para impedir mistura de vozes tipográficas, e
mono de painel é a mesma decisão que o próprio guia toma ao desenhar HUD e
telemetria.

**Ação pendente:** decisão do dono. Se ele quiser Inter pura, é um passe
mecânico de `font-mono-instr` → `tabular-nums`, e some um download de fonte
(ganho no §14).

### 15.3 A biblioteca de renders 3D não existe — e não há uma pronta e gratuita

O §6 pede uma biblioteca de renders 3D "exportada em tamanhos e ângulos
padronizados" para os oito hubs. Ela não existe, e as telas usam
`components/ui/heroi-tecnico.tsx` — ilustração técnica, que é o que o §5 do PRD
manda usar antes da foto real.

**Busca feita em 19/08/2026, com resultado negativo.** As bibliotecas 3D
realmente CC0 (uso comercial, sem atribuição) não cobrem o vocabulário náutico:

| Fonte | Licença | Tem os oito objetos? |
|---|---|---|
| [3dicons.co](https://3dicons.co/) | CC0, sem atribuição | **Não.** ~120 ícones de interface genérica (escudo, ferramentas, engrenagem, relógio, pasta). Sem motor marítimo, casco, bomba ou balsa |
| [Kenney](https://kenney.nl/assets/category:3D) | CC0 | **Não.** Kits de jogo (cidade, masmorra, pirata). Nenhum pacote náutico |
| [Poly Haven](https://polyhaven.com/models) | CC0 | **Não.** A categoria *Watercraft* está vazia |
| [Sketchfab](https://sketchfab.com/tags/cc0) | varia por modelo | **Parcial.** Há motor marítimo, extintor e colete avulsos, mas cada um com licença própria — e "download grátis" ali costuma ser CC-BY, que **exige atribuição** |

Duas conclusões que fecham a porta do atalho:

1. **Misturar fontes fura o §6 do próprio guia** — *"não misturar sólido,
   outline, emoji, clipart e 3D na mesma função"*. Oito hubs com quatro
   procedências desenhariam quatro linguagens numa grade só.
2. **Misturar licenças é risco real num produto pago.** O grátis de
   Vecteezy/Pngtree/Freepik costuma exigir atribuição ou proibir uso
   comercial no plano gratuito.

**Os dois caminhos que funcionam**, quando o dono decidir:

- **Blender + modelos CC0 avulsos.** Sourcing por hub no Sketchfab/Poly Haven,
  conferindo licença um a um, e render local nos oito ângulos padronizados. O
  ambiente já tem as ferramentas do Blender ligadas; falta o Blender aberto.
- **Encomendar o pacote.** Oito objetos, perspectiva 3/4, luz principal
  superior esquerda, fundo transparente, WebP + PNG de fallback (§14).

### 15.4 O mapa desenha rótulo com a fonte do Mapbox, não com a do app

`web/lib/mapa/camadas-viagem.ts` declara `"text-font": ["DIN Pro Bold", "Arial
Unicode MS Bold"]` nos rótulos das camadas de viagem. São três famílias no
produto, contra a "única" do §16.

**Não é deriva, é limite do motor.** O Mapbox GL não desenha texto com a fonte
do documento: ele monta os rótulos a partir de *glyphs* pré-renderizados
servidos pelo próprio Mapbox. Usar Inter ali exige hospedar o atlas de glyphs
da Inter e apontar o `glyphs` do estilo para ele — trabalho de infraestrutura,
não de CSS.

**Enquanto isso:** o texto do mapa é rótulo de carta (nome de ponto, distância
do trecho), não interface do app. Fica registrado para não ser "descoberto"
como bug numa próxima auditoria.

### 15.5 A escala tem 11 degraus, e o guia declara 6

O §4 declara 12/14/16/20/24/28–32 no mobile e 12/14/16/22/30–32/32–40 no
desktop. A união dos dois — que é o que um app responsivo com os mesmos
componentes pode usar — dá **12, 14, 16, 20, 22, 24, 28, 30, 32, 36, 40**, e é
essa a lista que `lib/ui/tipografia.test.ts` cobra.

Antes da onda 110 rodavam **19 tamanhos**: 10, 11, 11.5, 12, 13, 14, 15, 16,
17, 18, 20, 24, 26, 28, 30, 32, 34, 36 e 48. Nenhum foi decidido — cada um
entrou numa onda diferente resolvendo um caso, e ninguém tinha como ver a
soma. `11.5px` existia em um arquivo só.

**Três exceções sobrevivem**, com teto por arquivo no teste: o wordmark
(`logo.tsx`, dimensionado por quem chama), o número de pendências dentro do
escudo de 56px (`card-embarcacao.tsx`, tamanho ditado pelo continente) e o
cartão flutuante sobre o mapa (`navegar-mapa.tsx`, que tem escala própria
desde a onda 24, junto com o chão navy fixo e as cores próprias).

### 15.6 O tema claro

O guia não o menciona. Ele existe como preferência de produto e segue a regra
de tradução do §3.3. Se o dono decidir que o Commander é escuro e ponto, o tema
claro sai inteiro e este documento perde o §3.3.

## 16. Critérios de aceite visual

Uma tela só está pronta quando:

- [ ] uma única família tipográfica de UI (Inter) — ver desvio §15.2
- [ ] uma única família de ícones 2D; renders 3D com ângulo, luz e escala padronizados
- [ ] os oito hubs usam seus tokens fixos de cor
- [ ] cards, bordas, raios, sombras e espaçamentos vêm de token, nunca de valor local
- [ ] mobile em duas colunas de hubs + bottom navigation; desktop com sidebar e grid 4 × 2
- [ ] abas **substituem** conteúdo, não expõem tudo numa rolagem
- [ ] formulário abre só por ação — drawer no desktop, sheet/tela no mobile
- [ ] sem foto real há render 3D ilustrativo; com foto, ele é substituído no mesmo slot
- [ ] carrossel não inicia sozinho e funciona por swipe, teclado e controle visível
- [ ] vazio, loading, erro, sucesso, inválido e desabilitado implementados
- [ ] nenhuma linguagem visual nova sem atualizar este documento
- [ ] revisão feita em mobile, tablet e desktop, com dado real e texto longo

## 17. Onde cada regra vive no código

| Assunto | Arquivo |
|---|---|
| Todos os tokens de cor, raio, altura, sombra, curva | `web/app/globals.css` |
| Utilitárias Tailwind dos tokens | bloco `@theme inline` do mesmo arquivo |
| Guardião de contraste (texto 4,5:1, hub 3:1, separação 1,2:1) | `web/lib/ui/contraste.test.ts` |
| Teto de cor escrita à mão, por arquivo | `web/lib/ui/tokens.test.ts` |
| Escada de superfície e composição de painel | `web/lib/ui/superficies.ts` |
| Alvo de toque e transição | `web/lib/ui/acoes.ts` |
| Guardião de destino de menu | `web/lib/ui/menu-destinos.test.ts` |
