import { HttpApiBuilder } from "@effect/platform"
import { SqlClient } from "@effect/sql"
import { CurrentUser, type CurrentUserShape, JuneApi, Me } from "@june/shared"
import { Effect } from "effect"
import { CaptureTokens } from "../capture/CaptureTokens.js"
import { AppConfig } from "../config.js"
import { RecurringsRepo } from "../recurrings/RecurringsRepo.js"
import { TransactionsRepo } from "../transactions/TransactionsRepo.js"

export const SettingsHandlersLive = HttpApiBuilder.group(JuneApi, "settings", (handlers) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const tokens = yield* CaptureTokens
    const config = yield* AppConfig
    const recurrings = yield* RecurringsRepo
    const transactions = yield* TransactionsRepo

    const me = (user: CurrentUserShape) =>
      tokens.exists(user.id).pipe(Effect.map((hasCaptureToken) => new Me({ ...user, hasCaptureToken })))

    return handlers
      .handle("me", () => CurrentUser.pipe(Effect.flatMap(me)))
      .handle("setDefaultCurrency", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          yield* sql`update "user" set default_currency = ${payload.currency}, updated_at = now() where id = ${user.id}`.pipe(
            Effect.orDie
          )
          return yield* me({ ...user, defaultCurrency: payload.currency })
        })
      )
      .handle("regenerateCaptureToken", () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const { token } = yield* tokens.regenerate(user.id)
          return { token, captureUrl: `${config.baseUrl}/api/capture/${token}` }
        })
      )
      .handle("attention", () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const [recurringsWithoutWallet, unassignedTransactions] = yield* Effect.all([
            recurrings.countWithoutWallet(user.id),
            transactions.countUnassigned(user.id)
          ])
          return { recurringsWithoutWallet, unassignedTransactions }
        })
      )
  })
)
