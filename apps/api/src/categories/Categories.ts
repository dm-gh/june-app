import { HttpApiBuilder } from "@effect/platform"
import { SqlClient, type SqlError } from "@effect/sql"
import { Category, CategoryId, type CategoryType, CurrentUser, JuneApi, RuleViolation, slugify, type UserId } from "@june/shared"
import { Context, Effect, Layer, type Option } from "effect"
import { ownedTable } from "../db/ownedTable.js"
import { orNotFound } from "../http/errors.js"

/** A Category's columns are exactly its fields, so the row is the Category. */
export type CategoryRow = Category

export type CategoryPatch = {
  readonly name?: string | undefined
  readonly slug?: string | undefined
  readonly emoji?: string | null | undefined
  readonly hue?: number | undefined
}

export interface CategoriesRepoShape {
  /** Expense Categories first, then Income, each by name. */
  readonly list: (userId: UserId) => Effect.Effect<ReadonlyArray<CategoryRow>>
  readonly find: (userId: UserId, id: CategoryId) => Effect.Effect<Option.Option<CategoryRow>>
  readonly insert: (
    userId: UserId,
    input: { type: CategoryType; name: string; slug: string; emoji: string | null; hue: number }
  ) => Effect.Effect<CategoryRow, RuleViolation>
  readonly update: (userId: UserId, id: CategoryId, patch: CategoryPatch) => Effect.Effect<Option.Option<CategoryRow>, RuleViolation>
  readonly remove: (userId: UserId, id: CategoryId) => Effect.Effect<Option.Option<CategoryId>>
}

export class CategoriesRepo extends Context.Tag("CategoriesRepo")<CategoriesRepo, CategoriesRepoShape>() {}

/** Postgres unique_violation. */
const isUniqueViolation = (error: SqlError.SqlError): boolean =>
  typeof error.cause === "object" && error.cause !== null && (error.cause as { code?: string }).code === "23505"

/** The one constraint a User can run into: a slug is unique per User. */
const slugTaken = (error: SqlError.SqlError): Effect.Effect<never, RuleViolation> =>
  isUniqueViolation(error)
    ? Effect.fail(new RuleViolation({ message: "A Category with this slug already exists" }))
    : Effect.die(error)

export const CategoriesRepoLive = Layer.effect(
  CategoriesRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const categories = ownedTable(sql, {
      table: "category",
      id: CategoryId,
      row: Category,
      columns: "id, type, name, slug, emoji, hue",
      order: "type, name",
      refused: slugTaken
    })
    return { list: categories.list, find: categories.find, insert: categories.insert, update: categories.patch, remove: categories.remove }
  })
)

export const CategoriesHandlersLive = HttpApiBuilder.group(JuneApi, "categories", (handlers) =>
  Effect.gen(function* () {
    const repo = yield* CategoriesRepo
    return handlers
      .handle("list", () => CurrentUser.pipe(Effect.flatMap((user) => repo.list(user.id))))
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const slug = payload.slug ?? slugify(payload.name)
          if (slug.length === 0) return yield* new RuleViolation({ message: "Name must contain a letter or digit" })
          return yield* repo.insert(user.id, { type: payload.type, name: payload.name, slug, emoji: payload.emoji ?? null, hue: payload.hue })
        })
      )
      .handle("update", ({ path, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          return yield* orNotFound(repo.update(user.id, path.id, payload))
        })
      )
      .handle("delete", ({ path }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          yield* orNotFound(repo.remove(user.id, path.id))
        })
      )
  })
)
