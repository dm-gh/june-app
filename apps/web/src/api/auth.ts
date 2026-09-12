import { createAuthClient } from "better-auth/react"

/** Better Auth's browser client, against the same-origin mount at /api/auth. */
export const authClient = createAuthClient({ basePath: "/api/auth" })

export const signInWithGoogle = () => authClient.signIn.social({ provider: "google", callbackURL: "/transactions" })

export const signOut = () => authClient.signOut()

/** Session state. `isPending` is true only during the first load. */
export const useSession = authClient.useSession
