import type { LocalDate } from "@june/shared"
import { useEffect, useState } from "react"
import { formatLongDate, monthStart, type Period, usePeriod } from "../../lib/period"
import { Button, Calendar, cn, Field, Sheet } from "../../ui"

type End = "from" | "to"

/** From and To, a calendar that fills whichever end is active, and Apply. */
export function PeriodSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { period, setPeriod } = usePeriod()
  const [draft, setDraft] = useState<Period>(period)
  const [active, setActive] = useState<End>("from")
  const [month, setMonth] = useState<LocalDate>(monthStart(period.from))

  useEffect(() => {
    if (open) {
      setDraft(period)
      setActive("from")
      setMonth(monthStart(period.from))
    }
  }, [open, period])

  /** Filling From moves on to To; a To before From starts the range over from that day. */
  const pick = (day: LocalDate) => {
    if (active === "from" || day < draft.from) {
      setDraft({ from: day, to: day > draft.to ? day : draft.to })
      setActive("to")
    } else {
      setDraft({ from: draft.from, to: day })
    }
  }

  const apply = () => {
    setPeriod(draft)
    onClose()
  }

  const endButton = (end: End, id: string) => (
    <button
      id={id}
      type="button"
      aria-pressed={active === end}
      onClick={() => setActive(end)}
      className={cn(
        "flex h-11 w-full items-center border-3 border-ink px-3 text-left font-sans text-base focus:outline-none focus-visible:shadow-hard-sm",
        active === end ? "bg-accent shadow-hard-sm" : "bg-white"
      )}
    >
      {formatLongDate(draft[end])}
    </button>
  )

  return (
    <Sheet open={open} title="Period" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From" htmlFor="period-from">
          {endButton("from", "period-from")}
        </Field>
        <Field label="To" htmlFor="period-to">
          {endButton("to", "period-to")}
        </Field>
      </div>
      <div className="mt-3">
        <Calendar
          month={month}
          onMonthChange={setMonth}
          mark={(d) => (d === draft.from || d === draft.to ? "end" : d > draft.from && d < draft.to ? "range" : "none")}
          onPick={pick}
        />
      </div>
      <Button size="lg" className="mt-4 w-full" onClick={apply}>
        Apply
      </Button>
    </Sheet>
  )
}
