import { HttpApiBuilder } from "@effect/platform"
import { JuneApi } from "@june/shared"
import { Effect, Layer } from "effect"
import { CaptureHandlersLive } from "../capture/Capture.js"
import { CategoriesHandlersLive } from "../categories/Categories.js"
import { ImportHandlersLive } from "../import/Import.js"
import { LoansHandlersLive } from "../loans/Loans.js"
import { RecurringsHandlersLive } from "../recurrings/Recurrings.js"
import { SettingsHandlersLive } from "../settings/Settings.js"
import { TagsHandlersLive, TransactionsHandlersLive } from "../transactions/Transactions.js"
import { WalletsHandlersLive } from "../wallets/Wallets.js"

const HealthHandlersLive = HttpApiBuilder.group(JuneApi, "health", (handlers) =>
  handlers.handle("status", () => Effect.succeed({ ok: true as const }))
)

/** Every group of the contract, implemented. */
const HandlersLive = Layer.mergeAll(
  HealthHandlersLive,
  WalletsHandlersLive,
  CategoriesHandlersLive,
  TagsHandlersLive,
  TransactionsHandlersLive,
  SettingsHandlersLive,
  CaptureHandlersLive,
  ImportHandlersLive,
  RecurringsHandlersLive,
  LoansHandlersLive
)

/**
 * The contract served. Needs the services (Services.ts), AppConfig, and an Authentication:
 * Better Auth's session in production (auth/AuthenticationLive.ts), a fixed User in tests.
 */
export const ApiLive = HttpApiBuilder.api(JuneApi).pipe(Layer.provide(HandlersLive))
