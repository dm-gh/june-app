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
    expect(captured.unassigned).toBe(false)
    expect(captured.uncategorised).toBe(false)

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
    expect(unknownSlug.uncategorised).toBe(true)

    // "salary" is an Income Category; a negative amount cannot carry it.
    const wrongType = yield* h.client.capture.capture({
      path: { token: h.captureToken },
      payload: { amount: -1, currency: usd, category: "salary" }
    })
    expect(wrongType.uncategorised).toBe(true)

    const noWallet = yield* h.client.capture.capture({
      path: { token: h.captureToken },
      payload: { amount: -20, currency: gel }
    })
    expect(noWallet.unassigned).toBe(true)
    const tx = yield* h.client.transactions.get({ path: { id: noWallet.id } })
    expect(tx.walletId).toBeNull()
    expect(tx.currency).toBe("GEL")
    // Today's UTC date when the Shortcut sends none.
    expect(tx.occurredOn).toBe(new Date().toISOString().slice(0, 10))
  })
)

it.scoped("capture rejects an unknown token, a made-up currency, and too many decimals", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness()
    const unknown = yield* rawPost(h.handler, "/api/capture/not-a-token", { amount: -1, currency: "USD" })
    expect(unknown.status).toBe(404)

    const badCurrency = yield* rawPost(h.handler, `/api/capture/${h.captureToken}`, { amount: -1, currency: "XYZ" })
    expect(badCurrency.status).toBe(400)

    const decimals = yield* rawPost(h.handler, `/api/capture/${h.captureToken}`, { amount: -1.005, currency: "USD" })
    expect(decimals.status).toBe(422)
    expect(((yield* Effect.promise(() => decimals.json())) as { message: string }).message).toContain("2 decimals")

    const zero = yield* rawPost(h.handler, `/api/capture/${h.captureToken}`, { amount: 0, currency: "USD" })
    expect(zero.status).toBe(422)

    // Regenerating the token invalidates the old one.
    const issued = yield* h.client.settings.regenerateCaptureToken()
    const old = yield* rawPost(h.handler, `/api/capture/${h.captureToken}`, { amount: -1, currency: "USD" })
    expect(old.status).toBe(404)
    const fresh = yield* rawPost(h.handler, `/api/capture/${issued.token}`, { amount: -1, currency: "USD" })
    expect(fresh.status).toBe(201)
    expect(issued.captureUrl).toBe(`http://june.test/api/capture/${issued.token}`)
  })
)
