import { it } from "@effect/vitest"
import type { CategoryType, CurrencyCode, Hue, LocalDate, MinorAmount } from "@june/shared"
import { Effect } from "effect"
import { expect } from "vitest"
import { makeHarness, rawPost } from "./harness.js"

const usd = "USD" as CurrencyCode
const gel = "GEL" as CurrencyCode
const minor = (n: number) => n as MinorAmount

it.scoped("capture resolves the Wallet by Wallet Order and the Category by slug", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness()
    const card = yield* h.client.wallets.create({ payload: { name: "USD card", currency: usd, initMinor: minor(10_000) } })
    yield* h.client.wallets.create({ payload: { name: "USD cash", currency: usd, initMinor: minor(0) } })
    yield* h.client.wallets.create({ payload: { name: "GEL cash", currency: gel, initMinor: minor(0) } })
    const food = yield* h.client.categories.create({
      payload: { type: "expense" as CategoryType, name: "Food", hue: 20 as Hue }
    })
    expect(food.slug).toBe("food")

    const captured = yield* h.client.capture.capture({
      path: { token: h.captureToken },
      payload: { amount: -4.5, currency: usd, category: "food", description: "coffee", date: "2026-09-10" as LocalDate }
    })
    if (!captured.ok) throw new Error(captured.message)
    expect(captured.unassigned).toBe(false)
    expect(captured.uncategorised).toBe(false)
    expect(captured.message).toBe("✅ Saved 4.5 USD | Food")

    const tx = yield* h.client.transactions.get({ path: { id: captured.id } })
    expect(tx.walletId).toBe(card.id)
    expect(tx.amountMinor).toBe(-450)
    expect(tx.currency).toBe("USD")
    expect(tx.occurredOn).toBe("2026-09-10")
    expect(tx.categoryId).toBe(food.id)
    expect(tx.type).toBe("change")

    const wallets = yield* h.client.wallets.list()
    expect(wallets.wallets.find((w) => w.id === card.id)?.balanceMinor).toBe(10_000 - 450)
  })
)

it.scoped("capture never rejects an unknown slug, a wrong-type slug or an unmatched currency", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness()
    yield* h.client.wallets.create({ payload: { name: "USD card", currency: usd, initMinor: minor(0) } })
    yield* h.client.categories.create({ payload: { type: "income" as CategoryType, name: "Salary", hue: 100 as Hue } })

    const unknownSlug = yield* h.client.capture.capture({
      path: { token: h.captureToken },
      payload: { amount: -1, currency: usd, category: "nope" }
    })
    if (!unknownSlug.ok) throw new Error(unknownSlug.message)
    expect(unknownSlug.uncategorised).toBe(true)
    expect(unknownSlug.message).toBe("✅ Saved 1 USD | Uncategorised")

    // "salary" is an Income Category; a negative amount cannot carry it.
    const wrongType = yield* h.client.capture.capture({
      path: { token: h.captureToken },
      payload: { amount: -1, currency: usd, category: "salary" }
    })
    if (!wrongType.ok) throw new Error(wrongType.message)
    expect(wrongType.uncategorised).toBe(true)

    const noWallet = yield* h.client.capture.capture({
      path: { token: h.captureToken },
      payload: { amount: -20, currency: gel }
    })
    if (!noWallet.ok) throw new Error(noWallet.message)
    expect(noWallet.unassigned).toBe(true)
    expect(noWallet.message).toBe("✅ Saved 20 GEL | Uncategorised (no GEL wallet)")
    const tx = yield* h.client.transactions.get({ path: { id: noWallet.id } })
    expect(tx.walletId).toBeNull()
    expect(tx.currency).toBe("GEL")
    // Today's UTC date when the Shortcut sends none.
    expect(tx.occurredOn).toBe(new Date().toISOString().slice(0, 10))
  })
)

it.scoped("capture answers a bad currency, amount or date with a message the Shortcut can show", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness()
    const unknown = yield* rawPost(h.handler, "/api/capture/not-a-token", { amount: -1, currency: "USD" })
    expect(unknown.status).toBe(404)

    const answer = (body: unknown) =>
      rawPost(h.handler, `/api/capture/${h.captureToken}`, body).pipe(
        Effect.flatMap((res) => Effect.promise(() => res.json().then((json) => ({ status: res.status, json: json as { ok: boolean; message: string } }))))
      )
    const badCurrency = yield* answer({ amount: -1, currency: "XYZ" })
    expect(badCurrency.status).toBe(200)
    expect(badCurrency.json).toEqual({ ok: false, message: '❌ Error: currency "XYZ" is invalid' })

    const decimals = yield* answer({ amount: -1.005, currency: "USD" })
    expect(decimals.json.ok).toBe(false)
    expect(decimals.json.message).toContain("2 decimals")

    const zero = yield* answer({ amount: 0, currency: "USD" })
    expect(zero.json.message).toBe("❌ Error: amount is zero")

    const text = yield* answer({ amount: "abc", currency: "USD" })
    expect(text.json.message).toBe('❌ Error: amount "abc" is not a number')

    const date = yield* answer({ amount: -1, currency: "USD", date: "12/09/2026" })
    expect(date.json.message).toBe('❌ Error: date "12/09/2026" must be YYYY-MM-DD')

    // A string amount with a comma, as some keyboards type it, is accepted; income carries a plus.
    const comma = yield* answer({ amount: "22,5", currency: "usd" })
    expect(comma.json.message).toBe("✅ Saved +22.5 USD | Uncategorised (no USD wallet)")

    // Regenerating the token invalidates the old one.
    const issued = yield* h.client.settings.regenerateCaptureToken()
    const old = yield* rawPost(h.handler, `/api/capture/${h.captureToken}`, { amount: -1, currency: "USD" })
    expect(old.status).toBe(404)
    const fresh = yield* rawPost(h.handler, `/api/capture/${issued.token}`, { amount: -1, currency: "USD" })
    expect(fresh.status).toBe(200)
    expect(issued.captureUrl).toBe(`http://june.test/api/capture/${issued.token}`)
  })
)

it.scoped("a captured Change carries the trimmed description, no Tags and is not hidden", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness()
    const card = yield* h.client.wallets.create({ payload: { name: "USD card", currency: usd, initMinor: minor(0) } })

    const captured = yield* h.client.capture.capture({
      path: { token: h.captureToken },
      payload: { amount: 12, currency: usd, category: "  Salary ", description: "  bonus  " }
    })
    if (!captured.ok) throw new Error(captured.message)
    expect(captured.message).toBe("✅ Saved +12 USD | Uncategorised")
    const tx = yield* h.client.transactions.get({ path: { id: captured.id } })
    expect(tx).toMatchObject({ type: "change", walletId: card.id, amountMinor: 1200, description: "bonus", tags: [], hiddenFromAnalysis: false, categoryId: null, exchangeId: null })

    // The slug is matched after trimming and lower-casing.
    const salary = yield* h.client.categories.create({ payload: { type: "income" as CategoryType, name: "Salary", hue: 100 as Hue } })
    const matched = yield* h.client.capture.capture({ path: { token: h.captureToken }, payload: { amount: 12, currency: usd, category: "  Salary " } })
    if (!matched.ok) throw new Error(matched.message)
    expect(matched.uncategorised).toBe(false)
    expect((yield* h.client.transactions.get({ path: { id: matched.id } })).categoryId).toBe(salary.id)
  })
)
