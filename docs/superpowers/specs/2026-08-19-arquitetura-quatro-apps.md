# O Commander são quatro aplicativos, e hoje eles estão no mesmo menu

Spec de arquitetura · 19/08/2026 · **substitui** `2026-08-15-arquitetura-informacao-design.md`
na parte de navegação. As quatro naturezas de tela daquele documento (painel,
lista, ficha, formulário) continuam valendo.

**Origem: o dono navegou pelas áreas principais e escreveu o diagnóstico.** O
texto abaixo é dele, organizado — não é interpretação minha.

---

## 1. O diagnóstico

> *"O problema não é falta de conteúdo. O Commander tem conteúdo demais
> aparecendo ao mesmo tempo e sem separar o tipo de usuário."*

**O menu atual mistura quatro aplicativos diferentes:**

| # | Aplicativo | O que é |
|---|---|---|
| 1 | **Gestão do barco** | do proprietário |
| 2 | **Rede náutica** | Marketplace, prestadores, Explorar |
| 3 | **Operação Enterprise** | Pátio, Mecânica, Estoque, Combustível, Frota |
| 4 | **Administração interna** | Admin Commander |

> *"Um proprietário comum vê Cotistas, Pátio, Mecânica, Estoque, Combustível,
> Custo da frota e até Admin Commander. Isso não deveria aparecer para ele."*

**Isto reenquadra o problema.** Não é hierarquia visual — é ausência de recorte
por tipo de usuário. A sensação de "não sei onde estou" vem de o app não ter
decidido para quem cada tela é.

---

## 2. A arquitetura nova

### 2.1 Menu principal do proprietário — seis itens

```
Início · Meu Barco · Diário · Agenda · Serviços · Minha Conta
```

### 2.2 Dentro de **Serviços**

Explorar · Marketplace · Prestadores · Comandantes · Mensagens

### 2.3 Dentro de **Meu Barco**

Os oito hubs técnicos · Financeiro · Tripulação · Ocorrências · Histórico ·
Relatórios · Selos

### 2.4 **Enterprise é ambiente separado**

Frota · Pátio · Mecânica · Estoque · Combustível · Cotistas · Financeiro
operacional

> *"Nada disso pode ficar misturado ao Commander de um proprietário
> particular."*

---

## 3. A tela Barco vira central técnica

> *"Ela colocou tudo numa página enorme: Motores, Elétrica, Equipamentos,
> Hidráulica, Segurança, Casco, Documentos, Manutenções, Ferramentas, Selos,
> Commander Connect, Dados cadastrais. Além disso, repete Diário, Financeiro,
> Documentos, Contatos e outras funções que já estão no menu."*

**A tela Barco deve ser apenas a central técnica, com cards grandes:**

```
Motores · Casco · Elétrica · Hidráulica
Segurança · Equipamentos · Documentos · Manutenções
```

> *"A pessoa toca no card e entra naquele hub. Nada dessa página
> interminável."*

Cada card tem **identidade visual por hub** (§4).

---

## 4. A direção visual

> *"O aplicativo hoje parece um painel técnico/industrial, não o Commander
> premium que definimos."*

**O que está errado hoje:** verde-limão em todo botão · fundo preto absoluto ·
cards cinza quase idênticos · quase nenhuma fotografia náutica · tudo com o
mesmo peso visual · fontes pequenas e espaçadas demais · muitos filtros em
cápsula · grandes áreas vazias · formulários inteiros dentro das páginas · a
logo não é a identidade final da plaqueta dourada.

**O correto:**

- **Azul-marinho profundo**
- **Dourado real** nos detalhes e nas ações principais, **com moderação**
- **Branco quente / cinza claro** para leitura
- **Fotos reais da embarcação**
- **Cards com identidade visual por hub**
- **Alertas apenas em vermelho, âmbar e verde**

> *"O verde-limão precisa sair."*

**Consequência para o `docs/referencias/haulix-design-system.md`:** ele
permanece como referência de **densidade, tipografia, hierarquia de superfície,
status compacto e contenção** — que é o que ele tem de melhor. **A paleta dele
NÃO se aplica**: o Commander é navy e ouro, não quase-preto e lime.

---

## 5. O cabeçalho repetido

> *"O cabeçalho repete em absolutamente todas as telas: Motor BB, Motor BE,
> Revisão em 250 horas, Avisos, Perfil, Seletor do barco. Isso até faz sentido
> em Início e Barco, mas é desnecessário em Marketplace, Explorar, Mensagens e
> outras áreas. Parece que nunca conseguimos 'sair' da manutenção do barco."*

**Regra:** o cabeçalho de estado do barco aparece em **Início** e **Meu Barco**.
Nas demais áreas, some — ou fica reduzido ao que aquela área precisa.

---

## 6. Defeitos objetivos, lista de tarefas

| # | Defeito | Estado |
|---|---|---|
| 1 | `AtualizaÃ§Ãµes` e `MecÃ¢nica` com caracteres quebrados | **CORRIGIDO 19/08** — dupla codificação em dois arquivos, introduzida por edição via PowerShell. 87 e 421 ocorrências → 0 |
| 2 | Páginas vários segundos em skeleton | Investigado: em navegador AUTOMATIZADO é artefato (`requestAnimationFrame` não dispara em documento oculto). **No celular do dono é relato real e continua aberto** |
| 3 | Documentos abre listagem + alertas + upload + formulário completo ao mesmo tempo | Aberto |
| 4 | Explorar mostra bloco amarelo enorme sem imagem | Aberto |
| 5 | Menu longo demais, exige muita rolagem | Fecha com §2 |
| 6 | Funções Enterprise aparecem para embarcação sem cotas | Aberto — recorte por configuração, não só por papel |
| 7 | Admin Commander visível no menu normal | Aberto |
| 8 | Experiência feita primeiro para desktop, não mobile | Aberto |

---

## 7. O resumo, na palavra dele

> *"As funcionalidades estão boas, mas a arquitetura visual virou um depósito
> de funcionalidades. Hoje parece um sistema administrativo náutico interno. O
> Commander que planejamos deve parecer um aplicativo premium em que cada
> usuário enxerga somente o que precisa naquele momento."*

**A frase que governa toda decisão daqui em diante:** *cada usuário enxerga
somente o que precisa naquele momento.*
