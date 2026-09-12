import { it } from "@effect/vitest"
import type { CategoryType, CurrencyCode, Hue, ImportRow, LocalDate, MinorAmount } from "@june/shared"
import { Effect } from "effect"
import { expect } from "vitest"
import { makeHarness } from "./harness.js"

const usd = "USD" as CurrencyCode
const gel = "GEL" as CurrencyCode
const minor = (n: number) => n as MinorAmount
const period = { from: "2026-01-01" as LocalDate, to: "2026-12-31" as LocalDate }

const row = (line: number, cells: [string, string, string, string, string, string]): ImportRow =>
  ({ line, date: cells[0], amount: cells[1], currency: cells[2], category: cells[3], description: cells[4], tags: cells[5] }) as ImportRow

it.scoped("import applies the capture rules to every row and skips the ones it cannot read, by line", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness()
    const card = yield* h.client.wallets.create({ payload: { name: "Card", currency: usd, initMinor: minor(0) } })
    yield* h.client.wallets.create({ payload: { name: "Cash", currency: usd, initMinor: minor(0) } })
    const food = yield* h.client.categories.create({ payload: { type: "expense" as CategoryType, name: "Food", hue: 20 as Hue } })
    yield* h.client.categories.create({ payload: { type: "income" as CategoryType, name: "Salary", hue: 100 as Hue } })

    const rows = [
      row(2, ["2026-09-01", "-4,50", "usd", "food", "Coffee", "morning work"]),
      row(3, ["2026-09-02", "2000", "USD", "salary", "September", ""]),
      row(4, ["2026-09-03", "-12", "GEL", "food", "Khachapuri", ""]),
      row(5, ["2026-09-04", "-3", "USD", "salary", "Wrong type slug", ""]),
      row(6, ["03/09/2026", "-3", "USD", "", "Bad date", ""]),
      row(7, ["2026-09-05", "abc", "USD", "", "Bad amount", ""]),
      row(8, ["2026-09-05", "-1", "XYZ", "", "Bad currency", ""]),
      row(9, ["2026-09-05", "0", "USD", "", "Zero", ""])
    ]

    const preview = yield* h.client.import.run({ payload: { rows, preview: true, skipDuplicates: true } })
    expect(preview.imported).toBe(0)
    expect(preview.rows.map((r) => r.line)).toEqual([2, 3, 4, 5])
    expect(preview.skipped).toEqual([
      { line: 6, reason: 'date "03/09/2026" must be YYYY-MM-DD' },
      { line: 7, reason: 'amount "abc" is not a number' },
      { line: 8, reason: 'currency "XYZ" is invalid' },
      { line: 9, reason: "amount is zero" }
    ])
    const coffee = preview.rows[0]!
    expect(coffee).toMatchObject({ walletId: card.id, categoryId: food.id, amountMinor: -450, currency: "USD", description: "Coffee", tags: ["morning", "work"], duplicate: false })
    // No GEL Wallet: Unassigned. A slug of the wrong Category Type: Uncategorised.
    expect(preview.rows[2]!.walletId).toBeNull()
    expect(preview.rows[3]!.categoryId).toBeNull()
    expect(yield* h.client.transactions.list({ urlParams: period })).toHaveLength(2) // the two Inits only

    const done = yield* h.client.import.run({ payload: { rows, preview: false, skipDuplicates: true } })
    expect(done.imported).toBe(4)
    expect(done.skipped).toHaveLength(4)
    const list = yield* h.client.transactions.list({ urlParams: period })
    const changes = list.filter((t) => t.type === "change")
    expect(changes).toHaveLength(4)
    const saved = changes.find((t) => t.description === "Coffee")!
    expect(saved.tags).toEqual(["morning", "work"])
    expect(saved.categoryId).toBe(food.id)
    expect(saved.occurredOn).toBe("2026-09-01")
    expect(saved.hiddenFromAnalysis).toBe(false)
  })
)

it.scoped("import marks rows identical to an existing Change and skips them only when asked", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness()
    const card = yield* h.client.wallets.create({ payload: { name: "Card", currency: usd, initMinor: minor(0) } })
    yield* h.client.transactions.createChange({
      payload: { walletId: card.id, amountMinor: minor(-450), occurredOn: "2026-09-01" as LocalDate, description: "Coffee" }
    })
    const rows = [row(2, ["2026-09-01", "-4.5", "USD", "", "Coffee", ""]), row(3, ["2026-09-01", "-4.5", "USD", "", "Tea", ""])]

    const preview = yield* h.client.import.run({ payload: { rows, preview: true, skipDuplicates: true } })
    expect(preview.rows.map((r) => r.duplicate)).toEqual([true, false])

    const skipping = yield* h.client.import.run({ payload: { rows, preview: false, skipDuplicates: true } })
    expect(skipping.imported).toBe(1)
    expect(skipping.rows.map((r) => r.line)).toEqual([3])

    const keeping = yield* h.client.import.run({ payload: { rows, preview: false, skipDuplicates: false } })
    expect(keeping.imported).toBe(2)
    const changes = (yield* h.client.transactions.list({ urlParams: period })).filter((t) => t.type === "change")
    expect(changes).toHaveLength(4)
    expect(changes.filter((t) => t.currency === gel)).toHaveLength(0)
  })
)
