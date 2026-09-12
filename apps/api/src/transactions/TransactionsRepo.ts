import { SqlClient } from "@effect/sql"
import type { Fragment } from "@effect/sql/Statement"
import type { CategoryId, ExchangeId, LocalDate, TransactionId, TransactionType, UserId, WalletId } from "@june/shared"
import { Context, Effect, Layer, Option } from "effect"
import { textArray, uuidArray } from "../db/sqlHelpers.js"

export interface TransactionRow {
  readonly id: TransactionId
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
  readonly createdAt: Date
  readonly updatedAt: Date
}

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

/** A Change to record in bulk: never Hidden, never part of an Exchange. */
export interface NewChange {
  readonly walletId: WalletId | null
  readonly amountMinor: number
  readonly currency: string
  readonly occurredOn: LocalDate
  readonly description: string
  readonly tags: ReadonlyArray<string>
  readonly categoryId: CategoryId | null
}

export interface TransactionPatch {
  readonly walletId?: WalletId | null
  readonly amountMinor?: number
  readonly currency?: string
  readonly occurredOn?: LocalDate
  readonly description?: string
  readonly tags?: ReadonlyArray<string>
  readonly hiddenFromAnalysis?: boolean
  readonly categoryId?: CategoryId | null
}

export interface TransactionsRepoShape {
  readonly listInPeriod: (userId: UserId, from: LocalDate, to: LocalDate) => Effect.Effect<ReadonlyArray<TransactionRow>>
  readonly find: (userId: UserId, id: TransactionId) => Effect.Effect<Option.Option<TransactionRow>>
  readonly findMany: (userId: UserId, ids: ReadonlyArray<TransactionId>) => Effect.Effect<ReadonlyArray<TransactionRow>>
  readonly findByExchange: (userId: UserId, exchangeId: ExchangeId) => Effect.Effect<ReadonlyArray<TransactionRow>>
  readonly insert: (userId: UserId, row: NewTransaction) => Effect.Effect<TransactionRow>
  /** Many Changes in one statement, for CSV Import; returns how many were recorded. */
  readonly insertChanges: (userId: UserId, rows: ReadonlyArray<NewChange>) => Effect.Effect<number>
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
    set: { walletId?: WalletId; categoryId?: CategoryId | null; addTags: ReadonlyArray<string>; removeTags: ReadonlyArray<string> }
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
}

export class TransactionsRepo extends Context.Tag("TransactionsRepo")<TransactionsRepo, TransactionsRepoShape>() {}

const columns = `id, wallet_id, type, amount_minor, currency, to_char(occurred_on, 'YYYY-MM-DD') as occurred_on,
  description, tags, hidden_from_analysis, category_id, exchange_id, created_at, updated_at`

