import { HttpApiBuilder, HttpApiError } from "@effect/platform"
import { SqlClient, type SqlError } from "@effect/sql"
import {
  type Category,
  type CategoryId,
  type CategoryType,
  CurrentUser,
  type Hue,
  JuneApi,
  RuleViolation,
  type Slug,
  slugify,
  type UserId
} from "@june/shared"
import { Context, Effect, Layer, Option } from "effect"

export interface CategoryRow {
  readonly id: CategoryId
  readonly type: CategoryType
  readonly name: string
  readonly slug: Slug
  readonly emoji: string | null
  readonly hue: Hue
}

export interface CategoriesRepoShape {
  readonly list: (userId: UserId) => Effect.Effect<ReadonlyArray<CategoryRow>>
  readonly find: (userId: UserId, id: CategoryId) => Effect.Effect<Option.Option<CategoryRow>>
  readonly findBySlug: (userId: UserId, slug: string) => Effect.Effect<Option.Option<CategoryRow>>
  readonly insert: (
    userId: UserId,
    input: { type: CategoryType; name: string; slug: string; emoji: string | null; hue: number }
  ) => Effect.Effect<CategoryRow, RuleViolation>
  readonly update: (
    userId: UserId,
    id: CategoryId,
    patch: { name?: string; slug?: string; emoji?: string | null; hue?: number }
  ) => Effect.Effect<Option.Option<CategoryRow>, RuleViolation>
  readonly remove: (userId: UserId, id: CategoryId) => Effect.Effect<boolean>
}

export class CategoriesRepo extends Context.Tag("CategoriesRepo")<CategoriesRepo, CategoriesRepoShape>() {}

const columns = "id, type, name, slug, emoji, hue"

/** Postgres unique_violation. */
const isUniqueViolation = (error: SqlError.SqlError): boolean =>
  typeof error.cause === "object" && error.cause !== null && (error.cause as { code?: string }).code === "23505"

const slugTaken = (error: SqlError.SqlError): Effect.Effect<never, RuleViolation> =>
  isUniqueViolation(error)
    ? Effect.fail(new RuleViolation({ message: "A Category with this slug already exists" }))
    : Effect.die(error)

export const CategoriesRepoLive = Layer.effect(
  CategoriesRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const list: CategoriesRepoShape["list"] = (userId) =>
      sql<CategoryRow>`select ${sql.literal(columns)} from category where user_id = ${userId} order by type, name`.pipe(
        Effect.orDie
      )

    const find: CategoriesRepoShape["find"] = (userId, id) =>
      sql<CategoryRow>`select ${sql.literal(columns)} from category where user_id = ${userId} and id = ${id}`.pipe(
        Effect.map((rows) => Option.fromNullable(rows[0])),
        Effect.orDie
      )

    const findBySlug: CategoriesRepoShape["findBySlug"] = (userId, slug) =>
      sql<CategoryRow>`select ${sql.literal(columns)} from category where user_id = ${userId} and slug = ${slug}`.pipe(
        Effect.map((rows) => Option.fromNullable(rows[0])),
        Effect.orDie
      )

    const insert: CategoriesRepoShape["insert"] = (userId, input) =>
      sql<CategoryRow>`insert into category (user_id, type, name, slug, emoji, hue)
                       values (${userId}, ${input.type}, ${input.name}, ${input.slug}, ${input.emoji}, ${input.hue})
                       returning ${sql.literal(columns)}`.pipe(
        Effect.map((rows) => rows[0]!),
        Effect.catchAll(slugTaken)
      )

    const update: CategoriesRepoShape["update"] = (userId, id, patch) =>
      Effect.gen(function* () {
        const values: Record<string, unknown> = {}
        if (patch.name !== undefined) values.name = patch.name
        if (patch.slug !== undefined) values.slug = patch.slug
        if (patch.emoji !== undefined) values.emoji = patch.emoji
        if (patch.hue !== undefined) values.hue = patch.hue
        if (Object.keys(values).length === 0) return yield* find(userId, id)
        const rows = yield* sql<CategoryRow>`update category set ${sql.update(values)}
                                             where user_id = ${userId} and id = ${id}
                                             returning ${sql.literal(columns)}`
        return Option.fromNullable(rows[0])
      }).pipe(Effect.catchAll(slugTaken))

    const remove: CategoriesRepoShape["remove"] = (userId, id) =>
      sql<{ id: string }>`delete from category where user_id = ${userId} and id = ${id} returning id`.pipe(
        Effect.map((rows) => rows.length > 0),
        Effect.orDie
      )

    return { list, find, findBySlug, insert, update, remove }
  })
)

export const toCategory = (row: CategoryRow): Category => ({
  id: row.id,
  type: row.type,
  name: row.name,
  slug: row.slug,
  emoji: row.emoji,
  hue: row.hue
}) as Category

export const CategoriesHandlersLive = HttpApiBuilder.group(JuneApi, "categories", (handlers) =>
  Effect.gen(function* () {
    const repo = yield* CategoriesRepo
    return handlers
      .handle("list", () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          return (yield* repo.list(user.id)).map(toCategory)
        })
      )
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const slug = payload.slug ?? slugify(payload.name)
          if (slug.length === 0) return yield* new RuleViolation({ message: "Name must contain a letter or digit" })
          const row = yield* repo.insert(user.id, {
            type: payload.type,
            name: payload.name,
            slug,
            emoji: payload.emoji ?? null,
            hue: payload.hue
          })
          return toCategory(row)
        })
      )
      .handle("update", ({ path, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const row = yield* repo.update(user.id, path.id, {
            ...(payload.name !== undefined ? { name: payload.name } : {}),
            ...(payload.slug !== undefined ? { slug: payload.slug } : {}),
            ...(payload.emoji !== undefined ? { emoji: payload.emoji } : {}),
            ...(payload.hue !== undefined ? { hue: payload.hue } : {})
          })
          if (Option.isNone(row)) return yield* new HttpApiError.NotFound()
          return toCategory(row.value)
        })
      )
      .handle("delete", ({ path }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const removed = yield* repo.remove(user.id, path.id)
          if (!removed) return yield* new HttpApiError.NotFound()
        })
      )
  })
)
