import { SqlClient } from "@effect/sql"
import type { Fragment } from "@effect/sql/Statement"
import type { CategoryId, LocalDate, RecurringId, UserId, WalletId } from "@june/shared"
import { Context, Effect, Layer, Option } from "effect"
import { textArray } from "../db/sqlHelpers.js"

export interface RecurringRow {
  readonly id: RecurringId
  readonly userId: UserId
  readonly name: string
  readonly walletId: WalletId | null
  readonly amountMinor: number
  readonly currency: string
  readonly categoryId: CategoryId | null
  readonly description: string
  readonly tags: ReadonlyArray<string>
  readonly auto: boolean
  readonly cron: string | null
  readonly nextOn: LocalDate | null
  readonly lastFiredOn: LocalDate | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

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

export interface RecurringPatch {
  readonly name?: string
  readonly walletId?: WalletId
  readonly amountMinor?: number
  readonly currency?: string
  readonly categoryId?: CategoryId | null
  readonly description?: string
  readonly tags?: ReadonlyArray<string>
  readonly auto?: boolean
  readonly cron?: string | null
  readonly nextOn?: LocalDate | null
}

export interface RecurringsRepoShape {
  readonly list: (userId: UserId) => Effect.Effect<ReadonlyArray<RecurringRow>>
  readonly find: (userId: UserId, id: RecurringId) => Effect.Effect<Option.Option<RecurringRow>>
  readonly insert: (userId: UserId, row: NewRecurring) => Effect.Effect<RecurringRow>
  readonly update: (userId: UserId, id: RecurringId, patch: RecurringPatch) => Effect.Effect<Option.Option<RecurringRow>>
  readonly remove: (userId: UserId, id: RecurringId) => Effect.Effect<boolean>
  /** Ids of every User's auto Recurrings due on or before `today`. */
  readonly dueIds: (today: LocalDate) => Effect.Effect<ReadonlyArray<RecurringId>>
  /** The row, locked for the current transaction; none when another worker holds it. */
  readonly lock: (id: RecurringId) => Effect.Effect<Option.Option<RecurringRow>>
  /** After a firing: the date fired for, the next due date, and Auto off once a once Schedule is spent. */
  readonly fired: (id: RecurringId, firedOn: LocalDate, nextOn: LocalDate | null) => Effect.Effect<void>
  readonly countWithoutWallet: (userId: UserId) => Effect.Effect<number>
}

export class RecurringsRepo extends Context.Tag("RecurringsRepo")<RecurringsRepo, RecurringsRepoShape>() {}

const columns = `id, user_id, name, wallet_id, amount_minor, currency, category_id, description, tags, auto, cron,
  to_char(next_on, 'YYYY-MM-DD') as next_on, to_char(last_fired_on, 'YYYY-MM-DD') as last_fired_on, created_at, updated_at`

export const RecurringsRepoLive = Layer.effect(
  RecurringsRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const cols = sql.literal(columns)
    const normalise = (row: RecurringRow): RecurringRow => ({ ...row, currency: row.currency.trim() })
    const rows = (effect: Effect.Effect<ReadonlyArray<RecurringRow>, unknown>) =>
      effect.pipe(Effect.map((rs) => rs.map(normalise)), Effect.orDie)
    const first = (effect: Effect.Effect<ReadonlyArray<RecurringRow>, unknown>) => rows(effect).pipe(Effect.map((rs) => Option.fromNullable(rs[0])))

    // Soonest due first, overdue at the very top; the ones with no date come last, by name.
    const list: RecurringsRepoShape["list"] = (userId) =>
      rows(sql<RecurringRow>`select ${cols} from recurring where user_id = ${userId} order by next_on asc nulls last, name, created_at`)

    const find: RecurringsRepoShape["find"] = (userId, id) =>
      first(sql<RecurringRow>`select ${cols} from recurring where user_id = ${userId} and id = ${id}`)

    const insert: RecurringsRepoShape["insert"] = (userId, row) =>
      rows(sql<RecurringRow>`
        insert into recurring (user_id, name, wallet_id, amount_minor, currency, category_id, description, tags, auto, cron, next_on)
        values (${userId}, ${row.name}, ${row.walletId}, ${row.amountMinor}, ${row.currency}, ${row.categoryId}, ${row.description},
                ${textArray(sql, row.tags)}, ${row.auto}, ${row.cron}, ${row.nextOn})
        returning ${cols}`).pipe(Effect.map((rs) => rs[0]!))

    const update: RecurringsRepoShape["update"] = (userId, id, patch) => {
      const sets: Array<Fragment> = []
      if (patch.name !== undefined) sets.push(sql`name = ${patch.name}`)
      if (patch.walletId !== undefined) sets.push(sql`wallet_id = ${patch.walletId}`)
      if (patch.amountMinor !== undefined) sets.push(sql`amount_minor = ${patch.amountMinor}`)
      if (patch.currency !== undefined) sets.push(sql`currency = ${patch.currency}`)
      if (patch.categoryId !== undefined) sets.push(sql`category_id = ${patch.categoryId}`)
      if (patch.description !== undefined) sets.push(sql`description = ${patch.description}`)
      if (patch.tags !== undefined) sets.push(sql`tags = ${textArray(sql, patch.tags)}`)
      if (patch.auto !== undefined) sets.push(sql`auto = ${patch.auto}`)
      if (patch.cron !== undefined) sets.push(sql`cron = ${patch.cron}`)
      if (patch.nextOn !== undefined) sets.push(sql`next_on = ${patch.nextOn}`)
      if (sets.length === 0) return find(userId, id)
      sets.push(sql`updated_at = now()`)
      return first(sql<RecurringRow>`update recurring set ${sql.csv(sets)} where user_id = ${userId} and id = ${id} returning ${cols}`)
    }

    const remove: RecurringsRepoShape["remove"] = (userId, id) =>
      sql<{ id: string }>`delete from recurring where user_id = ${userId} and id = ${id} returning id`.pipe(
        Effect.map((rs) => rs.length > 0),
        Effect.orDie
      )

    const dueIds: RecurringsRepoShape["dueIds"] = (today) =>
      sql<{ id: RecurringId }>`select id from recurring where auto and next_on <= ${today} order by next_on`.pipe(
        Effect.map((rs) => rs.map((r) => r.id)),
        Effect.orDie
      )

    const lock: RecurringsRepoShape["lock"] = (id) =>
      first(sql<RecurringRow>`select ${cols} from recurring where id = ${id} for update skip locked`)

    const fired: RecurringsRepoShape["fired"] = (id, firedOn, nextOn) =>
      sql`update recurring
          set last_fired_on = ${firedOn}, next_on = ${nextOn}, auto = auto and ${nextOn !== null}, updated_at = now()
          where id = ${id}`.pipe(Effect.asVoid, Effect.orDie)

    const countWithoutWallet: RecurringsRepoShape["countWithoutWallet"] = (userId) =>
      sql<{ n: number }>`select count(*)::int as n from recurring where user_id = ${userId} and wallet_id is null`.pipe(
        Effect.map((rs) => rs[0]?.n ?? 0),
        Effect.orDie
      )

    return { list, find, insert, update, remove, dueIds, lock, fired, countWithoutWallet }
  })
)
