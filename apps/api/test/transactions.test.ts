import { it } from "@effect/vitest"
import type { CategoryType, CurrencyCode, Hue, LocalDate, MinorAmount, Tag } from "@june/shared"
import { Effect } from "effect"
import { expect } from "vitest"
import { RateProviderError } from "../src/rates/RateProvider.js"
import { makeHarness, stubRates } from "./harness.js"

const usd = "USD" as CurrencyCode
const gel = "GEL" as CurrencyCode
const minor = (n: number) => n as MinorAmount
const day = (s: string) => s as LocalDate
const tag = (s: string) => s as Tag
const period = { from: day("2026-01-01"), to: day("2026-12-31") }

it.scoped("the list converts every row into Default Currency for its own date", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness({ user: { defaultCurrency: gel } })
    const card = yield* h.client.wallets.create({ payload: { name: "Card", currency: usd, initMinor: minor(0) } })
    yield* h.client.transactions.createChange({
      payload: { walletId: card.id, amountMinor: minor(-450), occurredOn: day("2026-09-10"), tags: [tag("Coffee")] }
    })
    const list = yield* h.client.transactions.list({ urlParams: period })
    const change = list.find((t) => t.type === "change")!
    // -4.50 USD at 2.7 GEL per USD = -12.15 GEL.
    expect(change.defaultMinor).toBe(-1_215)
    expect(change.tags).toEqual(["coffee"])
    expect(list.find((t) => t.type === "init")!.defaultMinor).toBe(0)
  })
)

it.scoped("a date the Rate Provider cannot serve falls back to the nearest earlier cached date", () =>
  Effect.gen(function* () {
    const failing = day("2026-09-11")
    const h = yield* makeHarness({
      user: { defaultCurrency: gel },
      rateProvider: {
        ratesFor: (date) =>
          date === failing
            ? Effect.fail(new RateProviderError({ date, cause: "outage" }))
            : Effect.succeed(date === "2026-09-10" ? new Map([...stubRates, ["USD", 1], ["GEL", 3]]) : stubRates)
      }
    })
    const card = yield* h.client.wallets.create({ payload: { name: "Card", currency: usd, initMinor: minor(0) } })
    yield* h.client.transactions.createChange({ payload: { walletId: card.id, amountMinor: minor(-100), occurredOn: day("2026-09-10") } })
    yield* h.client.transactions.createChange({ payload: { walletId: card.id, amountMinor: minor(-100), occurredOn: failing } })
    const list = yield* h.client.transactions.list({ urlParams: period })
    const byDate = Object.fromEntries(list.filter((t) => t.type === "change").map((t) => [t.occurredOn, t.defaultMinor]))
    expect(byDate["2026-09-10"]).toBe(-300)
    // 11 Sep has no rate of its own; 10 Sep's 3 GEL per USD is used.
    expect(byDate["2026-09-11"]).toBe(-300)
  })
)

it.scoped("a Change must sit in a Wallet of its currency with a Category of its sign", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness()
    const card = yield* h.client.wallets.create({ payload: { name: "Card", currency: usd, initMinor: minor(0) } })
    const cash = yield* h.client.wallets.create({ payload: { name: "Cash", currency: gel, initMinor: minor(0) } })
    const salary = yield* h.client.categories.create({ payload: { type: "income" as CategoryType, name: "Salary", hue: 1 as Hue } })

    const wrongCategory = yield* h.client.transactions
      .createChange({ payload: { walletId: card.id, amountMinor: minor(-100), occurredOn: day("2026-09-01"), categoryId: salary.id } })
      .pipe(Effect.flip)
    expect(wrongCategory._tag).toBe("RuleViolation")

    const zero = yield* h.client.transactions
      .createChange({ payload: { walletId: card.id, amountMinor: minor(0), occurredOn: day("2026-09-01") } })
      .pipe(Effect.flip)
    expect(zero._tag).toBe("RuleViolation")

    const tx = yield* h.client.transactions.createChange({
      payload: { walletId: card.id, amountMinor: minor(-100), occurredOn: day("2026-09-01") }
    })
    // Moving a USD Change into a GEL Wallet is refused; the currency wins.
    const moved = yield* h.client.transactions.update({ path: { id: tx.id }, payload: { walletId: cash.id } }).pipe(Effect.flip)
    expect(moved._tag).toBe("RuleViolation")
    // Re-entering it in GEL together with the GEL Wallet is fine.
    const reentered = yield* h.client.transactions.update({
      path: { id: tx.id },
      payload: { walletId: cash.id, currency: gel, amountMinor: minor(-270) }
    })
    expect(reentered.walletId).toBe(cash.id)
    expect(reentered.currency).toBe("GEL")
    // Flipping the sign with an Income Category attached is fine; flipping it back is not.
    const income = yield* h.client.transactions.update({
      path: { id: tx.id },
      payload: { amountMinor: minor(500), categoryId: salary.id }
    })
    expect(income.categoryId).toBe(salary.id)
    const flipped = yield* h.client.transactions.update({ path: { id: tx.id }, payload: { amountMinor: minor(-500) } }).pipe(Effect.flip)
    expect(flipped._tag).toBe("RuleViolation")
  })
)

