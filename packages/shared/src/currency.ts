import { Either, Schema } from "effect"

/**
 * Currency rules. The valid list and each currency's minor-unit exponent come from the
 * runtime's built-in ISO 4217 data (Node 22 and every current browser), so there is no
 * dependency and no hand-maintained table. See docs/mvp-scope.md, "Stack".
 */

const supported: ReadonlySet<string> = new Set(Intl.supportedValuesOf("currency"))

export const isCurrency = (code: string): boolean => supported.has(code)

/** All valid ISO 4217 codes, sorted. */
export const allCurrencies: ReadonlyArray<string> = [...supported].sort()

const exponentCache = new Map<string, number>()

/** Number of decimal places of the currency's minor unit: USD 2, JPY 0, BHD 3. */
export const currencyExponent = (code: string): number => {
  const cached = exponentCache.get(code)
  if (cached !== undefined) return cached
  const digits =
    new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits ?? 2
  exponentCache.set(code, digits)
  return digits
}

/** ISO 4217 alphabetic code, checked against the runtime's currency list. */
export const CurrencyCode = Schema.String.pipe(
  Schema.pattern(/^[A-Z]{3}$/),
  Schema.filter(isCurrency, { message: () => "not an ISO 4217 currency" }),
  Schema.brand("CurrencyCode")
)
export type CurrencyCode = typeof CurrencyCode.Type

/**
 * Convert a decimal amount (e.g. -45.5) into minor units (-4550 for USD).
 * Fails when the amount has more decimals than the currency allows: -45.555 USD is rejected
 * rather than silently rounded.
 */
export const toMinor = (amount: number, currency: string): Either.Either<number, string> => {
  if (!Number.isFinite(amount)) return Either.left("amount must be a finite number")
  const factor = 10 ** currencyExponent(currency)
  const scaled = amount * factor
  const rounded = Math.round(scaled)
  // Tolerate binary floating error (0.1 * 100 = 10.000000000000002) but not real extra decimals.
  if (Math.abs(scaled - rounded) > 1e-6) {
    return Either.left(`${currency} allows at most ${currencyExponent(currency)} decimals`)
  }
  if (!Number.isSafeInteger(rounded)) return Either.left("amount is too large")
  return Either.right(rounded)
}

/** Minor units back to a decimal number, for display or for rate arithmetic. */
export const fromMinor = (minor: number, currency: string): number => minor / 10 ** currencyExponent(currency)

/**
 * Convert minor units between currencies using USD-pivoted rates (units of each currency per
 * 1 USD). Returns minor units of `to`, rounded half away from zero.
 */
export const convertMinor = (
  minor: number,
  from: string,
  to: string,
  ratePerUsdFrom: number,
  ratePerUsdTo: number
): number => {
  if (from === to) return minor
  const major = fromMinor(minor, from) / ratePerUsdFrom * ratePerUsdTo
  const scaled = major * 10 ** currencyExponent(to)
  return Math.sign(scaled) * Math.round(Math.abs(scaled))
}

/** Format minor units for display in the given locale, e.g. formatMinor(-183420, "USD") → "-$1,834.20". */
export const formatMinor = (minor: number, currency: string, locale = "en"): string =>
  new Intl.NumberFormat(locale, { style: "currency", currency }).format(fromMinor(minor, currency))
