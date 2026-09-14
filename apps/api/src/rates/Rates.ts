import { SqlClient } from "@effect/sql"
import { convertMinor, type LocalDate, MinorAmount, RateUnavailable, todayUtc } from "@june/shared"
import { Context, Effect, Layer } from "effect"
import { dateArray } from "../db/sqlHelpers.js"
import { RateProvider } from "./RateProvider.js"

/** Rates by date, then by currency: units per 1 USD. A date maps to the nearest earlier cached date. */
export type RateTable = ReadonlyMap<LocalDate, ReadonlyMap<string, number>>

export interface RatesShape {
  /**
   * Make sure every date has rates cached: fetch the missing ones from the Rate Provider,
   * refresh today's if older than an hour. A date the provider cannot serve is tolerated when an
   * earlier date exists (the nearest-earlier fallback applies); otherwise RateUnavailable.
   */
  readonly ensure: (dates: Iterable<LocalDate>) => Effect.Effect<void, RateUnavailable>
  /** Rates for each date after `ensure`, with the nearest-earlier fallback resolved in SQL. */
  readonly table: (dates: Iterable<LocalDate>) => Effect.Effect<RateTable>
  /** Convert minor units between currencies on a date; null when the table lacks a rate. */
  readonly convert: (table: RateTable, minor: number, from: string, to: string, date: LocalDate) => MinorAmount | null
}

export class Rates extends Context.Tag("Rates")<Rates, RatesShape>() {}

const REFRESH_TODAY_AFTER_MS = 60 * 60 * 1000

export const RatesLive = Layer.effect(
  Rates,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const provider = yield* RateProvider

    const cachedAt = (date: LocalDate) =>
      sql<{ fetchedAt: Date }>`select max(fetched_at) as fetched_at from exchange_rate where rate_date = ${date}`.pipe(
        Effect.map((rows) => rows[0]?.fetchedAt ?? null),
        Effect.orDie
      )

    const hasAnyEarlier = (date: LocalDate) =>
      sql<{ one: number }>`select 1 as one from exchange_rate where rate_date <= ${date} limit 1`.pipe(
        Effect.map((rows) => rows.length > 0),
        Effect.orDie
      )

    const store = (date: LocalDate, rates: ReadonlyMap<string, number>) =>
      Effect.gen(function* () {
        // The pivot itself is always 1, whatever the provider says.
        const withPivot = new Map(rates).set("USD", 1)
        const rows = [...withPivot.entries()]
          .filter(([currency, rate]) => /^[A-Z]{3}$/.test(currency) && rate > 0)
          .map(([currency, rate]) => ({ currency, rateDate: date, ratePerUsd: rate, fetchedAt: new Date() }))
        yield* sql`insert into exchange_rate ${sql.insert(rows)}
                   on conflict (currency, rate_date) do update
                     set rate_per_usd = excluded.rate_per_usd, fetched_at = excluded.fetched_at`
      }).pipe(Effect.orDie)

    const fetchInto = (date: LocalDate) =>
      provider.ratesFor(date).pipe(
        Effect.flatMap((rates) => store(date, rates)),
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* Effect.logWarning(`Rate Provider failed for ${date}`, error.cause)
            const fallbackExists = yield* hasAnyEarlier(date)
            if (!fallbackExists) {
              return yield* new RateUnavailable({ message: `No exchange rates available for ${date}` })
            }
          })
        )
      )

    const ensure: RatesShape["ensure"] = (dates) =>
      Effect.gen(function* () {
        const today = todayUtc()
        // Future dates cannot be fetched; they fall back to the latest cached date.
        const wanted = [...new Set(dates)].filter((d) => d <= today).sort()
        for (const date of wanted) {
          const fetchedAt = yield* cachedAt(date)
          const stale = date === today && fetchedAt !== null && Date.now() - fetchedAt.getTime() > REFRESH_TODAY_AFTER_MS
          if (fetchedAt === null || stale) yield* fetchInto(date)
        }
        // A wholly future set still needs something to fall back on.
        if (wanted.length === 0 && [...dates].length > 0) {
          if (!(yield* hasAnyEarlier(today))) yield* fetchInto(today)
        }
      })

    const table: RatesShape["table"] = (dates) =>
      Effect.gen(function* () {
        const wanted = [...new Set(dates)]
        if (wanted.length === 0) return new Map()
        const rows = yield* sql<{ wanted: LocalDate; currency: string; ratePerUsd: number }>`
          select d.wanted, r.currency, r.rate_per_usd
          from unnest(${dateArray(sql, wanted)}) as d(wanted)
          join lateral (
            select rate_date from exchange_rate where rate_date <= d.wanted order by rate_date desc limit 1
          ) nearest on true
          join exchange_rate r on r.rate_date = nearest.rate_date
        `
        const result = new Map<LocalDate, Map<string, number>>()
        for (const row of rows) {
          let byCurrency = result.get(row.wanted)
          if (byCurrency === undefined) {
            byCurrency = new Map()
            result.set(row.wanted, byCurrency)
          }
          byCurrency.set(row.currency.trim(), row.ratePerUsd)
        }
        return result
      }).pipe(Effect.orDie)

    const convert: RatesShape["convert"] = (table, minor, from, to, date) => {
      if (from === to) return MinorAmount.make(minor)
      const rates = table.get(date)
      const rateFrom = rates?.get(from)
      const rateTo = rates?.get(to)
      if (rateFrom === undefined || rateTo === undefined) return null
      return MinorAmount.make(convertMinor(minor, from, to, rateFrom, rateTo))
    }

    return { ensure, table, convert }
  })
)
