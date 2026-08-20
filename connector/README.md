# signalk-commander-connector

Plugin de [Signal K](https://signalk.org) do app **Commander**: envia os dados
do seu barco para a sua conta no Commander — e só o que você autorizar,
categoria por categoria.

## O que ele faz

- Assina os dados do **próprio barco** (`vessels.self`) no servidor Signal K
  de bordo e sobe a **última leitura de cada medida** em lotes (padrão: a cada
  30 segundos) para a sua conta Commander.
- **Somente leitura**: o plugin nunca escreve no barramento nem no servidor.
- **Opt-in por categoria** — tudo nasce desligado; você liga o que quiser:
  - **Posição** — posição, velocidade e rumo sobre o fundo;
  - **Motor** — rotação, temperatura e horímetro;
  - **Profundidade** — sob a quilha (transdutor como reserva);
  - **Elétrica** — tensão e corrente das baterias;
  - **Ambiente** — vento e temperatura da água.
- **Aguenta rede ruim**: sem sinal, as leituras ficam numa fila em disco
  (até 5.000, as mais antigas caem primeiro) e sobem quando a conexão volta,
  com espera progressiva entre tentativas (30 s até 10 min).
- Valores seguem nas **unidades SI do Signal K** e timestamps em **UTC ISO**;
  qualquer conversão de exibição é papel do app.

## Instalação

Procure por **Commander Connector** na App Store do seu servidor Signal K,
instale e ative. Na tela de configuração do plugin:

1. Cole o **token da sua conta Commander** (gere em *Menu → Ajustes* no app).
2. Ligue as categorias que você quer compartilhar.
3. (Opcional) ajuste o intervalo entre lotes — mínimo 5 segundos.

O estado do plugin (ativo, aguardando rede, erro de token) aparece na própria
tela de plugins do Signal K.

## Desenvolvimento

```bash
npm install       # dependências (inclui o signalk-server real p/ testes)
npm run build     # TypeScript → plugin/
npm test          # testes unitários (lote, fila, backoff, categorias, envio)
npm run e2e       # conformidade: sobe o signalk-server oficial com dados de
                  # amostra, instala o plugin e valida a entrega no mock
```

## Privacidade

Nada é enviado sem token configurado e sem pelo menos uma categoria ligada.
O plugin fala exclusivamente com o endereço configurado (padrão: o backend do
Commander) usando o seu token — revogue o token no app para cortar o acesso.
