import type { LocalDate } from "@june/shared"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  addDays,
  addMonths,
  dayMonth,
  dayMonthYear,
  daysBetween,
  formatLongDate,
  formatMonthYear,
  fromEpochMillis,
  isWholeMonth,
  monthEnd,
  monthPeriod,
  monthStart,
  parseLocalDate,
  periodLabel,
  shiftPeriod,
  SHORT_MONTHS,
  toLocalDate,
  type Period
} from "./period"

const d = (s: string) => s as LocalDate
const period = (from: string, to: string): Period => ({ from: d(from), to: d(to) })

describe("LocalDate <-> Date", () => {
  it("toLocalDate zero-pads month and day in the local zone", () => {
    expect(toLocalDate(new Date(2026, 0, 5))).toBe("2026-01-05")
  })

  it("parseLocalDate gives local midnight of that day and round-trips", () => {
    const parsed = parseLocalDate("2026-02-09")
    expect([parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), parsed.getHours()]).toEqual([2026, 1, 9, 0])
    expect(toLocalDate(parsed)).toBe("2026-02-09")
  })
})

describe("fromEpochMillis", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("reads the day an instant falls on in the local zone, whatever that zone is", () => {
    expect(fromEpochMillis(new Date(2026, 8, 10, 23, 30).getTime())).toBe("2026-09-10")
    expect(fromEpochMillis(new Date(2026, 8, 11, 0, 30).getTime())).toBe("2026-09-11")
  })

  it("does not slip a day near midnight the way the UTC date would, east of Greenwich", () => {
    vi.stubEnv("TZ", "Asia/Tbilisi")
    // 23:30 on 10 Sep in Tbilisi (UTC+4) is 19:30 UTC the same day; 01:30 on 11 Sep is 21:30 UTC on the 10th.
    const lateEvening = Date.UTC(2026, 8, 10, 19, 30)
    const smallHours = Date.UTC(2026, 8, 10, 21, 30)
    expect(fromEpochMillis(lateEvening)).toBe("2026-09-10")
    expect(fromEpochMillis(smallHours)).toBe("2026-09-11")
    expect(new Date(smallHours).toISOString().slice(0, 10)).toBe("2026-09-10")
  })
})

describe("SHORT_MONTHS", () => {
  it("spells September as Sep, the way every date in June reads", () => {
    expect(SHORT_MONTHS).toHaveLength(12)
    expect(SHORT_MONTHS[8]).toBe("Sep")
  })
})

describe("addDays", () => {
  it("crosses month and year ends in both directions", () => {
    expect(addDays(d("2026-01-31"), 1)).toBe("2026-02-01")
    expect(addDays(d("2026-12-31"), 1)).toBe("2027-01-01")
    expect(addDays(d("2026-03-01"), -1)).toBe("2026-02-28")
    expect(addDays(d("2027-01-01"), -1)).toBe("2026-12-31")
  })
})

describe("addMonths", () => {
  // Pinned as-is: the result is always the first of the target month, whatever day went in.
  it("moves 31 Jan one month to the first of February, never overflowing into March", () => {
    expect(addMonths(d("2026-01-31"), 1)).toBe("2026-02-01")
  })

  it("lands on the first of the month even from mid-month, and crosses year ends", () => {
    expect(addMonths(d("2026-09-14"), 1)).toBe("2026-10-01")
    expect(addMonths(d("2026-12-14"), 1)).toBe("2027-01-01")
    expect(addMonths(d("2026-01-14"), -1)).toBe("2025-12-01")
  })
})

describe("month bounds", () => {
  it("monthStart is the first, monthEnd is the last day including leap Februaries", () => {
    expect(monthStart(d("2026-09-14"))).toBe("2026-09-01")
    expect(monthEnd(d("2024-02-10"))).toBe("2024-02-29")
    expect(monthEnd(d("2026-02-10"))).toBe("2026-02-28")
    expect(monthEnd(d("2026-12-05"))).toBe("2026-12-31")
  })

  it("monthPeriod spans the whole month of the given day", () => {
    expect(monthPeriod(d("2026-09-14"))).toEqual(period("2026-09-01", "2026-09-30"))
  })

  it("isWholeMonth is true only for exactly one full month", () => {
    expect(isWholeMonth(period("2026-09-01", "2026-09-30"))).toBe(true)
    expect(isWholeMonth(period("2026-09-01", "2026-09-29"))).toBe(false)
    expect(isWholeMonth(period("2026-09-02", "2026-09-30"))).toBe(false)
    expect(isWholeMonth(period("2026-09-01", "2026-10-31"))).toBe(false)
  })
})

describe("daysBetween", () => {
  it("counts both ends inclusively", () => {
    expect(daysBetween(d("2026-09-14"), d("2026-09-14"))).toBe(1)
    expect(daysBetween(d("2026-09-01"), d("2026-09-30"))).toBe(30)
    expect(daysBetween(d("2025-12-28"), d("2026-01-03"))).toBe(7)
  })
})

describe("shiftPeriod", () => {
  it("shifts a whole month to the neighbouring whole month, whatever its length", () => {
    expect(shiftPeriod(period("2026-01-01", "2026-01-31"), 1)).toEqual(period("2026-02-01", "2026-02-28"))
    expect(shiftPeriod(period("2026-01-01", "2026-01-31"), -1)).toEqual(period("2025-12-01", "2025-12-31"))
  })

  it("shifts an arbitrary range by its own day count so consecutive ranges touch", () => {
    expect(shiftPeriod(period("2026-09-05", "2026-09-11"), 1)).toEqual(period("2026-09-12", "2026-09-18"))
    expect(shiftPeriod(period("2026-09-05", "2026-09-11"), -1)).toEqual(period("2026-08-29", "2026-09-04"))
  })
})

describe("labels", () => {
  it("dayMonth and dayMonthYear use day-first three-letter months", () => {
    expect(dayMonth(new Date(2026, 8, 12))).toBe("12 Sep")
    expect(dayMonthYear(new Date(2026, 8, 12))).toBe("12 Sep 2026")
  })

  it("periodLabel names a whole month, a same-year range, and a range across years", () => {
    expect(periodLabel(period("2026-09-01", "2026-09-30"))).toBe("September 2026")
    expect(periodLabel(period("2026-09-05", "2026-09-18"))).toBe("5 Sep – 18 Sep 2026")
    expect(periodLabel(period("2025-12-28", "2026-01-03"))).toBe("28 Dec 2025 – 3 Jan 2026")
  })

  it("formatLongDate and formatMonthYear read a LocalDate directly", () => {
    expect(formatLongDate(d("2026-09-12"))).toBe("12 Sep 2026")
    expect(formatMonthYear(d("2026-02-14"))).toBe("February 2026")
  })
})
