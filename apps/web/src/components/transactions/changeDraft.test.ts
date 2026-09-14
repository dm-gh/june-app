import { CategoryId, LocalDate, MinorAmount, WalletId } from "@june/shared"
import { describe, expect, it } from "vitest"
import { categories, transaction, wallets } from "../../test/fixtures"
import { draftFromTransaction } from "./changeDraft"

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

// Referenced so the branded constructors stay imported once readChangeDraft tests land below.
void CategoryId
void LocalDate
void WalletId
