import { it } from "@effect/vitest"
import { type CategoryType, type CronExpression, type CurrencyCode, type Hue, type LocalDate, type MinorAmount, nextAfter, nextOnOrAfter, parseCron, todayUtc } from "@june/shared"
import { Context, Effect, Either } from "effect"
import { expect } from "vitest"
import { RecurringFiring } from "../src/recurrings/Firing.js"
import { makeHarness } from "./harness.js"

const usd = "USD" as CurrencyCode
const minor = (n: number) => n as MinorAmount
const period = { from: "2020-01-01" as LocalDate, to: "2030-12-31" as LocalDate }
const cron = (s: string) => s as CronExpression
const parsed = (s: string) => Either.getOrThrow(parseCron(s))
const addDays = (d: LocalDate, n: number): LocalDate => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10) as LocalDate

it.scoped("a recurring's next date comes from its schedule and firing by hand records a change dated for it", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness()
    const today = todayUtc()
    const card = yield* h.client.wallets.create({ payload: { name: "Card", currency: usd, initMinor: minor(0) } })
    const housing = yield* h.client.categories.create({ payload: { type: "expense" as CategoryType, name: "Housing", hue: 200 as Hue } })

    // Monthly on today's day and the 28th: due today, since a matching day counts on the day it is created.
    const day = Number(today.slice(8, 10))
    const expr = cron(`0 0 ${day === 28 ? "28" : `${day},28`} * *`)
    const rent = yield* h.client.recurrings.create({
      payload: { name: "Rent", walletId: card.id, amountMinor: minor(-120000), categoryId: housing.id, description: "Flat", tags: ["home"] as never, auto: false, cron: expr }
    })
    expect(rent.currency).toBe("USD")
    expect(rent.nextOn).toBe(today)
    expect(rent.lastFiredOn).toBeNull()

    const recorded = yield* h.client.recurrings.fire({ path: { id: rent.id }, payload: {} })
    expect(recorded).toMatchObject({ type: "change", walletId: card.id, amountMinor: -120000, currency: "USD", occurredOn: today, description: "Flat", tags: ["home"], categoryId: housing.id, hiddenFromAnalysis: false })

    const after = yield* h.client.recurrings.get({ path: { id: rent.id } })
    expect(after.lastFiredOn).toBe(today)
    expect(after.nextOn).toBe(nextAfter(parsed(expr), today))
    expect(after.auto).toBe(false)

    // Edit & submit: the given change is recorded instead, the schedule still advances from the due date.
    const edited = yield* h.client.recurrings.fire({
      path: { id: rent.id },
      payload: { change: { walletId: card.id, amountMinor: minor(-125000), occurredOn: addDays(today, 1), description: "Flat, with fee", hiddenFromAnalysis: true } }
    })
    expect(edited).toMatchObject({ amountMinor: -125000, occurredOn: addDays(today, 1), description: "Flat, with fee", hiddenFromAnalysis: true })
    const list = yield* h.client.transactions.list({ urlParams: period })
    expect(list.filter((t) => t.type === "change")).toHaveLength(2)
  })
)

