import { HttpApiBuilder, HttpApiError } from "@effect/platform"
import { SqlClient } from "@effect/sql"
import { type CategoryId, categoryFits, type CreateExchange, CurrentUser, type CurrentUserShape, type ExchangeId, JuneApi, Transaction, type WalletId } from "@june/shared"
import { Effect, Option } from "effect"
import { randomUUID } from "node:crypto"
import { CategoriesRepo } from "../categories/Categories.js"
import { orNotFound } from "../http/errors.js"
import { Rates, type RateTable } from "../rates/Rates.js"
import { type WalletRow, WalletsRepo } from "../wallets/WalletsRepo.js"
import { RecordChange } from "./RecordChange.js"
import { categoryMismatch, checkChange as checkChangeRule, requireCategory as requireCategoryRule, requireWallet as requireWalletRule, violation } from "./rules.js"
import { type TransactionRow, TransactionsRepo } from "./TransactionsRepo.js"

/** The Transaction the api returns: the row converted into Default Currency for its own date. */
export const toTransaction = (row: TransactionRow, rates: Rates["Type"], table: RateTable, defaultCurrency: string): Transaction =>
  new Transaction({ ...row, defaultMinor: rates.convert(table, row.amountMinor, row.currency, defaultCurrency, row.occurredOn) })

