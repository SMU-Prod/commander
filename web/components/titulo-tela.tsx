/**
 * O TÍTULO DA TELA, COM O FILETE DOURADO SOB A PRIMEIRA PALAVRA.
 * ===========================================================================
 * Anatomia do mockup de 19/08 (`public/imagens/novodesignmodelo.png`), igual
 * nas três telas: cabeçalho de marca, e logo abaixo o nome da área em 24px com
 * um risco de ouro curto embaixo da primeira palavra. É o "onde estou" que o
 * app não tinha no celular — a Início abria com "Olá, fulano" e a /barco não
 * abria com nada.
 *
 * POR QUE ELE NÃO PAGA O ORÇAMENTO DE DOIS DOURADOS (docs/DESIGN.md §5).
 * A régua da casa separa o ouro de MOLDURA do ouro de CONTEÚDO: o de moldura é
 * o indicador de onde-a-pessoa-está (item ativo do trilho, da barra de baixo,
 * aba ativa), existe em toda tela e não compete por atenção com o assunto
 * dela. Este filete é exatamente isso — o mesmo gesto do indicador de 2px que
 * `bottom-nav.tsx` desenha sobre a aba ativa, só que dito por extenso. O
 * orçamento de dois continua valendo para o ouro de conteúdo: na Início, o
 * burgee da marca e o "Registrar saída".
 *
 * POR QUE ELE É UM COMPONENTE E NÃO TRÊS CÓPIAS. `docs/DESIGN.md` §6, regra 6:
 * *"se você está escrevendo um estilo à mão, pare: ou o componente existe, ou
 * você acabou de encontrar um que precisa existir"*. São três consumidores no
 * mesmo commit (`/hoje`, `/barco`, `/servicos`) e o gesto é o mesmo nos três.
 * Mora em `components/` e não em `components/ui/` porque aquela pasta está com
 * outro agente nesta rodada — a decisão é de conflito de edição, não de
 * arquitetura; quando a poeira baixar, ele pertence a `ui/`.
 *
 * A PRIMEIRA PALAVRA E NÃO O TÍTULO INTEIRO. No mockup o risco sublinha
 * "Início", "Meu" e "Serviços" — ou seja, a primeira palavra, não a frase. Com
 * o título inteiro sublinhado o gesto viraria uma barra de 200px atravessando
 * a tela, que é ouro em área e não ouro em detalhe (§07 do HAULIX: 1–3%).
 */
/**
 * ONDA 105 — O TÍTULO PASSA A SER CENTRALIZADO, E A DECISÃO É DAS IMAGENS.
 * As oito imagens normativas centram o nome da área em TODAS as telas — "Meu
 * Barco", "Diário de Bordo", "Agenda", "Documentos", "Manutenções". Não é
 * capricho de composição: com o cabeçalho de marca também centralizado logo
 * acima, o eixo da tela vira um só, e a coluna de leitura passa a ter um
 * ponto de entrada em vez de dois cantos disputando o olho.
 *
 * `subtitulo` é o nome da embarcação do §7, e ele vem com as duas réguas
 * douradas laterais que as imagens desenham — ver o comentário no JSX.
 */
export function TituloTela({
  children,
  subtitulo,
  className = "",
}: {
  children: string
  /** O nome da embarcação, em ouro entre duas réguas. Só em Meu Barco. */
  subtitulo?: string
  className?: string
}) {
  const [primeira, ...resto] = children.trim().split(" ")
  return (
    // `mb-4` e não `mb-6`: o título é a primeira coisa DEPOIS de um cabeçalho
    // que já tem borda inferior — o respiro grande está pago ali em cima.
    <h1 className={`titulo-pagina mb-4 text-center ${subtitulo ? "mb-3" : ""} ${className}`}>
      {/* `inline-block` + `pb-1.5`: o filete precisa de uma caixa com a
          LARGURA DA PALAVRA para se ancorar, e de 6px de folga para não
          encostar nas descidas do "ç" e do "g". Um `border-b` no <h1> pegaria
          a linha inteira; um `<u>` seguiria a fonte e não a régua. */}
      <span className="relative inline-block pb-1.5">
        {primeira}
        {/* `aria-hidden`: é ornamento de identidade, não informação — quem lê
            por áudio já recebeu o título inteiro no <h1>. */}
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 rounded-[var(--raio-pilula)] bg-accent" />
      </span>
      {resto.length > 0 && ` ${resto.join(" ")}`}
      {/* O NOME DA EMBARCAÇÃO, EM OURO, ENTRE DUAS RÉGUAS.
          É a anatomia das imagens 1, 6 e 7 (o "Aurora" delas). As réguas não
          são enfeite: sem elas o nome do barco em ouro, sozinho e centralizado
          logo abaixo de um título maior, lê como subtítulo qualquer. Com elas,
          lê como PLAQUETA — que é o que a identidade da marca é.
          `flex-1` nas duas com `max-w-16`: elas crescem até o limite e param,
          então um nome curto ("Aurora") não fica com duas barras enormes ao
          lado, e um nome longo não some entre elas.
          `block` e `text-base`: isto vive DENTRO do `<h1>`, então precisa
          declarar o próprio corpo — senão herda os 24px do título. Fica dentro
          por acessibilidade: o nome do barco faz parte do título da tela, e um
          `<p>` irmão o tiraria do nome acessível do cabeçalho. */}
      {subtitulo && (
        <span className="mt-1 flex items-center justify-center gap-3 text-base font-medium text-accent">
          <span aria-hidden="true" className="h-px max-w-16 flex-1 bg-accent/40" />
          {subtitulo}
          <span aria-hidden="true" className="h-px max-w-16 flex-1 bg-accent/40" />
        </span>
      )}
    </h1>
  )
}
