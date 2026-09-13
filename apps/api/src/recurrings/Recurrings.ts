import { HttpApiBuilder, HttpApiError } from "@effect/platform"
import { SqlClient } from "@effect/sql"
import {
  type CategoryId,
  CurrentUser,
  type CurrentUserShape,
  JuneApi,
  type LocalDate,
  nextOnOrAfter,
  parseCron,
  type Recurring,
  type RecurringId,
  todayUtc,
  type WalletId
} from "@june/shared"
import { DateTime, Effect, Either, Option } from "effect"
import { CategoriesRepo } from "../categories/Categories.js"
import { Rates } from "../rates/Rates.js"
import { checkChange, requireCategory, requireWallet, violation } from "../transactions/rules.js"
import { toTransaction } from "../transactions/Transactions.js"
import { WalletsRepo } from "../wallets/WalletsRepo.js"
import { RecurringFiring } from "./Firing.js"
import { type RecurringPatch, type RecurringRow, RecurringsRepo } from "./RecurringsRepo.js"

export const toRecurring = (row: RecurringRow): Recurring =>
  ({
    id: row.id,
    name: row.name,
    walletId: row.walletId,
    amountMinor: row.amountMinor,
    currency: row.currency,
    categoryId: row.categoryId,
    description: row.description,
    tags: row.tags,
    auto: row.auto,
    cron: row.cron,
    nextOn: row.nextOn,
    lastFiredOn: row.lastFiredOn,
    createdAt: DateTime.unsafeFromDate(row.createdAt),
    updatedAt: DateTime.unsafeFromDate(row.updatedAt)
  }) as Recurring

/**
 * The Schedule the client asked for, resolved: a cron expression gives the first due date on or
 * after today; a lone date is a once Schedule; neither is no Schedule, which Auto cannot have.
 */
export const resolveSchedule = (
  input: { cron: string | null; nextOn: LocalDate | null; auto: boolean },
  today: LocalDate
): Either.Either<{ cron: string | null; nextOn: LocalDate | null }, string> => {
  if (input.cron !== null) {
    const cron = parseCron(input.cron)
    if (Either.isLeft(cron)) return Either.left(`Schedule cannot be read: ${cron.left}`)
    return Either.right({ cron: input.cron, nextOn: nextOnOrAfter(cron.right, today) })
  }
  if (input.nextOn === null && input.auto) return Either.left("Auto needs a schedule")
  return Either.right({ cron: null, nextOn: input.nextOn })
}

