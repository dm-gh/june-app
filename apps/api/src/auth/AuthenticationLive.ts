import { HttpApiError, HttpServerRequest } from "@effect/platform"
import { Authentication, type CurrencyCode, type UserId } from "@june/shared"
import { Effect, Layer } from "effect"
import { Auth } from "./Auth.js"

/**
 * Implements the contract's Authentication middleware: read the session cookie through
 * Better Auth and provide the CurrentUser. No session, or a broken one, is a 401.
 */
export const AuthenticationLive = Layer.effect(
  Authentication,
  Effect.gen(function* () {
    const auth = yield* Auth
    return Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      const session = yield* Effect.tryPromise({
        try: () => auth.api.getSession({ headers: new Headers(request.headers) }),
        catch: () => new HttpApiError.Unauthorized()
      })
      if (session === null) return yield* new HttpApiError.Unauthorized()
      const user = session.user
      return {
        id: user.id as UserId,
        email: user.email,
        name: user.name,
        image: user.image ?? null,
        defaultCurrency: (user.defaultCurrency ?? "USD") as CurrencyCode
      }
    })
  })
)
