import { SqlClient } from "@effect/sql"
import type { Fragment } from "@effect/sql/Statement"
import { type CategoryId, type ExchangeId, type LocalDate, Tag, Transaction, TransactionId, type TransactionType, type UserId, type WalletId } from "@june/shared"
import { Context, Effect, Layer, type Option, Schema } from "effect"
import { ownedTable } from "../db/ownedTable.js"
import { textArray, uuidArray } from "../db/sqlHelpers.js"

/** A Transaction as stored: its fields without the derived defaultMinor, timestamps read from Date. */
export const TransactionRow = Schema.Struct({
  ...Schema.Struct(Transaction.fields).omit("defaultMinor").fields,
  createdAt: Schema.DateTimeUtcFromDate,
  updatedAt: Schema.DateTimeUtcFromDate
})
export type TransactionRow = typeof TransactionRow.Type

export interface NewTransaction {
  readonly walletId: WalletId | null
  readonly type: TransactionType
  readonly amountMinor: number
  readonly currency: string
  readonly occurredOn: LocalDate
  readonly description: string
  readonly tags: ReadonlyArray<string>
  readonly hiddenFromAnalysis: boolean
  readonly categoryId: CategoryId | null
  readonly exchangeId: ExchangeId | null
}

/** A Change with its Wallet and Category settled, ready to write; never part of an Exchange. */
export interface NewChange {
  readonly walletId: WalletId | null
  readonly categoryId: CategoryId | null
  readonly amountMinor: number
  readonly currency: string
  readonly occurredOn: LocalDate
  readonly description: string
  readonly tags: ReadonlyArray<string>
  readonly hiddenFromAnalysis: boolean
}

export type TransactionPatch = {
  readonly walletId?: WalletId | null | undefined
  readonly amountMinor?: number | undefined
  readonly currency?: string | undefined
  readonly occurredOn?: LocalDate | undefined
  readonly description?: string | undefined
  readonly tags?: ReadonlyArray<string> | undefined
  readonly hiddenFromAnalysis?: boolean | undefined
  readonly categoryId?: CategoryId | null | undefined
}

export interface TransactionsRepoShape {
  readonly listInPeriod: (userId: UserId, from: LocalDate, to: LocalDate) => Effect.Effect<ReadonlyArray<TransactionRow>>
  readonly find: (userId: UserId, id: TransactionId) => Effect.Effect<Option.Option<TransactionRow>>
  readonly findMany: (userId: UserId, ids: ReadonlyArray<TransactionId>) => Effect.Effect<ReadonlyArray<TransactionRow>>
  readonly findByExchange: (userId: UserId, exchangeId: ExchangeId) => Effect.Effect<ReadonlyArray<TransactionRow>>
  readonly insert: (userId: UserId, row: NewTransaction) => Effect.Effect<TransactionRow>
  /** Changes, one or many, in one statement; RecordChange is the only caller. Returns the rows in the order given. */
  readonly insertChanges: (userId: UserId, rows: ReadonlyArray<NewChange>) => Effect.Effect<ReadonlyArray<TransactionRow>>
  readonly update: (userId: UserId, id: TransactionId, patch: TransactionPatch) => Effect.Effect<Option.Option<TransactionRow>>
  /** Same patch on every row of an Exchange: date, description, tags. */
  readonly updateExchange: (
    userId: UserId,
    exchangeId: ExchangeId,
    patch: Pick<TransactionPatch, "occurredOn" | "description" | "tags">
  ) => Effect.Effect<void>
  readonly bulkSet: (
    userId: UserId,
    ids: ReadonlyArray<TransactionId>,
    set: {
      walletId?: WalletId | undefined
      categoryId?: CategoryId | null | undefined
      addTags: ReadonlyArray<string>
      removeTags: ReadonlyArray<string>
    }
  ) => Effect.Effect<void>
  readonly deleteMany: (userId: UserId, ids: ReadonlyArray<TransactionId>) => Effect.Effect<number>
  readonly deleteExchanges: (userId: UserId, exchangeIds: ReadonlyArray<ExchangeId>) => Effect.Effect<number>
  /** Wallet deletion, step one: the Init goes with the Wallet. */
  readonly deleteInitOf: (userId: UserId, walletId: WalletId) => Effect.Effect<void>
  /**
   * Wallet deletion, step two: every Exchange touching the Wallet collapses into a Change in the
   * other Wallet, tagged so the conversion stays visible. See ADR-0004.
   */
  readonly collapseExchangesOf: (userId: UserId, walletId: WalletId, tag: string) => Effect.Effect<void>
  /** Balance of every Wallet of the User: sum(amount_minor) per wallet_id. */
  readonly balances: (userId: UserId) => Effect.Effect<ReadonlyMap<WalletId, number>>
  readonly initOf: (userId: UserId, walletId: WalletId) => Effect.Effect<Option.Option<TransactionRow>>
  /** How many of the User's Transactions are Unassigned, for the attention banner. */
  readonly countUnassigned: (userId: UserId) => Effect.Effect<number>
  /** Every distinct Tag on the User's Transactions, sorted; a Tag has no life beyond them. */
  readonly distinctTags: (userId: UserId) => Effect.Effect<ReadonlyArray<Tag>>
}

