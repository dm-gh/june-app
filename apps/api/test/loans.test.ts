import { it } from "@effect/vitest"
import type { CurrencyCode, LocalDate, MinorAmount } from "@june/shared"
import { Effect } from "effect"
import { expect } from "vitest"
import { makeHarness } from "./harness.js"

const usd = "USD" as CurrencyCode
const gel = "GEL" as CurrencyCode
const minor = (n: number) => n as MinorAmount
const on = "2026-09-13" as LocalDate
const period = { from: "2026-01-01" as LocalDate, to: "2026-12-31" as LocalDate }

it.scoped("settling records a change and moves the loan by the opposite amount, archiving at zero and flipping past it", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness()
    const card = yield* h.client.wallets.create({ payload: { name: "Card", currency: usd, initMinor: minor(0) } })
    const lari = yield* h.client.wallets.create({ payload: { name: "Lari", currency: gel, initMinor: minor(0) } })

    const sister = yield* h.client.loans.create({ payload: { amountMinor: minor(100000), currency: usd, description: "Sister" } })
    expect(sister).toMatchObject({ amountMinor: 100000, currency: "USD", archived: false })

    // Lend 300 more: money leaves the wallet, the loan grows.
    const lentMore = yield* h.client.loans.settle({ path: { id: sister.id }, payload: { change: { walletId: card.id, amountMinor: minor(-30000), occurredOn: on } } })
    expect(lentMore.amountMinor).toBe(130000)
    // She returns 500.
    const returned = yield* h.client.loans.settle({ path: { id: sister.id }, payload: { change: { walletId: card.id, amountMinor: minor(50000), occurredOn: on, description: "Back" } } })
    expect(returned.amountMinor).toBe(80000)
    // Returning more than remains flips Lent into Borrowed; nothing is archived.
    const flipped = yield* h.client.loans.settle({ path: { id: sister.id }, payload: { change: { walletId: card.id, amountMinor: minor(90000), occurredOn: on } } })
    expect(flipped).toMatchObject({ amountMinor: -10000, archived: false })
    // Exactly to zero archives.
    const settled = yield* h.client.loans.settle({ path: { id: sister.id }, payload: { change: { walletId: card.id, amountMinor: minor(-10000), occurredOn: on } } })
    expect(settled).toMatchObject({ amountMinor: 0, archived: true })

    const changes = (yield* h.client.transactions.list({ urlParams: period })).filter((t) => t.type === "change")
    expect(changes).toHaveLength(4)
    expect(changes.every((t) => t.hiddenFromAnalysis && t.walletId === card.id)).toBe(true)
    expect(changes.find((t) => t.description === "Back")!.amountMinor).toBe(50000)
    const wallets = yield* h.client.wallets.list()
    expect(wallets.wallets.find((w) => w.id === card.id)!.balanceMinor).toBe(100000)

    // A wallet in another currency cannot settle, and nothing is written when it is refused.
    const wrong = yield* h.client.loans
      .settle({ path: { id: sister.id }, payload: { change: { walletId: lari.id, amountMinor: minor(1000), occurredOn: on } } })
      .pipe(Effect.flip)
    expect(wrong._tag).toBe("RuleViolation")
    expect((yield* h.client.transactions.list({ urlParams: period })).filter((t) => t.type === "change")).toHaveLength(4)

    // Hidden can be switched off for a settlement, and a loan edits to any value.
    const shown = yield* h.client.loans.settle({ path: { id: sister.id }, payload: { change: { walletId: card.id, amountMinor: minor(500), occurredOn: on, hiddenFromAnalysis: false } } })
    expect(shown.amountMinor).toBe(-500)
    const edited = yield* h.client.loans.update({ path: { id: sister.id }, payload: { amountMinor: minor(0), archived: false } })
    expect(edited).toMatchObject({ amountMinor: 0, archived: false })
    const zero = yield* h.client.loans.create({ payload: { amountMinor: minor(0), currency: usd } }).pipe(Effect.flip)
    expect(["ParseError", "HttpApiDecodeError"]).toContain(zero._tag) // the typed client refuses it before the server can

    yield* h.client.loans.delete({ path: { id: sister.id } })
    expect(yield* h.client.loans.list()).toHaveLength(0)
    const gone = yield* h.client.loans.delete({ path: { id: sister.id } }).pipe(Effect.flip)
    expect(gone._tag).toBe("NotFound")
  })
)
