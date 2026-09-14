import { Either, Schema } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CurrencyCode } from "./currency.js"
import { Hue, LocalDate, MinorAmount, Slug, Tag, slugify, splitTags, todayUtc } from "./domain.js"

const decodes = <A, I>(schema: Schema.Schema<A, I>, input: I): boolean => Either.isRight(Schema.decodeUnknownEither(schema)(input))
const decode = <A, I>(schema: Schema.Schema<A, I>, input: I): A => Schema.decodeUnknownSync(schema)(input)

describe("splitTags", () => {
  it("splits on any whitespace, lower-cases, and drops blanks", () => {
    expect(splitTags("  Food\tWeekly\n vacation-2026 ")).toEqual(["food", "weekly", "vacation-2026"])
  })

  it("dedupes case-insensitively, keeping first occurrence order", () => {
    expect(splitTags("Food weekly FOOD")).toEqual(["food", "weekly"])
  })

  it("gives no Tags for an empty or blank input", () => {
    expect(splitTags("")).toEqual([])
    expect(splitTags("   ")).toEqual([])
  })
})

describe("slugify", () => {
  it("lower-cases, dashes, and transliterates", () => {
    expect(slugify("Groceries & Snacks")).toBe("groceries-and-snacks")
    expect(slugify("Продукты")).toBe("produkty")
    expect(slugify("  Café au lait!  ")).toBe("cafe-au-lait")
  })
})

describe("todayUtc", () => {
  afterEach(() => vi.useRealTimers())

  it("is the UTC calendar date as YYYY-MM-DD, even late in the day", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-01T23:30:00Z"))
    expect(todayUtc()).toBe("2026-03-01")
  })
})

describe("LocalDate schema", () => {
  it("accepts a real YYYY-MM-DD date", () => {
    expect(decodes(LocalDate, "2026-09-14")).toBe(true)
    expect(decodes(LocalDate, "2024-02-29")).toBe(true)
  })

  it("rejects a loosely formatted date and an impossible month", () => {
    expect(decodes(LocalDate, "2026-9-4")).toBe(false)
    expect(decodes(LocalDate, "2026-13-01")).toBe(false)
  })

  // Pinned as-is: V8's Date.parse rolls 29 Feb 2026 (not a leap year) over to 1 March, so it passes.
  it("accepts 2026-02-29 although 2026 is not a leap year", () => {
    expect(decodes(LocalDate, "2026-02-29")).toBe(true)
  })
})

describe("Tag schema", () => {
  it("lower-cases and trims a single word", () => {
    expect(decode(Tag, " Food ")).toBe("food")
  })

  it("rejects whitespace inside and an empty Tag", () => {
    expect(decodes(Tag, "two words")).toBe(false)
    expect(decodes(Tag, "")).toBe(false)
    expect(decodes(Tag, "   ")).toBe(false)
  })
})

describe("MinorAmount schema", () => {
  it("accepts integers of either sign and rejects fractions", () => {
    expect(decodes(MinorAmount, -4250)).toBe(true)
    expect(decodes(MinorAmount, 0)).toBe(true)
    expect(decodes(MinorAmount, 1.5)).toBe(false)
  })
})

describe("CurrencyCode schema", () => {
  it("accepts USD and rejects XYZ or a lower-case code", () => {
    expect(decodes(CurrencyCode, "USD")).toBe(true)
    expect(decodes(CurrencyCode, "XYZ")).toBe(false)
    expect(decodes(CurrencyCode, "usd")).toBe(false)
  })
})

describe("Hue and Slug schemas", () => {
  it("Hue is an integer from 0 to 359", () => {
    expect(decodes(Hue, 0)).toBe(true)
    expect(decodes(Hue, 359)).toBe(true)
    expect(decodes(Hue, 360)).toBe(false)
    expect(decodes(Hue, 12.5)).toBe(false)
  })

  it("Slug is lower-case words joined by single dashes", () => {
    expect(decodes(Slug, "groceries-2")).toBe(true)
    expect(decodes(Slug, "Groceries")).toBe(false)
    expect(decodes(Slug, "a--b")).toBe(false)
  })
})
