import { HttpApiError, HttpApiMiddleware } from "@effect/platform"
import { Context } from "effect"
import type { CurrencyCode } from "../currency.js"
import type { UserId } from "../domain.js"

/** The signed-in User, resolved from the session cookie by the api. */
export interface CurrentUserShape {
  readonly id: UserId
  readonly email: string
  readonly name: string
  readonly image: string | null
  readonly defaultCurrency: CurrencyCode
}

export class CurrentUser extends Context.Tag("CurrentUser")<CurrentUser, CurrentUserShape>() {}

/**
 * Session middleware. Every group except `capture` and `health` requires it.
 * The implementation lives in apps/api (Better Auth); the contract only says a User is provided.
 */
export class Authentication extends HttpApiMiddleware.Tag<Authentication>()("Authentication", {
  failure: HttpApiError.Unauthorized,
  provides: CurrentUser
}) {}
