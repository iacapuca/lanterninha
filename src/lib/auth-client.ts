import { createAuthClient } from 'better-auth/react'
import { usernameClient } from 'better-auth/client/plugins'

// Browser-side client for /api/auth. Same origin, so no baseURL is needed.
export const authClient = createAuthClient({
  plugins: [usernameClient()],
})
