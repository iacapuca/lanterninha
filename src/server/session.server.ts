// Signed-cookie session. Web Crypto only, so it runs unchanged on Node, Bun,
// Workers and Vercel/Netlify functions.
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'

const COOKIE = 'lanterninha_session'
const ONE_YEAR = 60 * 60 * 24 * 365
const encoder = new TextEncoder()

// Read per call: never cache env at module scope (edge runtimes inject it per request).
function secret() {
  const value = process.env.SESSION_SECRET
  if (value) return value
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET is not set')
  return 'lanterninha-dev-secret'
}

async function hmacKey() {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

function toBase64Url(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64Url(s: string) {
  const binary = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

export async function readSession(): Promise<{ username: string } | null> {
  const value = getCookie(COOKIE)
  if (!value) return null
  const [username, signature] = value.split('.')
  if (!username || !signature) return null
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(),
      fromBase64Url(signature),
      encoder.encode(username),
    )
    return valid ? { username } : null
  } catch {
    return null
  }
}

export async function startSession(username: string) {
  const signature = toBase64Url(
    await crypto.subtle.sign('HMAC', await hmacKey(), encoder.encode(username)),
  )
  setCookie(COOKIE, `${username}.${signature}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR,
  })
}

export function endSession() {
  deleteCookie(COOKIE, { path: '/' })
}
