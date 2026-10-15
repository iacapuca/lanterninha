import { env } from 'cloudflare:workers'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { username } from 'better-auth/plugins/username'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { USERNAME_PATTERN } from '~/lib/schemas'
import { db } from './db/client.server'
import { sendPasswordResetEmail, sendVerificationEmail } from './email.server'
import { account, session, user, verification } from './db/schema.server'

/**
 * Email + password with a public @username. People register with username,
 * email and password, and can sign in with either. Verification and password
 * reset emails go out through Cloudflare Email Service; verifying is
 * encouraged (it's how a forgotten password is recovered) but not required.
 */
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  // Derived per request, but only for our own hosts (local dev and preview included).
  baseURL: {
    allowedHosts: ['lanterninha.review', 'localhost:*', '127.0.0.1:*'],
    fallback: 'https://lanterninha.review',
  },
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
    // The link lands on /reset-password with the token (see that route).
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, displayName(user), url)
    },
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, displayName(user), url)
    },
  },
  user: {
    // LGPD: people can delete their account; reviews and votes cascade with it.
    deleteUser: { enabled: true },
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 24,
      usernameValidator: (value) => USERNAME_PATTERN.test(value),
    }),
    // Must stay last: lets auth.api calls from server functions set cookies.
    tanstackStartCookies(),
  ],
})

function displayName(user: { name: string; username?: string | null }) {
  return user.username ?? user.name
}
