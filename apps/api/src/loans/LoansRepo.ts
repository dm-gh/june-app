import { SqlClient } from "@effect/sql"
import { Loan, LoanId, type UserId } from "@june/shared"
import { Context, Effect, Layer, type Option, Schema } from "effect"
import { ownedTable } from "../db/ownedTable.js"

/** A Loan as stored: the Loan's own fields, the timestamps read from the database's Date. */
export const LoanRow = Schema.Struct({ ...Loan.fields, createdAt: Schema.DateTimeUtcFromDate, updatedAt: Schema.DateTimeUtcFromDate })
export type LoanRow = typeof LoanRow.Type

export type LoanPatch = {
  readonly amountMinor?: number | undefined
  readonly currency?: string | undefined
  readonly description?: string | undefined
  readonly archived?: boolean | undefined
}

export interface LoansRepoShape {
  readonly list: (userId: UserId) => Effect.Effect<ReadonlyArray<LoanRow>>
  readonly find: (userId: UserId, id: LoanId) => Effect.Effect<Option.Option<LoanRow>>
  readonly insert: (userId: UserId, row: { amountMinor: number; currency: string; description: string }) => Effect.Effect<LoanRow>
  readonly update: (userId: UserId, id: LoanId, patch: LoanPatch) => Effect.Effect<Option.Option<LoanRow>>
  /** Settling: move the amount by `delta`, archiving at zero. Locks the row for the current transaction. */
  readonly move: (userId: UserId, id: LoanId, delta: number) => Effect.Effect<Option.Option<LoanRow>>
  readonly remove: (userId: UserId, id: LoanId) => Effect.Effect<Option.Option<LoanId>>
}

export class LoansRepo extends Context.Tag("LoansRepo")<LoansRepo, LoansRepoShape>() {}

export const LoansRepoLive = Layer.effect(
  LoansRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const loans = ownedTable(sql, {
      table: "loan",
      id: LoanId,
      row: LoanRow,
      columns: "id, amount_minor, trim(currency) as currency, description, archived, created_at, updated_at",
      order: "archived, created_at desc",
      stampsUpdatedAt: true
    })

    const move: LoansRepoShape["move"] = (userId, id, delta) =>
      loans.first(sql`update loan
                      set amount_minor = amount_minor + ${delta},
                          archived = archived or amount_minor + ${delta} = 0,
                          updated_at = now()
                      where user_id = ${userId} and id = ${id} returning ${loans.columns}`)

    return { list: loans.list, find: loans.find, insert: loans.insert, update: loans.patch, move, remove: loans.remove }
  })
)