it.scoped("auto needs a schedule, a once schedule is spent by firing, and editing the schedule recomputes the next date", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness()
    const today = todayUtc()
    const card = yield* h.client.wallets.create({ payload: { name: "Card", currency: usd, initMinor: minor(0) } })

    const noSchedule = yield* h.client.recurrings
      .create({ payload: { name: "Gym", walletId: card.id, amountMinor: minor(-5000), auto: true } })
      .pipe(Effect.flip)
    expect(noSchedule._tag).toBe("RuleViolation")

    const once = yield* h.client.recurrings.create({ payload: { name: "Deposit", walletId: card.id, amountMinor: minor(-30000), auto: true, nextOn: addDays(today, 3) } })
    expect(once).toMatchObject({ cron: null, nextOn: addDays(today, 3), auto: true })
    const fired = yield* h.client.recurrings.fire({ path: { id: once.id }, payload: {} })
    expect(fired.occurredOn).toBe(addDays(today, 3))
    const spent = yield* h.client.recurrings.get({ path: { id: once.id } })
    expect(spent).toMatchObject({ nextOn: null, auto: false, lastFiredOn: addDays(today, 3) })

    // Switching to a yearly expression recomputes from today.
    const yearly = cron("0 0 14 3 *")
    const updated = yield* h.client.recurrings.update({ path: { id: once.id }, payload: { cron: yearly, auto: true } })
    expect(updated.cron).toBe(yearly)
    expect(updated.nextOn).toBe(nextOnOrAfter(parsed(yearly), today))
    expect(updated.auto).toBe(true)

    // Turning auto on alone also recomputes, so a paused recurring never catches up on the past.
    yield* h.client.recurrings.update({ path: { id: once.id }, payload: { auto: false } })
    yield* h.sql`update recurring set next_on = '2020-01-14' where id = ${once.id}`
    const resumed = yield* h.client.recurrings.update({ path: { id: once.id }, payload: { auto: true } })
    expect(resumed.nextOn).toBe(nextOnOrAfter(parsed(yearly), today))

    const bad = yield* h.client.recurrings.update({ path: { id: once.id }, payload: { cron: cron("0 0 * * 1"), amountMinor: minor(0) } }).pipe(Effect.flip)
    expect(["ParseError", "HttpApiDecodeError"]).toContain(bad._tag)
  })
)

it.scoped("the tick fires every due auto recurring, catches up missed dates, and a recurring without a wallet fires unassigned", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness()
    const today = todayUtc()
    const firing = Context.get(h.context, RecurringFiring)
    const card = yield* h.client.wallets.create({ payload: { name: "Card", currency: usd, initMinor: minor(0) } })
    const cash = yield* h.client.wallets.create({ payload: { name: "Cash", currency: usd, initMinor: minor(0) } })

    const daily = yield* h.client.recurrings.create({ payload: { name: "Coffee", walletId: card.id, amountMinor: minor(-400), auto: true, cron: cron("0 0 * * *") } })
    const manual = yield* h.client.recurrings.create({ payload: { name: "Manual", walletId: card.id, amountMinor: minor(-100), auto: false, cron: cron("0 0 * * *") } })
    const orphan = yield* h.client.recurrings.create({ payload: { name: "Orphan", walletId: cash.id, amountMinor: minor(-900), auto: true, cron: cron("0 0 * * *") } })
    // Three days of downtime.
    yield* h.sql`update recurring set next_on = ${addDays(today, -2)} where id = ${daily.id}`
    yield* h.client.wallets.delete({ path: { id: cash.id } })

    const attention = yield* h.client.settings.attention()
    expect(attention).toEqual({ recurringsWithoutWallet: 1, unassignedTransactions: 0 })

    const fired = yield* firing.fireDue(today)
    expect(fired).toBe(4) // three days of coffee, one orphan

    const list = (yield* h.client.transactions.list({ urlParams: period })).filter((t) => t.type === "change")
    const coffees = list.filter((t) => t.description === "" && t.amountMinor === -400).map((t) => t.occurredOn).sort()
    expect(coffees).toEqual([addDays(today, -2), addDays(today, -1), today])
    const orphaned = list.find((t) => t.amountMinor === -900)!
    expect(orphaned.walletId).toBeNull()
    expect(orphaned.currency).toBe("USD")

    expect((yield* h.client.recurrings.get({ path: { id: daily.id } })).nextOn).toBe(addDays(today, 1))
    expect((yield* h.client.recurrings.get({ path: { id: manual.id } })).lastFiredOn).toBeNull()
    expect((yield* h.client.recurrings.get({ path: { id: orphan.id } })).walletId).toBeNull()
    expect((yield* h.client.settings.attention()).unassignedTransactions).toBe(1)

    // A second tick the same day does nothing.
    expect(yield* firing.fireDue(today)).toBe(0)

    yield* h.client.recurrings.delete({ path: { id: daily.id } })
    expect(yield* h.client.recurrings.list()).toHaveLength(2)
    expect((yield* h.client.transactions.list({ urlParams: period })).filter((t) => t.type === "change")).toHaveLength(4)
  })
)
