import { HttpApiBuilder } from "@effect/platform"
import { SqlClient } from "@effect/sql"
import { CurrentUser, JuneApi, type Tag } from "@june/shared"
import { Effect } from "effect"

/** Distinct Tags across the User's Transactions, for the tag input's suggestions. */
export const TagsHandlersLive = HttpApiBuilder.group(JuneApi, "tags", (handlers) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    return handlers.handle("list", () =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const rows = yield* sql<{ tag: Tag }>`
          select distinct tag from transaction, unnest(tags) as tag where user_id = ${user.id} order by tag
        `.pipe(Effect.orDie)
        return rows.map((r) => r.tag)
      })
    )
  })
)
