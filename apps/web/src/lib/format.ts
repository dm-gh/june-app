import { fromMinor, type LocalDate } from "@june/shared"
import { addDays, dayMonth, dayMonthYear, parseLocalDate, todayLocal } from "./period"

const codeFormatters = new Map<string, Intl.NumberFormat>()

/** "USD 1,834.20": the code, a space, the number. Never a symbol, so every currency reads the same. */
export const moneyCode = (minor: number, currency: string): string => {
  let f = codeFormatters.get(currency)
  if (f === undefined) {
    f = new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "code" })
    codeFormatters.set(currency, f)
  }
  return f.format(Math.abs(fromMinor(minor, currency))).replace(/ /g, " ")
}

/** "−USD 1,834.20" / "+USD 2,400.00". A real minus sign, as in the mocks. */
export const signedMoney = (minor: number, currency: string): string =>
  `${minor < 0 ? "−" : minor > 0 ? "+" : ""}${moneyCode(minor, currency)}`

/** "−USD 12.00" when below zero, "USD 12.00" otherwise: a Balance, which is not a flow. */
export const balanceMoney = (minor: number, currency: string): string => `${minor < 0 ? "−" : ""}${moneyCode(minor, currency)}`

/** "12 Sep" within today's year, "28 Dec 2025" beyond it: the year only when it is not obvious. */
export const shortDate = (date: LocalDate, today: LocalDate = todayLocal()): string => {
  const d = parseLocalDate(date)
  return d.getFullYear() === parseLocalDate(today).getFullYear() ? dayMonth(d) : dayMonthYear(d)
}

/** The Today/Yesterday rule, stated once: "Today · <date>", "Yesterday · <date>", otherwise the date as `render` writes it. */
export const describeDay = (date: LocalDate, render: (d: LocalDate) => string, today: LocalDate = todayLocal()): string => {
  if (date === today) return `Today · ${render(date)}`
  if (date === addDays(today, -1)) return `Yesterday · ${render(date)}`
  return render(date)
}

/** Day-group heading: "TODAY · 12 SEP", "YESTERDAY · 11 SEP", "10 SEP", "28 DEC 2025". */
export const dayHeading = (date: LocalDate): string => {
  const today = todayLocal()
  return describeDay(date, (d) => shortDate(d, today), today).toUpperCase()
}

/** "row" or "rows", "is" or "are": the word that goes with a count. */
export const plural = (n: number, one: string, many: string = `${one}s`): string => (n === 1 ? one : many)

/** Category colour: the User picks only the hue. */
export const hueColor = (hue: number): string => `hsl(${hue} 100% 70%)`

/** A Category as it reads everywhere: "🥕 Groceries", or just the name when it has no emoji. */
export const categoryLabel = (category: { readonly name: string; readonly emoji: string | null }): string =>
  `${category.emoji ? `${category.emoji} ` : ""}${category.name}`
