import { SqlClient } from "@effect/sql"
import { type UserId, Wallet, WalletId } from "@june/shared"
import { Context, Effect, Layer, type Option, Schema } from "effect"
import { ownedTable } from "../db/ownedTable.js"

/** A Wallet as stored: its own fields, without the derived Balance and Init amount. */
export const WalletRow = Schema.Struct(Wallet.fields).pick("id", "name", "currency", "position")
export type WalletRow = typeof WalletRow.Type

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
  readonly remove: (userId: UserId, id: WalletId) => Effect.Effect<Option.Option<WalletId>>
}

export class WalletsRepo extends Context.Tag("WalletsRepo")<WalletsRepo, WalletsRepoShape>() {}

export const WalletsRepoLive = Layer.effect(
  WalletsRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const wallets = ownedTable(sql, {
      table: "wallet",
      id: WalletId,
      row: WalletRow,
      columns: "id, name, trim(currency) as currency, position",
      order: "position"
    })

    const findMany: WalletsRepoShape["findMany"] = (userId, ids) =>
      ids.length === 0
        ? Effect.succeed([])
        : wallets.rows(sql`select ${wallets.columns} from wallet where user_id = ${userId} and ${sql.in("id", ids)}`)

    const firstWithCurrency: WalletsRepoShape["firstWithCurrency"] = (userId, currency) =>
      wallets.first(sql`select ${wallets.columns} from wallet where user_id = ${userId} and currency = ${currency}
                        order by position limit 1`)

    const insert: WalletsRepoShape["insert"] = (userId, input) =>
      wallets.insert(userId, {
        name: input.name,
        currency: input.currency,
        position: sql`(select coalesce(max(position), -1) + 1 from wallet where user_id = ${userId})`
      })

    const rename: WalletsRepoShape["rename"] = (userId, id, name) => wallets.patch(userId, id, { name })

    const reorder: WalletsRepoShape["reorder"] = (userId, ids) =>
      Effect.gen(function* () {
        yield* sql`set constraints wallet_user_position_unique deferred`
        for (const [position, id] of ids.entries()) {
          yield* sql`update wallet set position = ${position} where user_id = ${userId} and id = ${id}`
        }
      }).pipe(sql.withTransaction, Effect.orDie)

    return { list: wallets.list, find: wallets.find, findMany, firstWithCurrency, insert, rename, reorder, remove: wallets.remove }
  })
)