export const TransactionsRepoLive = Layer.effect(
  TransactionsRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const cols = sql.literal(columns)
    const normalise = (row: TransactionRow): TransactionRow => ({ ...row, currency: row.currency.trim() })
    const rows = <A extends TransactionRow>(effect: Effect.Effect<ReadonlyArray<A>, unknown>) =>
      effect.pipe(Effect.map((rs) => rs.map(normalise)), Effect.orDie)

    const listInPeriod: TransactionsRepoShape["listInPeriod"] = (userId, from, to) =>
      rows(sql<TransactionRow>`select ${cols} from transaction
                               where user_id = ${userId} and occurred_on between ${from} and ${to}
                               order by occurred_on desc, created_at desc`)

    const find: TransactionsRepoShape["find"] = (userId, id) =>
      rows(sql<TransactionRow>`select ${cols} from transaction where user_id = ${userId} and id = ${id}`).pipe(
        Effect.map((rs) => Option.fromNullable(rs[0]))
      )

    const findMany: TransactionsRepoShape["findMany"] = (userId, ids) =>
      ids.length === 0
        ? Effect.succeed([])
        : rows(sql<TransactionRow>`select ${cols} from transaction where user_id = ${userId} and ${sql.in("id", ids)}`)

    const findByExchange: TransactionsRepoShape["findByExchange"] = (userId, exchangeId) =>
      rows(sql<TransactionRow>`select ${cols} from transaction
                               where user_id = ${userId} and exchange_id = ${exchangeId} order by amount_minor`)

    const insert: TransactionsRepoShape["insert"] = (userId, row) =>
      rows(sql<TransactionRow>`
        insert into transaction (user_id, wallet_id, type, amount_minor, currency, occurred_on, description, tags,
                                 hidden_from_analysis, category_id, exchange_id)
        values (${userId}, ${row.walletId}, ${row.type}, ${row.amountMinor}, ${row.currency}, ${row.occurredOn},
                ${row.description}, ${textArray(sql, row.tags)}, ${row.hiddenFromAnalysis}, ${row.categoryId},
                ${row.exchangeId})
        returning ${cols}`).pipe(Effect.map((rs) => rs[0]!))

    // One statement for the whole file: the rows travel as one JSON parameter and unpack in SQL.
    const insertChanges: TransactionsRepoShape["insertChanges"] = (userId, rows) =>
      rows.length === 0
        ? Effect.succeed(0)
        : sql<{ id: string }>`
            insert into transaction (user_id, wallet_id, type, amount_minor, currency, occurred_on, description, tags,
                                     hidden_from_analysis, category_id, exchange_id)
            select ${userId}, r.wallet_id, 'change', r.amount_minor, r.currency, r.occurred_on, r.description,
                   array(select jsonb_array_elements_text(r.tags)), false, r.category_id, null
            from jsonb_to_recordset(${JSON.stringify(
              rows.map((r) => ({
                wallet_id: r.walletId,
                amount_minor: r.amountMinor,
                currency: r.currency,
                occurred_on: r.occurredOn,
                description: r.description,
                tags: r.tags,
                category_id: r.categoryId
              }))
            )}::jsonb) as r(wallet_id uuid, amount_minor bigint, currency text, occurred_on date, description text, tags jsonb, category_id uuid)
            returning id`.pipe(
            Effect.map((rs) => rs.length),
            Effect.orDie
          )

    const update: TransactionsRepoShape["update"] = (userId, id, patch) => {
      const sets: Array<Fragment> = []
      if (patch.walletId !== undefined) sets.push(sql`wallet_id = ${patch.walletId}`)
      if (patch.amountMinor !== undefined) sets.push(sql`amount_minor = ${patch.amountMinor}`)
      if (patch.currency !== undefined) sets.push(sql`currency = ${patch.currency}`)
      if (patch.occurredOn !== undefined) sets.push(sql`occurred_on = ${patch.occurredOn}`)
      if (patch.description !== undefined) sets.push(sql`description = ${patch.description}`)
      if (patch.tags !== undefined) sets.push(sql`tags = ${textArray(sql, patch.tags)}`)
      if (patch.hiddenFromAnalysis !== undefined) sets.push(sql`hidden_from_analysis = ${patch.hiddenFromAnalysis}`)
      if (patch.categoryId !== undefined) sets.push(sql`category_id = ${patch.categoryId}`)
      if (sets.length === 0) return find(userId, id)
      sets.push(sql`updated_at = now()`)
      return rows(sql<TransactionRow>`update transaction set ${sql.csv(sets)}
                                      where user_id = ${userId} and id = ${id} returning ${cols}`).pipe(
        Effect.map((rs) => Option.fromNullable(rs[0]))
      )
    }

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
      rows(sql<TransactionRow>`select ${cols} from transaction
                               where user_id = ${userId} and wallet_id = ${walletId} and type = 'init'`).pipe(
        Effect.map((rs) => Option.fromNullable(rs[0]))
      )

    return {
      listInPeriod,
      find,
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
      initOf
    }
  })
)
