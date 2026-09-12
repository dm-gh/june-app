import { SqlClient } from "@effect/sql"
import type { UserId } from "@june/shared"
import { Context, Effect, Layer, Option } from "effect"
import { createHash, randomBytes } from "node:crypto"

export interface IssuedToken {
  /** The plain token, returned once and never stored. */
  readonly token: string
}

export interface CaptureTokensShape {
  /** Create a token for a User who has none; no-op otherwise. Used on first sign-in. */
  readonly ensure: (userId: UserId) => Effect.Effect<void>
  /** Replace the User's token, invalidating every generated Shortcut. */
  readonly regenerate: (userId: UserId) => Effect.Effect<IssuedToken>
  readonly exists: (userId: UserId) => Effect.Effect<boolean>
  /** Resolve the User a plain token belongs to. */
  readonly resolveUser: (token: string) => Effect.Effect<Option.Option<UserId>>
}

/** One Capture Token per User. Only its SHA-256 is stored. See ADR-0003. */
export class CaptureTokens extends Context.Tag("CaptureTokens")<CaptureTokens, CaptureTokensShape>() {}

const newToken = (): string => randomBytes(32).toString("base64url")
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex")

export const CaptureTokensLive = Layer.effect(
  CaptureTokens,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const ensure: CaptureTokensShape["ensure"] = (userId) =>
      sql`insert into capture_token (user_id, token_hash) values (${userId}, ${hashToken(newToken())})
          on conflict (user_id) do nothing`.pipe(Effect.asVoid, Effect.orDie)

    const regenerate: CaptureTokensShape["regenerate"] = (userId) =>
      Effect.gen(function* () {
        const token = newToken()
        yield* sql`insert into capture_token (user_id, token_hash) values (${userId}, ${hashToken(token)})
                   on conflict (user_id) do update set token_hash = excluded.token_hash, created_at = now()`
        return { token }
      }).pipe(Effect.orDie)

    const exists: CaptureTokensShape["exists"] = (userId) =>
      sql<{ one: number }>`select 1 as one from capture_token where user_id = ${userId}`.pipe(
        Effect.map((rows) => rows.length > 0),
        Effect.orDie
      )

    const resolveUser: CaptureTokensShape["resolveUser"] = (token) =>
      sql<{ userId: UserId }>`select user_id from capture_token where token_hash = ${hashToken(token)}`.pipe(
        Effect.map((rows) => Option.fromNullable(rows[0]?.userId)),
        Effect.orDie
      )

    return { ensure, regenerate, exists, resolveUser }
  })
)
