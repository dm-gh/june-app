import { describeSchedule, type LocalDate, type Recurring } from "@june/shared"
import { shortDate } from "../../lib/format"
import { daysBetween, formatLongDate, todayLocal } from "../../lib/period"

/** The Schedule in words for a card or a page. */
export const scheduleWords = (r: Pick<Recurring, "cron" | "nextOn">): string => describeSchedule(r.cron, r.nextOn, formatLongDate)

export interface DueState {
  /** "Next 5 Oct" or "Due 10 Sep"; empty without a date. */
  readonly label: string
  /** "3 days ago" once the due date has passed; quiet, but there. */
  readonly overdue: string | null
}

export const dueState = (r: Pick<Recurring, "nextOn">, today: LocalDate = todayLocal()): DueState => {
  if (r.nextOn === null) return { label: "", overdue: null }
  if (r.nextOn > today) return { label: `Next ${shortDate(r.nextOn, today)}`, overdue: null }
  const days = daysBetween(r.nextOn, today) - 1
  return { label: `Due ${shortDate(r.nextOn, today)}`, overdue: days === 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago` }
}
