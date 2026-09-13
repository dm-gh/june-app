import { todayUtc } from "@june/shared"
import { Effect, Layer, Schedule } from "effect"
import { RecurringFiring } from "./Firing.js"

/**
 * The in-process tick behind auto firing: once at start-up and then every hour, apply every
 * Recurring whose due date has passed in UTC. Cheap enough to run beside the server; if the
 * service is ever put to sleep between requests, a scheduler calling `fireDue` would replace this.
 */
export const RecurringTickerLive = Layer.scopedDiscard(
  Effect.gen(function* () {
    const firing = yield* RecurringFiring
    const tick = firing.fireDue(todayUtc()).pipe(
      Effect.tap((fired) => (fired > 0 ? Effect.logInfo(`Fired ${fired} recurring change(s)`) : Effect.void)),
      Effect.catchAllCause((cause) => Effect.logError("Recurring tick failed", cause))
    )
    yield* Effect.forkScoped(Effect.repeat(tick, Schedule.spaced("1 hour")))
  })
)
