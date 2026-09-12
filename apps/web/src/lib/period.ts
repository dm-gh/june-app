import type { LocalDate } from "@june/shared"
import { createContext, useContext } from "react"

/** The one selected period shared by Transactions and Analysis. Bounds are inclusive. */
export interface Period {
  readonly from: LocalDate
  readonly to: LocalDate
}

const pad = (n: number) => String(n).padStart(2, "0")

export const toLocalDate = (d: Date): LocalDate => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` as LocalDate

/** Today in the browser's zone. */
export const todayLocal = (): LocalDate => toLocalDate(new Date())

export const parseLocalDate = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y!, m! - 1, d!)
}

export const addDays = (s: LocalDate, days: number): LocalDate => {
  const d = parseLocalDate(s)
  d.setDate(d.getDate() + days)
  return toLocalDate(d)
}

export const addMonths = (s: LocalDate, months: number): LocalDate => {
  const d = parseLocalDate(s)
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  return toLocalDate(d)
}

export const monthStart = (s: LocalDate): LocalDate => (s.slice(0, 8) + "01") as LocalDate

export const monthEnd = (s: LocalDate): LocalDate => {
  const d = parseLocalDate(s)
  return toLocalDate(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

export const monthPeriod = (s: LocalDate): Period => ({ from: monthStart(s), to: monthEnd(s) })

export const isWholeMonth = (p: Period): boolean => p.from === monthStart(p.from) && p.to === monthEnd(p.from)

export const daysBetween = (from: LocalDate, to: LocalDate): number =>
  Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86_400_000) + 1

/** Step by the period's own length: a whole month moves a month, any other range moves by its day count. */
export const shiftPeriod = (p: Period, direction: -1 | 1): Period => {
  if (isWholeMonth(p)) return monthPeriod(addMonths(p.from, direction))
  const days = daysBetween(p.from, p.to) * direction
  return { from: addDays(p.from, days), to: addDays(p.to, days) }
}

const monthYear = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" })
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "12 Sep": day first, three-letter month (Intl's en-GB says "Sept", so it is spelled here). */
export const dayMonth = (d: Date): string => `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`
/** "12 Sep 2026" */
export const dayMonthYear = (d: Date): string => `${dayMonth(d)} ${d.getFullYear()}`

/** "September 2026" for a whole month, otherwise "5 Sep – 18 Sep 2026". */
export const periodLabel = (p: Period): string => {
  if (isWholeMonth(p)) return monthYear.format(parseLocalDate(p.from))
  const from = parseLocalDate(p.from)
  const to = parseLocalDate(p.to)
  const left = from.getFullYear() === to.getFullYear() ? dayMonth(from) : dayMonthYear(from)
  return `${left} – ${dayMonthYear(to)}`
}

export const formatLongDate = (s: LocalDate): string => dayMonthYear(parseLocalDate(s))

export const formatMonthYear = (s: LocalDate): string => monthYear.format(parseLocalDate(s))

export interface PeriodState {
  readonly period: Period
  readonly setPeriod: (p: Period) => void
}

export const PeriodContext = createContext<PeriodState | null>(null)

export const usePeriod = (): PeriodState => {
  const value = useContext(PeriodContext)
  if (value === null) throw new Error("usePeriod outside PeriodProvider")
  return value
}