it.scoped("bulk edit refuses a Wallet across currencies and merges Tags", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness()
    const card = yield* h.client.wallets.create({ payload: { name: "Card", currency: usd, initMinor: minor(0) } })
    const card2 = yield* h.client.wallets.create({ payload: { name: "Card 2", currency: usd, initMinor: minor(0) } })
    const cash = yield* h.client.wallets.create({ payload: { name: "Cash", currency: gel, initMinor: minor(0) } })
    const a = yield* h.client.transactions.createChange({
      payload: { walletId: card.id, amountMinor: minor(-100), occurredOn: day("2026-09-01"), tags: [tag("trip"), tag("food")] }
    })
    const b = yield* h.client.transactions.createChange({
      payload: { walletId: card.id, amountMinor: minor(-200), occurredOn: day("2026-09-01"), tags: [tag("trip")] }
    })
    const c = yield* h.client.transactions.createChange({
      payload: { walletId: cash.id, amountMinor: minor(-300), occurredOn: day("2026-09-01") }
    })

    const mixed = yield* h.client.transactions
      .bulkUpdate({ payload: { ids: [a.id, c.id], walletId: card2.id } })
      .pipe(Effect.flip)
    expect(mixed._tag).toBe("RuleViolation")

    yield* h.client.transactions.bulkUpdate({
      payload: { ids: [a.id, b.id], walletId: card2.id, addTags: [tag("2026"), tag("trip")], removeTags: [tag("food")] }
    })
    const after = yield* h.client.transactions.list({ urlParams: period })
    const ta = after.find((t) => t.id === a.id)!
    const tb = after.find((t) => t.id === b.id)!
    expect(ta.walletId).toBe(card2.id)
    expect(ta.tags).toEqual(["trip", "2026"])
    expect(tb.tags).toEqual(["trip", "2026"])
    expect(yield* h.client.tags.list()).toEqual(["2026", "trip"])

    const missing = yield* h.client.transactions
      .bulkUpdate({ payload: { ids: [a.id, "00000000-0000-4000-8000-00000000dead" as typeof a.id] } })
      .pipe(Effect.flip)
    expect(missing._tag).toBe("NotFound")
  })
)

it.scoped("deleting removes both legs of an Exchange and never an Init", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness()
    const card = yield* h.client.wallets.create({ payload: { name: "Card", currency: usd, initMinor: minor(1_000) } })
    const cash = yield* h.client.wallets.create({ payload: { name: "Cash", currency: gel, initMinor: minor(0) } })
    const legs = yield* h.client.transactions.createExchange({
      payload: { sourceWalletId: card.id, sourceMinor: minor(100), targetWalletId: cash.id, targetMinor: minor(270), occurredOn: day("2026-09-05") }
    })
    yield* h.client.transactions.delete({ path: { id: legs[0]!.id } })
    const remaining = yield* h.client.transactions.list({ urlParams: period })
    expect(remaining.map((t) => t.type)).toEqual(["init", "init"])

    const init = remaining[0]!
    const refused = yield* h.client.transactions.bulkDelete({ payload: { ids: [init.id] } }).pipe(Effect.flip)
    expect(refused._tag).toBe("RuleViolation")

    const same = yield* h.client.transactions
      .createExchange({
        payload: { sourceWalletId: card.id, sourceMinor: minor(100), targetWalletId: card.id, targetMinor: minor(100), occurredOn: day("2026-09-05") }
      })
      .pipe(Effect.flip)
    expect(same._tag).toBe("RuleViolation")
  })
)
