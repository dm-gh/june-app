import { Config, Context, Effect, Layer, type Redacted } from "effect"

export interface AppConfigShape {
  readonly port: number
  /** Public origin of the app, e.g. https://june.up.railway.app or http://localhost:3000. */
  readonly baseUrl: string
  readonly authSecret: Redacted.Redacted
  readonly googleClientId: string
  readonly googleClientSecret: Redacted.Redacted
  readonly openExchangeRatesAppId: Redacted.Redacted
  /** Directory of the built web app to serve as static files; unset in development (Vite serves it). */
  readonly webDist: string | undefined
}

export class AppConfig extends Context.Tag("AppConfig")<AppConfig, AppConfigShape>() {}

export const AppConfigLive = Layer.effect(
  AppConfig,
  Effect.gen(function* () {
    return {
      port: yield* Config.integer("PORT").pipe(Config.withDefault(3000)),
      baseUrl: yield* Config.string("BASE_URL").pipe(Config.withDefault("http://localhost:3000")),
      authSecret: yield* Config.redacted("BETTER_AUTH_SECRET"),
      googleClientId: yield* Config.string("GOOGLE_CLIENT_ID"),
      googleClientSecret: yield* Config.redacted("GOOGLE_CLIENT_SECRET"),
      openExchangeRatesAppId: yield* Config.redacted("OPEN_EXCHANGE_RATES_APP_ID"),
      webDist: yield* Config.string("WEB_DIST").pipe(Config.option, Effect.map((o) => (o._tag === "Some" ? o.value : undefined)))
    }
  })
)
