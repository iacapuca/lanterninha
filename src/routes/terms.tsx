import { Link, createFileRoute } from '@tanstack/react-router'
import { CONTACT_EMAIL, LEGAL_UPDATED_AT } from './privacy'

export const Route = createFileRoute('/terms')({
  head: () => ({
    meta: [
      { title: 'Termos de uso · Lanterninha' },
      { name: 'description', content: 'As regras para usar a Lanterninha e publicar avaliações de salas de cinema.' },
    ],
  }),
  component: TermsPage,
})

function TermsPage() {
  return (
    <article className="legal">
      <p className="eyebrow">Atualizados em {LEGAL_UPDATED_AT}</p>
      <h1>Termos de uso</h1>
      <p className="lede">
        Ao criar uma conta ou usar a Lanterninha, você concorda com estes termos. Eles são curtos de propósito.
      </p>

      <h2>1. O serviço</h2>
      <p>
        A Lanterninha reúne avaliações de salas de cinema escritas pela comunidade, dados públicos da ANCINE sobre salas
        e complexos, e horários de sessões publicados por sites de ingressos e pelos próprios cinemas. O uso é gratuito.
      </p>

      <h2>2. Sua conta</h2>
      <ul>
        <li>
          Você precisa ter pelo menos 13 anos. Menores de 18 anos devem usar o site com o conhecimento dos responsáveis.
        </li>
        <li>
          Use um e-mail seu e mantenha sua senha em segredo; você responde pelo que for publicado com a sua conta.
        </li>
        <li>Seu @ não pode se passar por outra pessoa, marca ou cinema.</li>
        <li>
          Você pode excluir sua conta quando quiser, em <Link to="/account">Conta</Link>.
        </li>
      </ul>

      <h2>3. O que você publica</h2>
      <ul>
        <li>
          Avalie salas em que você realmente esteve, com base na sua experiência. Não publique avaliações pagas, falsas
          ou em troca de vantagens, nem avalie o cinema onde você trabalha.
        </li>
        <li>
          Não publique conteúdo ofensivo, discriminatório, ameaçador, com dados pessoais de terceiros, propaganda ou
          spam, nem nada que viole a lei ou direitos de outras pessoas.
        </li>
        <li>
          O texto continua sendo seu. Ao publicar, você autoriza a Lanterninha, de forma gratuita e não exclusiva, a
          exibir, reproduzir e adaptar o conteúdo no site e em materiais de divulgação dele (por exemplo, a imagem de
          prévia quando um link é compartilhado), enquanto ele estiver publicado.
        </li>
        <li>Você pode editar ou excluir suas avaliações a qualquer momento.</li>
      </ul>

      <h2>4. Moderação</h2>
      <p>
        Podemos remover conteúdo ou suspender contas que descumpram estes termos ou a lei, e cumprir ordens judiciais,
        nos termos do Marco Civil da Internet (Lei nº 12.965/2014).
      </p>

      <h2>5. Horários e ingressos</h2>
      <p>
        Horários, preços e disponibilidade vêm de terceiros e podem mudar sem aviso — confirme no site do cinema ou da
        bilheteria antes de sair de casa. Ingressos são vendidos por esses terceiros, não pela Lanterninha, e a compra
        segue as condições deles.
      </p>

      <h2>6. Responsabilidade</h2>
      <p>
        As avaliações expressam a opinião de quem as escreveu, não da Lanterninha. O site é oferecido como está; fazemos
        o possível para mantê-lo no ar e correto, mas não garantimos que estará sempre disponível ou livre de erros.
      </p>

      <h2>7. Privacidade</h2>
      <p>
        O tratamento dos seus dados está descrito na <Link to="/privacy">Política de privacidade</Link>.
      </p>

      <h2>8. Mudanças e contato</h2>
      <p>
        Podemos atualizar estes termos; mudanças importantes serão avisadas no site antes de valer. Vale a lei
        brasileira. Dúvidas: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </article>
  )
}
