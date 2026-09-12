import type { UserId } from "@june/shared"
import { betterAuth } from "better-auth"
import { Config, Context, Effect, Layer, Redacted, Runtime } from "effect"
import { Pool } from "pg"
import { CaptureTokens } from "../capture/CaptureTokens.js"
import { AppConfig } from "../config.js"
import { authOptions } from "./authOptions.js"

const makeAuth = (settings: Parameters<typeof authOptions>[0]) => betterAuth(authOptions(settings))
export type JuneAuth = ReturnType<typeof makeAuth>

/** The Better Auth instance. Owns its own pg Pool, separate from Effect's SqlClient. */
export class Auth extends Context.Tag("Auth")<Auth, JuneAuth>() {}

export const AuthLive = Layer.scoped(
  Auth,
  Effect.gen(function* () {
    const config = yield* AppConfig
    const captureTokens = yield* CaptureTokens
    const runtime = yield* Effect.runtime<never>()
    const databaseUrl = yield* Config.redacted("DATABASE_URL")
    const pool = yield* Effect.acquireRelease(
      Effect.sync(() => new Pool({ connectionString: Redacted.value(databaseUrl) })),
      (pool) => Effect.promise(() => pool.end())
    )
    return makeAuth({
      pool,
      baseURL: config.baseUrl,
      secret: Redacted.value(config.authSecret),
      google: { clientId: config.googleClientId, clientSecret: Redacted.value(config.googleClientSecret) },
      // A Capture Token exists from the first sign-in so Settings can always offer the Shortcut.
      onUserCreated: (userId) => Runtime.runPromise(runtime)(captureTokens.ensure(userId as UserId))
    })
  })
)
