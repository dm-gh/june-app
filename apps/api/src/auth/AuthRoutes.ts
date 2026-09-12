import { HttpApiBuilder, HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"
import { Auth } from "./Auth.js"

/**
 * Mounts Better Auth's fetch handler under /api/auth so sign-in, callback and sign-out are
 * served by the same origin as the rest of the api. Not part of the HttpApi contract.
 */
export const AuthRoutesLive = HttpApiBuilder.Router.use((router) =>
  Effect.gen(function* () {
    const auth = yield* Auth
    const app = Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      const webRequest = yield* HttpServerRequest.toWeb(request)
      const webResponse = yield* Effect.promise(() => auth.handler(webRequest))
      return HttpServerResponse.fromWeb(webResponse)
    })
    yield* router.mountApp("/api/auth", app, { includePrefix: true })
  })
)
