import { it } from "@effect/vitest"
import type { CurrencyCode, LocalDate, MinorAmount, WalletId } from "@june/shared"
import { Effect } from "effect"
import { expect } from "vitest"
import { walletDeleteTag } from "../src/wallets/Wallets.js"
import { makeHarness } from "./harness.js"

const usd = "USD" as CurrencyCode
const gel = "GEL" as CurrencyCode
const minor = (n: number) => n as MinorAmount
const day = (s: string) => s as LocalDate

it.scoped("a Wallet's Balance is its Init plus every Change, converted at today's rate for the total", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness({ user: { defaultCurrency: gel } })
    const card = yield* h.client.wallets.create({ payload: { name: "Card", currency: usd, initMinor: minor(10_000) } })
    expect(card.initMinor).toBe(10_000)
    expect(card.balanceMinor).toBe(10_000)
    // 100 USD at 2.7 GEL per USD.
    expect(card.balanceDefaultMinor).toBe(27_000)

    yield* h.client.transactions.createChange({
      payload: { walletId: card.id, amountMinor: minor(-2_550), occurredOn: day("2026-09-01") }
    })
    const cash = yield* h.client.wallets.create({ payload: { name: "Cash", currency: gel, initMinor: minor(500) } })

    const list = yield* h.client.wallets.list()
    expect(list.wallets.map((w) => w.name)).toEqual(["Card", "Cash"])
    expect(list.wallets[0]!.balanceMinor).toBe(7_450)
    expect(list.totalDefaultMinor).toBe(Math.round(74.5 * 2.7 * 100) + 500)

    // Editing the opening balance edits the Init.
    const updated = yield* h.client.wallets.update({ path: { id: card.id }, payload: { initMinor: minor(20_000), name: "Main card" } })
    expect(updated.name).toBe("Main card")
    expect(updated.initMinor).toBe(20_000)
    expect(updated.balanceMinor).toBe(17_450)

    // Reorder must list every Wallet exactly once.
    yield* h.client.wallets.reorder({ payload: { ids: [cash.id, card.id] } })
    expect((yield* h.client.wallets.list()).wallets.map((w) => w.id)).toEqual([cash.id, card.id])
    const bad = yield* h.client.wallets.reorder({ payload: { ids: [cash.id] } }).pipe(Effect.flip)
    expect(bad._tag).toBe("RuleViolation")
  })
)

it.scoped("deleting a Wallet removes its Init, unassigns its Changes and collapses its Exchanges", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness()
    const card = yield* h.client.wallets.create({ payload: { name: "Card", currency: usd, initMinor: minor(50_000) } })
    const cash = yield* h.client.wallets.create({ payload: { name: "Cash", currency: gel, initMinor: minor(0) } })

    const coffee = yield* h.client.transactions.createChange({
      payload: { walletId: card.id, amountMinor: minor(-450), occurredOn: day("2026-09-02") }
    })
    const legs = yield* h.client.transactions.createExchange({
      payload: {
        sourceWalletId: card.id,
        sourceMinor: minor(10_000),
        targetWalletId: cash.id,
        targetMinor: minor(27_000),
        occurredOn: day("2026-09-03"),
        description: "atm"
      }
    })
    expect(legs).toHaveLength(2)
    expect(legs.map((l) => l.amountMinor).sort((a, b) => a - b)).toEqual([-10_000, 27_000])
    expect((yield* h.client.wallets.list()).wallets.find((w) => w.id === cash.id)?.balanceMinor).toBe(27_000)

    yield* h.client.wallets.delete({ path: { id: card.id } })

    const wallets = yield* h.client.wallets.list()
    expect(wallets.wallets.map((w) => w.id)).toEqual([cash.id])
    // Cash keeps its money: the surviving leg is now a Change.
    expect(wallets.wallets[0]!.balanceMinor).toBe(27_000)

    const all = yield* h.client.transactions.list({ urlParams: { from: day("2026-01-01"), to: day("2026-12-31") } })
    // Only Cash's Init survives; the Card's Init and both Exchange legs are gone.
    expect(all.filter((t) => t.type === "init").map((t) => t.walletId)).toEqual([cash.id])
    expect(all.map((t) => t.type)).not.toContain("exchange")
    const orphan = all.find((t) => t.id === coffee.id)!
    expect(orphan.walletId).toBeNull()
    expect(orphan.currency).toBe("USD")
    const collapsed = all.find((t) => t.walletId === cash.id && t.amountMinor === 27_000)!
    expect(collapsed.type).toBe("change")
    expect(collapsed.exchangeId).toBeNull()
    expect(collapsed.description).toBe("atm")
    const today = new Date().toISOString().slice(0, 10) as LocalDate
    expect(collapsed.tags).toEqual([walletDeleteTag("USD", today)])
    expect(walletDeleteTag("USD", day("2026-09-12"))).toBe("wallet_usd_delete_12.09.2026")

    const gone = yield* h.client.wallets.delete({ path: { id: "00000000-0000-4000-8000-00000000dead" as WalletId } }).pipe(Effect.flip)
    expect(gone._tag).toBe("NotFound")
  })
)

it.scoped("a Wallet that does not exist is not found for update", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness()
    const ghost = "00000000-0000-4000-8000-00000000dead" as WalletId
    const missing = yield* h.client.wallets.update({ path: { id: ghost }, payload: { name: "Ghost" } }).pipe(Effect.flip)
    expect(missing._tag).toBe("NotFound")
  })
)
