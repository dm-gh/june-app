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

/** Day-group heading: "TODAY · 12 SEP", "YESTERDAY · 11 SEP", "10 SEP", "28 DEC 2025". */
export const dayHeading = (date: LocalDate): string => {
  const today = todayLocal()
  const d = parseLocalDate(date)
  const short = (d.getFullYear() === parseLocalDate(today).getFullYear() ? dayMonth(d) : dayMonthYear(d)).toUpperCase()
  if (date === today) return `TODAY · ${short}`
  if (date === addDays(today, -1)) return `YESTERDAY · ${short}`
  return short
}

/** Category colour: the User picks only the hue. */
export const hueColor = (hue: number): string => `hsl(${hue} 100% 70%)`
