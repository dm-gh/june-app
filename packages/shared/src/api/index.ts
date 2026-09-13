import { HttpApi } from "@effect/platform"
import { CaptureGroup } from "./capture.js"
import { CategoriesGroup } from "./categories.js"
import { HealthGroup } from "./health.js"
import { ImportGroup } from "./import.js"
import { LoansGroup } from "./loans.js"
import { RecurringsGroup } from "./recurrings.js"
import { SettingsGroup } from "./settings.js"
import { TagsGroup } from "./tags.js"
import { TransactionsGroup } from "./transactions.js"
import { WalletsGroup } from "./wallets.js"

/**
 * The whole June API contract. The api derives its handlers from this value and the web
 * derives a typed client from it, so a change here breaks the build rather than a request.
 * Better Auth is mounted separately at /api/auth and is not part of this contract.
 */
export class JuneApi extends HttpApi.make("june")
  .add(HealthGroup)
  .add(WalletsGroup)
  .add(CategoriesGroup)
  .add(TagsGroup)
  .add(TransactionsGroup)
  .add(SettingsGroup)
  .add(CaptureGroup)
  .add(ImportGroup)
  .add(RecurringsGroup)
  .add(LoansGroup)
  .prefix("/api") {}

export * from "./auth.js"
export * from "./capture.js"
export * from "./categories.js"
export * from "./errors.js"
export * from "./health.js"
export * from "./import.js"
export * from "./loans.js"
export * from "./recurrings.js"
export * from "./settings.js"
export * from "./tags.js"
export * from "./transactions.js"
export * from "./wallets.js"
