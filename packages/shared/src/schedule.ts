import { Cron, Either, Schema } from "effect"
import type { LocalDate } from "./domain.js"

/**
 * A Recurring's Schedule (CONTEXT.md): stored as a standard five-field cron expression that the
 * User never sees, built by the generator below from one of three shapes, or absent for a once
 * date. Days are calendar days in UTC; the time fields are always "0 0".
 */

/** Cron expressions are always read in UTC, wherever the server or the User is. */
const TZ = "UTC"

export const parseCron = (expression: string): Either.Either<Cron.Cron, string> =>
  Cron.parse(expression, TZ).pipe(Either.mapLeft((e) => e.message))

/** A five-field cron expression Effect can parse. */
export const CronExpression = Schema.String.pipe(
  Schema.filter((s) => Either.isRight(parseCron(s)), { message: () => "not a cron expression" }),
  Schema.brand("CronExpression")
)
export type CronExpression = typeof CronExpression.Type

const toLocalDate = (d: Date): LocalDate => d.toISOString().slice(0, 10) as LocalDate

const startOf = (date: LocalDate): Date => new Date(`${date}T00:00:00Z`)

/** The first matching date on or after `date`. */
export const nextOnOrAfter = (cron: Cron.Cron, date: LocalDate): LocalDate =>
  toLocalDate(Cron.next(cron, new Date(startOf(date).getTime() - 1)))

/** The first matching date strictly after `date`. */
export const nextAfter = (cron: Cron.Cron, date: LocalDate): LocalDate => toLocalDate(Cron.next(cron, startOf(date)))

// ---------------------------------------------------------------- the generator

/** What the form lets the User pick. `once` is not a cron shape: it becomes a date with no expression. */
export type ScheduleShape =
  | { readonly kind: "weekly"; readonly weekdays: ReadonlyArray<number> }
  | { readonly kind: "monthly"; readonly days: ReadonlyArray<number> }
  | { readonly kind: "yearly"; readonly day: number; readonly month: number }

const list = (ns: ReadonlyArray<number>): string => [...new Set(ns)].sort((a, b) => a - b).join(",")

/** The expression for a shape, or a message when nothing is selected. */
export const buildCron = (shape: ScheduleShape): Either.Either<CronExpression, string> => {
  switch (shape.kind) {
    case "weekly":
      return shape.weekdays.length === 0 ? Either.left("Pick at least one weekday") : Either.right(`0 0 * * ${list(shape.weekdays)}` as CronExpression)
    case "monthly":
      return shape.days.length === 0 ? Either.left("Pick at least one day") : Either.right(`0 0 ${list(shape.days)} * *` as CronExpression)
    case "yearly":
      return Either.right(`0 0 ${shape.day} ${shape.month} *` as CronExpression)
  }
}

/** The shape behind an expression the generator produced; null for anything else. */
export const readCron = (expression: string): ScheduleShape | null => {
  const m = /^0 0 (\S+) (\S+) (\S+)$/.exec(expression.trim())
  if (!m) return null
  const [, day, month, weekday] = m as unknown as [string, string, string, string]
  const nums = (s: string) => s.split(",").map(Number)
  if (day === "*" && month === "*" && weekday !== "*") return { kind: "weekly", weekdays: nums(weekday) }
  if (month === "*" && weekday === "*" && day !== "*") return { kind: "monthly", days: nums(day) }
  if (weekday === "*" && day !== "*" && month !== "*" && !day.includes(",") && !month.includes(",")) {
    return { kind: "yearly", day: Number(day), month: Number(month) }
  }
  return null
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

export const ordinal = (n: number): string => {
  const rest = n % 100
  const suffix = rest >= 11 && rest <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th"
  return `${n}${suffix}`
}

const joinWords = (xs: ReadonlyArray<string>): string =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`

/** "Weekly on Monday and Friday", "Monthly on the 5th and 20th", "Yearly on 14 March". */
export const describeShape = (shape: ScheduleShape): string => {
  switch (shape.kind) {
    case "weekly":
      return `Weekly on ${joinWords([...shape.weekdays].sort((a, b) => a - b).map((d) => WEEKDAYS[d % 7]!))}`
    case "monthly":
      return `Monthly on the ${joinWords([...shape.days].sort((a, b) => a - b).map(ordinal))}`
    case "yearly":
      return `Yearly on ${shape.day} ${MONTHS[shape.month - 1]}`
  }
}

/** The Schedule in words: a shape, "Once on …" for a lone date, "No schedule" for neither, the raw expression as a last resort. */
export const describeSchedule = (cron: string | null, nextOn: LocalDate | null, formatDate: (d: LocalDate) => string): string => {
  if (cron === null) return nextOn === null ? "No schedule" : `Once on ${formatDate(nextOn)}`
  const shape = readCron(cron)
  return shape ? describeShape(shape) : cron
}
