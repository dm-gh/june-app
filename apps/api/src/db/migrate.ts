import { NodeContext, NodeRuntime } from "@effect/platform-node"
import * as PgMigrator from "@effect/sql-pg/PgMigrator"
import { Effect } from "effect"
import * as path from "node:path"
import { PgLive } from "./PgLive.js"

/**
 * Runs every migration in ../migrations that has not yet been applied, then exits.
 * Works both from source (tsx, .ts files) and from dist (node, .js files) because the
 * file-system loader accepts either extension and the directory is resolved relative to this file.
 */
const migrationsDirectory = path.join(import.meta.dirname, "..", "migrations")

const program = PgMigrator.run({
  loader: PgMigrator.fromFileSystem(migrationsDirectory)
}).pipe(
  Effect.tap((applied) =>
    applied.length === 0
      ? Effect.logInfo("No pending migrations")
      : Effect.logInfo(`Applied ${applied.length} migration(s): ${applied.map(([id, name]) => `${id}_${name}`).join(", ")}`)
  ),
  Effect.provide(PgLive),
  Effect.provide(NodeContext.layer)
)

NodeRuntime.runMain(program)
