import type { LocalDate } from "@june/shared"
import { CalendarBlank } from "@phosphor-icons/react"
import { useState } from "react"
import { describeDay } from "../lib/format"
import { addDays, formatLongDate, monthStart, todayLocal } from "../lib/period"
import { Button } from "./Button"
import { Calendar } from "./Calendar"
import { cn } from "./cn"
import { controlClass } from "./Input"
import { Sheet } from "./Sheet"

export interface DateInputProps {
  id?: string | undefined
  value: LocalDate
  onChange: (value: LocalDate) => void
  disabled?: boolean | undefined
  invalid?: boolean | undefined
}

/** A bordered control that reads like an input and opens June's calendar in a sheet instead of the system picker. */
export function DateInput({ id, value, onChange, disabled, invalid }: DateInputProps) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState<LocalDate>(monthStart(value))
  const show = () => {
    setMonth(monthStart(value))
    setOpen(true)
  }
  const pick = (d: LocalDate) => {
    onChange(d)
    setOpen(false)
  }
  return (
    <>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-haspopup="dialog"
        onClick={show}
        className={cn(controlClass, "flex h-11 items-center justify-between gap-3 text-left")}
      >
        <span>{describeDay(value, formatLongDate)}</span>
        <CalendarBlank size={20} weight="bold" className="shrink-0" />
      </button>
      <Sheet open={open} title="Date" onClose={() => setOpen(false)}>
        <Calendar month={month} onMonthChange={setMonth} mark={(d) => (d === value ? "end" : "none")} onPick={pick} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => pick(addDays(todayLocal(), -1))}>
            Yesterday
          </Button>
          <Button variant="secondary" onClick={() => pick(todayLocal())}>
            Today
          </Button>
        </div>
      </Sheet>
    </>
  )
}
