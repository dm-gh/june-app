import { HttpApiBuilder, HttpMiddleware, HttpServer } from "@effect/platform"
import { NodeHttpClient, NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { createServer } from "node:http"
import { AuthLive } from "./auth/Auth.js"
import { AuthRoutesLive } from "./auth/AuthRoutes.js"
import { CaptureTokensLive } from "./capture/CaptureTokens.js"
import { CategoriesRepoLive } from "./categories/Categories.js"
import { AppConfig, AppConfigLive } from "./config.js"
import { PgLive } from "./db/PgLive.js"
import { ApiLive } from "./http/Api.js"
import { StaticRoutesLive } from "./http/Static.js"
import { LoansRepoLive } from "./loans/LoansRepo.js"
import { RecurringFiringLive } from "./recurrings/Firing.js"
import { RecurringsRepoLive } from "./recurrings/RecurringsRepo.js"
import { RecurringTickerLive } from "./recurrings/Ticker.js"
import { OpenExchangeRatesLive } from "./rates/RateProvider.js"
import { RatesLive } from "./rates/Rates.js"
import { RecordChangeLive } from "./transactions/RecordChange.js"
import { TransactionsRepoLive } from "./transactions/TransactionsRepo.js"
import { WalletsRepoLive } from "./wallets/WalletsRepo.js"

/** Every service the handlers need, wired from configuration and the database. */
export const ServicesLive = Layer.mergeAll(AuthLive, RatesLive, CaptureTokensLive, RecurringFiringLive).pipe(
  Layer.provideMerge(RecordChangeLive),
  Layer.provideMerge(Layer.mergeAll(WalletsRepoLive, CategoriesRepoLive, TransactionsRepoLive, RecurringsRepoLive, LoansRepoLive)),
  Layer.provideMerge(Layer.mergeAll(CaptureTokensLive, OpenExchangeRatesLive)),
  Layer.provideMerge(Layer.mergeAll(AppConfigLive, PgLive, NodeHttpClient.layerUndici))
)

const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide([AuthRoutesLive, StaticRoutesLive]),
  Layer.provide(ApiLive),
  HttpServer.withLogAddress,
  Layer.provide(
    Layer.unwrapEffect(AppConfig.pipe(Effect.map((config) => NodeHttpServer.layer(createServer, { port: config.port }))))
  )
)

/** The server and, beside it, the hourly tick that fires due Recurrings, sharing one set of services. */
const MainLive = Layer.mergeAll(HttpLive, RecurringTickerLive).pipe(Layer.provide(ServicesLive))

NodeRuntime.runMain(Layer.launch(MainLive))
