import { HttpApiError } from "@effect/platform"
import { Effect, Option } from "effect"

/** A row that does not exist and a row of another User are the same 404. */
export const orNotFound = <A, E, R>(self: Effect.Effect<Option.Option<A>, E, R>): Effect.Effect<A, E | HttpApiError.NotFound, R> =>
  Effect.flatMap(self, Option.match({ onNone: () => new HttpApiError.NotFound(), onSome: Effect.succeed }))
