import type { LocalDate } from "@june/shared"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { recurring } from "../../test/fixtures"
import { dueState, scheduleWords } from "./recurring"

const d = (s: string) => s as LocalDate

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 14, 12, 0, 0))
})
afterEach(() => vi.useRealTimers())

describe("scheduleWords", () => {
  it("describes a cron Schedule in words", () => {
    expect(scheduleWords(recurring({ cron: "0 0 1 * *" as never }))).toBe("Monthly on the 1st")
  })

  it("describes a once Schedule with its long date", () => {
    expect(scheduleWords(recurring({ cron: null, nextOn: d("2026-10-01") }))).toBe("Once on 1 Oct 2026")
  })

  it("says No schedule with neither", () => {
    expect(scheduleWords(recurring({ cron: null, nextOn: null }))).toBe("No schedule")
  })
})

describe("dueState", () => {
  const today = d("2026-09-14")

  it("is Next with no Overdue note before the due date", () => {
    expect(dueState(recurring({ nextOn: d("2026-10-05") }), today)).toEqual({ label: "Next 5 Oct", overdue: null })
  })

  it("is Due today on the due date itself", () => {
    expect(dueState(recurring({ nextOn: today }), today)).toEqual({ label: "Due 14 Sep", overdue: "today" })
  })

  it("counts days Overdue in the singular and the plural", () => {
    expect(dueState(recurring({ nextOn: d("2026-09-13") }), today)).toEqual({ label: "Due 13 Sep", overdue: "1 day ago" })
    expect(dueState(recurring({ nextOn: d("2026-09-11") }), today)).toEqual({ label: "Due 11 Sep", overdue: "3 days ago" })
  })

  it("adds the year to an Overdue date from another year", () => {
    expect(dueState(recurring({ nextOn: d("2025-12-28") }), today).label).toBe("Due 28 Dec 2025")
  })

  it("is empty for a Recurring with no Schedule", () => {
    expect(dueState(recurring({ nextOn: null }), today)).toEqual({ label: "", overdue: null })
  })

  it("defaults today to the local clock", () => {
    expect(dueState(recurring({ nextOn: d("2026-09-14") }))).toEqual({ label: "Due 14 Sep", overdue: "today" })
  })
})
