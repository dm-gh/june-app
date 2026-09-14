import { Schema } from "effect"

/**
 * Building request schemas out of one another, so a rule (a positive leg, a non-zero amount,
 * a 25-character name) is written once on the Create and inherited by the Update.
 */

/** The `:id` segment of a path, typed by the id it carries. */
export const pathOf = <Id extends Schema.Schema.All>(id: Id) => Schema.Struct({ id })

/** Every field of a Struct as `Schema.optional` (absent or `undefined` means unchanged); fields already optional stay as they are. */
export type PartialFields<F extends Schema.Struct.Fields> = {
  readonly [K in keyof F]: F[K] extends Schema.PropertySignature.All ? F[K] : F[K] extends Schema.Schema.All ? Schema.optional<F[K]> : never
}

export const partialFields = <F extends Schema.Struct.Fields>(fields: F): PartialFields<F> =>
  Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, Schema.isPropertySignature(field) ? field : Schema.optional(field)])) as PartialFields<F>
