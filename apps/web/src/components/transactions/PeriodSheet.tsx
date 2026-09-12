import type { LocalDate } from "@june/shared"
import { CaretLeft, CaretRight } from "@phosphor-icons/react"
import { useEffect, useState } from "react"
import {
  addDays,
  addMonths,
  formatMonthYear,
  monthEnd,
  monthStart,
  parseLocalDate,
  type Period,
  toLocalDate,
  usePeriod
} from "../../lib/period"
import { Button, cn, Field, IconButton, Input, Sheet } from "../../ui"

const weekdays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

/** Six Monday-first rows covering the month. */
const gridFor = (month: LocalDate): Array<LocalDate> => {
  const first = parseLocalDate(monthStart(month))
  const offset = (first.getDay() + 6) % 7
  const start = addDays(toLocalDate(first), -offset)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

/** From and To fields, a calendar to pick a range by tapping two days, and Apply. */
export function PeriodSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { period, setPeriod } = usePeriod()
  const [draft, setDraft] = useState<{ from: LocalDate; to: LocalDate | null }>(period)
  const [month, setMonth] = useState<LocalDate>(monthStart(period.from))

  useEffect(() => {
    if (open) {
      setDraft(period)
      setMonth(monthStart(period.from))
    }
  }, [open, period])

  const pick = (day: LocalDate) => {
    if (draft.to !== null || day < draft.from) setDraft({ from: day, to: null })
    else setDraft({ from: draft.from, to: day })
  }

  const apply = () => {
    const to = draft.to ?? draft.from
    const next: Period = draft.from <= to ? { from: draft.from, to } : { from: to, to: draft.from }
    setPeriod(next)
    onClose()
  }

  const from = draft.from
  const to = draft.to ?? draft.from
  const inRange = (d: LocalDate) => d >= from && d <= to
  const days = gridFor(month)

  return (
    <Sheet open={open} title="Period" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From" htmlFor="period-from">
          <Input
            id="period-from"
            type="date"
            value={draft.from}
            onChange={(e) => e.target.value && setDraft((d) => ({ ...d, from: e.target.value as LocalDate }))}
          />
        </Field>
        <Field label="To" htmlFor="period-to">
          <Input
            id="period-to"
            type="date"
            value={to}
            onChange={(e) => e.target.value && setDraft((d) => ({ ...d, to: e.target.value as LocalDate }))}
          />
        </Field>
      </div>
      <div className="mt-3 -mx-2.5 flex items-center justify-between">
        <IconButton icon={CaretLeft} label="Previous month" onClick={() => setMonth(addMonths(month, -1))} />
        <span className="font-heading font-bold">{formatMonthYear(month)}</span>
        <IconButton icon={CaretRight} label="Next month" onClick={() => setMonth(addMonths(month, 1))} />
      </div>
      <div className="mt-2 grid grid-cols-7 gap-y-1 text-center">
        {weekdays.map((w) => (
          <div key={w} className="py-1 font-heading text-xs font-bold uppercase tracking-wider text-grey-ink">
            {w}
          </div>
        ))}
        {days.map((d) => {
          const outside = d < monthStart(month) || d > monthEnd(month)
          const selected = inRange(d)
          const end = d === from || d === to
          return (
            <button
              key={d}
              type="button"
              onClick={() => pick(d)}
              aria-pressed={selected}
              className={cn(
                "mx-auto flex h-10 w-full items-center justify-center font-mono text-sm",
                selected && "bg-accent",
                end && "border-3 border-ink shadow-hard-sm",
                !selected && "hover:bg-ink/5",
                outside && !selected && "text-grey-ink"
              )}
            >
              {parseLocalDate(d).getDate()}
            </button>
          )
        })}
      </div>
      <Button size="lg" className="mt-4 w-full" onClick={apply}>
        Apply
      </Button>
    </Sheet>
  )
}
