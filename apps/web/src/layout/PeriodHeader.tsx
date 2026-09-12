import { CalendarBlank, CaretLeft, CaretRight } from "@phosphor-icons/react"
import { useState } from "react"
import { PeriodSheet } from "../components/transactions/PeriodSheet"
import { periodLabel, shiftPeriod, usePeriod } from "../lib/period"
import { Display, IconButton } from "../ui"

/** Screen title plus the ‹ 📅 September 2026 › row shared by Transactions and Analysis. */
export function PeriodHeader({ title }: { title: string }) {
  const { period, setPeriod } = usePeriod()
  const [open, setOpen] = useState(false)
  return (
    <header className="mb-4">
      <Display size="sm">{title}</Display>
      <div className="mt-3 -mx-2.5 flex items-center justify-between">
        <IconButton icon={CaretLeft} label="Previous period" onClick={() => setPeriod(shiftPeriod(period, -1))} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 px-2 py-1 font-heading text-xl font-bold hover:bg-ink/5"
        >
          <CalendarBlank size={20} weight="bold" />
          {periodLabel(period)}
        </button>
        <IconButton icon={CaretRight} label="Next period" onClick={() => setPeriod(shiftPeriod(period, 1))} />
      </div>
      <PeriodSheet open={open} onClose={() => setOpen(false)} />
    </header>
  )
}
