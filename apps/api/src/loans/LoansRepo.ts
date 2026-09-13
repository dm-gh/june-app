import { SqlClient } from "@effect/sql"
import type { Fragment } from "@effect/sql/Statement"
import type { LoanId, UserId } from "@june/shared"
import { Context, Effect, Layer, Option } from "effect"

export interface LoanRow {
  readonly id: LoanId
  readonly amountMinor: number
  readonly currency: string
  readonly description: string
  readonly archived: boolean
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface LoanPatch {
  readonly amountMinor?: number
  readonly currency?: string
  readonly description?: string
  readonly archived?: boolean
}

export interface LoansRepoShape {
  readonly list: (userId: UserId) => Effect.Effect<ReadonlyArray<LoanRow>>
  readonly find: (userId: UserId, id: LoanId) => Effect.Effect<Option.Option<LoanRow>>
  readonly insert: (userId: UserId, row: { amountMinor: number; currency: string; description: string }) => Effect.Effect<LoanRow>
  readonly update: (userId: UserId, id: LoanId, patch: LoanPatch) => Effect.Effect<Option.Option<LoanRow>>
  /** Settling: move the amount by `delta`, archiving at zero. Locks the row for the current transaction. */
  readonly move: (userId: UserId, id: LoanId, delta: number) => Effect.Effect<Option.Option<LoanRow>>
  readonly remove: (userId: UserId, id: LoanId) => Effect.Effect<boolean>
}

export class LoansRepo extends Context.Tag("LoansRepo")<LoansRepo, LoansRepoShape>() {}

const columns = "id, amount_minor, currency, description, archived, created_at, updated_at"

export const LoansRepoLive = Layer.effect(
  LoansRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const cols = sql.literal(columns)
    const normalise = (row: LoanRow): LoanRow => ({ ...row, currency: row.currency.trim() })
    const rows = (effect: Effect.Effect<ReadonlyArray<LoanRow>, unknown>) =>
      effect.pipe(Effect.map((rs) => rs.map(normalise)), Effect.orDie)
    const first = (effect: Effect.Effect<ReadonlyArray<LoanRow>, unknown>) => rows(effect).pipe(Effect.map((rs) => Option.fromNullable(rs[0])))

    const list: LoansRepoShape["list"] = (userId) =>
      rows(sql<LoanRow>`select ${cols} from loan where user_id = ${userId} order by archived, created_at desc`)

    const find: LoansRepoShape["find"] = (userId, id) => first(sql<LoanRow>`select ${cols} from loan where user_id = ${userId} and id = ${id}`)

    const insert: LoansRepoShape["insert"] = (userId, row) =>
      rows(sql<LoanRow>`insert into loan (user_id, amount_minor, currency, description)
                        values (${userId}, ${row.amountMinor}, ${row.currency}, ${row.description}) returning ${cols}`).pipe(
        Effect.map((rs) => rs[0]!)
      )

    const update: LoansRepoShape["update"] = (userId, id, patch) => {
      const sets: Array<Fragment> = []
      if (patch.amountMinor !== undefined) sets.push(sql`amount_minor = ${patch.amountMinor}`)
      if (patch.currency !== undefined) sets.push(sql`currency = ${patch.currency}`)
      if (patch.description !== undefined) sets.push(sql`description = ${patch.description}`)
      if (patch.archived !== undefined) sets.push(sql`archived = ${patch.archived}`)
      if (sets.length === 0) return find(userId, id)
      sets.push(sql`updated_at = now()`)
      return first(sql<LoanRow>`update loan set ${sql.csv(sets)} where user_id = ${userId} and id = ${id} returning ${cols}`)
    }

    const move: LoansRepoShape["move"] = (userId, id, delta) =>
      first(sql<LoanRow>`update loan
                         set amount_minor = amount_minor + ${delta},
                             archived = archived or amount_minor + ${delta} = 0,
                             updated_at = now()
                         where user_id = ${userId} and id = ${id} returning ${cols}`)

    const remove: LoansRepoShape["remove"] = (userId, id) =>
      sql<{ id: string }>`delete from loan where user_id = ${userId} and id = ${id} returning id`.pipe(
        Effect.map((rs) => rs.length > 0),
        Effect.orDie
      )

    return { list, find, insert, update, move, remove }
  })
)
