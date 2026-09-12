import { PgClient } from "@effect/sql-pg"
import { Config, Effect, Layer, Redacted, String } from "effect"
import { types } from "pg"

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

const layerOptions = {
  transformResultNames: String.snakeToCamel,
  transformQueryNames: String.camelToSnake,
  types: {
    getTypeParser: (oid: number, format?: "text" | "binary") =>
      format === "binary" ? types.getTypeParser(oid, format) : (parsers[oid] ?? types.getTypeParser(oid, "text"))
  }
} as const

/** Postgres client layer configured from DATABASE_URL. Provides both PgClient and the generic SqlClient. */
export const PgLive = Layer.unwrapEffect(
  Config.redacted("DATABASE_URL").pipe(Effect.map((url) => PgClient.layer({ url, ...layerOptions })))
)

/** Same client against an explicit URL; used by tests for their throwaway databases. */
export const PgLiveForUrl = (url: string) => PgClient.layer({ url: Redacted.make(url), ...layerOptions })
