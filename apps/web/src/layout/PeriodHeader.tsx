import { ArrowLeft, CalendarBlank, CaretLeft, CaretRight } from "@phosphor-icons/react"
import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { PeriodSheet } from "../components/transactions/PeriodSheet"
import { filterParams, useFilter } from "../lib/filter"
import { periodLabel, shiftPeriod, usePeriod } from "../lib/period"
import { Display, IconButton } from "../ui"
import { FilterRow } from "./FilterRow"
import { StickyBar } from "./StickyBar"

/** Mirror the shared Filter into the URL so a link carries it. One way: the page loaded from a URL seeds the Filter once, in App. */
const useFilterInUrl = () => {
  const { filter } = useFilter()
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    const next = filterParams(filter)
    if (next.toString() !== params.toString()) setParams(next, { replace: true })
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps
}

/** Screen title, the ‹ 📅 September 2026 › row and the Filter row shared by Transactions and Analysis. */
export function PeriodHeader({ title, backTo }: { title: string; backTo?: string }) {
  const { period, setPeriod } = usePeriod()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  useFilterInUrl()
  return (
    <StickyBar>
      <header className="pb-3">
        {backTo ? (
          <div className="-ml-2.5 flex items-center gap-1">
            <IconButton icon={ArrowLeft} label="Back" onClick={() => navigate(backTo)} />
            <Display size="sm">{title}</Display>
          </div>
        ) : (
          <Display size="sm">{title}</Display>
        )}
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
        <div className="mt-1">
          <FilterRow />
        </div>
        <PeriodSheet open={open} onClose={() => setOpen(false)} />
      </header>
    </StickyBar>
  )
}