export const RecurringsHandlersLive = HttpApiBuilder.group(JuneApi, "recurrings", (handlers) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const repo = yield* RecurringsRepo
    const wallets = yield* WalletsRepo
    const categories = yield* CategoriesRepo
    const rates = yield* Rates
    const firing = yield* RecurringFiring
    const provideRepos = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      effect.pipe(Effect.provideService(WalletsRepo, wallets), Effect.provideService(CategoriesRepo, categories))

    const findOrNotFound = (user: CurrentUserShape, id: RecurringId) =>
      repo.find(user.id, id).pipe(Effect.flatMap(Option.match({ onNone: () => new HttpApiError.NotFound(), onSome: Effect.succeed })))

    /** The template's own rule: a Wallet in its currency and a Category of the right type. Unassigned only happens by deletion. */
    const checkTemplate = (user: CurrentUserShape, t: { walletId: WalletId; amountMinor: number; categoryId: CategoryId | null | undefined }) =>
      Effect.gen(function* () {
        const wallet = yield* requireWallet(user, t.walletId)
        if (t.categoryId) {
          const category = yield* requireCategory(user, t.categoryId)
          if ((t.amountMinor < 0) !== (category.type === "expense")) return yield* violation(`${category.name} is an ${category.type} Category`)
        }
        return wallet
      }).pipe(provideRepos)

    return handlers
      .handle("list", () => CurrentUser.pipe(Effect.flatMap((user) => repo.list(user.id)), Effect.map((rows) => rows.map(toRecurring))))
      .handle("get", ({ path }) => CurrentUser.pipe(Effect.flatMap((user) => findOrNotFound(user, path.id)), Effect.map(toRecurring)))
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const wallet = yield* checkTemplate(user, { walletId: payload.walletId, amountMinor: payload.amountMinor, categoryId: payload.categoryId })
          const schedule = resolveSchedule({ cron: payload.cron ?? null, nextOn: payload.nextOn ?? null, auto: payload.auto }, todayUtc())
          if (Either.isLeft(schedule)) return yield* violation(schedule.left)
          const row = yield* repo.insert(user.id, {
            name: payload.name,
            walletId: wallet.id,
            amountMinor: payload.amountMinor,
            currency: wallet.currency,
            categoryId: payload.categoryId ?? null,
            description: payload.description ?? "",
            tags: payload.tags ?? [],
            auto: payload.auto,
            cron: schedule.right.cron,
            nextOn: schedule.right.nextOn
          })
          return toRecurring(row)
        })
      )
      .handle("update", ({ path, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const current = yield* findOrNotFound(user, path.id)
          const patch: RecurringPatch = {
            ...(payload.name !== undefined ? { name: payload.name } : {}),
            ...(payload.amountMinor !== undefined ? { amountMinor: payload.amountMinor } : {}),
            ...(payload.categoryId !== undefined ? { categoryId: payload.categoryId } : {}),
            ...(payload.description !== undefined ? { description: payload.description } : {}),
            ...(payload.tags !== undefined ? { tags: payload.tags } : {}),
            ...(payload.auto !== undefined ? { auto: payload.auto } : {})
          }
          const walletId = payload.walletId ?? current.walletId
          if (walletId !== null) {
            const wallet = yield* checkTemplate(user, {
              walletId,
              amountMinor: payload.amountMinor ?? current.amountMinor,
              categoryId: payload.categoryId === undefined ? current.categoryId : payload.categoryId
            })
            if (payload.walletId !== undefined) Object.assign(patch, { walletId: wallet.id, currency: wallet.currency })
          }
          // Any word about the Schedule or Auto recomputes the next due date from today.
          const touchesSchedule = payload.cron !== undefined || payload.nextOn !== undefined || payload.auto !== undefined
          if (touchesSchedule) {
            const cron = payload.cron === undefined ? current.cron : payload.cron
            const nextOn = payload.nextOn === undefined ? (payload.cron !== undefined ? null : current.nextOn) : payload.nextOn
            const schedule = resolveSchedule({ cron, nextOn, auto: payload.auto ?? current.auto }, todayUtc())
            if (Either.isLeft(schedule)) return yield* violation(schedule.left)
            Object.assign(patch, schedule.right)
          }
          const updated = yield* repo.update(user.id, current.id, patch)
          if (Option.isNone(updated)) return yield* new HttpApiError.NotFound()
          return toRecurring(updated.value)
        })
      )
      .handle("delete", ({ path }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const removed = yield* repo.remove(user.id, path.id)
          if (!removed) return yield* new HttpApiError.NotFound()
        })
      )
      .handle("fire", ({ path, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const row = yield* findOrNotFound(user, path.id)
          if (payload.change) {
            const wallet = yield* checkChange(user, {
              walletId: payload.change.walletId,
              amountMinor: payload.change.amountMinor,
              currency: row.currency,
              categoryId: payload.change.categoryId ?? null
            }).pipe(provideRepos)
            if (wallet.currency !== row.currency) return yield* violation(`Wallet ${wallet.name} holds ${wallet.currency}, not ${row.currency}`)
          }
          const recorded = yield* firing.fireOne(row, payload.change).pipe(sql.withTransaction, Effect.catchTag("SqlError", (e) => Effect.die(e)))
          yield* rates.ensure([recorded.occurredOn])
          const table = yield* rates.table([recorded.occurredOn])
          return toTransaction(recorded, rates, table, user.defaultCurrency)
        })
      )
  })
)
