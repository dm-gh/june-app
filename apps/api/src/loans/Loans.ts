import { HttpApiBuilder, HttpApiError } from "@effect/platform"
import { SqlClient } from "@effect/sql"
import { CurrentUser, type CurrentUserShape, JuneApi, type Loan, type LoanId } from "@june/shared"
import { DateTime, Effect, Option } from "effect"
import { CategoriesRepo } from "../categories/Categories.js"
import { checkChange, violation } from "../transactions/rules.js"
import { TransactionsRepo } from "../transactions/TransactionsRepo.js"
import { WalletsRepo } from "../wallets/WalletsRepo.js"
import { type LoanRow, LoansRepo } from "./LoansRepo.js"

export const toLoan = (row: LoanRow): Loan =>
  ({
    id: row.id,
    amountMinor: row.amountMinor,
    currency: row.currency,
    description: row.description,
    archived: row.archived,
    createdAt: DateTime.unsafeFromDate(row.createdAt),
    updatedAt: DateTime.unsafeFromDate(row.updatedAt)
  }) as Loan

/**
 * Loans (CONTEXT.md): a stored current position, Lent when positive and Borrowed when negative.
 * Settling records an ordinary Change and moves the Loan by the opposite of its amount, in one
 * transaction; nothing links the two (ADR-0005).
 */
export const LoansHandlersLive = HttpApiBuilder.group(JuneApi, "loans", (handlers) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const repo = yield* LoansRepo
    const wallets = yield* WalletsRepo
    const categories = yield* CategoriesRepo
    const transactions = yield* TransactionsRepo

    const findOrNotFound = (user: CurrentUserShape, id: LoanId) =>
      repo.find(user.id, id).pipe(Effect.flatMap(Option.match({ onNone: () => new HttpApiError.NotFound(), onSome: Effect.succeed })))

    return handlers
      .handle("list", () => CurrentUser.pipe(Effect.flatMap((user) => repo.list(user.id)), Effect.map((rows) => rows.map(toLoan))))
      .handle("get", ({ path }) => CurrentUser.pipe(Effect.flatMap((user) => findOrNotFound(user, path.id)), Effect.map(toLoan)))
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const row = yield* repo.insert(user.id, { amountMinor: payload.amountMinor, currency: payload.currency, description: payload.description ?? "" })
          return toLoan(row)
        })
      )
      .handle("update", ({ path, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const updated = yield* repo.update(user.id, path.id, {
            ...(payload.amountMinor !== undefined ? { amountMinor: payload.amountMinor } : {}),
            ...(payload.currency !== undefined ? { currency: payload.currency } : {}),
            ...(payload.description !== undefined ? { description: payload.description } : {}),
            ...(payload.archived !== undefined ? { archived: payload.archived } : {})
          })
          if (Option.isNone(updated)) return yield* new HttpApiError.NotFound()
          return toLoan(updated.value)
        })
      )
      .handle("delete", ({ path }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const removed = yield* repo.remove(user.id, path.id)
          if (!removed) return yield* new HttpApiError.NotFound()
        })
      )
      .handle("settle", ({ path, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const loan = yield* findOrNotFound(user, path.id)
          const change = payload.change
          const wallet = yield* checkChange(user, {
            walletId: change.walletId,
            amountMinor: change.amountMinor,
            currency: loan.currency,
            categoryId: change.categoryId ?? null
          }).pipe(Effect.provideService(WalletsRepo, wallets), Effect.provideService(CategoriesRepo, categories))
          if (wallet.currency !== loan.currency) return yield* violation(`Settle in ${loan.currency}: ${wallet.name} holds ${wallet.currency}`)
          const moved = yield* Effect.gen(function* () {
            yield* transactions.insert(user.id, {
              walletId: wallet.id,
              type: "change",
              amountMinor: change.amountMinor,
              currency: wallet.currency,
              occurredOn: change.occurredOn,
              description: change.description ?? "",
              tags: change.tags ?? [],
              hiddenFromAnalysis: change.hiddenFromAnalysis ?? true,
              categoryId: change.categoryId ?? null,
              exchangeId: null
            })
            // Money arriving in the Wallet shrinks what they owe; money leaving grows it.
            return yield* repo.move(user.id, loan.id, -change.amountMinor)
          }).pipe(sql.withTransaction, Effect.orDie)
          if (Option.isNone(moved)) return yield* new HttpApiError.NotFound()
          return toLoan(moved.value)
        })
      )
  })
)
