import { FetchHttpClient, HttpApiClient } from "@effect/platform"
import { JuneApi } from "@june/shared"
import { Cause, Effect, Exit, ManagedRuntime } from "effect"

/**
 * The typed June client, derived from the shared contract. Same origin as the page, so the
 * session cookie travels with every request and no base URL is configured.
 */
const runtime = ManagedRuntime.make(FetchHttpClient.layer)

export const api = await runtime.runPromise(HttpApiClient.make(JuneApi, { baseUrl: window.location.origin }))

/** What the UI shows when a request fails. */
export class ApiError extends Error {
  constructor(
    readonly kind: "rule" | "unauthorized" | "not-found" | "rates" | "network" | "unknown",
    message: string
  ) {
    super(message)
  }
}

const toApiError = (error: unknown): ApiError => {
  if (typeof error === "object" && error !== null && "_tag" in error) {
    const tagged = error as { _tag: string; message?: string }
    switch (tagged._tag) {
      case "RuleViolation":
        return new ApiError("rule", tagged.message ?? "That is not allowed")
      case "Unauthorized":
        return new ApiError("unauthorized", "Please sign in again")
      case "NotFound":
        return new ApiError("not-found", "Not found")
      case "RateUnavailable":
        return new ApiError("rates", tagged.message ?? "Exchange rates are unavailable right now")
      case "HttpApiDecodeError":
        return new ApiError("unknown", tagged.message ?? "The request was rejected")
      case "RequestError":
      case "ResponseError":
        return new ApiError("network", "June is unreachable. Check your connection.")
    }
  }
  return new ApiError("unknown", error instanceof Error ? error.message : "Something went wrong")
}

/** Run a client call as a promise, turning every failure into an ApiError. */
export const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
  runtime.runPromiseExit(effect).then((exit) => {
    if (Exit.isSuccess(exit)) return exit.value
    throw toApiError(Cause.squash(exit.cause))
  })
