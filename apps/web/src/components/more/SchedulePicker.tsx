import { buildCron, type CronExpression, describeShape, type LocalDate, nextOnOrAfter, ordinal, parseCron, readCron, type ScheduleShape } from "@june/shared"
import { Either } from "effect"
import { formatLongDate, todayLocal } from "../../lib/period"
import { Button, cn, DateInput, Field, Label, Segmented, Select, Text } from "../../ui"

/** What the picker holds; `kind: "none"` is no Schedule (only allowed with Auto off). */
export interface ScheduleDraft {
  kind: "none" | "once" | "daily" | "weekly" | "monthly" | "yearly"
  weekdays: ReadonlyArray<number>
  days: ReadonlyArray<number>
  day: number
  month: number
  once: LocalDate
}

export const emptySchedule = (): ScheduleDraft => {
  const today = todayLocal()
  return { kind: "none", weekdays: [], days: [Number(today.slice(8, 10))], day: Number(today.slice(8, 10)), month: Number(today.slice(5, 7)), once: today }
}

/** The picker for an existing Recurring: its shape read back from the expression, or its once date. */
export const scheduleFromRecurring = (r: { cron: string | null; nextOn: LocalDate | null }): ScheduleDraft => {
  const base = emptySchedule()
  if (r.cron === null) return r.nextOn === null ? base : { ...base, kind: "once", once: r.nextOn }
  const shape = readCron(r.cron)
  if (shape === null) return base
  switch (shape.kind) {
    case "daily":
      return { ...base, kind: "daily" }
    case "weekly":
      return { ...base, kind: "weekly", weekdays: shape.weekdays }
    case "monthly":
      return { ...base, kind: "monthly", days: shape.days }
    case "yearly":
      return { ...base, kind: "yearly", day: shape.day, month: shape.month }
  }
}

const toShape = (d: ScheduleDraft): ScheduleShape | null => {
  switch (d.kind) {
    case "daily":
      return { kind: "daily" }
    case "weekly":
      return { kind: "weekly", weekdays: d.weekdays }
    case "monthly":
      return { kind: "monthly", days: d.days }
    case "yearly":
      return { kind: "yearly", day: d.day, month: d.month }
    default:
      return null
  }
}

/** The payload for the server: an expression, a once date, or neither. */
export const schedulePayload = (d: ScheduleDraft): Either.Either<{ cron: CronExpression | null; nextOn: LocalDate | null }, string> => {
  if (d.kind === "none") return Either.right({ cron: null, nextOn: null })
  if (d.kind === "once") return Either.right({ cron: null, nextOn: d.once })
  const shape = toShape(d)!
  return buildCron(shape).pipe(Either.map((cron) => ({ cron, nextOn: null })))
}

/** "Monthly on the 5th and 20th · Next fires 20 Sep 2026", or the reason nothing fires yet. */
export const schedulePreview = (d: ScheduleDraft): string => {
  if (d.kind === "none") return "No schedule: fire it by hand from its page."
  if (d.kind === "once") return d.once < todayLocal() ? `This will never happen: ${formatLongDate(d.once)} has already passed.` : `Once on ${formatLongDate(d.once)}`
  const shape = toShape(d)!
  const cron = buildCron(shape)
  if (Either.isLeft(cron)) return cron.left
  const parsed = parseCron(cron.right)
  if (Either.isLeft(parsed)) return parsed.left
  return `${describeShape(shape)} · Next fires ${formatLongDate(nextOnOrAfter(parsed.right, todayLocal()))}`
}

const WEEKDAYS = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [0, "Sun"]
] as const
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

const toggle = (xs: ReadonlyArray<number>, x: number) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x])

/** A bordered chip that reads as a toggle: accent with a hard shadow when on. */
function Chip({ on, children, onClick, className }: { on: boolean; children: React.ReactNode; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onClick}
      className={cn("h-10 border-3 border-ink font-heading text-sm font-bold", on ? "bg-accent shadow-hard-sm" : "bg-paper text-grey-ink hover:bg-ink/5", className)}
    >
      {children}
    </button>
  )
}

export interface SchedulePickerProps {
  value: ScheduleDraft
  onChange: (value: ScheduleDraft) => void
  /** With Auto on a Schedule is required, so "none" is not offered. */
  required: boolean
  error?: string | undefined
}

/**
 * The generator behind a Schedule. Daily is every day, Weekly and Monthly take several days,
 * Yearly one day of one month, Once a date. The cron expression it produces is never shown.
 */
export function SchedulePicker({ value: d, onChange, required, error }: SchedulePickerProps) {
  const set = <K extends keyof ScheduleDraft>(key: K, v: ScheduleDraft[K]) => onChange({ ...d, [key]: v })
  const kinds = [
    { value: "once" as const, label: "Once" },
    { value: "daily" as const, label: "Daily" },
    { value: "weekly" as const, label: "Weekly" },
    { value: "monthly" as const, label: "Monthly" },
    { value: "yearly" as const, label: "Yearly" }
  ]
  return (
    <div className="flex flex-col gap-3">
      <Field label="Schedule" error={error}>
        <Segmented options={kinds} value={d.kind === "none" ? ("" as ScheduleDraft["kind"]) : d.kind} onChange={(kind) => set("kind", kind)} />
      </Field>
      {d.kind === "weekly" ? (
        <div>
          <Label as="div" className="mb-2 block">
            Weekdays
          </Label>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map(([n, label]) => (
              <Chip key={n} on={d.weekdays.includes(n)} onClick={() => set("weekdays", toggle(d.weekdays, n))}>
                {label}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
      {d.kind === "monthly" ? (
        <div>
          <Label as="div" className="mb-2 block">
            Days of month
          </Label>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
              <Chip key={n} on={d.days.includes(n)} onClick={() => set("days", toggle(d.days, n))} className="font-mono">
                {n}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
      {d.kind === "yearly" ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Day" htmlFor="yearly-day">
            <Select id="yearly-day" value={d.day} onChange={(e) => set("day", Number(e.target.value))}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {ordinal(n)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Month" htmlFor="yearly-month">
            <Select id="yearly-month" value={d.month} onChange={(e) => set("month", Number(e.target.value))}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : null}
      {d.kind === "once" ? (
        <Field label="Date" htmlFor="once">
          <DateInput id="once" value={d.once} onChange={(once) => set("once", once)} />
        </Field>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <Text className={cn("text-sm", d.kind === "once" && d.once < todayLocal() ? "text-coral-ink" : "text-grey-ink")}>{schedulePreview(d)}</Text>
        {d.kind !== "none" && !required ? (
          <Button variant="ghost" size="sm" onClick={() => set("kind", "none")}>
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  )
}
