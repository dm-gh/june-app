import { SqlClient } from "@effect/sql"
import { type CategoryId, type LocalDate, Recurring, RecurringId, UserId, type WalletId } from "@june/shared"
import { Context, Effect, Layer, type Option, Schema } from "effect"
import { ownedTable } from "../db/ownedTable.js"
import { textArray } from "../db/sqlHelpers.js"

/** A Recurring as stored: its own fields, its User (the tick fires for every User), timestamps read from Date. */
export const RecurringRow = Schema.Struct({
  ...Recurring.fields,
  userId: UserId,
  createdAt: Schema.DateTimeUtcFromDate,
  updatedAt: Schema.DateTimeUtcFromDate
})
export type RecurringRow = typeof RecurringRow.Type

export interface NewRecurring {
  readonly name: string
  readonly walletId: WalletId
  readonly amountMinor: number
  readonly currency: string
  readonly categoryId: CategoryId | null
  readonly description: string
  readonly tags: ReadonlyArray<string>
  readonly auto: boolean
  readonly cron: string | null
  readonly nextOn: LocalDate | null
}

export type RecurringPatch = {
  readonly name?: string | undefined
  readonly walletId?: WalletId | undefined
  readonly amountMinor?: number | undefined
  readonly currency?: string | undefined
  readonly categoryId?: CategoryId | null | undefined
  readonly description?: string | undefined
  readonly tags?: ReadonlyArray<string> | undefined
  readonly auto?: boolean | undefined
  readonly cron?: string | null | undefined
  readonly nextOn?: LocalDate | null | undefined
}

export interface RecurringsRepoShape {
  /** Soonest due first, overdue at the very top; the ones with no date come last, by name. */
  readonly list: (userId: UserId) => Effect.Effect<ReadonlyArray<RecurringRow>>
  readonly find: (userId: UserId, id: RecurringId) => Effect.Effect<Option.Option<RecurringRow>>
  readonly insert: (userId: UserId, row: NewRecurring) => Effect.Effect<RecurringRow>
  readonly update: (userId: UserId, id: RecurringId, patch: RecurringPatch) => Effect.Effect<Option.Option<RecurringRow>>
  readonly remove: (userId: UserId, id: RecurringId) => Effect.Effect<Option.Option<RecurringId>>
  /** Ids of every User's auto Recurrings due on or before `today`. */
  readonly dueIds: (today: LocalDate) => Effect.Effect<ReadonlyArray<RecurringId>>
  /** The row, locked for the current transaction; none when another worker holds it. */
  readonly lock: (id: RecurringId) => Effect.Effect<Option.Option<RecurringRow>>
  /** After a firing: the date fired for, the next due date, and Auto off once a once Schedule is spent. */
  readonly fired: (id: RecurringId, firedOn: LocalDate, nextOn: LocalDate | null) => Effect.Effect<void>
  readonly countWithoutWallet: (userId: UserId) => Effect.Effect<number>
}

export class RecurringsRepo extends Context.Tag("RecurringsRepo")<RecurringsRepo, RecurringsRepoShape>() {}

export const RecurringsRepoLive = Layer.effect(
  RecurringsRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const recurrings = ownedTable(sql, {
      table: "recurring",
      id: RecurringId,
      row: RecurringRow,
      columns: `id, user_id, name, wallet_id, amount_minor, trim(currency) as currency, category_id, description, tags, auto, cron,
        to_char(next_on, 'YYYY-MM-DD') as next_on, to_char(last_fired_on, 'YYYY-MM-DD') as last_fired_on, created_at, updated_at`,
      order: "next_on asc nulls last, name, created_at",
      stampsUpdatedAt: true
    })

    const insert: RecurringsRepoShape["insert"] = (userId, row) => recurrings.insert(userId, { ...row, tags: textArray(sql, row.tags) })

    const update: RecurringsRepoShape["update"] = (userId, id, patch) =>
      recurrings.patch(userId, id, { ...patch, tags: patch.tags && textArray(sql, patch.tags) })

    const dueIds: RecurringsRepoShape["dueIds"] = (today) =>
      sql<{ id: RecurringId }>`select id from recurring where auto and next_on <= ${today} order by next_on`.pipe(
        Effect.map((rs) => rs.map((r) => r.id)),
        Effect.orDie
      )

    const lock: RecurringsRepoShape["lock"] = (id) =>
      recurrings.first(sql`select ${recurrings.columns} from recurring where id = ${id} for update skip locked`)

    const fired: RecurringsRepoShape["fired"] = (id, firedOn, nextOn) =>
      sql`update recurring
          set last_fired_on = ${firedOn}, next_on = ${nextOn}, auto = auto and ${nextOn !== null}, updated_at = now()
          where id = ${id}`.pipe(Effect.asVoid, Effect.orDie)

    const countWithoutWallet: RecurringsRepoShape["countWithoutWallet"] = (userId) =>
      sql<{ n: number }>`select count(*)::int as n from recurring where user_id = ${userId} and wallet_id is null`.pipe(
        Effect.map((rs) => rs[0]?.n ?? 0),
        Effect.orDie
      )

    return { list: recurrings.list, find: recurrings.find, insert, update, remove: recurrings.remove, dueIds, lock, fired, countWithoutWallet }
  })
)
