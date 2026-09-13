import { SqlClient } from "@effect/sql"
import { type CreateChange, type LocalDate, nextAfter, parseCron, RuleViolation, todayUtc } from "@june/shared"
import { Context, Effect, Either, Layer, Option } from "effect"
import { type TransactionRow, TransactionsRepo } from "../transactions/TransactionsRepo.js"
import { type RecurringRow, RecurringsRepo } from "./RecurringsRepo.js"

/**
 * Firing (CONTEXT.md): one Change from a Recurring, dated the due date it is fired for, then the
 * Schedule advances. Auto firing catches up every due date missed while June was down. Nothing
 * links the Change back to the Recurring (ADR-0005).
 */
export interface RecurringFiringShape {
  /**
   * Fire one Recurring by hand, inside the caller's transaction. `change` replaces the Recurring's
   * own fields (Edit & submit); otherwise the Change is the Recurring as is, dated `nextOn` or today.
   */
  readonly fireOne: (row: RecurringRow, change?: CreateChange) => Effect.Effect<TransactionRow, RuleViolation>
  /** The hourly tick: every auto Recurring due on or before `today`, each in its own transaction. Returns how many Changes were recorded. */
  readonly fireDue: (today: LocalDate) => Effect.Effect<number>
}

export class RecurringFiring extends Context.Tag("RecurringFiring")<RecurringFiring, RecurringFiringShape>() {}

/** The due date after `firedOn`; null once a once Schedule is spent or the expression cannot be read. */
export const advance = (row: RecurringRow, firedOn: LocalDate): LocalDate | null => {
  if (row.cron === null) return null
  const cron = parseCron(row.cron)
  return Either.isRight(cron) ? nextAfter(cron.right, firedOn) : null
}

export const RecurringFiringLive = Layer.effect(
  RecurringFiring,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const recurrings = yield* RecurringsRepo
    const transactions = yield* TransactionsRepo

    const fireOne: RecurringFiringShape["fireOne"] = (row, change) =>
      Effect.gen(function* () {
        const firedOn = change?.occurredOn ?? row.nextOn ?? todayUtc()
        const recorded = yield* transactions.insert(row.userId, {
          walletId: change?.walletId ?? row.walletId,
          type: "change",
          amountMinor: change?.amountMinor ?? row.amountMinor,
          currency: row.currency,
          occurredOn: firedOn,
          description: change?.description ?? row.description,
          tags: change?.tags ?? row.tags,
          hiddenFromAnalysis: change?.hiddenFromAnalysis ?? false,
          categoryId: change === undefined ? row.categoryId : (change.categoryId ?? null),
          exchangeId: null
        })
        // The Schedule moves on from the due date it was fired for, not from the date the User chose.
        const dueFor = row.nextOn ?? firedOn
        yield* recurrings.fired(row.id, firedOn, advance(row, dueFor))
        return recorded
      })

    /** One Recurring, caught up to today, in one transaction; locked so a restart mid-tick cannot double-fire. */
    const catchUp = (id: RecurringRow["id"], today: LocalDate) =>
      Effect.gen(function* () {
        let fired = 0
        let current = yield* recurrings.lock(id)
        while (Option.isSome(current) && current.value.auto && current.value.nextOn !== null && current.value.nextOn <= today) {
          yield* fireOne(current.value)
          fired += 1
          current = yield* recurrings.find(current.value.userId, id)
        }
        return fired
      }).pipe(sql.withTransaction)

    const fireDue: RecurringFiringShape["fireDue"] = (today) =>
      Effect.gen(function* () {
        let total = 0
        for (const id of yield* recurrings.dueIds(today)) {
          const fired = yield* catchUp(id, today).pipe(
            Effect.catchAllCause((cause) => Effect.logError(`Recurring ${id} failed to fire`, cause).pipe(Effect.as(0)))
          )
          total += fired
        }
        return total
      })

    return { fireOne, fireDue }
  })
)
