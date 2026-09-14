import type { LocalDate, Transaction } from "@june/shared"
import { describe, expect, it } from "vitest"
import type { Period } from "../../lib/period"
import { categories, transaction, wallets } from "../../test/fixtures"
import {
  breakdown,
  breakdownBoth,
  bucketsFor,
  counted,
  elapsedBuckets,
  flowSeries,
  granularityFor,
  incomeMinor,
  spendSeries,
  spentMinor,
  withEveryWallet
} from "./analysis"

const d = (s: string) => s as LocalDate
const period = (from: string, to: string): Period => ({ from: d(from), to: d(to) })
const tx = (over: Record<string, unknown> = {}): Transaction => transaction(over as unknown as Partial<Transaction>)

const september = period("2026-09-01", "2026-09-30")
const year2026 = period("2026-01-01", "2026-12-31")

describe("granularityFor", () => {
  it("uses days for a whole month or anything up to 31 days, months beyond that", () => {
    expect(granularityFor(september)).toBe("day")
    expect(granularityFor(period("2026-08-15", "2026-09-14"))).toBe("day")
    expect(granularityFor(period("2026-08-14", "2026-09-14"))).toBe("month")
    expect(granularityFor(year2026)).toBe("month")
  })
})

describe("bucketsFor", () => {
  it("gives one bucket per day of a month, labelled by day number", () => {
    const buckets = bucketsFor(september)
    expect(buckets).toHaveLength(30)
    expect(buckets[0]).toEqual({ key: "2026-09-01", label: "1", from: "2026-09-01", to: "2026-09-01" })
    expect(buckets[29]!.label).toBe("30")
  })

  it("gives one bucket per month of a year, naming the year only on the first and on January", () => {
    const buckets = bucketsFor(year2026)
    expect(buckets.map((b) => b.label)).toEqual(["Jan 26", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])
    expect(buckets[0]).toEqual({ key: "2026-01-01", label: "Jan 26", from: "2026-01-01", to: "2026-01-31" })
    expect(buckets[11]!.to).toBe("2026-12-31")
  })

  it("clips the first and last month buckets of an arbitrary range to the period", () => {
    expect(bucketsFor(period("2026-02-15", "2026-04-10"))).toEqual([
      { key: "2026-02-01", label: "Feb 26", from: "2026-02-15", to: "2026-02-28" },
      { key: "2026-03-01", label: "Mar", from: "2026-03-01", to: "2026-03-31" },
      { key: "2026-04-01", label: "Apr", from: "2026-04-01", to: "2026-04-10" }
    ])
  })

  it("marks the year again when a range crosses into January", () => {
    expect(bucketsFor(period("2025-11-01", "2026-02-28")).map((b) => b.label)).toEqual(["Nov 25", "Dec", "Jan 26", "Feb"])
  })
})

describe("counted", () => {
  it("keeps visible Changes and drops Exchange legs, Inits and Hidden rows", () => {
    const change = tx()
    const hidden = tx({ hiddenFromAnalysis: true })
    const init = tx({ type: "init", amountMinor: 100000 })
    const exchange = tx({ type: "exchange", exchangeId: "e" })
    expect(counted([change, hidden, init, exchange])).toEqual([change])
  })
})

describe("spentMinor and incomeMinor", () => {
  const rows = [
    tx({ amountMinor: -4250, defaultMinor: -4250 }),
    tx({ amountMinor: 100000, defaultMinor: 100000 }),
    tx({ amountMinor: -1000, defaultMinor: null }),
    tx({ amountMinor: -500, defaultMinor: -500, hiddenFromAnalysis: true }),
    tx({ type: "init", amountMinor: 50000, defaultMinor: 50000 })
  ]

  it("sum each side in Default Currency, counting a row with no rate as nothing", () => {
    expect(spentMinor(rows)).toBe(-4250)
    expect(incomeMinor(rows)).toBe(100000)
  })
})

describe("breakdown", () => {
  const byCategory = (t: Transaction) => [t.categoryId ?? "uncategorised"]
  const rows = [
    tx({ amountMinor: -4250, defaultMinor: -4250 }),
    tx({ amountMinor: -1000, defaultMinor: -1000 }),
    tx({ amountMinor: 100000, defaultMinor: 100000, categoryId: categories.salary.id }),
    tx({ amountMinor: -50000, defaultMinor: -50000, categoryId: null })
  ]

  it("totals expense per key as positive sums, largest first, with the shared native currency", () => {
    expect(breakdown(rows, byCategory)).toEqual([
      { key: "uncategorised", sum: 50000, native: { minor: 50000, currency: "USD" } },
      { key: categories.groceries.id, sum: 5250, native: { minor: 5250, currency: "USD" } }
    ])
  })

  it("reads the income side when asked", () => {
    expect(breakdown(rows, byCategory, "income")).toEqual([{ key: categories.salary.id, sum: 100000, native: { minor: 100000, currency: "USD" } }])
  })

  it("counts a row under every key it yields and skips rows yielding none", () => {
    const tagged = tx({ amountMinor: -4250, defaultMinor: -4250, tags: ["food", "weekly"] })
    const untagged = tx({ amountMinor: -9999, defaultMinor: -9999, tags: [] })
    expect(breakdown([tagged, untagged], (t) => t.tags)).toEqual([
      { key: "food", sum: 4250, native: { minor: 4250, currency: "USD" } },
      { key: "weekly", sum: 4250, native: { minor: 4250, currency: "USD" } }
    ])
  })

  it("collapses native to null when a key mixes currencies, still summing in Default Currency", () => {
    const usd = tx({ amountMinor: -4250, defaultMinor: -4250 })
    const eur = tx({ amountMinor: -1000, defaultMinor: -1100, currency: "EUR", walletId: wallets.cash.id })
    expect(breakdown([usd, eur], byCategory)).toEqual([{ key: categories.groceries.id, sum: 5350, native: null }])
  })
})

