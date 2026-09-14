import type { UserId } from "@june/shared"
import { betterAuth } from "better-auth"
import { Context, Effect, Layer, Redacted, Runtime } from "effect"
import { CaptureTokens } from "../capture/CaptureTokens.js"
import { AppConfig } from "../config.js"
import { PgPool } from "../db/PgLive.js"
import { authOptions } from "./authOptions.js"

const makeAuth = (settings: Parameters<typeof authOptions>[0]) => betterAuth(authOptions(settings))
export type JuneAuth = ReturnType<typeof makeAuth>

/** The Better Auth instance. Its Kysely dialect draws from the same pg Pool as Effect's SqlClient. */
export class Auth extends Context.Tag("Auth")<Auth, JuneAuth>() {}

export const AuthLive = Layer.effect(
  Auth,
  Effect.gen(function* () {
    const config = yield* AppConfig
    const pool = yield* PgPool
    const captureTokens = yield* CaptureTokens
    const runtime = yield* Effect.runtime<never>()
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
