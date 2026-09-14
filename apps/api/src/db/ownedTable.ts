import type { SqlClient, SqlError } from "@effect/sql"
import type { Fragment } from "@effect/sql/Statement"
import type { UserId } from "@june/shared"
import { Effect, Option, Schema, String } from "effect"

/** A value the sql template binds as one parameter. An array is not one: it goes through textArray. */
type Parameter = string | number | bigint | boolean | Date | null

/**
 * Column values by their camelCase name, as an insert or a patch states them. A Fragment is
 * spliced as SQL (an array through textArray, a subselect); undefined leaves the column alone.
 */
export type ColumnValues = Record<string, Parameter | Fragment | undefined>

export interface OwnedTableSpec<Row, RowEncoded, Id, E> {
  readonly table: string
  /** The type of id the table is addressed by; only its Type is used. */
  readonly id: Schema.Schema<Id, string>
  /** Decodes a row the database returns, so the domain's brands and filters hold on the way out. */
  readonly row: Schema.Schema<Row, RowEncoded>
  /** The select list; an expression with an alias is fine (`trim(currency) as currency`). */
  readonly columns: string
  /** How `list` orders the User's rows. */
  readonly order: string
  /** Set when the table has an updated_at column: every patch stamps it. */
  readonly stampsUpdatedAt?: boolean
  /** How a constraint the database refuses on insert or patch becomes a typed error; unset, it is a defect. */
  readonly refused?: (error: SqlError.SqlError) => Effect.Effect<never, E>
}

/**
 * What every per-User table shares: rows belong to a user_id, are found by id, listed in one
 * order, inserted, patched column by column and removed, and come back decoded by a Schema. A
 * row the database returns that the Schema refuses is a defect, not an error a handler answers.
 */
export interface OwnedTable<Row, Id, E> {
  /** The select list, for the statements a table writes itself. */
  readonly columns: Fragment
  /** Run a statement that selects or returns `columns` and decode its rows. */
  readonly rows: <X>(statement: Effect.Effect<ReadonlyArray<unknown>, X>) => Effect.Effect<ReadonlyArray<Row>>
  readonly first: <X>(statement: Effect.Effect<ReadonlyArray<unknown>, X>) => Effect.Effect<Option.Option<Row>>
  readonly find: (userId: UserId, id: Id) => Effect.Effect<Option.Option<Row>>
  readonly list: (userId: UserId) => Effect.Effect<ReadonlyArray<Row>>
  readonly insert: (userId: UserId, values: ColumnValues) => Effect.Effect<Row, E>
  /** Sets the columns given; none given, the row as it is. None when the User has no such row. */
  readonly patch: (userId: UserId, id: Id, sets: ColumnValues) => Effect.Effect<Option.Option<Row>, E>
  /** The removed row's id; none when the User has no such row. */
  readonly remove: (userId: UserId, id: Id) => Effect.Effect<Option.Option<Id>>
}

export const ownedTable = <Row, RowEncoded, Id, E = never>(
  sql: SqlClient.SqlClient,
  spec: OwnedTableSpec<Row, RowEncoded, Id, E>
): OwnedTable<Row, Id, E> => {
  const table = sql.literal(spec.table)
  const columns = sql.literal(spec.columns)
  const order = sql.literal(spec.order)
  const refused = spec.refused ?? ((error: SqlError.SqlError) => Effect.die(error))
  const decodeRows = Schema.decodeUnknown(Schema.Array(spec.row))
  const decoded = (rs: ReadonlyArray<unknown>): Effect.Effect<ReadonlyArray<Row>> => decodeRows(rs).pipe(Effect.orDie)

  const rows: OwnedTable<Row, Id, E>["rows"] = (statement) => statement.pipe(Effect.orDie, Effect.flatMap(decoded))
  const first: OwnedTable<Row, Id, E>["first"] = (statement) => rows(statement).pipe(Effect.map((rs) => Option.fromNullable(rs[0])))
  /** A write a constraint may refuse. */
  const written = (statement: Effect.Effect<ReadonlyArray<unknown>, SqlError.SqlError>) =>
    statement.pipe(Effect.catchAll(refused), Effect.flatMap(decoded))

  const given = (values: ColumnValues) =>
    Object.entries(values).flatMap(([column, value]): Array<[string, Parameter | Fragment]> =>
      value === undefined ? [] : [[String.camelToSnake(column), value]]
    )

  const find: OwnedTable<Row, Id, E>["find"] = (userId, id) =>
    first(sql`select ${columns} from ${table} where user_id = ${userId} and id = ${id}`)

  const list: OwnedTable<Row, Id, E>["list"] = (userId) =>
    rows(sql`select ${columns} from ${table} where user_id = ${userId} order by ${order}`)

  const insert: OwnedTable<Row, Id, E>["insert"] = (userId, values) => {
    const entries = given(values)
    const names = sql.literal(["user_id", ...entries.map(([column]) => column)].join(", "))
    const placeholders = sql.csv([sql`${userId}`, ...entries.map(([, value]) => sql`${value}`)])
    return written(sql`insert into ${table} (${names}) values (${placeholders}) returning ${columns}`).pipe(Effect.map((rs) => rs[0]!))
  }

  const patch: OwnedTable<Row, Id, E>["patch"] = (userId, id, sets) => {
    const assignments = given(sets).map(([column, value]) => sql`${sql.literal(column)} = ${value}`)
    if (assignments.length === 0) return find(userId, id)
    if (spec.stampsUpdatedAt) assignments.push(sql`updated_at = now()`)
    return written(
      sql`update ${table} set ${sql.csv(assignments)} where user_id = ${userId} and id = ${id} returning ${columns}`
    ).pipe(Effect.map((rs) => Option.fromNullable(rs[0])))
  }

  const remove: OwnedTable<Row, Id, E>["remove"] = (userId, id) =>
    sql<{ id: Id }>`delete from ${table} where user_id = ${userId} and id = ${id} returning id`.pipe(
      Effect.map((rs) => Option.fromNullable(rs[0]?.id)),
      Effect.orDie
    )

  return { columns, rows, first, find, list, insert, patch, remove }
}