describe("breakdownBoth", () => {
  const byWallet = (t: Transaction) => [t.walletId ?? "unassigned"]
  const rows = [
    tx({ amountMinor: -4250, defaultMinor: -4250 }),
    tx({ amountMinor: 100000, defaultMinor: 100000 }),
    tx({ amountMinor: -1000, defaultMinor: -1100, currency: "EUR", walletId: wallets.cash.id })
  ]

  it("pairs both sides per key, largest movement first, with an empty side as zero", () => {
    expect(breakdownBoth(rows, byWallet)).toEqual([
      {
        key: wallets.card.id,
        expense: { sum: 4250, native: { minor: 4250, currency: "USD" } },
        income: { sum: 100000, native: { minor: 100000, currency: "USD" } }
      },
      { key: wallets.cash.id, expense: { sum: 1100, native: { minor: 1000, currency: "EUR" } }, income: { sum: 0, native: null } }
    ])
  })

  it("withEveryWallet appends a zero row for each Wallet without movement, after the rest", () => {
    const slices = breakdownBoth(rows.slice(0, 2), byWallet)
    const all = withEveryWallet(slices, [wallets.card.id, wallets.cash.id])
    expect(all.map((s) => s.key)).toEqual([wallets.card.id, wallets.cash.id])
    expect(all[1]).toEqual({ key: wallets.cash.id, expense: { sum: 0, native: null }, income: { sum: 0, native: null } })
    expect(withEveryWallet(all, [wallets.card.id, wallets.cash.id])).toHaveLength(2)
  })
})

describe("spendSeries", () => {
  const rows = [
    tx({ amountMinor: -4250, defaultMinor: -4250, occurredOn: "2026-09-03" }),
    tx({ amountMinor: -1000, defaultMinor: -1000, occurredOn: "2026-09-10" }),
    tx({ amountMinor: -300, defaultMinor: null, occurredOn: "2026-09-10" }),
    tx({ amountMinor: 100000, defaultMinor: 100000, occurredOn: "2026-09-05" }),
    tx({ amountMinor: -500, defaultMinor: -500, occurredOn: "2026-09-20", hiddenFromAnalysis: true }),
    tx({ amountMinor: -700, defaultMinor: -700, occurredOn: "2026-08-31" }),
    tx({ amountMinor: -700, defaultMinor: -700, occurredOn: "2026-10-01" })
  ]

  it("puts spending in its day bucket with a running total, ignoring income, Hidden and out-of-period rows", () => {
    const points = spendSeries(rows, september, d("2026-09-10"))
    expect(points).toHaveLength(30)
    expect(points[2]).toEqual({ key: "2026-09-03", label: "3", spent: 4250, total: 4250, when: "past" })
    expect(points[4]!.spent).toBe(0)
    expect(points[9]).toEqual({ key: "2026-09-10", label: "10", spent: 1000, total: 5250, when: "today" })
    expect(points[29]).toEqual({ key: "2026-09-30", label: "30", spent: 0, total: 5250, when: "future" })
  })

  it("marks the month holding today when the period is a year", () => {
    const rows = [tx({ amountMinor: -4250, defaultMinor: -4250, occurredOn: "2026-03-15" }), tx({ amountMinor: -1000, defaultMinor: -1000, occurredOn: "2026-09-01" })]
    const points = spendSeries(rows, year2026, d("2026-09-14"))
    expect(points.map((p) => p.when)).toEqual(["past", "past", "past", "past", "past", "past", "past", "past", "today", "future", "future", "future"])
    expect(points[2]!.spent).toBe(4250)
    expect(points[8]).toMatchObject({ spent: 1000, total: 5250 })
  })

  it("flowSeries hangs expense below zero and lifts income above it in the same buckets", () => {
    const points = flowSeries(rows, september)
    expect(points[2]).toMatchObject({ key: "2026-09-03", income: 0, expense: -4250 })
    expect(points[4]).toMatchObject({ key: "2026-09-05", income: 100000, expense: 0 })
  })
})

describe("elapsedBuckets", () => {
  it("counts the buckets that have started, at least one", () => {
    expect(elapsedBuckets(september, d("2026-09-10"))).toBe(10)
    expect(elapsedBuckets(september, d("2026-08-20"))).toBe(1)
    expect(elapsedBuckets(september, d("2026-10-05"))).toBe(30)
    expect(elapsedBuckets(year2026, d("2026-09-14"))).toBe(9)
  })
})
