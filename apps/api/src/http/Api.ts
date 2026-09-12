import { HttpApiBuilder } from "@effect/platform"
import { JuneApi } from "@june/shared"
import { Effect, Layer } from "effect"
import { AuthenticationLive } from "../auth/AuthenticationLive.js"
import { CaptureHandlersLive } from "../capture/Capture.js"
import { CategoriesHandlersLive } from "../categories/Categories.js"
import { SettingsHandlersLive } from "../settings/Settings.js"
import { TagsHandlersLive } from "../tags/Tags.js"
import { TransactionsHandlersLive } from "../transactions/Transactions.js"
import { WalletsHandlersLive } from "../wallets/Wallets.js"

const HealthHandlersLive = HttpApiBuilder.group(JuneApi, "health", (handlers) =>
  handlers.handle("status", () => Effect.succeed({ ok: true as const }))
)

/** Every group of the contract, implemented. Needs the repos, Rates, CaptureTokens, AppConfig and an Authentication. */
export const HandlersLive = Layer.mergeAll(
  HealthHandlersLive,
  WalletsHandlersLive,
  CategoriesHandlersLive,
  TagsHandlersLive,
  TransactionsHandlersLive,
  SettingsHandlersLive,
  CaptureHandlersLive
)

export const ApiLive = HttpApiBuilder.api(JuneApi).pipe(Layer.provide(HandlersLive), Layer.provide(AuthenticationLive))
