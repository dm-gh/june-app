import { HttpApiBuilder, HttpMiddleware, HttpServer } from "@effect/platform"
import { NodeHttpClient, NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { createServer } from "node:http"
import { AuthLive } from "./auth/Auth.js"
import { AuthenticationLive } from "./auth/AuthenticationLive.js"
import { AuthRoutesLive } from "./auth/AuthRoutes.js"
import { AppConfig, AppConfigLive } from "./config.js"
import { PgPoolLive } from "./db/PgLive.js"
import { ApiLive } from "./http/Api.js"
import { StaticRoutesLive } from "./http/Static.js"
import { RecurringTickerLive } from "./recurrings/Ticker.js"
import { OpenExchangeRatesLive } from "./rates/RateProvider.js"
import { ServicesLive } from "./Services.js"

const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide([AuthRoutesLive, StaticRoutesLive]),
  Layer.provide(ApiLive),
  Layer.provide(AuthenticationLive),
  HttpServer.withLogAddress,
  Layer.provide(
    Layer.unwrapEffect(AppConfig.pipe(Effect.map((config) => NodeHttpServer.layer(createServer, { port: config.port }))))
  )
)

/**
 * The server and, beside it, the hourly tick that fires due Recurrings, sharing one set of
 * services. Production's substitution points: configuration from the environment, the pool on
 * DATABASE_URL, Open Exchange Rates, and Better Auth for the session.
 */
const MainLive = Layer.mergeAll(HttpLive, RecurringTickerLive).pipe(
  Layer.provide(AuthLive),
  Layer.provide(ServicesLive),
  Layer.provide(OpenExchangeRatesLive),
  Layer.provide(Layer.mergeAll(AppConfigLive, PgPoolLive, NodeHttpClient.layerUndici))
)

NodeRuntime.runMain(Layer.launch(MainLive))
