import { PgClient } from "@effect/sql-pg"
import { Config } from "effect"

/** Postgres client layer configured from DATABASE_URL. Provides both PgClient and the generic SqlClient. */
export const PgLive = PgClient.layerConfig({
  url: Config.redacted("DATABASE_URL")
})
