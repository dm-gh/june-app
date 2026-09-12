import type { LocalDate, Transaction } from "@june/shared"
import { addDays, addMonths, daysBetween, isWholeMonth, monthEnd, monthStart, parseLocalDate, type Period } from "../../lib/period"

/** Pure arithmetic behind Analysis. Every figure is in Default Currency minor units, Hidden rows never count. */

export const counted = (rows: ReadonlyArray<Transaction>): Array<Transaction> => rows.filter((t) => t.type === "change" && !t.hiddenFromAnalysis)

const value = (t: Transaction): number => t.defaultMinor ?? 0

/** Days while the period is a month or shorter, months beyond that. */
export type Granularity = "day" | "month"

export const granularityFor = (p: Period): Granularity => (isWholeMonth(p) || daysBetween(p.from, p.to) <= 31 ? "day" : "month")

export interface Bucket {
  readonly key: LocalDate
  /** Axis label: the day of month, or a three-letter month. */
  readonly label: string
  readonly from: LocalDate
  readonly to: LocalDate
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export const bucketsFor = (p: Period): Array<Bucket> => {
  const out: Array<Bucket> = []
  if (granularityFor(p) === "day") {
    for (let d = p.from; d <= p.to; d = addDays(d, 1)) out.push({ key: d, label: String(parseLocalDate(d).getDate()), from: d, to: d })
    return out
  }
  for (let m = monthStart(p.from); m <= p.to; m = addMonths(m, 1)) {
    const date = parseLocalDate(m)
    const label = date.getMonth() === 0 || out.length === 0 ? `${SHORT_MONTHS[date.getMonth()]} ${String(date.getFullYear()).slice(2)}` : SHORT_MONTHS[date.getMonth()]!
    out.push({ key: m, label, from: m < p.from ? p.from : m, to: monthEnd(m) > p.to ? p.to : monthEnd(m) })
  }
  return out
}

const indexOf = (buckets: ReadonlyArray<Bucket>, granularity: Granularity, date: LocalDate): number =>
  granularity === "day" ? daysBetween(buckets[0]!.key, date) - 1 : buckets.findIndex((b) => b.key === monthStart(date))

export interface SpendPoint {
  readonly key: LocalDate
  readonly label: string
  readonly spent: number
  readonly total: number
  readonly when: "past" | "today" | "future"
}

/** Spent per bucket and the running total. */
export const spendSeries = (rows: ReadonlyArray<Transaction>, p: Period, today: LocalDate): Array<SpendPoint> => {
  const granularity = granularityFor(p)
  const buckets = bucketsFor(p)
  const sums = new Array<number>(buckets.length).fill(0)
  for (const t of counted(rows)) {
    if (t.amountMinor >= 0) continue
    const i = indexOf(buckets, granularity, t.occurredOn)
    if (i >= 0 && i < sums.length) sums[i]! += Math.abs(value(t))
  }
  let total = 0
  return buckets.map((b, i) => {
    total += sums[i]!
    const when = today >= b.from && today <= b.to ? "today" : b.from > today ? "future" : "past"
    return { key: b.key, label: b.label, spent: sums[i]!, total, when }
  })
}

export interface FlowPoint {
  readonly key: LocalDate
  readonly label: string
  readonly income: number
  /** Negative, so the column hangs below the zero line. */
  readonly expense: number
}

/** Income up and expense down per bucket. */
export const flowSeries = (rows: ReadonlyArray<Transaction>, p: Period): Array<FlowPoint> => {
  const granularity = granularityFor(p)
  const buckets = bucketsFor(p)
  const income = new Array<number>(buckets.length).fill(0)
  const expense = new Array<number>(buckets.length).fill(0)
  for (const t of counted(rows)) {
    const i = indexOf(buckets, granularity, t.occurredOn)
    if (i < 0 || i >= buckets.length) continue
    if (t.amountMinor > 0) income[i]! += value(t)
    else expense[i]! -= Math.abs(value(t))
  }
  return buckets.map((b, i) => ({ key: b.key, label: b.label, income: income[i]!, expense: expense[i]! }))
}

/** How many buckets have started, for the average in the Per day heading. */
export const elapsedBuckets = (p: Period, today: LocalDate): number => {
  const buckets = bucketsFor(p)
  const started = buckets.filter((b) => b.from <= today).length
  return Math.max(1, started)
}

export interface Slice {
  readonly key: string
  readonly sum: number
}

/** Which side of the ledger the breakdowns show: spending unless Expense is deselected and Income is not. */
export type Side = "expense" | "income"

export const sideOf = (excludedTypes: ReadonlyArray<string>): Side =>
  excludedTypes.includes("expense") && !excludedTypes.includes("income") ? "income" : "expense"

/** Totals per key on one side, largest first. `keysOf` may return several keys (a row with two Tags counts in both) or none. */
export const breakdown = (rows: ReadonlyArray<Transaction>, keysOf: (t: Transaction) => ReadonlyArray<string>, side: Side = "expense"): Array<Slice> => {
  const sums = new Map<string, number>()
  for (const t of counted(rows)) {
    if (side === "expense" ? t.amountMinor >= 0 : t.amountMinor <= 0) continue
    for (const key of keysOf(t)) sums.set(key, (sums.get(key) ?? 0) + Math.abs(value(t)))
  }
  return [...sums.entries()].map(([key, sum]) => ({ key, sum })).sort((a, b) => b.sum - a.sum)
}

export const spentMinor = (rows: ReadonlyArray<Transaction>): number =>
  counted(rows).reduce((sum, t) => (t.amountMinor < 0 ? sum + value(t) : sum), 0)

export const incomeMinor = (rows: ReadonlyArray<Transaction>): number =>
  counted(rows).reduce((sum, t) => (t.amountMinor > 0 ? sum + value(t) : sum), 0)
