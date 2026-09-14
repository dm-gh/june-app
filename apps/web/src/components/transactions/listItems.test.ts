import type { Transaction } from "@june/shared"
import { describe, expect, it } from "vitest"
import { transaction, wallets } from "../../test/fixtures"
import { groupByDay, itemDate, itemIds, toItems, type ListItem } from "./listItems"

const tx = (over: Record<string, unknown> = {}): Transaction => transaction(over as unknown as Partial<Transaction>)
const EXCHANGE = "88888888-8888-4888-8888-888888888888"

const changeA = tx({ id: "a", occurredOn: "2026-09-10" })
const changeB = tx({ id: "b", occurredOn: "2026-09-08" })
const sourceLeg = tx({ id: "src", type: "exchange", exchangeId: EXCHANGE, amountMinor: -1000, walletId: wallets.card.id, occurredOn: "2026-09-09" })
const targetLeg = tx({ id: "tgt", type: "exchange", exchangeId: EXCHANGE, amountMinor: 900, walletId: wallets.cash.id, currency: "EUR", occurredOn: "2026-09-09" })

describe("toItems", () => {
  it("keeps Changes as single items in list order", () => {
    expect(toItems([changeA, changeB])).toEqual([
      { kind: "single", transaction: changeA },
      { kind: "single", transaction: changeB }
    ])
  })

  it("pairs both legs of an Exchange into one item at the first leg's position", () => {
    expect(toItems([changeA, sourceLeg, changeB, targetLeg])).toEqual([
      { kind: "single", transaction: changeA },
      { kind: "exchange", source: sourceLeg, target: targetLeg },
      { kind: "single", transaction: changeB }
    ])
  })

  it("takes the negative leg as the source whichever leg comes first", () => {
    expect(toItems([targetLeg, sourceLeg])).toEqual([{ kind: "exchange", source: sourceLeg, target: targetLeg }])
  })

  it("leaves a lone Exchange leg as a single item", () => {
    expect(toItems([sourceLeg])).toEqual([{ kind: "single", transaction: sourceLeg }])
  })

  it("leaves two legs with the same sign as two single items", () => {
    const other = tx({ id: "src2", type: "exchange", exchangeId: EXCHANGE, amountMinor: -50 })
    expect(toItems([sourceLeg, other])).toEqual([
      { kind: "single", transaction: sourceLeg },
      { kind: "single", transaction: other }
    ])
  })
})

describe("itemIds and itemDate", () => {
  const single: ListItem = { kind: "single", transaction: changeA }
  const exchange: ListItem = { kind: "exchange", source: sourceLeg, target: targetLeg }

  it("an Exchange item carries both legs' ids and dates by its source", () => {
    expect(itemIds(single)).toEqual(["a"])
    expect(itemIds(exchange)).toEqual(["src", "tgt"])
    expect(itemDate(single)).toBe("2026-09-10")
    expect(itemDate(exchange)).toBe("2026-09-09")
  })
})

describe("groupByDay", () => {
  it("groups items by day in first-seen order, keeping item order inside a day", () => {
    const a: ListItem = { kind: "single", transaction: changeA }
    const b: ListItem = { kind: "single", transaction: changeB }
    const c: ListItem = { kind: "single", transaction: tx({ id: "c", occurredOn: "2026-09-10" }) }
    expect(groupByDay([a, b, c])).toEqual([
      ["2026-09-10", [a, c]],
      ["2026-09-08", [b]]
    ])
  })

  it("gives no groups for no items", () => {
    expect(groupByDay([])).toEqual([])
  })
})
