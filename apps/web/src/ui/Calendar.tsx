import type { LocalDate } from "@june/shared"
import { CaretLeft, CaretRight } from "@phosphor-icons/react"
import { addDays, addMonths, formatMonthYear, monthEnd, monthStart, parseLocalDate, todayLocal, toLocalDate } from "../lib/period"
import { cn } from "./cn"
import { IconButton } from "./IconButton"

const weekdays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

/** Six Monday-first rows covering the month. */
const gridFor = (month: LocalDate): Array<LocalDate> => {
  const first = parseLocalDate(monthStart(month))
  const offset = (first.getDay() + 6) % 7
  const start = addDays(toLocalDate(first), -offset)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

/** How a day is drawn: plain, inside a picked range, or an end of it. A single picked day is an end. */
export type DayMark = "none" | "range" | "end"

export interface CalendarProps {
  /** Any day of the month on show. */
  month: LocalDate
  onMonthChange: (month: LocalDate) => void
  mark: (day: LocalDate) => DayMark
  onPick: (day: LocalDate) => void
}

/** June's own month view: ‹ September 2026 › over a seven-column grid of hard-edged day buttons. */
export function Calendar({ month, onMonthChange, mark, onPick }: CalendarProps) {
  const today = todayLocal()
  const start = monthStart(month)
  const end = monthEnd(month)
  return (
    <div>
      <div className="-mx-2.5 flex items-center justify-between">
        <IconButton icon={CaretLeft} label="Previous month" onClick={() => onMonthChange(addMonths(month, -1))} />
        <button
          type="button"
          onClick={() => onMonthChange(monthStart(today))}
          title="Back to this month"
          className="px-2 py-1 font-heading font-bold hover:bg-ink/5"
        >
          {formatMonthYear(month)}
        </button>
        <IconButton icon={CaretRight} label="Next month" onClick={() => onMonthChange(addMonths(month, 1))} />
      </div>
      <div className="mt-2 grid grid-cols-7 gap-y-1 text-center">
        {weekdays.map((w) => (
          <div key={w} className="py-1 font-heading text-xs font-bold uppercase tracking-wider text-grey-ink">
            {w}
          </div>
        ))}
        {gridFor(month).map((d) => {
          const outside = d < start || d > end
          const m = mark(d)
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPick(d)}
              aria-pressed={m !== "none"}
              aria-label={parseLocalDate(d).toDateString()}
              className={cn(
                "relative flex h-10 w-full items-center justify-center font-mono text-sm",
                m !== "none" && "bg-accent",
                m === "end" && "border-3 border-ink shadow-hard-sm font-bold",
                m === "none" && "hover:bg-ink/5",
                outside && m === "none" && "text-grey-ink"
              )}
            >
              {parseLocalDate(d).getDate()}
              {d === today ? <span aria-hidden className="absolute bottom-0.5 size-1.5 bg-ink" /> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
