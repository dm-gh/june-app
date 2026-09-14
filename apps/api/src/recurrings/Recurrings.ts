import { HttpApiBuilder } from "@effect/platform"
import { SqlClient } from "@effect/sql"
import {
  type CategoryId,
  CurrentUser,
  type CurrentUserShape,
  JuneApi,
  type LocalDate,
  nextOnOrAfter,
  parseCron,
  Recurring,
  todayUtc,
  type WalletId
} from "@june/shared"
import { Effect, Either } from "effect"
import { CategoriesRepo } from "../categories/Categories.js"
import { orNotFound } from "../http/errors.js"
import { Rates } from "../rates/Rates.js"
import { checkChange, violation } from "../transactions/rules.js"
import { toTransaction } from "../transactions/Transactions.js"
import { WalletsRepo } from "../wallets/WalletsRepo.js"
import { RecurringFiring } from "./Firing.js"
import { type RecurringRow, RecurringsRepo } from "./RecurringsRepo.js"

/** The Recurring the api returns: the row without its User. */
export const toRecurring = (row: RecurringRow): Recurring => new Recurring(row)

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

    /**
     * The template obeys the hand-entered Change's rule: a Wallet that exists and a Category of
     * the right type (its amount is non-zero by schema). Unassigned only happens by deletion.
     */
    const checkTemplate = (user: CurrentUserShape, t: { walletId: WalletId; amountMinor: number; categoryId: CategoryId | null | undefined }) =>
      checkChange(user.id, { walletId: t.walletId, amountMinor: t.amountMinor, categoryId: t.categoryId ?? null }).pipe(
        Effect.provideService(WalletsRepo, wallets),
        Effect.provideService(CategoriesRepo, categories)
      )

    return handlers
      .handle("list", () => CurrentUser.pipe(Effect.flatMap((user) => repo.list(user.id)), Effect.map((rows) => rows.map(toRecurring))))
      .handle("get", ({ path }) => CurrentUser.pipe(Effect.flatMap((user) => orNotFound(repo.find(user.id, path.id))), Effect.map(toRecurring)))
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
          const current = yield* orNotFound(repo.find(user.id, path.id))
          // A Wallet named moves the template into it, currency included; the rule is checked against whichever Wallet stands.
          let walletFields: { walletId: WalletId; currency: string } | undefined
          const walletId = payload.walletId ?? current.walletId
          if (walletId !== null) {
            const wallet = yield* checkTemplate(user, {
              walletId,
              amountMinor: payload.amountMinor ?? current.amountMinor,
              categoryId: payload.categoryId === undefined ? current.categoryId : payload.categoryId
            })
            if (payload.walletId !== undefined) walletFields = { walletId: wallet.id, currency: wallet.currency }
          }
          // Any word about the Schedule or Auto recomputes the next due date from today.
          let scheduleFields: { cron: string | null; nextOn: LocalDate | null } | undefined
          if (payload.cron !== undefined || payload.nextOn !== undefined || payload.auto !== undefined) {
            const cron = payload.cron === undefined ? current.cron : payload.cron
            const nextOn = payload.nextOn === undefined ? (payload.cron !== undefined ? null : current.nextOn) : payload.nextOn
            const schedule = resolveSchedule({ cron, nextOn, auto: payload.auto ?? current.auto }, todayUtc())
            if (Either.isLeft(schedule)) return yield* violation(schedule.left)
            scheduleFields = schedule.right
          }
          const updated = yield* orNotFound(
            repo.update(user.id, current.id, {
              name: payload.name,
              amountMinor: payload.amountMinor,
              categoryId: payload.categoryId,
              description: payload.description,
              tags: payload.tags,
              auto: payload.auto,
              ...walletFields,
              ...scheduleFields
            })
          )
          return toRecurring(updated)
        })
      )
      .handle("delete", ({ path }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          yield* orNotFound(repo.remove(user.id, path.id))
        })
      )
      .handle("fire", ({ path, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const row = yield* orNotFound(repo.find(user.id, path.id))
          const recorded = yield* firing.fireOne(row, payload.change).pipe(sql.withTransaction, Effect.catchTag("SqlError", (e) => Effect.die(e)))
          yield* rates.ensure([recorded.occurredOn])
          const table = yield* rates.table([recorded.occurredOn])
          return toTransaction(recorded, rates, table, user.defaultCurrency)
        })
      )
  })
)
