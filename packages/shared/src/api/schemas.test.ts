import { Either, Schema } from "effect"
import { describe, expect, it } from "vitest"
import { CategoryId, LoanId, RecurringId, TransactionId, UserId, WalletId } from "../domain.js"
import { UpdateCategory } from "./categories.js"
import { CreateLoan, UpdateLoan } from "./loans.js"
import { CreateRecurring, UpdateRecurring } from "./recurrings.js"
import { CreateChange, CreateExchange, UpdateExchange, UpdateTransaction } from "./transactions.js"
import { UpdateWallet } from "./wallets.js"

/** Pins that an Update request accepts what its Create accepts, so the two can be composed rather than copied. */

const decodeEither = <A, I>(schema: Schema.Schema<A, I>, input: unknown) => Schema.decodeUnknownEither(schema)(input)
const accepts = <A, I>(schema: Schema.Schema<A, I>, input: unknown): boolean => Either.isRight(decodeEither(schema, input))
const roundTrip = <A, I>(schema: Schema.Schema<A, I>, input: I): I => Schema.encodeSync(schema)(Schema.decodeUnknownSync(schema)(input))
const failureText = <A, I>(schema: Schema.Schema<A, I>, input: unknown): string =>
  Either.match(decodeEither(schema, input), { onLeft: (e) => e.message, onRight: () => "" })

const wallet = "11111111-1111-4111-8111-111111111111"
const other = "22222222-2222-4222-8222-222222222222"

describe("UpdateExchange", () => {
  const sample = { sourceWalletId: wallet, sourceMinor: 1000, targetWalletId: other, targetMinor: 900, occurredOn: "2026-09-14", description: "swap", tags: ["fx"] }

  it("accepts exactly what CreateExchange accepts and encodes the same JSON", () => {
    expect(roundTrip(UpdateExchange, sample)).toEqual(roundTrip(CreateExchange, sample))
    expect(accepts(UpdateExchange, sample)).toBe(true)
  })

  it("rejects a negative sourceMinor like CreateExchange does", () => {
    const negative = { ...sample, sourceMinor: -1 }
    expect(accepts(CreateExchange, negative)).toBe(false)
    expect(accepts(UpdateExchange, negative)).toBe(false)
  })

  it("requires the same fields as CreateExchange", () => {
    const { occurredOn: _, ...missing } = sample
    expect(accepts(CreateExchange, missing)).toBe(false)
    expect(accepts(UpdateExchange, missing)).toBe(false)
  })
})

describe("UpdateRecurring", () => {
  const full = { name: "Rent", walletId: wallet, amountMinor: -120000, categoryId: null, description: "flat", tags: ["home"], auto: true, cron: "0 0 1 * *", nextOn: null }

  it("accepts an empty patch and each single field CreateRecurring accepts", () => {
    expect(accepts(UpdateRecurring, {})).toBe(true)
    for (const [key, value] of Object.entries(full)) {
      expect(accepts(UpdateRecurring, { [key]: value }), key).toBe(true)
    }
    expect(accepts(CreateRecurring, full)).toBe(true)
  })

  it("keeps every field of CreateRecurring and no other", () => {
    expect(Object.keys(UpdateRecurring.fields).sort()).toEqual(Object.keys(CreateRecurring.fields).sort())
  })

  it("rejects a zero amountMinor with the same message as CreateRecurring", () => {
    expect(failureText(UpdateRecurring, { amountMinor: 0 })).toContain("amount cannot be zero")
    expect(failureText(CreateRecurring, { ...full, amountMinor: 0 })).toContain("amount cannot be zero")
  })

  it("rejects a blank name and an unknown Wallet id", () => {
    expect(accepts(UpdateRecurring, { name: "  " })).toBe(false)
    expect(accepts(UpdateRecurring, { walletId: "not-a-uuid" })).toBe(false)
  })

  it("leaves an omitted field undefined, so a handler can tell 'unchanged' from 'cleared'", () => {
    const patch = Schema.decodeUnknownSync(UpdateRecurring)({ categoryId: null })
    expect(patch.categoryId).toBeNull()
    expect(patch.name).toBeUndefined()
    expect("name" in Schema.encodeSync(UpdateRecurring)(patch)).toBe(false)
  })
})

