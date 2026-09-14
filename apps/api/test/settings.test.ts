import { it } from "@effect/vitest"
import type { CurrencyCode, LocalDate, MinorAmount } from "@june/shared"
import { Effect } from "effect"
import { expect } from "vitest"
import { makeHarness, testUser } from "./harness.js"

const usd = "USD" as CurrencyCode
const gel = "GEL" as CurrencyCode
const minor = (n: number) => n as MinorAmount
const period = { from: "2026-01-01" as LocalDate, to: "2026-12-31" as LocalDate }

it.scoped("me is the signed-in User with their Default Currency and whether a Capture Token exists", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness()
    const me = yield* h.client.settings.me()
    expect(me).toEqual({ ...testUser, hasCaptureToken: true })

    yield* h.sql`delete from capture_token where user_id = ${h.userId}`
    expect((yield* h.client.settings.me()).hasCaptureToken).toBe(false)
  })
)

it.scoped("changing the Default Currency changes me and every converted amount from then on", () =>
  Effect.gen(function* () {
    const h = yield* makeHarness()
    const card = yield* h.client.wallets.create({ payload: { name: "Card", currency: usd, initMinor: minor(10_000) } })
    yield* h.client.transactions.createChange({ payload: { walletId: card.id, amountMinor: minor(-450), occurredOn: "2026-09-10" as LocalDate } })
    expect((yield* h.client.wallets.list()).totalDefaultMinor).toBe(9_550)

    const changed = yield* h.client.settings.setDefaultCurrency({ payload: { currency: gel } })
    expect(changed.defaultCurrency).toBe("GEL")
    expect((yield* h.client.settings.me()).defaultCurrency).toBe("GEL")

    // 95.50 USD at 2.7 GEL per USD.
    const wallets = yield* h.client.wallets.list()
    expect(wallets.wallets[0]!.balanceDefaultMinor).toBe(25_785)
    expect(wallets.totalDefaultMinor).toBe(25_785)
    const change = (yield* h.client.transactions.list({ urlParams: period })).find((t) => t.type === "change")!
    expect(change.defaultMinor).toBe(-1_215)
  })
)
