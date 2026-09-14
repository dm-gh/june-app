import { HttpApiBuilder } from "@effect/platform"
import { SqlClient } from "@effect/sql"
import {
  CurrentUser,
  type CurrentUserShape,
  JuneApi,
  type LocalDate,
  MinorAmount,
  RuleViolation,
  todayUtc,
  Wallet,
  type WalletId
} from "@june/shared"
import { Effect, Option } from "effect"
import { orNotFound } from "../http/errors.js"
import { Rates } from "../rates/Rates.js"
import { TransactionsRepo } from "../transactions/TransactionsRepo.js"
import { type WalletRow, WalletsRepo } from "./WalletsRepo.js"

/** `wallet_<currency>_delete_<dd.mm.yyyy>`, the system Tag on Changes collapsed from Exchanges. */
export const walletDeleteTag = (currency: string, on: LocalDate): string => {
  const [y, m, d] = on.split("-")
  return `wallet_${currency.toLowerCase()}_delete_${d}.${m}.${y}`
}

export const WalletsHandlersLive = HttpApiBuilder.group(JuneApi, "wallets", (handlers) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const wallets = yield* WalletsRepo
    const transactions = yield* TransactionsRepo
    const rates = yield* Rates

    /** Wallet rows with Balance, Init amount and Balance in Default Currency at today's rate. */
    const view = (user: CurrentUserShape, rows: ReadonlyArray<WalletRow>) =>
      Effect.gen(function* () {
        const today = todayUtc()
        yield* rates.ensure([today])
        const table = yield* rates.table([today])
        const balances = yield* transactions.balances(user.id)
        const result: Array<Wallet> = []
        for (const row of rows) {
          const init = yield* transactions.initOf(user.id, row.id)
          const balanceMinor = MinorAmount.make(balances.get(row.id) ?? 0)
          result.push(
            new Wallet({
              ...row,
              balanceMinor,
              initMinor: Option.isSome(init) ? init.value.amountMinor : MinorAmount.make(0),
              balanceDefaultMinor: rates.convert(table, balanceMinor, row.currency, user.defaultCurrency, today)
            })
          )
        }
        return result
      })

    const one = (user: CurrentUserShape, row: WalletRow) => view(user, [row]).pipe(Effect.map((ws) => ws[0]!))

    return handlers
      .handle("list", () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const list = yield* view(user, yield* wallets.list(user.id))
          const total = list.reduce<MinorAmount | null>(
            (acc, w) => (acc === null || w.balanceDefaultMinor === null ? null : MinorAmount.make(acc + w.balanceDefaultMinor)),
            MinorAmount.make(0)
          )
          return { wallets: list, totalDefaultMinor: total }
        })
      )
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const row = yield* Effect.gen(function* () {
            const wallet = yield* wallets.insert(user.id, { name: payload.name, currency: payload.currency })
            yield* transactions.insert(user.id, {
              walletId: wallet.id,
              type: "init",
              amountMinor: payload.initMinor,
              currency: payload.currency,
              occurredOn: payload.initOn ?? todayUtc(),
              description: "",
              tags: [],
              hiddenFromAnalysis: false,
              categoryId: null,
              exchangeId: null
            })
            return wallet
          }).pipe(sql.withTransaction, Effect.orDie)
          return yield* one(user, row)
        })
      )
      .handle("update", ({ path, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          let row = yield* orNotFound(wallets.find(user.id, path.id))
          if (payload.name !== undefined) {
            row = Option.getOrElse(yield* wallets.rename(user.id, path.id, payload.name), () => row)
          }
          if (payload.initMinor !== undefined) {
            const init = yield* transactions.initOf(user.id, path.id)
            if (Option.isSome(init)) {
              yield* transactions.update(user.id, init.value.id, { amountMinor: payload.initMinor })
            }
          }
          return yield* one(user, row)
        })
      )
      .handle("reorder", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const current = (yield* wallets.list(user.id)).map((w) => w.id)
          const same = current.length === payload.ids.length && current.every((id) => payload.ids.includes(id))
          const unique = new Set(payload.ids).size === payload.ids.length
          if (!same || !unique) {
            return yield* new RuleViolation({ message: "Wallet order must list every Wallet exactly once" })
          }
          yield* wallets.reorder(user.id, payload.ids as ReadonlyArray<WalletId>)
        })
      )
      .handle("delete", ({ path }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const wallet = yield* orNotFound(wallets.find(user.id, path.id))
          yield* Effect.gen(function* () {
            yield* transactions.deleteInitOf(user.id, wallet.id)
            yield* transactions.collapseExchangesOf(user.id, wallet.id, walletDeleteTag(wallet.currency, todayUtc()))
            // Remaining Changes lose their Wallet through the foreign key's set null.
            yield* wallets.remove(user.id, wallet.id)
          }).pipe(sql.withTransaction, Effect.orDie)
        })
      )
  })
)
