import { SqlClient } from "@effect/sql"
import type { UserId, WalletId } from "@june/shared"
import { Context, Effect, Layer, Option } from "effect"

export interface WalletRow {
  readonly id: WalletId
  readonly name: string
  readonly currency: string
  readonly position: number
}

export interface WalletsRepoShape {
  /** In Wallet Order. */
  readonly list: (userId: UserId) => Effect.Effect<ReadonlyArray<WalletRow>>
  readonly find: (userId: UserId, id: WalletId) => Effect.Effect<Option.Option<WalletRow>>
  readonly findMany: (userId: UserId, ids: ReadonlyArray<WalletId>) => Effect.Effect<ReadonlyArray<WalletRow>>
  /** First Wallet in Wallet Order with this currency: how a capture resolves its Wallet. */
  readonly firstWithCurrency: (userId: UserId, currency: string) => Effect.Effect<Option.Option<WalletRow>>
  /** Appends at the end of Wallet Order. */
  readonly insert: (userId: UserId, input: { name: string; currency: string }) => Effect.Effect<WalletRow>
  readonly rename: (userId: UserId, id: WalletId, name: string) => Effect.Effect<Option.Option<WalletRow>>
  /** `ids` must be exactly the User's Wallets; positions are rewritten inside one transaction. */
  readonly reorder: (userId: UserId, ids: ReadonlyArray<WalletId>) => Effect.Effect<void>
  readonly remove: (userId: UserId, id: WalletId) => Effect.Effect<boolean>
}

export class WalletsRepo extends Context.Tag("WalletsRepo")<WalletsRepo, WalletsRepoShape>() {}

const columns = "id, name, currency, position"

export const WalletsRepoLive = Layer.effect(
  WalletsRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const cols = sql.literal(columns)
    const normalise = (row: WalletRow): WalletRow => ({ ...row, currency: row.currency.trim() })
    const rows = (effect: Effect.Effect<ReadonlyArray<WalletRow>, unknown>) =>
      effect.pipe(Effect.map((rs) => rs.map(normalise)), Effect.orDie)

    const list: WalletsRepoShape["list"] = (userId) =>
      rows(sql<WalletRow>`select ${cols} from wallet where user_id = ${userId} order by position`)

    const find: WalletsRepoShape["find"] = (userId, id) =>
      rows(sql<WalletRow>`select ${cols} from wallet where user_id = ${userId} and id = ${id}`).pipe(
        Effect.map((rs) => Option.fromNullable(rs[0]))
      )

    const findMany: WalletsRepoShape["findMany"] = (userId, ids) =>
      ids.length === 0
        ? Effect.succeed([])
        : rows(sql<WalletRow>`select ${cols} from wallet where user_id = ${userId} and ${sql.in("id", ids)}`)

    const firstWithCurrency: WalletsRepoShape["firstWithCurrency"] = (userId, currency) =>
      rows(sql<WalletRow>`select ${cols} from wallet where user_id = ${userId} and currency = ${currency}
                          order by position limit 1`).pipe(Effect.map((rs) => Option.fromNullable(rs[0])))

    const insert: WalletsRepoShape["insert"] = (userId, input) =>
      rows(sql<WalletRow>`insert into wallet (user_id, name, currency, position)
                          values (${userId}, ${input.name}, ${input.currency},
                                  (select coalesce(max(position), -1) + 1 from wallet where user_id = ${userId}))
                          returning ${cols}`).pipe(Effect.map((rs) => rs[0]!))

    const rename: WalletsRepoShape["rename"] = (userId, id, name) =>
      rows(sql<WalletRow>`update wallet set name = ${name} where user_id = ${userId} and id = ${id} returning ${cols}`).pipe(
        Effect.map((rs) => Option.fromNullable(rs[0]))
      )

    const reorder: WalletsRepoShape["reorder"] = (userId, ids) =>
      Effect.gen(function* () {
        yield* sql`set constraints wallet_user_position_unique deferred`
        for (const [position, id] of ids.entries()) {
          yield* sql`update wallet set position = ${position} where user_id = ${userId} and id = ${id}`
        }
      }).pipe(sql.withTransaction, Effect.orDie)

    const remove: WalletsRepoShape["remove"] = (userId, id) =>
      sql<{ id: string }>`delete from wallet where user_id = ${userId} and id = ${id} returning id`.pipe(
        Effect.map((rs) => rs.length > 0),
        Effect.orDie
      )

    return { list, find, findMany, firstWithCurrency, insert, rename, reorder, remove }
  })
)
