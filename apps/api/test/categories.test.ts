import { it } from "@effect/vitest"
import type { CategoryId, CategoryType, CurrencyCode, Hue, LocalDate, MinorAmount, Slug } from "@june/shared"
import { Effect } from "effect"
import { expect } from "vitest"
import { makeHarness, uuid } from "./harness.js"

const usd = "USD" as CurrencyCode
const minor = (n: number) => n as MinorAmount
const expense = "expense" as CategoryType
const income = "income" as CategoryType
const hue = (n: number) => n as Hue
const period = { from: "2026-01-01" as LocalDate, to: "2026-12-31" as LocalDate }

it.scoped("the Category list holds both Category Types, expense first, each by name", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness()
    yield* h.client.categories.create({ payload: { type: income, name: "Salary", hue: hue(100) } })
    yield* h.client.categories.create({ payload: { type: expense, name: "Rent", hue: hue(200), emoji: "🏠" } })
    yield* h.client.categories.create({ payload: { type: expense, name: "Food", hue: hue(20) } })
    yield* h.client.categories.create({ payload: { type: income, name: "Gifts", hue: hue(300), emoji: null } })

    const list = yield* h.client.categories.list()
    expect(list.map((c) => [c.type, c.name, c.slug, c.emoji, c.hue])).toEqual([
      ["expense", "Food", "food", null, 20],
      ["expense", "Rent", "rent", "🏠", 200],
      ["income", "Gifts", "gifts", null, 300],
      ["income", "Salary", "salary", null, 100]
    ])
  })
)

it.scoped("updating a Category changes its name, hue and emoji, keeps its slug unless one is sent, and refuses a taken slug", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness()
    const food = yield* h.client.categories.create({ payload: { type: expense, name: "Food", hue: hue(20) } })
    yield* h.client.categories.create({ payload: { type: expense, name: "Rent", hue: hue(200) } })

    const renamed = yield* h.client.categories.update({ path: { id: food.id }, payload: { name: "Groceries", hue: hue(25), emoji: "🥦" } })
    expect(renamed).toMatchObject({ id: food.id, type: "expense", name: "Groceries", slug: "food", hue: 25, emoji: "🥦" })

    const reslugged = yield* h.client.categories.update({ path: { id: food.id }, payload: { slug: "groceries" as Slug, emoji: null } })
    expect(reslugged).toMatchObject({ name: "Groceries", slug: "groceries", emoji: null })

    const untouched = yield* h.client.categories.update({ path: { id: food.id }, payload: {} })
    expect(untouched).toEqual(reslugged)

    const taken = yield* h.client.categories.update({ path: { id: food.id }, payload: { slug: "rent" as Slug } }).pipe(Effect.flip)
    expect(taken).toMatchObject({ _tag: "RuleViolation", message: "A Category with this slug already exists" })

    const duplicate = yield* h.client.categories.create({ payload: { type: income, name: "Rent", hue: hue(1) } }).pipe(Effect.flip)
    expect(duplicate._tag).toBe("RuleViolation")
  })
)

it.scoped("a Category of another User or an unknown id is not found for update and delete", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness()
    const otherUser = uuid()
    const theirs = uuid() as CategoryId
    yield* h.sql`insert into "user" (id, name, email, email_verified) values (${otherUser}, 'Other', 'other@example.com', true)`
    yield* h.sql`insert into category (id, user_id, type, name, slug, hue) values (${theirs}, ${otherUser}, 'expense', 'Theirs', 'theirs', 5)`

    const foreign = yield* h.client.categories.update({ path: { id: theirs }, payload: { name: "Mine now" } }).pipe(Effect.flip)
    expect(foreign._tag).toBe("NotFound")
    const foreignDelete = yield* h.client.categories.delete({ path: { id: theirs } }).pipe(Effect.flip)
    expect(foreignDelete._tag).toBe("NotFound")
    const unknown = yield* h.client.categories.update({ path: { id: uuid() as CategoryId }, payload: { name: "Ghost" } }).pipe(Effect.flip)
    expect(unknown._tag).toBe("NotFound")
    const unknownDelete = yield* h.client.categories.delete({ path: { id: uuid() as CategoryId } }).pipe(Effect.flip)
    expect(unknownDelete._tag).toBe("NotFound")

    expect(yield* h.sql`select name from category where id = ${theirs}`).toEqual([{ name: "Theirs" }])
  })
)

it.scoped("deleting a Category leaves its Transactions and Recurrings Uncategorised", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness()
    const card = yield* h.client.wallets.create({ payload: { name: "Card", currency: usd, initMinor: minor(0) } })
    const food = yield* h.client.categories.create({ payload: { type: expense, name: "Food", hue: hue(20) } })
    const rent = yield* h.client.categories.create({ payload: { type: expense, name: "Rent", hue: hue(200) } })
    const coffee = yield* h.client.transactions.createChange({
      payload: { walletId: card.id, amountMinor: minor(-450), occurredOn: "2026-09-10" as LocalDate, categoryId: food.id }
    })
    const flat = yield* h.client.recurrings.create({
      payload: { name: "Flat", walletId: card.id, amountMinor: minor(-120000), categoryId: food.id, auto: false }
    })

    yield* h.client.categories.delete({ path: { id: food.id } })

    expect((yield* h.client.categories.list()).map((c) => c.id)).toEqual([rent.id])
    expect((yield* h.client.transactions.get({ path: { id: coffee.id } })).categoryId).toBeNull()
    expect((yield* h.client.recurrings.get({ path: { id: flat.id } })).categoryId).toBeNull()
    expect((yield* h.client.transactions.list({ urlParams: period })).find((t) => t.id === coffee.id)!.amountMinor).toBe(-450)
  })
)
