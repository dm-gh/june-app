import type { LocalDate } from "@june/shared"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { balanceMoney, categoryLabel, dayHeading, describeDay, hueColor, moneyCode, plural, shortDate, signedMoney } from "./format"

const MINUS = "−"

describe("moneyCode", () => {
  it("writes the code, a plain space, then the grouped number", () => {
    expect(moneyCode(183420, "USD")).toBe("USD 1,834.20")
    expect(moneyCode(183420, "USD")).not.toContain(" ")
  })

  it("uses no decimals for JPY", () => {
    expect(moneyCode(1500, "JPY")).toBe("JPY 1,500")
  })

  it("drops the sign of a negative amount and shows zero with decimals", () => {
    expect(moneyCode(-4250, "USD")).toBe("USD 42.50")
    expect(moneyCode(0, "USD")).toBe("USD 0.00")
  })
})

describe("signedMoney", () => {
  it("prefixes a real minus sign for an expense and a plus for income", () => {
    expect(signedMoney(-183420, "USD")).toBe(`${MINUS}USD 1,834.20`)
    expect(signedMoney(240000, "USD")).toBe("+USD 2,400.00")
  })

  it("leaves zero unsigned", () => {
    expect(signedMoney(0, "JPY")).toBe("JPY 0")
  })
})

describe("balanceMoney", () => {
  it("marks only a negative Balance, with the same real minus sign", () => {
    expect(balanceMoney(-1200, "USD")).toBe(`${MINUS}USD 12.00`)
    expect(balanceMoney(1200, "USD")).toBe("USD 12.00")
    expect(balanceMoney(0, "USD")).toBe("USD 0.00")
  })
})

describe("dayHeading", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 12, 12, 0, 0))
  })
  afterEach(() => vi.useRealTimers())

  const heading = (s: string) => dayHeading(s as LocalDate)

  it("names today and yesterday", () => {
    expect(heading("2026-09-12")).toBe("TODAY · 12 SEP")
    expect(heading("2026-09-11")).toBe("YESTERDAY · 11 SEP")
  })

  it("shows other days of this year without the year, upper-cased", () => {
    expect(heading("2026-09-10")).toBe("10 SEP")
    expect(heading("2026-09-13")).toBe("13 SEP")
  })

  it("adds the year for a day in another year", () => {
    expect(heading("2025-12-28")).toBe("28 DEC 2025")
  })
})

describe("shortDate", () => {
  const today = "2026-09-14" as LocalDate

  it("omits the year within today's year and adds it beyond, either way", () => {
    expect(shortDate("2026-10-05" as LocalDate, today)).toBe("5 Oct")
    expect(shortDate("2027-03-14" as LocalDate, today)).toBe("14 Mar 2027")
    expect(shortDate("2025-12-28" as LocalDate, today)).toBe("28 Dec 2025")
  })

  it("reads today from the local clock when none is given", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2027, 0, 2, 12, 0, 0))
    expect(shortDate("2027-03-14" as LocalDate)).toBe("14 Mar")
    vi.useRealTimers()
  })
})

describe("describeDay", () => {
  const today = "2026-09-14" as LocalDate
  const long = (d: LocalDate) => `long(${d})`

  it("says Today and Yesterday with a middle dot before the rendered date", () => {
    expect(describeDay("2026-09-14" as LocalDate, long, today)).toBe("Today · long(2026-09-14)")
    expect(describeDay("2026-09-13" as LocalDate, long, today)).toBe("Yesterday · long(2026-09-13)")
  })

  it("leaves any other day, tomorrow included, as the rendered date alone", () => {
    expect(describeDay("2026-09-12" as LocalDate, long, today)).toBe("long(2026-09-12)")
    expect(describeDay("2026-09-15" as LocalDate, long, today)).toBe("long(2026-09-15)")
  })

  it("is what the date control shows: Today · 14 Sep 2026", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 14, 12, 0, 0))
    expect(describeDay("2026-09-14" as LocalDate, (d) => d)).toBe("Today · 2026-09-14")
    vi.useRealTimers()
  })
})

describe("plural", () => {
  it("adds an s for anything but exactly one", () => {
    expect(plural(1, "row")).toBe("row")
    expect(plural(0, "row")).toBe("rows")
    expect(plural(2, "row")).toBe("rows")
  })

  it("takes an irregular plural", () => {
    expect(plural(1, "is", "are")).toBe("is")
    expect(plural(3, "has", "have")).toBe("have")
  })
})

describe("hueColor", () => {
  it("fixes saturation and lightness so only the Hue varies", () => {
    expect(hueColor(120)).toBe("hsl(120 100% 70%)")
    expect(hueColor(0)).toBe("hsl(0 100% 70%)")
  })
})

describe("categoryLabel", () => {
  it("puts the emoji before the name and leaves a Category without one as its name", () => {
    expect(categoryLabel({ name: "Groceries", emoji: "🥕" })).toBe("🥕 Groceries")
    expect(categoryLabel({ name: "Salary", emoji: null })).toBe("Salary")
  })
})
