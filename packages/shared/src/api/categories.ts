import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"
import { Category, CategoryId, CategoryType, Hue, Slug } from "../domain.js"
import { Authentication } from "./auth.js"
import { RuleViolation } from "./errors.js"

const CategoryPath = Schema.Struct({ id: CategoryId })

/** A Category name is at most 50 characters. */
export const CategoryName = Schema.NonEmptyTrimmedString.pipe(Schema.maxLength(50))

export class CreateCategory extends Schema.Class<CreateCategory>("CreateCategory")({
  type: CategoryType,
  name: CategoryName,
  /** Defaults to a slug generated from the name. */
  slug: Schema.optional(Slug),
  emoji: Schema.optional(Schema.NullOr(Schema.String)),
  hue: Hue
}) {}

/** Category Type is fixed: changing it would orphan every Transaction of the other sign. */
export class UpdateCategory extends Schema.Class<UpdateCategory>("UpdateCategory")({
  name: Schema.optional(CategoryName),
  slug: Schema.optional(Slug),
  emoji: Schema.optional(Schema.NullOr(Schema.String)),
  hue: Schema.optional(Hue)
}) {}

export class CategoriesGroup extends HttpApiGroup.make("categories")
  .add(HttpApiEndpoint.get("list", "/categories").addSuccess(Schema.Array(Category)))
  .add(
    HttpApiEndpoint.post("create", "/categories")
      .setPayload(CreateCategory)
      .addSuccess(Category, { status: 201 })
      .addError(RuleViolation)
  )
  .add(
    HttpApiEndpoint.patch("update", "/categories/:id")
      .setPath(CategoryPath)
      .setPayload(UpdateCategory)
      .addSuccess(Category)
      .addError(HttpApiError.NotFound)
      .addError(RuleViolation)
  )
  .add(
    HttpApiEndpoint.del("delete", "/categories/:id")
      .setPath(CategoryPath)
      .addSuccess(HttpApiSchema.NoContent)
      .addError(HttpApiError.NotFound)
  )
  .middleware(Authentication) {}