export const TransactionsHandlersLive = HttpApiBuilder.group(JuneApi, "transactions", (handlers) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const repo = yield* TransactionsRepo
    const wallets = yield* WalletsRepo
    const categories = yield* CategoriesRepo
    const rates = yield* Rates
    const recordChange = yield* RecordChange

    /** Rows to API Transactions, converted into Default Currency. */
    const present = (user: CurrentUserShape, rows: ReadonlyArray<TransactionRow>) =>
      Effect.gen(function* () {
        const dates = rows.map((r) => r.occurredOn)
        yield* rates.ensure(dates)
        const table = yield* rates.table(dates)
        return rows.map((row) => toTransaction(row, rates, table, user.defaultCurrency))
      })

    const presentOne = (user: CurrentUserShape, row: TransactionRow) => present(user, [row]).pipe(Effect.map((ts) => ts[0]!))

    const requireWallet = (user: CurrentUserShape, id: WalletId) =>
      requireWalletRule(user.id, id).pipe(Effect.provideService(WalletsRepo, wallets))
    const requireCategory = (user: CurrentUserShape, id: CategoryId) =>
      requireCategoryRule(user.id, id).pipe(Effect.provideService(CategoriesRepo, categories))
    const checkChange = (user: CurrentUserShape, change: Parameters<typeof checkChangeRule>[1]) =>
      checkChangeRule(user.id, change).pipe(Effect.provideService(WalletsRepo, wallets), Effect.provideService(CategoriesRepo, categories))

    /** The rules both creating and editing an Exchange obey; resolves both Wallets. */
    const checkExchange = (user: CurrentUserShape, payload: Pick<CreateExchange, "sourceWalletId" | "sourceMinor" | "targetWalletId" | "targetMinor">) =>
      Effect.gen(function* () {
        if (payload.sourceWalletId === payload.targetWalletId) {
          return yield* violation("An Exchange needs two different Wallets")
        }
        const source = yield* requireWallet(user, payload.sourceWalletId)
        const target = yield* requireWallet(user, payload.targetWalletId)
        if (source.currency === target.currency && payload.sourceMinor !== payload.targetMinor) {
          return yield* violation("Same-currency Exchange must move equal amounts")
        }
        return { source, target }
      })

    /** Both legs, or 404 when the User has no such Exchange. */
    const findExchangeOrNotFound = (user: CurrentUserShape, exchangeId: ExchangeId) =>
      orNotFound(repo.findByExchange(user.id, exchangeId).pipe(Effect.map((legs) => (legs.length === 0 ? Option.none() : Option.some(legs)))))

    return handlers
      .handle("list", ({ urlParams }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          if (urlParams.from > urlParams.to) return []
          return yield* present(user, yield* repo.listInPeriod(user.id, urlParams.from, urlParams.to))
        })
      )
      .handle("get", ({ path }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          return yield* presentOne(user, yield* orNotFound(repo.find(user.id, path.id)))
        })
      )
      .handle("createChange", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const row = yield* recordChange.strict(user.id, {
            walletId: payload.walletId,
            amountMinor: payload.amountMinor,
            occurredOn: payload.occurredOn,
            categoryId: payload.categoryId,
            description: payload.description,
            tags: payload.tags,
            hiddenFromAnalysis: payload.hiddenFromAnalysis
          })
          return yield* presentOne(user, row)
        })
      )
      .handle("createExchange", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const { source, target } = yield* checkExchange(user, payload)
          const exchangeId = randomUUID() as ExchangeId
          const leg = (wallet: WalletRow, amountMinor: number) => ({
            walletId: wallet.id,
            type: "exchange" as const,
            amountMinor,
            currency: wallet.currency,
            occurredOn: payload.occurredOn,
            description: payload.description ?? "",
            tags: payload.tags ?? [],
            hiddenFromAnalysis: false,
            categoryId: null,
            exchangeId
          })
          const rows = yield* Effect.all([
            repo.insert(user.id, leg(source, -payload.sourceMinor)),
            repo.insert(user.id, leg(target, payload.targetMinor))
          ]).pipe(sql.withTransaction, Effect.orDie)
          return yield* present(user, rows)
        })
      )
      .handle("getExchange", ({ path }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          return yield* present(user, yield* findExchangeOrNotFound(user, path.exchangeId))
        })
      )
      .handle("updateExchange", ({ path, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const legs = yield* findExchangeOrNotFound(user, path.exchangeId)
          const sourceLeg = legs.find((l) => l.amountMinor < 0)
          const targetLeg = legs.find((l) => l.amountMinor > 0)
          if (sourceLeg === undefined || targetLeg === undefined) return yield* new HttpApiError.NotFound()
          const { source, target } = yield* checkExchange(user, payload)
          yield* Effect.all([
            repo.update(user.id, sourceLeg.id, { walletId: source.id, amountMinor: -payload.sourceMinor, currency: source.currency }),
            repo.update(user.id, targetLeg.id, { walletId: target.id, amountMinor: payload.targetMinor, currency: target.currency }),
            repo.updateExchange(user.id, path.exchangeId, {
              occurredOn: payload.occurredOn,
              description: payload.description ?? "",
              tags: payload.tags ?? []
            })
          ]).pipe(sql.withTransaction, Effect.orDie)
          return yield* present(user, yield* repo.findByExchange(user.id, path.exchangeId))
        })
      )
      .handle("update", ({ path, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const current = yield* orNotFound(repo.find(user.id, path.id))
          const next = {
            walletId: payload.walletId ?? current.walletId,
            amountMinor: payload.amountMinor ?? current.amountMinor,
            currency: payload.currency ?? current.currency,
            categoryId: payload.categoryId === undefined ? current.categoryId : payload.categoryId
          }
          switch (current.type) {
            case "change": {
              yield* checkChange(user, next)
              break
            }
            case "init": {
              if (payload.walletId !== undefined || payload.currency !== undefined || payload.categoryId) {
                return yield* violation("An Init only changes its amount, date or description")
              }
              break
            }
            case "exchange": {
              return yield* violation("An Exchange is edited as a whole")
            }
          }
          return yield* presentOne(user, yield* orNotFound(repo.update(user.id, current.id, payload)))
        })
      )
      .handle("bulkUpdate", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const rows = yield* repo.findMany(user.id, payload.ids)
          if (rows.length !== new Set(payload.ids).size) return yield* new HttpApiError.NotFound()
          if (payload.walletId !== undefined) {
            const wallet = yield* requireWallet(user, payload.walletId)
            if (rows.some((r) => r.type !== "change")) return yield* violation("Only Changes can move Wallet in bulk")
            if (rows.some((r) => r.currency !== wallet.currency)) {
              return yield* violation(`Every selected Transaction must be in ${wallet.currency}`)
            }
          }
          if (payload.categoryId !== undefined && payload.categoryId !== null) {
            const category = yield* requireCategory(user, payload.categoryId)
            if (rows.some((r) => r.type !== "change")) return yield* violation("Only Changes have a Category")
            if (rows.some((r) => !categoryFits(category, r.amountMinor))) return yield* categoryMismatch(category)
          }
          yield* repo.bulkSet(user.id, payload.ids, {
            walletId: payload.walletId,
            categoryId: payload.categoryId,
            addTags: payload.addTags ?? [],
            removeTags: payload.removeTags ?? []
          })
        })
      )
      .handle("delete", ({ path }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const row = yield* orNotFound(repo.find(user.id, path.id))
          yield* deleteRows(user, [row])
        })
      )
      .handle("bulkDelete", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const rows = yield* repo.findMany(user.id, payload.ids)
          if (rows.length !== new Set(payload.ids).size) return yield* new HttpApiError.NotFound()
          yield* deleteRows(user, rows)
        })
      )

    /** Inits are deleted with their Wallet only; an Exchange goes as a whole. */
    function deleteRows(user: CurrentUserShape, rows: ReadonlyArray<TransactionRow>) {
      return Effect.gen(function* () {
        if (rows.some((r) => r.type === "init")) {
          return yield* violation("An opening balance is removed by deleting its Wallet")
        }
        const exchangeIds = [...new Set(rows.flatMap((r) => (r.exchangeId === null ? [] : [r.exchangeId])))]
        const changeIds = rows.filter((r) => r.type === "change").map((r) => r.id)
        yield* Effect.all([repo.deleteExchanges(user.id, exchangeIds), repo.deleteMany(user.id, changeIds)]).pipe(
          sql.withTransaction,
          Effect.orDie
        )
      })
    }
  })
)

/** Distinct Tags across the User's Transactions, for the tag input's suggestions. */
export const TagsHandlersLive = HttpApiBuilder.group(JuneApi, "tags", (handlers) =>
  Effect.gen(function* () {
    const repo = yield* TransactionsRepo
    return handlers.handle("list", () => CurrentUser.pipe(Effect.flatMap((user) => repo.distinctTags(user.id))))
  })
)
