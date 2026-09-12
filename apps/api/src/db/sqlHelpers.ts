import type { SqlClient } from "@effect/sql"
import type { Fragment } from "@effect/sql/Statement"

/**
 * The sql template expands an interpolated array to `($1, $2, ...)`, which suits `in (...)` but
 * not a Postgres array value. These send the values as one JSON parameter and unpack it in SQL,
 * which also covers the empty array the template cannot express.
 */
const pgArray = (sql: SqlClient.SqlClient, values: ReadonlyArray<string>, type: string): Fragment =>
  sql`array(select jsonb_array_elements_text(${JSON.stringify(values)}::jsonb))::${sql.literal(type)}[]`

export const textArray = (sql: SqlClient.SqlClient, values: ReadonlyArray<string>): Fragment => pgArray(sql, values, "text")

export const dateArray = (sql: SqlClient.SqlClient, values: ReadonlyArray<string>): Fragment => pgArray(sql, values, "date")

export const uuidArray = (sql: SqlClient.SqlClient, values: ReadonlyArray<string>): Fragment => pgArray(sql, values, "uuid")
