import { Either } from "effect"
import { describe, expect, it } from "vitest"
import { allCurrencies, convertMinor, currencyExponent, currencyName, formatMinor, fromMinor, isCurrency, toMajorFixed, toMinor } from "./currency.js"

describe("isCurrency", () => {
  it("knows real ISO 4217 codes and rejects made-up or lower-case ones", () => {
    expect(isCurrency("USD")).toBe(true)
    expect(isCurrency("XYZ")).toBe(false)
    expect(isCurrency("usd")).toBe(false)
  })

  it("lists every supported currency sorted", () => {
    expect(allCurrencies).toContain("USD")
    expect([...allCurrencies].sort()).toEqual(allCurrencies)
  })
})

describe("currencyExponent", () => {
  it("is 2 for USD, 0 for JPY and 3 for BHD", () => {
    expect(currencyExponent("USD")).toBe(2)
    expect(currencyExponent("JPY")).toBe(0)
    expect(currencyExponent("BHD")).toBe(3)
  })
})

describe("toMinor", () => {
  it("scales a decimal amount into minor units", () => {
    expect(toMinor(12.5, "USD")).toEqual(Either.right(1250))
    expect(toMinor(-45.5, "USD")).toEqual(Either.right(-4550))
    expect(toMinor(1500, "JPY")).toEqual(Either.right(1500))
    expect(toMinor(1.25, "BHD")).toEqual(Either.right(1250))
  })

  it("tolerates binary floating error such as 0.1 + 0.2", () => {
    expect(toMinor(0.1 + 0.2, "USD")).toEqual(Either.right(30))
  })

  it("rejects more decimals than the currency allows instead of rounding", () => {
    expect(toMinor(12.345, "USD")).toEqual(Either.left("USD allows at most 2 decimals"))
    expect(toMinor(100.5, "JPY")).toEqual(Either.left("JPY allows at most 0 decimals"))
  })

  it("rejects NaN and infinities", () => {
    expect(Either.isLeft(toMinor(Number.NaN, "USD"))).toBe(true)
    expect(Either.isLeft(toMinor(Number.POSITIVE_INFINITY, "USD"))).toBe(true)
  })

  it("rejects an amount beyond the safe integer range", () => {
    expect(toMinor(1e20, "USD")).toEqual(Either.left("amount is too large"))
  })

  // Pinned as-is: a well-formed but unknown code is not checked against isCurrency here,
  // so it silently gets 2 decimals; a malformed code throws instead of returning a Left.
  it("does not reject an unknown three-letter code, and throws on a malformed one", () => {
    expect(toMinor(1, "XYZ")).toEqual(Either.right(100))
    expect(() => toMinor(1, "invalid")).toThrow(RangeError)
  })
})

describe("fromMinor", () => {
  it("is the inverse of toMinor per currency", () => {
    expect(fromMinor(1250, "USD")).toBe(12.5)
    expect(fromMinor(1500, "JPY")).toBe(1500)
    expect(fromMinor(1250, "BHD")).toBe(1.25)
  })
})

describe("convertMinor", () => {
  it("returns the amount untouched when both currencies are the same", () => {
    expect(convertMinor(4250, "USD", "USD", 1, 1)).toBe(4250)
  })

  it("pivots through USD using units-per-USD rates", () => {
    expect(convertMinor(100, "USD", "JPY", 1, 150)).toBe(150)
    expect(convertMinor(100, "EUR", "USD", 0.5, 1)).toBe(200)
    expect(convertMinor(15000, "JPY", "USD", 150, 1)).toBe(10000)
  })

  it("rounds half away from zero in both directions", () => {
    expect(convertMinor(1, "USD", "JPY", 1, 150)).toBe(2)
    expect(convertMinor(-1, "USD", "JPY", 1, 150)).toBe(-2)
  })
})

describe("formatMinor", () => {
  it("formats minor units as a localised currency string", () => {
    expect(formatMinor(-183420, "USD")).toBe("-$1,834.20")
    expect(formatMinor(1500, "JPY")).toBe("¥1,500")
    expect(formatMinor(183420, "EUR", "de")).toBe("1.834,20\u00A0€")
  })
})

describe("toMajorFixed", () => {
  it("is the unsigned major-unit text a form shows, with the currency's decimals", () => {
    expect(toMajorFixed(1250, "USD")).toBe("12.50")
    expect(toMajorFixed(-4250, "USD")).toBe("42.50")
    expect(toMajorFixed(1500, "JPY")).toBe("1500")
    expect(toMajorFixed(-1250, "BHD")).toBe("1.250")
    expect(toMajorFixed(0, "USD")).toBe("0.00")
  })
})

describe("currencyName", () => {
  it("names a currency in English and falls back to the code", () => {
    expect(currencyName("USD")).toBe("US Dollar")
    expect(currencyName("EUR")).toBe("Euro")
    expect(currencyName("XYZ")).toBe("XYZ")
  })
})
