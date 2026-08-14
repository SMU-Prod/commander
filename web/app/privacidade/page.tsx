import type { Metadata } from "next"
import Link from "next/link"
import { DestaqueLegal, PaginaLegal, SecaoLegal } from "@/components/legal/pagina-legal"

// =====================================================================
// AVISO PARA QUEM EDITAR ESTE ARQUIVO (onda 30): texto escrito a partir de
// levantamento direto do código (schema do banco, políticas de RLS,
// integrações de terceiros, telas de consentimento) para ser específico
// sobre o que o Commander realmente coleta e faz — mas NÃO É TEXTO
// JURÍDICO REVISADO. Antes de valer como Política de Privacidade de
// verdade (produção com cobrança real ativa para o público), um advogado
// especializado em LGPD precisa revisar as bases legais atribuídas a cada
// categoria de dado, o texto de transferência internacional e o processo
// de exercício de direitos do titular. Não remova este aviso sem essa
// revisão acontecer.
// =====================================================================

export const metadata: Metadata = {
  title: "Política de Privacidade — Commander",
  description: "O que o Commander coleta, por quê, com quem compartilha e como você exerce seus direitos sobre seus dados — incluindo o tratamento específico da sondagem colaborativa e dos corredores.",
}

const VIGENCIA = "14 de agosto de 2026"

