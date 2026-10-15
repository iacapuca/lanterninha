import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/privacy')({
  head: () => ({
    meta: [
      { title: 'Política de privacidade · Lanterninha' },
      {
        name: 'description',
        content:
          'Quais dados a Lanterninha coleta, para quê, com quem compartilha e como exercer seus direitos (LGPD).',
      },
    ],
  }),
  component: PrivacyPage,
})

export const LEGAL_UPDATED_AT = '15 de outubro de 2026'
export const CONTACT_EMAIL = 'contato@lanterninha.review'

function PrivacyPage() {
  return (
    <article className="legal">
      <p className="eyebrow">Atualizada em {LEGAL_UPDATED_AT}</p>
      <h1>Política de privacidade</h1>
      <p className="lede">
        A Lanterninha é um site de avaliações de salas de cinema escritas pela comunidade. Coletamos o mínimo necessário
        para você ter uma conta e publicar avaliações, e nada é vendido a ninguém. Esta política segue a Lei Geral de
        Proteção de Dados (Lei nº 13.709/2018, LGPD).
      </p>

      <h2>Quais dados coletamos</h2>
      <ul>
        <li>
          <strong>Conta:</strong> nome de usuário (@), e-mail e senha. A senha é guardada apenas como hash — nem nós
          conseguimos lê-la.
        </li>
        <li>
          <strong>O que você publica:</strong> avaliações (notas, texto, fileira, filme, etiquetas e data) e respostas
          sobre as salas (tipo de tela, projeção, som). Avaliações e respostas são <strong>públicas</strong> e aparecem
          com o seu @.
        </li>
        <li>
          <strong>Sessão de acesso:</strong> quando você entra, guardamos um cookie de sessão e, junto da sessão, o
          endereço IP e o navegador usados, para manter você conectado e proteger a conta.
        </li>
        <li>
          <strong>Localização:</strong> em “Perto de mim”, a localização do navegador (se você permitir) é usada só no
          seu aparelho e nunca é enviada para nós. Sem ela, usamos a cidade aproximada da sua conexão, calculada pela
          Cloudflare a partir do IP, apenas para ordenar a lista — ela não é guardada.
        </li>
        <li>
          <strong>Rascunhos:</strong> o texto de uma avaliação não enviada fica salvo só no seu navegador (armazenamento
          local).
        </li>
      </ul>

      <h2>Para que usamos</h2>
      <ul>
        <li>Criar e manter sua conta, e permitir que você publique avaliações (execução do serviço que você pediu).</li>
        <li>Enviar e-mails de serviço: confirmação de e-mail e redefinição de senha. Não enviamos propaganda.</li>
        <li>Proteger o site contra abuso, spam e acessos indevidos (legítimo interesse).</li>
        <li>Calcular as notas das salas e as badges da sua coleção.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        Usamos apenas o cookie necessário para manter você conectado. Não usamos cookies de publicidade nem de
        rastreamento.
      </p>

      <h2>Com quem compartilhamos</h2>
      <p>Não vendemos nem alugamos dados. Alguns serviços operam partes do site para nós:</p>
      <ul>
        <li>
          <strong>Cloudflare</strong> — hospedagem, banco de dados e envio de e-mails. Os dados podem ser processados
          fora do Brasil, com as garantias previstas na LGPD para transferência internacional.
        </li>
        <li>
          <strong>OpenFreeMap</strong> (mapa de “Perto de mim”) e <strong>Google Fonts</strong> (fontes do site) —
          recebem o seu IP quando o navegador baixa mapas e fontes, como em qualquer site que os usa.
        </li>
        <li>
          <strong>Sites de ingressos</strong> (Ingresso.com, Velox Tickets e outros) — só se você clicar em um horário
          para comprar; a partir daí vale a política deles.
        </li>
      </ul>

      <h2>Por quanto tempo guardamos</h2>
      <p>
        Enquanto sua conta existir. Sessões expiram em 7 dias sem uso. Ao excluir a conta, apagamos seus dados de conta,
        avaliações e respostas imediatamente; cópias de segurança do banco são sobrescritas em até 30 dias.
      </p>

      <h2>Seus direitos</h2>
      <p>Pela LGPD (art. 18), você pode, a qualquer momento:</p>
      <ul>
        <li>confirmar se tratamos seus dados e acessá-los;</li>
        <li>corrigir dados incompletos ou desatualizados — suas avaliações podem ser editadas no próprio site;</li>
        <li>
          excluir sua conta e tudo o que publicou, em <Link to="/account">Conta</Link>;
        </li>
        <li>pedir a portabilidade ou informações sobre o compartilhamento dos seus dados;</li>
        <li>revogar consentimentos e reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</li>
      </ul>
      <p>
        Para qualquer pedido, escreva para <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Respondemos em até
        15 dias.
      </p>

      <h2>Crianças e adolescentes</h2>
      <p>
        A Lanterninha é destinada a maiores de 13 anos. Menores de 18 anos devem usar o site com o conhecimento dos
        responsáveis.
      </p>

      <h2>Mudanças nesta política</h2>
      <p>
        Se mudarmos algo importante, avisaremos no site antes de a mudança valer. Veja também os{' '}
        <Link to="/terms">Termos de uso</Link>.
      </p>
    </article>
  )
}
