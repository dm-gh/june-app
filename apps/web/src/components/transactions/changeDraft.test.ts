import { MinorAmount } from "@june/shared"
import { Either } from "effect"
import { describe, expect, it } from "vitest"
import { categories, transaction, wallets } from "../../test/fixtures"
import { type ChangeDraft, draftFromTransaction, readAmount, readChangeDraft } from "./changeDraft"

describe("draftFromTransaction", () => {
  it("splits the amount into an unsigned major-unit text and a sign, and reads the ids as empty strings when null", () => {
    expect(draftFromTransaction(transaction())).toEqual({
      sign: "-",
      amount: "42.50",
      currency: "USD",
      walletId: wallets.card.id,
      categoryId: categories.groceries.id,
      date: "2026-09-10",
      description: "Weekly shop",
      tags: ["food", "weekly"],
      hidden: false
    })
    expect(draftFromTransaction(transaction({ amountMinor: MinorAmount.make(240000), walletId: null, categoryId: null, hiddenFromAnalysis: true }))).toMatchObject({
      sign: "+",
      amount: "2400.00",
      walletId: "",
      categoryId: "",
      hidden: true
    })
  })

  it("uses the currency's own decimals and reads zero as income", () => {
    expect(draftFromTransaction(transaction({ amountMinor: MinorAmount.make(-1500), currency: "JPY" as never }))).toMatchObject({ sign: "-", amount: "1500" })
    expect(draftFromTransaction(transaction({ type: "init", amountMinor: MinorAmount.make(0) }))).toMatchObject({ sign: "+", amount: "0.00" })
  })
})

describe("readAmount", () => {
  it("reads the unsigned text into signed minor units", () => {
    expect(readAmount("-", "42.50", "USD")).toEqual(Either.right(-4250))
    expect(readAmount("+", "1500", "JPY")).toEqual(Either.right(1500))
    expect(readAmount("+", "0.1", "USD")).toEqual(Either.right(10))
  })

  it("asks for an amount when the text is blank or zero", () => {
    expect(readAmount("-", "", "USD")).toEqual(Either.left("Enter an amount"))
    expect(readAmount("-", "   ", "USD")).toEqual(Either.left("Enter an amount"))
    expect(readAmount("-", "0", "USD")).toEqual(Either.left("Enter an amount"))
    expect(readAmount("+", "0.00", "USD")).toEqual(Either.left("Enter an amount"))
  })

  it("allows zero for an opening balance or a settled Loan, but still not a blank", () => {
    expect(readAmount("+", "0", "USD", { allowZero: true })).toEqual(Either.right(0))
    expect(readAmount("-", "0.00", "USD", { allowZero: true })).toEqual(Either.right(0))
    expect(readAmount("+", "", "USD", { allowZero: true })).toEqual(Either.left("Enter an amount"))
  })

  it("passes toMinor's own message through for too many decimals or a non-number", () => {
    expect(readAmount("-", "1.005", "USD")).toEqual(Either.left("USD allows at most 2 decimals"))
    expect(readAmount("-", "abc", "USD")).toEqual(Either.left("amount must be a finite number"))
  })
})

const draft = (over: Partial<ChangeDraft> = {}): ChangeDraft => ({ ...draftFromTransaction(transaction()), description: "  Weekly shop ", ...over })

describe("readChangeDraft", () => {
  it("reads a full draft into the payload a Change is created or updated with", () => {
    expect(readChangeDraft(draft())).toEqual(
      Either.right({
        walletId: wallets.card.id,
        amountMinor: -4250,
        currency: "USD",
        categoryId: categories.groceries.id,
        description: "Weekly shop",
        tags: ["food", "weekly"],
        occurredOn: "2026-09-10",
        hiddenFromAnalysis: false
      })
    )
  })

  it("reads Uncategorised as a null Category and income as a positive amount", () => {
    expect(readChangeDraft(draft({ sign: "+", categoryId: "", hidden: true }))).toMatchObject(Either.right({ amountMinor: 4250, categoryId: null, hiddenFromAnalysis: true }))
  })

  it("leaves out the date and Hidden when the draft has none, as a Recurring's does", () => {
    const { date: _date, hidden: _hidden, ...fields } = draft()
    expect(readChangeDraft(fields)).toEqual(
      Either.right({ walletId: wallets.card.id, amountMinor: -4250, currency: "USD", categoryId: categories.groceries.id, description: "Weekly shop", tags: ["food", "weekly"] })
    )
  })

  it("collects an amount error and a missing Wallet under their field names", () => {
    expect(readChangeDraft(draft({ amount: "" }))).toEqual(Either.left({ amount: "Enter an amount" }))
    expect(readChangeDraft(draft({ amount: "1.005" }))).toEqual(Either.left({ amount: "USD allows at most 2 decimals" }))
    expect(readChangeDraft(draft({ currency: "EUR", walletId: "" }))).toEqual(Either.left({ wallet: "Create a EUR wallet first" }))
    expect(readChangeDraft(draft({ amount: "", currency: "EUR", walletId: "" }))).toEqual(Either.left({ amount: "Enter an amount", wallet: "Create a EUR wallet first" }))
  })

  it("lets an opening balance be zero", () => {
    expect(readChangeDraft(draft({ amount: "0.00" }), { allowZero: true })).toMatchObject(Either.right({ amountMinor: 0 }))
    expect(readChangeDraft(draft({ amount: "0.00" }))).toEqual(Either.left({ amount: "Enter an amount" }))
  })
})