export default function PrivacidadePage() {
  return (
    <PaginaLegal
      titulo="Política de Privacidade"
      icone="escudo"
      vigencia={VIGENCIA}
      outraPagina={{ href: "/termos", rotulo: "os Termos de Uso" }}
    >
      <SecaoLegal titulo="1. Quem trata seus dados">
        <p>
          O Commander é operado pela equipe do Commander (SMU), com sede no Rio de Janeiro. Para
          qualquer assunto de privacidade — dúvida, reclamação ou exercício de direitos —, o
          canal é <a href="mailto:atendimento.smu@gmail.com">atendimento.smu@gmail.com</a>. É
          esse mesmo e-mail que hoje responde por questões de encarregado (DPO) de dados
          enquanto o Commander opera nesta escala.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="2. Quais dados coletamos, para quê e com que base legal">
        <p>
          Cada linha abaixo é uma categoria de dado real do produto, com a base legal da Lei
          Geral de Proteção de Dados (LGPD, Lei 13.709/2018) que se aplica a ela.
        </p>
        <ul className="list-disc space-y-2.5 pl-5">
          <li>
            <strong>Conta:</strong> e-mail e senha (login via Supabase Auth), nome informado no
            cadastro. <em>Base legal: execução de contrato</em> — sem isso não existe conta.
          </li>
          <li>
            <strong>Perfil:</strong> nome, telefone (opcional). Se você publica um perfil de
            comandante em Comandantes, também nome público, categoria, cidade, bio, foto.{" "}
            <em>Base legal: execução de contrato / consentimento</em> (o perfil de comandante é
            uma escolha à parte, não vem marcado por padrão).
          </li>
          <li>
            <strong>Embarcação e equipamentos:</strong> nome, estaleiro, modelo, ano, medidas,
            número de casco, motores/geradores/baterias e suas horas de uso.{" "}
            <em>Base legal: execução de contrato</em> — é o núcleo do dossiê que você pediu para
            criar.
          </li>
          <li>
            <strong>Documentos e fotos:</strong> os arquivos que você anexa (documentos da
            embarcação com validade, fotos do casco/interior/convés), guardados no espaço de
            fotos privado da sua conta. <em>Base legal: execução de contrato.</em>
          </li>
          <li>
            <strong>Diário de bordo:</strong> cada manutenção, abastecimento, avaria, docagem e
            saída registrada — incluindo gasto em reais, descrição, hora de saída/retorno,
            destino e quem estava a bordo (tripulação da saída, guardada como comprovação).{" "}
            <em>Base legal: execução de contrato.</em>
          </li>
          <li>
            <strong>Trilha por GPS:</strong> quando você grava uma saída, o app usa a posição do
            aparelho <strong>enquanto a tela de navegação está aberta e a gravação ligada</strong>{" "}
            (não há coleta de posição em segundo plano hoje) para desenhar a trilha e calcular
            distância/velocidade; a trilha fica salva junto com aquela saída do diário. Trilhas
            também podem ser importadas de um arquivo GPX de outro plotter (Garmin, Raymarine,
            Navionics). <em>Base legal: execução de contrato</em> — é o registro da própria
            saída que você pediu para guardar.
          </li>
          <li>
            <strong>Sondagem colaborativa e corredores:</strong> tratamento à parte, com
            consentimento explícito — ver a seção 3 abaixo, dedicada a isso.
          </li>
          <li>
            <strong>Tripulação, vínculos e permissões:</strong> quem está vinculado a qual
            embarcação, com qual papel (proprietário/comandante) e o que cada pessoa pode ver e
            editar por área (motores, elétrica, casco, documentos, fotos, contatos, diário).{" "}
            <em>Base legal: execução de contrato</em> — é como o app decide o que mostrar para
            quem.
          </li>
          <li>
            <strong>Parceiros comerciais:</strong> se você cadastra um negócio (marina, posto,
            pousada, restaurante), coletamos nome do negócio, categoria, contato, localização,
            fotos, preços e quantas vezes o seu perfil foi visto por donos de barco.{" "}
            <em>Base legal: execução de contrato</em> (o cadastro em si) <em>e legítimo
            interesse</em> (a contagem de visualizações, que existe para você avaliar se vale a
            pena manter o perfil ativo).
          </li>
          <li>
            <strong>Notificações push:</strong> se você ativa avisos, o navegador/aparelho gera
            um endpoint e chaves de assinatura push (protocolo Web Push, com par de chaves
            VAPID) que guardamos para poder mandar o aviso até aquele aparelho.{" "}
            <em>Base legal: consentimento</em> — você ativa isso explicitamente, e pode desativar
            a qualquer momento em Avisos.
          </li>
          <li>
            <strong>Pagamento:</strong> nome completo e CPF, coletados na tela de assinatura e
            enviados ao Asaas para emitir a cobrança — o Commander nunca vê número de cartão.{" "}
            <em>Base legal: execução de contrato</em> (processar a assinatura) <em>e obrigação
            legal</em> (emissão de documento fiscal/cobrança exige CPF).
          </li>
          <li>
            <strong>E-mails transacionais:</strong> avisos de documento/manutenção vencendo e o
            relatório mensal são enviados para o e-mail da sua conta.{" "}
            <em>Base legal: execução de contrato</em> — é a função central do app (avisar antes
            do prazo).
          </li>
        </ul>
      </SecaoLegal>

      <SecaoLegal titulo="3. Sondagem colaborativa e corredores — leia com atenção">
        <DestaqueLegal>
          <p>
            Essas são as duas funcionalidades do Commander em que o dado da sua navegação vira
            um bem coletivo, então tratamos o assunto com destaque em vez de misturar na lista
            acima.
          </p>
          <p>
            <strong>Sondagem colaborativa</strong> (o equivalente ao SonarChart do Navionics): se
            seu barco tem ecobatímetro conectado, você pode optar por contribuir com as leituras
            de profundidade. Isso é <strong>opt-in com consentimento explícito</strong> — existe
            uma caixa de marcação específica na tela de navegação (&quot;Concordo em compartilhar
            minhas leituras de profundidade e posição aproximada, de forma agregada por
            área&quot;) que precisa estar marcada antes de a coleta começar; sem marcar, nada é
            enviado. Enquanto sem sinal de internet no mar, cada leitura fica guardada só no seu
            aparelho (a fila) e sobe sozinha quando o sinal voltar.
          </p>
          <p>
            A leitura bruta (posição exata, embarcação e usuário que gravou) só é visível para
            quem tem vínculo com a sua própria embarcação — nunca para outros usuários. O que
            outros usuários enxergam é sempre o <strong>agregado por célula de área</strong>{" "}
            (mediana de profundidade, quantas leituras, quando foi a última) devolvido por uma
            função do banco que nunca expõe a linha individual, o dono ou a embarcação.{" "}
            <strong>Ninguém vê a rota individual de ninguém</strong> através da sondagem.
          </p>
          <p>
            <strong>Corredores</strong> (o &quot;Strava do Mar&quot;): toda vez que você grava ou
            importa uma trilha, aparece a opção de marcar &quot;Contribuir com o mapa de
            corredores&quot; — de novo, uma caixa separada, desmarcada por padrão, com o aviso
            de que a trilha &quot;vira passagens anônimas, agregadas por área, nunca sua rota
            individual&quot;. Sem marcar, a trilha é salva normalmente no seu diário e nada sobe
            para os corredores.
          </p>
          <p>
            Diferente da sondagem, o dado de corredores <strong>nasce anônimo</strong>: a tabela
            de corredores no banco não tem nenhuma coluna de usuário ou embarcação — só uma
            célula de área e um contador de quantas passagens já foram registradas ali. Não há
            como o Commander (nem nós, nem ninguém) reconstituir quem passou por uma célula a
            partir desse dado, porque essa informação nunca é gravada.
          </p>
          <p>
            <strong>Como revogar o consentimento:</strong> desmarque a caixa antes da próxima
            trilha/sondagem — a partir daí, nada de novo é enviado. Seja honesto sobre o
            passado: como o agregado de corredores já nasce sem identificação de quem
            contribuiu, <strong>não existe como &quot;retirar&quot; sua contribuição específica
            de dentro de um número já agregado</strong> — a reversão não é tecnicamente possível
            porque a informação de autoria nunca existiu ali. Já a sondagem, por ter dono
            enquanto é leitura bruta, pode ser apagada mediante pedido pelo canal de contato
            desta política (o que sai é a leitura bruta atribuível a você; o agregado por célula
            que ela já ajudou a compor, assim como no corredor, não é reversível).
          </p>
        </DestaqueLegal>
      </SecaoLegal>

      <SecaoLegal titulo="4. Com quem compartilhamos dados">
        <p>
          Não vendemos seus dados. Compartilhamos apenas com prestadores que operam partes do
          serviço, cada um só com o necessário para sua função:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Supabase</strong> — banco de dados, autenticação e armazenamento de arquivos
            (documentos e fotos). É onde praticamente todo o dado deste app vive.
          </li>
          <li>
            <strong>Vercel</strong> — hospedagem do site e das funções de servidor do Commander.
          </li>
          <li>
            <strong>Mapbox</strong> — provedor dos mapas de navegação. Recebe a posição
            aproximada da área do mapa que sua tela está mostrando (viewport), necessária para
            carregar os ladrilhos (tiles) do mapa daquela região.
          </li>
          <li>
            <strong>Open-Meteo</strong> — provedor de previsão de tempo e mar. Recebe a
            coordenada (da sua marina cadastrada ou do ponto consultado) para devolver
            vento/onda/maré estimada daquele local.
          </li>
          <li>
            <strong>OpenSeaMap</strong> — provedor da camada de carta náutica sobreposta ao mapa.
          </li>
          <li>
            <strong>Asaas</strong> — gateway de pagamento. Recebe nome, e-mail e CPF para
            processar sua assinatura (seção 2 acima). Dados de cartão nunca passam pelo
            Commander.
          </li>
          <li>
            <strong>Resend</strong> — envio dos e-mails transacionais (avisos de prazo,
            relatório mensal). Recebe o e-mail da sua conta e o conteúdo do aviso.
          </li>
          <li>
            <strong>PostHog</strong> — analytics de produto, usado para entender uso agregado do
            app. Só funciona se uma chave de projeto estiver configurada no ambiente; sem ela,
            o código de analytics não faz nada. Nenhum evento é rastreado automaticamente
            (autocapture desligado) — só eventos específicos que registramos manualmente.
          </li>
          <li>
            <strong>Serviço de push do seu navegador/fabricante</strong> (ex.: Google/Apple) —
            entrega as notificações Web Push até o seu aparelho, como em qualquer app que manda
            notificação.
          </li>
        </ul>
        <p>
          Não compartilhamos a trilha individual de um usuário com outro usuário, nem
          publicamos posição/rota de embarcações. As duas exceções conhecidas — agregado de
          sondagem por célula e contador anônimo de corredores — estão detalhadas na seção 3.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="5. Retenção">
        <p>
          Guardamos seus dados enquanto sua conta existir. Se você cancelar a assinatura, o
          dossiê fica congelado mas não é apagado (ver Termos, seção 3) — assim, se você voltar
          a assinar depois, o histórico continua ali. Dados de cobrança são mantidos pelo prazo
          exigido pela legislação fiscal brasileira. Leituras de sondagem que você pedir para
          apagar (seção 3) são removidas da tabela de leituras brutas; o que já virou agregado
          de célula ou corredor segue as regras de irreversibilidade explicadas na seção 3.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="6. Seus direitos como titular dos dados (LGPD)">
        <p>Você tem direito a, a qualquer momento:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong>Acesso</strong> — saber quais dados seus temos e como usamos;</li>
          <li><strong>Correção</strong> — pedir correção de dado incompleto, inexato ou desatualizado;</li>
          <li><strong>Exclusão</strong> — pedir a exclusão de dados pessoais (com as ressalvas de irreversibilidade de dado já agregado, seção 3, e retenção fiscal, seção 5);</li>
          <li><strong>Portabilidade</strong> — pedir seus dados em formato estruturado para levar a outro serviço;</li>
          <li><strong>Revogação de consentimento</strong> — para sondagem, corredores e notificações push, a qualquer momento;</li>
          <li><strong>Informação sobre compartilhamento</strong> — com quem seus dados são compartilhados (seção 4).</li>
        </ul>
        <p>
          <strong>Como exercer:</strong> hoje o Commander ainda não tem um botão de
          autoatendimento para exportar ou apagar a conta inteira — o pedido é feito escrevendo
          para <a href="mailto:atendimento.smu@gmail.com">atendimento.smu@gmail.com</a>, a partir
          do e-mail cadastrado na sua conta (para confirmarmos que é você). Respondemos e
          executamos o pedido dentro do prazo legal da LGPD.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="7. Transferência internacional">
        <p>
          O Commander usa provedores de nuvem (Supabase, Vercel e os serviços de terceiro
          listados na seção 4) cuja infraestrutura pode estar hospedada fora do Brasil,
          dependendo da região do servidor contratada para cada serviço. Quando isso acontece,
          seus dados podem ser transferidos internacionalmente para viabilizar o funcionamento
          do app. Exigimos desses provedores práticas de segurança compatíveis com a LGPD; se
          quiser confirmar a região específica de hospedagem em uso no momento, escreva para o
          canal de contato desta política.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="8. Cookies e armazenamento local">
        <p>
          O Commander não usa cookies de rastreamento de terceiros. Usamos armazenamento local
          do navegador (localStorage), que fica só no seu aparelho, para:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Lembrar sua preferência de tema (claro/escuro);</li>
          <li>Guardar a <strong>fila</strong> de leituras de sondagem ainda não enviadas ao servidor (para não perder nada sem sinal);</li>
          <li>Lembrar sua escolha de consentimento de corredores entre uma saída e outra;</li>
          <li>Guardar preferências de camadas do mapa e do endereço do servidor Signal K (para quem usa sondagem via Signal K);</li>
          <li>Guardar a posição de fundeio marcada por você (âncora), só no seu aparelho.</li>
        </ul>
        <p>
          Cookies de sessão do Supabase Auth são usados para manter você logado — sem eles, o
          app não sabe quem é você a cada tela.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="9. Segurança">
        <p>
          Todos os dados de embarcação, equipamentos, documentos e diário são protegidos por
          controle de acesso no próprio banco (Row Level Security): cada consulta já sai
          filtrada pelo que aquele usuário tem permissão de ver, não é uma verificação só na
          tela. Documentos e fotos ficam em um espaço de armazenamento privado, acessível
          apenas por quem tem vínculo com a embarcação e permissão para aquela área.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="10. Alterações desta política">
        <p>
          Podemos atualizar este texto conforme o app evolui, especialmente conforme novas
          funcionalidades tratam dados de forma diferente. Mudanças relevantes são comunicadas
          por e-mail e/ou aviso dentro do app antes de valerem; a data de &quot;Vigência&quot;
          no topo desta página sempre reflete a versão mais recente.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="11. Contato">
        <p>
          Dúvidas, pedidos de acesso/correção/exclusão/portabilidade ou qualquer assunto de
          privacidade: <a href="mailto:atendimento.smu@gmail.com">atendimento.smu@gmail.com</a>.
          Veja também <Link href="/termos">os Termos de Uso</Link>.
        </p>
      </SecaoLegal>
    </PaginaLegal>
  )
}
