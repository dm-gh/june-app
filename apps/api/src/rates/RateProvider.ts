import { HttpClient, HttpClientRequest, HttpClientResponse } from "@effect/platform"
import type { LocalDate } from "@june/shared"
import { Context, Data, Effect, Layer, Redacted, Schema } from "effect"
import { AppConfig } from "../config.js"

export class RateProviderError extends Data.TaggedError("RateProviderError")<{
  readonly date: LocalDate
  readonly cause: unknown
}> {}

/** Units of each currency per 1 USD on a date. */
export type UsdRates = ReadonlyMap<string, number>

export interface RateProviderShape {
  readonly ratesFor: (date: LocalDate) => Effect.Effect<UsdRates, RateProviderError>
}

/** The external source of Exchange Rates. See ADR-0001. */
export class RateProvider extends Context.Tag("RateProvider")<RateProvider, RateProviderShape>() {}

const HistoricalResponse = Schema.Struct({
  base: Schema.Literal("USD"),
  rates: Schema.Record({ key: Schema.String, value: Schema.Number })
})

/**
 * Open Exchange Rates, free plan: USD base, one request returns every currency for a date.
 * https://docs.openexchangerates.org/reference/historical-json
 */
export const OpenExchangeRatesLive = Layer.effect(
  RateProvider,
  Effect.gen(function* () {
    const config = yield* AppConfig
    const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk)
    const appId = Redacted.value(config.openExchangeRatesAppId)

    const ratesFor: RateProviderShape["ratesFor"] = (date) =>
      HttpClientRequest.get(`https://openexchangerates.org/api/historical/${date}.json`).pipe(
        HttpClientRequest.setUrlParam("app_id", appId),
        client.execute,
        Effect.flatMap(HttpClientResponse.schemaBodyJson(HistoricalResponse)),
        Effect.map((body) => new Map(Object.entries(body.rates))),
        Effect.mapError((cause) => new RateProviderError({ date, cause })),
        Effect.withSpan("RateProvider.ratesFor", { attributes: { date } })
      )

    return { ratesFor }
  })
)

/** Fixed rates for tests and offline development. */
export const RateProviderStub = (rates: UsdRates) => Layer.succeed(RateProvider, { ratesFor: () => Effect.succeed(rates) })
