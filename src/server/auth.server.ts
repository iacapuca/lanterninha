import { env } from 'cloudflare:workers'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { username } from 'better-auth/plugins/username'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { USERNAME_PATTERN } from '~/lib/schemas'
import { db } from './db/client.server'
import { account, session, user, verification } from './db/schema.server'

/**
 * Email + password with a public @username: the simplest Better Auth setup
 * that needs no email provider and no OAuth app. People register with
 * username, email and password, and can sign in with either username or email.
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
