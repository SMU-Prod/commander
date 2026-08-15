import type { Metadata } from "next"
import Link from "next/link"
import { DestaqueLegal, PaginaLegal, SecaoLegal } from "@/components/legal/pagina-legal"
import { LINK_TABUA_MARE_CHM } from "@/lib/domain/mar"

// =====================================================================
// AVISO PARA QUEM EDITAR ESTE ARQUIVO (onda 30): o texto abaixo foi escrito
// a partir de levantamento do código (schema, RLS, integrações, telas de
// cobrança) para ser honesto sobre o que o Commander realmente faz — mas
// NÃO É TEXTO JURÍDICO REVISADO. Antes de valer como Termos de Uso de
// verdade (produção com cobrança real ativa para o público), um advogado
// precisa revisar cláusulas de responsabilidade, foro, rescisão e
// cobrança. Não remova este aviso sem essa revisão acontecer.
// =====================================================================

export const metadata: Metadata = {
  title: "Termos de Uso — Commander",
  description: "Termos de Uso do Commander: o que o app faz, assinatura, conteúdo do usuário e os limites de responsabilidade na navegação.",
}

const VIGENCIA = "14 de agosto de 2026"

export default function TermosPage() {
  return (
    <PaginaLegal
      titulo="Termos de Uso"
      icone="documento"
      vigencia={VIGENCIA}
      outraPagina={{ href: "/privacidade", rotulo: "a Política de Privacidade" }}
    >
      <SecaoLegal titulo="1. O que é o Commander">
        <p>
          O Commander é o dossiê digital do seu barco: um app para cadastrar a embarcação, os
          motores e equipamentos, os documentos e suas validades, o histórico de manutenções e
          gastos, o diário de bordo (incluindo saídas registradas com trilha por GPS) e as horas
          de motor. A partir disso, o app avisa antes de um documento vencer ou uma manutenção
          ficar atrasada, mostra o mapa náutico durante a navegação e permite convidar
          comandantes e tripulação para ajudar a manter esse histórico.
        </p>
        <p>
          Estes Termos regem o uso do site e do app Commander (web e, quando disponível, os
          apps Android/iOS) por qualquer pessoa que crie uma conta. Ao criar uma conta, você
          concorda com este texto e com a{" "}
          <Link href="/privacidade">Política de Privacidade</Link>.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="2. Conta e responsabilidade do usuário">
        <p>
          Você cria uma conta com e-mail e senha (mínimo 8 caracteres). É responsável por manter
          sua senha em segurança e por tudo que acontecer usando sua conta. Se convidar
          tripulação para sua embarcação, você (proprietário) escolhe o que cada pessoa pode ver
          e editar — motores, elétrica, casco, documentos, fotos, contatos ou o diário — e pode
          mudar isso a qualquer momento pela tela de Tripulação.
        </p>
        <p>
          As informações que você cadastra (embarcação, equipamentos, documentos, fotos) devem
          ser verdadeiras. O Commander não confere a veracidade do que é cadastrado — o dossiê
          vale o que os dados cadastrados nele valem.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="3. Assinatura e pagamento">
        <p>
          O Commander tem um plano gratuito e planos pagos. Os valores vigentes ficam sempre
          visíveis na página <Link href="/assinar">/assinar</Link> antes de você confirmar
          qualquer coisa; não repetimos os números aqui para não ficarem desatualizados. Apenas
          o proprietário (papel PROP) da embarcação assina; comandantes e tripulantes
          convidados não pagam.
        </p>
        <p>
          Podemos oferecer condições promocionais temporárias (por exemplo, para quem vem de
          outro aplicativo, ou como parte de uma avaliação Commander Gold aprovada). Quando o
          período da promoção termina, a cobrança passa ao valor normal do plano, e isso fica
          informado na tela Menu → Assinatura enquanto a promoção está valendo. Promoções não
          são cumulativas entre si.
        </p>
        <p>
          A cobrança é processada pelo <strong>Asaas</strong>, um gateway de pagamento
          brasileiro — cartão ou Pix são preenchidos direto na página segura do Asaas, nunca no
          Commander. Para emitir a cobrança, pedimos seu nome completo e CPF, que enviamos ao
          Asaas para cadastrar você como cliente.
        </p>
        <p>
          A assinatura renova automaticamente até ser cancelada. Você cancela a qualquer
          momento pela tela Menu → Assinatura, sem multa. Ao cancelar, sua conta volta ao plano
          gratuito: <strong>nada do que você registrou é apagado</strong> — embarcação,
          Diários, documentos, fotos e histórico continuam guardados e visíveis. O que fica
          bloqueado são os recursos do plano pago, e eles voltam inteiros se você reativar. Se
          quiser excluir os dados de verdade, veja a seção &quot;Direitos do titular&quot; da{" "}
          <Link href="/privacidade">Política de Privacidade</Link>.
        </p>
        <p>
          Se um pagamento for recusado, avisamos e você tem um prazo de regularização antes de
          os recursos pagos serem bloqueados — o prazo em vigor aparece no próprio aviso, na
          tela Menu → Assinatura. Durante esse prazo, nada muda no seu acesso. O histórico de
          faturas também fica nessa tela.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="4. Conteúdo do usuário">
        <p>
          Tudo que você cadastra — texto do diário, fotos da embarcação, documentos anexados,
          trilhas de GPS, leituras de sondagem — continua seu. Ao subir isso no Commander, você
          nos dá permissão só para armazenar, processar e exibir esse conteúdo de volta pra
          você e para quem tem acesso pela sua embarcação (tripulação com permissão), como
          necessário para o app funcionar. Não vendemos nem publicamos seu conteúdo individual
          para terceiros.
        </p>
        <p>
          Duas exceções que já existem no produto e valem a pena deixar explícitas: (1) se você
          optar (é sempre uma escolha, nunca automático) por contribuir com o mapa de
          corredores, pontos anônimos e agregados da sua trilha passam a beneficiar outros
          usuários — nunca sua trilha em si; (2) fotos e informações de um perfil de{" "}
          <strong>parceiro comercial</strong> (marina, posto, pousada, restaurante) são públicas
          por natureza — é o objetivo daquele cadastro. Os dois casos estão detalhados na{" "}
          <Link href="/privacidade">Política de Privacidade</Link>.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="5. Uso aceitável">
        <p>Ao usar o Commander, você concorda em não:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Cadastrar dados falsos sobre embarcação, documentos ou identidade de terceiros;</li>
          <li>Tentar acessar embarcações ou dados de outras pessoas sem vínculo/convite;</li>
          <li>Usar sondagem colaborativa ou corredores para tentar identificar a rota individual de outro usuário;</li>
          <li>Fazer engenharia reversa, raspagem automatizada (scraping) ou sobrecarregar o serviço deliberadamente;</li>
          <li>Publicar como parceiro comercial informação enganosa sobre preço, localização ou disponibilidade.</li>
        </ul>
      </SecaoLegal>

      <SecaoLegal titulo="6. Limitação de responsabilidade náutica">
        <DestaqueLegal>
          <p>
            <strong>Isto é o mais importante destes Termos.</strong> O Commander é uma
            ferramenta de apoio ao planejamento e ao registro da navegação —{" "}
            <strong>não substitui carta náutica oficial</strong>, publicação náutica ou o
            julgamento do comandante.
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              A camada de profundidade do mapa vem de uma grade pública de baixa resolução
              (ETOPO) — não é sondagem de precisão.
            </li>
            <li>
              A sondagem colaborativa é dado bruto contribuído por outros barcos: melhora com o
              tempo, mas nunca vira carta confiável — pode haver área rasa não mapeada por
              ninguém ainda.
            </li>
            <li>
              O mapa de corredores mostra onde outros barcos já passaram, como indício — nunca
              validação, garantia de segurança ou recomendação de rota. Um barco menor ou de
              calado diferente pode ter passado onde o seu não passa.
            </li>
            <li>
              A rota calculada pelo app (incluindo o A* que usa calado e corredores) é um
              <strong> auxílio ao planejamento</strong>, não uma instrução de navegação.
            </li>
            <li>
              A maré mostrada no app é uma <strong>estimativa de modelo meteorológico</strong>{" "}
              (Open-Meteo Marine) — não é a tábua de marés oficial. A tábua oficial é a da
              Marinha do Brasil, disponível em{" "}
              <a href={LINK_TABUA_MARE_CHM} target="_blank" rel="noopener noreferrer">
                marinha.mil.br/chm
              </a>
              .
            </li>
            <li>Vento, onda e condição do mar mostrados são previsão de modelo, não garantia.</li>
          </ul>
          <p>
            <strong>
              A decisão de sair, a rota escolhida e a responsabilidade pela segurança da
              navegação são sempre do comandante da embarcação.
            </strong>{" "}
            O Commander e a equipe por trás dele não respondem por acidente, encalhe, avaria ou
            qualquer dano decorrente de uma decisão de navegação tomada com apoio do app.
          </p>
        </DestaqueLegal>
      </SecaoLegal>

      <SecaoLegal titulo="7. Disponibilidade do serviço">
        <p>
          Fazemos o possível para manter o Commander no ar, mas é um serviço em evolução
          contínua: pode haver manutenção programada, instabilidade ou indisponibilidade de
          integrações externas (mapa, previsão do tempo, pagamento) fora do nosso controle
          direto. Quando uma informação (como a previsão de tempo) não estiver disponível, o
          app avisa que está indisponível em vez de mostrar um número antigo como se fosse
          atual.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="8. Rescisão">
        <p>
          Você pode parar de usar o Commander e cancelar sua assinatura quando quiser (seção 3).
          Podemos suspender ou encerrar uma conta que violar a seção &quot;Uso aceitável&quot;
          acima, avisando pelo e-mail cadastrado sempre que possível antes de uma medida
          definitiva.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="9. Alterações destes Termos">
        <p>
          Podemos atualizar este texto conforme o app evolui. Mudanças relevantes são
          comunicadas por e-mail e/ou aviso dentro do app antes de valerem; a data de
          &quot;Vigência&quot; no topo desta página sempre reflete a versão mais recente.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="10. Lei aplicável e foro">
        <p>
          Estes Termos são regidos pela lei brasileira. Fica eleito o foro da comarca do
          domicílio do usuário para dirimir eventuais controvérsias, salvo disposição legal em
          contrário.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="11. Contato">
        <p>
          Dúvidas sobre estes Termos: <a href="mailto:atendimento.smu@gmail.com">atendimento.smu@gmail.com</a>.
        </p>
      </SecaoLegal>
    </PaginaLegal>
  )
}
