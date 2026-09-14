import { Layer } from "effect"
import { CaptureTokensLive } from "./capture/CaptureTokens.js"
import { CategoriesRepoLive } from "./categories/Categories.js"
import { PgLive } from "./db/PgLive.js"
import { LoansRepoLive } from "./loans/LoansRepo.js"
import { RecurringFiringLive } from "./recurrings/Firing.js"
import { RecurringsRepoLive } from "./recurrings/RecurringsRepo.js"
import { RatesLive } from "./rates/Rates.js"
import { RecordChangeLive } from "./transactions/RecordChange.js"
import { TransactionsRepoLive } from "./transactions/TransactionsRepo.js"
import { WalletsRepoLive } from "./wallets/WalletsRepo.js"

/**
 * Every service behind the handlers, wired once for main.ts and the test harness. What differs
 * between production and a test stays a requirement: the pg Pool (PgPool) and the Rate Provider
 * here, AppConfig and the Authentication middleware on the api above (http/Api.ts).
 */
export const ServicesLive = Layer.mergeAll(RatesLive, RecurringFiringLive).pipe(
  Layer.provideMerge(RecordChangeLive),
  Layer.provideMerge(
    Layer.mergeAll(WalletsRepoLive, CategoriesRepoLive, TransactionsRepoLive, RecurringsRepoLive, LoansRepoLive)
  ),
  Layer.provideMerge(CaptureTokensLive),
  Layer.provideMerge(PgLive)
)
