// Transactional email through Cloudflare Email Service (the `EMAIL` send_email
// binding): verification, password reset. Plain HTML styled like the site's
// paper tickets, with a text alternative. Never log addresses or links.
import { env } from 'cloudflare:workers'

const FROM = { name: 'Lanterninha', email: 'nao-responda@lanterninha.review' }

type Message = {
  to: string
  subject: string
  /** Short heading on the ticket. */
  heading: string
  /** Paragraphs of plain text (escaped). */
  paragraphs: string[]
  action: { label: string; url: string }
  /** Small print under the button. */
  footnote: string
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function html(m: Message) {
  const p = m.paragraphs
    .map((t) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#2b1a10">${escapeHtml(t)}</p>`)
    .join('')
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(m.subject)}</title></head>
<body style="margin:0;padding:24px 12px;background:#130d0a;font-family:Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#f3e7d0;border-radius:12px">
      <tr><td style="padding:22px 26px 8px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#a8231b;font-weight:bold">🔦 lanterninha</td></tr>
      <tr><td style="padding:0 26px 6px"><h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:24px;line-height:1.2;color:#2b1a10">${escapeHtml(m.heading)}</h1>${p}</td></tr>
      <tr><td style="padding:4px 26px 22px">
        <a href="${escapeHtml(m.action.url)}" style="display:inline-block;background:#a8231b;color:#f3e7d0;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:999px">${escapeHtml(m.action.label)}</a>
      </td></tr>
      <tr><td style="border-top:2px dashed #2b1a1040;background:#e6d5b5;border-radius:0 0 12px 12px;padding:14px 26px;font-size:12px;line-height:1.5;color:#6e5644">
        ${escapeHtml(m.footnote)}<br>Se o botão não funcionar, copie este link: <span style="word-break:break-all">${escapeHtml(m.action.url)}</span>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`
}

const text = (m: Message) =>
  [m.heading, '', ...m.paragraphs.flatMap((p) => [p, '']), `${m.action.label}: ${m.action.url}`, '', m.footnote, '', '— Lanterninha · lanterninha.review'].join('\n')

async function send(m: Message) {
  await env.EMAIL.send({ from: FROM, to: m.to, subject: m.subject, html: html(m), text: text(m) })
}

export function sendVerificationEmail(to: string, username: string, url: string) {
  return send({
    to,
    subject: 'Confirme seu e-mail na Lanterninha',
    heading: `Oi, @${username}! Confirme seu e-mail`,
    paragraphs: [
      'Falta só um passo: confirme que este e-mail é seu. Assim você consegue recuperar a conta se esquecer a senha.',
    ],
    action: { label: 'Confirmar e-mail', url },
    footnote: 'O link vale por 1 hora. Se você não criou uma conta na Lanterninha, ignore este e-mail.',
  })
}

export function sendPasswordResetEmail(to: string, username: string, url: string) {
  return send({
    to,
    subject: 'Redefinir sua senha na Lanterninha',
    heading: 'Vamos criar uma senha nova',
    paragraphs: [`Recebemos um pedido para redefinir a senha de @${username}.`],
    action: { label: 'Criar nova senha', url },
    footnote:
      'O link vale por 1 hora e só pode ser usado uma vez. Se não foi você, ignore este e-mail: sua senha continua a mesma.',
  })
}