export class TransactionsRepo extends Context.Tag("TransactionsRepo")<TransactionsRepo, TransactionsRepoShape>() {}

export const TransactionsRepoLive = Layer.effect(
  TransactionsRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const transactions = ownedTable(sql, {
      table: "transaction",
      id: TransactionId,
      row: TransactionRow,
      columns: `id, wallet_id, type, amount_minor, trim(currency) as currency, to_char(occurred_on, 'YYYY-MM-DD') as occurred_on,
        description, tags, hidden_from_analysis, category_id, exchange_id, created_at, updated_at`,
      order: "occurred_on desc, created_at desc",
      stampsUpdatedAt: true
    })
    const cols = transactions.columns

    const listInPeriod: TransactionsRepoShape["listInPeriod"] = (userId, from, to) =>
      transactions.rows(sql`select ${cols} from transaction
                            where user_id = ${userId} and occurred_on between ${from} and ${to}
                            order by occurred_on desc, created_at desc`)

    const findMany: TransactionsRepoShape["findMany"] = (userId, ids) =>
      ids.length === 0
        ? Effect.succeed([])
        : transactions.rows(sql`select ${cols} from transaction where user_id = ${userId} and ${sql.in("id", ids)}`)

    const findByExchange: TransactionsRepoShape["findByExchange"] = (userId, exchangeId) =>
      transactions.rows(sql`select ${cols} from transaction
                            where user_id = ${userId} and exchange_id = ${exchangeId} order by amount_minor`)

    const insert: TransactionsRepoShape["insert"] = (userId, row) => transactions.insert(userId, { ...row, tags: textArray(sql, row.tags) })

    // One statement however many rows: they travel as one JSON parameter and unpack in SQL.
    const insertChanges: TransactionsRepoShape["insertChanges"] = (userId, changes) =>
      changes.length === 0
        ? Effect.succeed([])
        : transactions.rows(sql`
            insert into transaction (user_id, wallet_id, type, amount_minor, currency, occurred_on, description, tags,
                                     hidden_from_analysis, category_id, exchange_id)
            select ${userId}, r.wallet_id, 'change', r.amount_minor, r.currency, r.occurred_on, r.description,
                   array(select jsonb_array_elements_text(r.tags)), r.hidden, r.category_id, null
            from jsonb_to_recordset(${JSON.stringify(
              changes.map((r) => ({
                wallet_id: r.walletId,
                amount_minor: r.amountMinor,
                currency: r.currency,
                occurred_on: r.occurredOn,
                description: r.description,
                tags: r.tags,
                hidden: r.hiddenFromAnalysis,
                category_id: r.categoryId
              }))
            )}::jsonb) as r(wallet_id uuid, amount_minor bigint, currency text, occurred_on date, description text, tags jsonb,
                            hidden boolean, category_id uuid)
            returning ${cols}`)

    const update: TransactionsRepoShape["update"] = (userId, id, patch) =>
      transactions.patch(userId, id, { ...patch, tags: patch.tags && textArray(sql, patch.tags) })

    const updateExchange: TransactionsRepoShape["updateExchange"] = (userId, exchangeId, patch) => {
      const sets: Array<Fragment> = []
      if (patch.occurredOn !== undefined) sets.push(sql`occurred_on = ${patch.occurredOn}`)
      if (patch.description !== undefined) sets.push(sql`description = ${patch.description}`)
      if (patch.tags !== undefined) sets.push(sql`tags = ${textArray(sql, patch.tags)}`)
      if (sets.length === 0) return Effect.void
      sets.push(sql`updated_at = now()`)
      return sql`update transaction set ${sql.csv(sets)} where user_id = ${userId} and exchange_id = ${exchangeId}`.pipe(
        Effect.asVoid,
        Effect.orDie
      )
    }

    const bulkSet: TransactionsRepoShape["bulkSet"] = (userId, ids, set) => {
      const sets: Array<Fragment> = [sql`updated_at = now()`]
      if (set.walletId !== undefined) sets.push(sql`wallet_id = ${set.walletId}`)
      if (set.categoryId !== undefined) sets.push(sql`category_id = ${set.categoryId}`)
      if (set.addTags.length > 0 || set.removeTags.length > 0) {
        // Remove, then append the additions that are not already present, keeping order.
        sets.push(sql`tags = (
          select coalesce(array_agg(t order by ord), '{}'::text[]) from (
            select t, ord from unnest(tags) with ordinality as u(t, ord)
            where not (t = any(${textArray(sql, set.removeTags)}))
            union all
            select a, 1000 + aord from unnest(${textArray(sql, set.addTags)}) with ordinality as v(a, aord)
            where not (a = any(tags)) and not (a = any(${textArray(sql, set.removeTags)}))
          ) merged
        )`)
      }
      return sql`update transaction set ${sql.csv(sets)} where user_id = ${userId} and ${sql.in("id", ids)}`.pipe(
        Effect.asVoid,
        Effect.orDie
      )
    }

    const deleteMany: TransactionsRepoShape["deleteMany"] = (userId, ids) =>
      ids.length === 0
        ? Effect.succeed(0)
        : sql<{ id: string }>`delete from transaction where user_id = ${userId} and ${sql.in("id", ids)} returning id`.pipe(
            Effect.map((rs) => rs.length),
            Effect.orDie
          )

    const deleteExchanges: TransactionsRepoShape["deleteExchanges"] = (userId, exchangeIds) =>
      exchangeIds.length === 0
        ? Effect.succeed(0)
        : sql<{ id: string }>`delete from transaction
                              where user_id = ${userId} and exchange_id = any(${uuidArray(sql, exchangeIds)}) returning id`.pipe(
            Effect.map((rs) => rs.length),
            Effect.orDie
          )

    const deleteInitOf: TransactionsRepoShape["deleteInitOf"] = (userId, walletId) =>
      sql`delete from transaction where user_id = ${userId} and wallet_id = ${walletId} and type = 'init'`.pipe(
        Effect.asVoid,
        Effect.orDie
      )

    const collapseExchangesOf: TransactionsRepoShape["collapseExchangesOf"] = (userId, walletId, tag) =>
      Effect.gen(function* () {
        const legs = yield* sql<{ exchangeId: ExchangeId }>`
          select distinct exchange_id from transaction
          where user_id = ${userId} and wallet_id = ${walletId} and type = 'exchange'`
        if (legs.length === 0) return
        const exchangeIds = legs.map((l) => l.exchangeId)
        // The surviving leg becomes a Change; the deleted Wallet's leg goes.
        yield* sql`update transaction
                   set type = 'change', exchange_id = null, updated_at = now(),
                       tags = case when ${tag} = any(tags) then tags else array_append(tags, ${tag}) end
                   where user_id = ${userId} and wallet_id <> ${walletId}
                     and exchange_id = any(${uuidArray(sql, exchangeIds)})`
        yield* sql`delete from transaction
                   where user_id = ${userId} and wallet_id = ${walletId}
                     and exchange_id = any(${uuidArray(sql, exchangeIds)})`
      }).pipe(Effect.orDie)

    const balances: TransactionsRepoShape["balances"] = (userId) =>
      sql<{ walletId: WalletId; balanceMinor: number }>`
        select wallet_id, sum(amount_minor)::float8 as balance_minor from transaction
        where user_id = ${userId} and wallet_id is not null group by wallet_id`.pipe(
        Effect.map((rs) => new Map(rs.map((r) => [r.walletId, r.balanceMinor] as const))),
        Effect.orDie
      )

    const initOf: TransactionsRepoShape["initOf"] = (userId, walletId) =>
      transactions.first(sql`select ${cols} from transaction
                             where user_id = ${userId} and wallet_id = ${walletId} and type = 'init'`)

    const countUnassigned: TransactionsRepoShape["countUnassigned"] = (userId) =>
      sql<{ n: number }>`select count(*)::int as n from transaction where user_id = ${userId} and wallet_id is null`.pipe(
        Effect.map((rs) => rs[0]?.n ?? 0),
        Effect.orDie
      )

    const distinctTags: TransactionsRepoShape["distinctTags"] = (userId) =>
      sql<{ tag: string }>`select distinct tag from transaction, unnest(tags) as tag where user_id = ${userId} order by tag`.pipe(
        Effect.flatMap((rs) => Schema.decodeUnknown(Schema.Array(Tag))(rs.map((r) => r.tag))),
        Effect.orDie
      )

    return {
      listInPeriod,
      find: transactions.find,
      findMany,
      findByExchange,
      insert,
      insertChanges,
      update,
      updateExchange,
      bulkSet,
      deleteMany,
      deleteExchanges,
      deleteInitOf,
      collapseExchangesOf,
      balances,
      initOf,
      countUnassigned,
      distinctTags
    }
  })
)
