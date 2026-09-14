import { ExchangeId, LoanId, RecurringId, TransactionId } from "@june/shared"
import { describe, expect, it, vi } from "vitest"

// The client builds a typed HTTP client against window.location at import time; none of that is under test here.
vi.mock("./client", () => ({ api: {}, run: () => Promise.reject(new Error("no network in unit tests")) }))

const { invalidates, keys } = await import("./queries")

const sample = { from: "2026-09-01", to: "2026-09-30" } as never
const id = "11111111-1111-4111-8111-111111111111"

describe("keys", () => {
  it("start every query key with the key's own name, so a name is a valid invalidation root", () => {
    const built = {
      ...keys,
      transactions: keys.transactions(sample),
      transaction: keys.transaction(TransactionId.make(id)),
      exchange: keys.exchange(ExchangeId.make(id)),
      recurring: keys.recurring(RecurringId.make(id)),
      loan: keys.loan(LoanId.make(id))
    }
    for (const [name, key] of Object.entries(built)) expect(key[0]).toBe(name)
  })

  it("accept no Exchange for the disabled query without inventing an id", () => {
    expect(keys.exchange(null)).toEqual(["exchange", null])
  })
})

describe("invalidation roots", () => {
  it("refresh every money root when a Change, Exchange, Wallet or import is recorded", () => {
    expect(invalidates.money).toEqual(expect.arrayContaining(["transactions", "transaction", "exchange", "wallets", "tags", "recurrings", "recurring", "attention"]))
  })

  it("refresh the Exchange query with the Default Currency, since an Exchange carries defaultMinor", () => {
    expect(invalidates.defaultCurrency).toEqual(expect.arrayContaining(["me", "transactions", "transaction", "exchange", "wallets"]))
  })

  it("refresh Recurrings when a Category changes or goes, since a Recurring's Category is set null on delete", () => {
    expect(invalidates.category).toEqual(expect.arrayContaining(["categories", "transactions", "transaction", "recurrings", "recurring"]))
  })

  it("keep the Recurring and Loan roots to their own lists and pages", () => {
    expect(invalidates.recurring).toEqual(["recurrings", "recurring", "attention"])
    expect(invalidates.loan).toEqual(["loans", "loan"])
  })

  it("name only roots that exist among the keys", () => {
    for (const roots of Object.values(invalidates)) for (const root of roots) expect(Object.keys(keys)).toContain(root)
  })
})
