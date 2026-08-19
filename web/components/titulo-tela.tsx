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
export function TituloTela({ children, className = "" }: { children: string; className?: string }) {
  const [primeira, ...resto] = children.trim().split(" ")
  return (
    // `mb-4` e não `mb-6`: o título é a primeira coisa DEPOIS de um cabeçalho
    // que já tem borda inferior — o respiro grande está pago ali em cima.
    <h1 className={`titulo-pagina mb-4 ${className}`}>
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
    </h1>
  )
}
