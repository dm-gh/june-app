import { PgClient } from "@effect/sql-pg"
import { Config, Context, Effect, Layer, Redacted, String } from "effect"
import { Pool, types } from "pg"

/**
 * Parsers for the column types June cares about. pg returns int8 and numeric as strings by
 * default (they may exceed a double); June's minor-unit amounts and rates fit a double
 * comfortably, so they become numbers. `date` stays the plain YYYY-MM-DD string so no time
 * zone ever shifts an occurred_on.
 */
const parsers: Record<number, (value: string) => unknown> = {
  20: Number, // int8
  1700: Number, // numeric
  1082: (value) => value // date
}

const getTypeParser = (oid: number, format?: "text" | "binary") =>
  format === "binary" ? types.getTypeParser(oid, format) : (parsers[oid] ?? types.getTypeParser(oid, "text"))

/**
 * The one connection pool a June process opens. Effect's SqlClient (PgLive) and Better Auth's
 * Kysely dialect (auth/Auth.ts) both draw from it.
 */
export class PgPool extends Context.Tag("PgPool")<PgPool, Pool>() {}

const openPool = (url: string) =>
  Effect.acquireRelease(
    Effect.sync(() => new Pool({ connectionString: url, types: { getTypeParser } })),
    (pool) => Effect.promise(() => pool.end())
  )

/** The pool on DATABASE_URL. */
export const PgPoolLive = Layer.scoped(
  PgPool,
  Config.redacted("DATABASE_URL").pipe(Effect.flatMap((url) => openPool(Redacted.value(url))))
)

/** A pool on an explicit URL; used by tests for their throwaway databases. */
export const PgPoolForUrl = (url: string) => Layer.scoped(PgPool, openPool(url))

/** Postgres client over the shared pool. Provides both PgClient and the generic SqlClient. */
export const PgLive = Layer.unwrapEffect(
  PgPool.pipe(
    Effect.map((pool) =>
      PgClient.layerFromPool({
        acquire: Effect.succeed(pool),
        transformResultNames: String.snakeToCamel,
        transformQueryNames: String.camelToSnake
      })
    )
  )
)
