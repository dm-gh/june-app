import { HttpApiBuilder } from "@effect/platform"
import { SqlClient } from "@effect/sql"
import { CurrentUser, JuneApi } from "@june/shared"
import { Effect } from "effect"
import { orNotFound } from "../http/errors.js"
import { RecordChange } from "../transactions/RecordChange.js"
import { LoansRepo } from "./LoansRepo.js"

/**
 * Loans (CONTEXT.md): a stored current position, Lent when positive and Borrowed when negative.
 * Settling records an ordinary Change and moves the Loan by the opposite of its amount, in one
 * transaction; nothing links the two (ADR-0005). A decoded row is the Loan the api returns.
 */
export const LoansHandlersLive = HttpApiBuilder.group(JuneApi, "loans", (handlers) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const repo = yield* LoansRepo
    const recordChange = yield* RecordChange

    return handlers
      .handle("list", () => CurrentUser.pipe(Effect.flatMap((user) => repo.list(user.id))))
      .handle("get", ({ path }) => CurrentUser.pipe(Effect.flatMap((user) => orNotFound(repo.find(user.id, path.id)))))
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          return yield* repo.insert(user.id, { amountMinor: payload.amountMinor, currency: payload.currency, description: payload.description ?? "" })
        })
      )
      .handle("update", ({ path, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          return yield* orNotFound(repo.update(user.id, path.id, payload))
        })
      )
      .handle("delete", ({ path }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          yield* orNotFound(repo.remove(user.id, path.id))
        })
      )
      .handle("settle", ({ path, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const loan = yield* orNotFound(repo.find(user.id, path.id))
          const change = payload.change
          return yield* Effect.gen(function* () {
            // A settlement is entered by hand in the Loan's currency and Hidden from analysis unless the User says otherwise.
            yield* recordChange.strict(
              user.id,
              {
                walletId: change.walletId,
                amountMinor: change.amountMinor,
                currency: loan.currency,
                occurredOn: change.occurredOn,
                categoryId: change.categoryId,
                description: change.description,
                tags: change.tags,
                hiddenFromAnalysis: change.hiddenFromAnalysis
              },
              { hiddenFromAnalysis: true }
            )
            // Money arriving in the Wallet shrinks what they owe; money leaving grows it.
            return yield* orNotFound(repo.move(user.id, loan.id, -change.amountMinor))
          }).pipe(sql.withTransaction, Effect.catchTag("SqlError", (e) => Effect.die(e)))
        })
      )
  })
)