describe("UpdateLoan", () => {
  it("accepts `archived` alone and each field of CreateLoan", () => {
    expect(accepts(UpdateLoan, { archived: true })).toBe(true)
    expect(accepts(UpdateLoan, { amountMinor: -500 })).toBe(true)
    expect(accepts(UpdateLoan, { currency: "EUR" })).toBe(true)
    expect(accepts(UpdateLoan, { description: "Anna" })).toBe(true)
  })

  it("accepts a zero amount, which CreateLoan refuses: a settled Loan may be edited to zero", () => {
    expect(accepts(UpdateLoan, { amountMinor: 0 })).toBe(true)
    expect(failureText(CreateLoan, { amountMinor: 0, currency: "EUR" })).toContain("amount cannot be zero")
  })
})

describe("UpdateCategory", () => {
  it("accepts a rename alone, never a Category Type", () => {
    expect(accepts(UpdateCategory, { name: "Groceries" })).toBe(true)
    expect(accepts(UpdateCategory, {})).toBe(true)
    expect("type" in UpdateCategory.fields).toBe(false)
  })

  it("applies the Category name limit and the Slug shape", () => {
    expect(accepts(UpdateCategory, { name: "x".repeat(26) })).toBe(false)
    expect(accepts(UpdateCategory, { slug: "Not A Slug" })).toBe(false)
  })
})

describe("UpdateWallet", () => {
  it("accepts a rename or a new Init amount, never a currency", () => {
    expect(accepts(UpdateWallet, { name: "Cash" })).toBe(true)
    expect(accepts(UpdateWallet, { initMinor: 0 })).toBe(true)
    expect(accepts(UpdateWallet, { name: " " })).toBe(false)
    expect(Object.keys(UpdateWallet.fields).sort()).toEqual(["initMinor", "name"])
  })
})

describe("UpdateTransaction", () => {
  it("accepts every field of CreateChange plus currency, each alone", () => {
    for (const key of Object.keys(CreateChange.fields)) expect(key in UpdateTransaction.fields, key).toBe(true)
    expect(accepts(UpdateTransaction, { currency: "USD" })).toBe(true)
    expect(accepts(UpdateTransaction, { amountMinor: 0 })).toBe(true)
    expect(accepts(UpdateTransaction, { categoryId: null })).toBe(true)
    expect(accepts(UpdateTransaction, {})).toBe(true)
  })
})

describe("CreateChange", () => {
  const change = { walletId: wallet, amountMinor: -450, occurredOn: "2026-09-14" }

  it("accepts a bare Change and lower-cases its Tags", () => {
    expect(Schema.decodeUnknownSync(CreateChange)({ ...change, tags: ["Food"] }).tags).toEqual(["food"])
  })

  it("takes a zero amount at the schema level; the api's rule refuses it", () => {
    expect(accepts(CreateChange, { ...change, amountMinor: 0 })).toBe(true)
  })

  it("rejects a Tag with whitespace and a fractional amount", () => {
    expect(accepts(CreateChange, { ...change, tags: ["two words"] })).toBe(false)
    expect(accepts(CreateChange, { ...change, amountMinor: 1.5 })).toBe(false)
  })
})

describe("branded ids", () => {
  it.each([
    ["UserId", UserId],
    ["WalletId", WalletId],
    ["CategoryId", CategoryId],
    ["TransactionId", TransactionId],
    ["RecurringId", RecurringId],
    ["LoanId", LoanId]
  ])("%s accepts a UUID and rejects anything else", (_name, schema) => {
    expect(accepts(schema, wallet)).toBe(true)
    expect(accepts(schema, "42")).toBe(false)
    expect(accepts(schema, 42)).toBe(false)
  })
})
