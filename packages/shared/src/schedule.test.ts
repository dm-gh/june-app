import { Either } from "effect"
import { describe, expect, it } from "vitest"
import type { LocalDate } from "./domain.js"
import { buildCron, describeSchedule, describeShape, nextAfter, nextOnOrAfter, ordinal, parseCron, readCron, type ScheduleShape } from "./schedule.js"

const d = (s: string) => s as LocalDate
const cron = (expression: string) => Either.getOrThrow(parseCron(expression))

describe("parseCron", () => {
  it("accepts a five-field expression", () => {
    expect(Either.isRight(parseCron("0 0 * * *"))).toBe(true)
  })

  it("rejects garbage with a message rather than throwing", () => {
    const result = parseCron("garbage")
    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) expect(typeof result.left).toBe("string")
  })
})

describe("Schedule due dates", () => {
  it("a monthly Schedule on the 31st skips months without that day", () => {
    const monthly31 = cron("0 0 31 * *")
    expect(nextOnOrAfter(monthly31, d("2026-02-01"))).toBe("2026-03-31")
    expect(nextAfter(monthly31, d("2026-03-31"))).toBe("2026-05-31")
  })

  it("a monthly Schedule on the 29th skips February in a non-leap year", () => {
    expect(nextOnOrAfter(cron("0 0 29 * *"), d("2026-02-01"))).toBe("2026-03-29")
  })

  it("nextOnOrAfter includes the date itself, nextAfter moves strictly past it", () => {
    const monthly1 = cron("0 0 1 * *")
    expect(nextOnOrAfter(monthly1, d("2026-10-01"))).toBe("2026-10-01")
    expect(nextAfter(monthly1, d("2026-10-01"))).toBe("2026-11-01")
  })

  it("a weekly Schedule on Monday and Friday walks the weekdays in order", () => {
    const weekly = cron("0 0 * * 1,5")
    expect(nextOnOrAfter(weekly, d("2026-09-14"))).toBe("2026-09-14") // a Monday
    expect(nextAfter(weekly, d("2026-09-14"))).toBe("2026-09-18")
    expect(nextAfter(weekly, d("2026-09-18"))).toBe("2026-09-21")
  })

  it("a yearly Schedule comes round once a year", () => {
    const yearly = cron("0 0 14 3 *")
    expect(nextOnOrAfter(yearly, d("2026-03-14"))).toBe("2026-03-14")
    expect(nextAfter(yearly, d("2026-03-14"))).toBe("2027-03-14")
  })

  it("a daily Schedule crosses the year end", () => {
    expect(nextAfter(cron("0 0 * * *"), d("2026-12-31"))).toBe("2027-01-01")
  })
})

describe("buildCron and readCron", () => {
  const shapes: ReadonlyArray<[ScheduleShape, string]> = [
    [{ kind: "daily" }, "0 0 * * *"],
    [{ kind: "weekly", weekdays: [1, 5] }, "0 0 * * 1,5"],
    [{ kind: "monthly", days: [5, 20] }, "0 0 5,20 * *"],
    [{ kind: "yearly", day: 14, month: 3 }, "0 0 14 3 *"]
  ]

  it.each(shapes)("builds the documented expression for %o and reads it back", (shape, expression) => {
    expect(buildCron(shape)).toEqual(Either.right(expression))
    expect(readCron(expression)).toEqual(shape)
  })

  it("sorts and dedupes the picked days", () => {
    expect(buildCron({ kind: "monthly", days: [20, 5, 5] })).toEqual(Either.right("0 0 5,20 * *"))
    expect(buildCron({ kind: "weekly", weekdays: [5, 1, 1] })).toEqual(Either.right("0 0 * * 1,5"))
  })

  it("refuses a weekly or monthly shape with nothing picked", () => {
    expect(buildCron({ kind: "weekly", weekdays: [] })).toEqual(Either.left("Pick at least one weekday"))
    expect(buildCron({ kind: "monthly", days: [] })).toEqual(Either.left("Pick at least one day"))
  })

  it("readCron returns null for an expression the generator would not produce", () => {
    expect(readCron("garbage")).toBeNull()
    expect(readCron("*/5 * * * *")).toBeNull()
    expect(readCron("0 0 5,20 3 *")).toBeNull()
    expect(readCron("0 0 14 3 1")).toBeNull()
  })
})

describe("Schedule in words", () => {
  it("ordinal handles the teens and the 21st", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "31st"])
  })

  it("describeShape spells each shape as the form shows it", () => {
    expect(describeShape({ kind: "daily" })).toBe("Daily")
    expect(describeShape({ kind: "weekly", weekdays: [5, 1] })).toBe("Weekly on Monday and Friday")
    expect(describeShape({ kind: "weekly", weekdays: [1, 3, 5] })).toBe("Weekly on Monday, Wednesday and Friday")
    expect(describeShape({ kind: "monthly", days: [20, 5] })).toBe("Monthly on the 5th and 20th")
    expect(describeShape({ kind: "monthly", days: [1] })).toBe("Monthly on the 1st")
    expect(describeShape({ kind: "yearly", day: 14, month: 3 })).toBe("Yearly on 14 March")
  })

  it("describeSchedule says No schedule, Once on a formatted date, or the shape", () => {
    const format = (x: LocalDate) => `<${x}>`
    expect(describeSchedule(null, null, format)).toBe("No schedule")
    expect(describeSchedule(null, d("2026-10-01"), format)).toBe("Once on <2026-10-01>")
    expect(describeSchedule("0 0 1 * *", d("2026-10-01"), format)).toBe("Monthly on the 1st")
  })

  it("describeSchedule falls back to the raw expression it cannot read", () => {
    expect(describeSchedule("*/5 * * * *", null, (x) => x)).toBe("*/5 * * * *")
  })
})
