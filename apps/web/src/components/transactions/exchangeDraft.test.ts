import { Either } from "effect"
import { MinorAmount, WalletId, type Transaction } from "@june/shared"
import { describe, expect, it } from "vitest"
import { transaction, wallets } from "../../test/fixtures"
import { draftFromLegs, type ExchangeDraft, exchangePayload } from "./exchangeDraft"

const legs = (over: { source?: Partial<Transaction>; target?: Partial<Transaction> } = {}): ReadonlyArray<Transaction> => [
  transaction({ amountMinor: MinorAmount.make(-10000), walletId: wallets.card.id, currency: "USD" as never, description: "Cash for the trip", tags: ["trip"], categoryId: null, type: "exchange", ...over.source }),
  transaction({ amountMinor: MinorAmount.make(9200), walletId: wallets.cash.id, currency: "EUR" as never, description: "Cash for the trip", tags: ["trip"], categoryId: null, type: "exchange", ...over.target })
]

describe("draftFromLegs", () => {
  it("takes the Wallets and magnitudes from the negative and positive legs and the shared fields from the source", () => {
    expect(draftFromLegs(legs())).toEqual({
      source: wallets.card.id,
      target: wallets.cash.id,
      sent: "100.00",
      received: "92.00",
      date: "2026-09-10",
      description: "Cash for the trip",
      tags: ["trip"]
    })
  })

  it("is null when a leg lost its Wallet or a side is missing", () => {
    expect(draftFromLegs(legs({ target: { walletId: null } }))).toBeNull()
    expect(draftFromLegs(legs().slice(0, 1))).toBeNull()
  })
})

const draft = (over: Partial<ExchangeDraft> = {}): ExchangeDraft => ({
  source: wallets.card.id,
  target: wallets.cash.id,
  sent: "100",
  received: "92.5",
  date: "2026-09-10" as never,
  description: "  Cash for the trip ",
  tags: ["trip"],
  ...over
})
const all = [wallets.card, wallets.cash]

describe("exchangePayload", () => {
  it("signs nothing: both magnitudes are positive minor amounts, the description trimmed", () => {
    expect(exchangePayload(draft(), all)).toEqual(
      Either.right({
        sourceWalletId: wallets.card.id,
        sourceMinor: 10000,
        targetWalletId: wallets.cash.id,
        targetMinor: 9250,
        occurredOn: "2026-09-10",
        description: "Cash for the trip",
        tags: ["trip"]
      })
    )
  })

  it("copies the sent amount to the received side when both Wallets share a currency", () => {
    const other = { ...wallets.cash, id: WalletId.make("99999999-9999-4999-8999-999999999999"), currency: "USD" }
    expect(exchangePayload(draft({ target: other.id, received: "" }), [...all, other])).toMatchObject(Either.right({ sourceMinor: 10000, targetMinor: 10000 }))
  })

  it("names the missing piece: both wallets, two different ones, the sent amount, the received amount", () => {
    expect(exchangePayload(draft({ source: WalletId.make("00000000-0000-4000-8000-000000000000") }), all)).toEqual(Either.left("Pick both wallets"))
    expect(exchangePayload(draft({ target: wallets.card.id }), all)).toEqual(Either.left("Pick two different wallets"))
    expect(exchangePayload(draft({ sent: "" }), all)).toEqual(Either.left("Enter the amount sent"))
    expect(exchangePayload(draft({ received: "0" }), all)).toEqual(Either.left("Enter the amount received"))
  })

  it("passes toMinor's own message through for too many decimals", () => {
    expect(exchangePayload(draft({ sent: "1.005" }), all)).toEqual(Either.left("USD allows at most 2 decimals"))
    expect(exchangePayload(draft({ received: "1.005" }), all)).toEqual(Either.left("EUR allows at most 2 decimals"))
  })
})
