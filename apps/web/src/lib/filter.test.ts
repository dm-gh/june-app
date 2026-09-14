import type { Transaction, Wallet } from "@june/shared"
import { describe, expect, it } from "vitest"
import type { ListItem } from "../components/transactions/listItems"
import { categories, transaction, wallets } from "../test/fixtures"
import {
  emptyFilter,
  filterItems,
  filterParams,
  filterRows,
  filterSearch,
  hasFilterParams,
  itemMatches,
  kindOf,
  matchesFilter,
  parseFilter,
  slugLookup,
  summarise,
  toggleIn,
  UNASSIGNED,
  UNCATEGORISED,
  walletOptions,
  type Filter
} from "./filter"

const tx = (over: Record<string, unknown> = {}): Transaction => transaction(over as unknown as Partial<Transaction>)
const filter = (over: Partial<Filter>): Filter => ({ ...emptyFilter, ...over })
const slugOf = slugLookup([categories.groceries, categories.salary])

const expense = tx()
const income = tx({ amountMinor: 100000, categoryId: categories.salary.id, tags: [] })
const init = tx({ type: "init", amountMinor: 100000, categoryId: null, tags: [] })
const exchangeLeg = tx({ type: "exchange", exchangeId: "88888888-8888-4888-8888-888888888888", categoryId: null, tags: [] })
const unassigned = tx({ walletId: null })
const uncategorised = tx({ categoryId: null })
const unknownCategory = tx({ categoryId: "99999999-9999-4999-8999-999999999999" })
const cashRow = tx({ walletId: wallets.cash.id, currency: "EUR" })

describe("kindOf", () => {
  it("reads a negative Change as expense and a positive one as income", () => {
    expect(kindOf(expense)).toBe("expense")
    expect(kindOf(income)).toBe("income")
  })

  it("counts an Init as income whatever its sign, and an Exchange as exchange", () => {
    expect(kindOf(init)).toBe("income")
    expect(kindOf(tx({ type: "init", amountMinor: -500 }))).toBe("income")
    expect(kindOf(exchangeLeg)).toBe("exchange")
  })
})

describe("matchesFilter", () => {
  it("keeps every Transaction under an empty Filter", () => {
    for (const t of [expense, income, init, exchangeLeg, unassigned, uncategorised]) expect(matchesFilter(t, emptyFilter, slugOf)).toBe(true)
  })

  it("deselecting a Transaction Type hides only that Type; income covers Init", () => {
    expect(matchesFilter(expense, filter({ types: ["expense"] }), slugOf)).toBe(false)
    expect(matchesFilter(income, filter({ types: ["expense"] }), slugOf)).toBe(true)
    expect(matchesFilter(init, filter({ types: ["income"] }), slugOf)).toBe(false)
    expect(matchesFilter(exchangeLeg, filter({ types: ["exchange"] }), slugOf)).toBe(false)
    expect(matchesFilter(exchangeLeg, filter({ types: ["expense", "income"] }), slugOf)).toBe(true)
  })

  it("deselecting a Category by slug hides its Changes", () => {
    expect(matchesFilter(expense, filter({ categories: ["groceries"] }), slugOf)).toBe(false)
    expect(matchesFilter(uncategorised, filter({ categories: ["groceries"] }), slugOf)).toBe(true)
  })

  it("deselecting Uncategorised hides Changes without a Category or with an unknown one", () => {
    expect(matchesFilter(uncategorised, filter({ categories: [UNCATEGORISED] }), slugOf)).toBe(false)
    expect(matchesFilter(unknownCategory, filter({ categories: [UNCATEGORISED] }), slugOf)).toBe(false)
    expect(matchesFilter(expense, filter({ categories: [UNCATEGORISED] }), slugOf)).toBe(true)
  })

  it("Category chips apply to Changes only: an Init or Exchange leg is never Uncategorised", () => {
    expect(matchesFilter(init, filter({ categories: [UNCATEGORISED] }), slugOf)).toBe(true)
    expect(matchesFilter(exchangeLeg, filter({ categories: [UNCATEGORISED] }), slugOf)).toBe(true)
  })

  it("deselecting a Wallet hides its rows; Unassigned is its own key", () => {
    expect(matchesFilter(expense, filter({ wallets: [wallets.card.id] }), slugOf)).toBe(false)
    expect(matchesFilter(cashRow, filter({ wallets: [wallets.card.id] }), slugOf)).toBe(true)
    expect(matchesFilter(unassigned, filter({ wallets: [UNASSIGNED] }), slugOf)).toBe(false)
    expect(matchesFilter(expense, filter({ wallets: [UNASSIGNED] }), slugOf)).toBe(true)
  })

  it("deselecting any one of a row's Tags hides it", () => {
    expect(matchesFilter(expense, filter({ tags: ["weekly"] }), slugOf)).toBe(false)
    expect(matchesFilter(expense, filter({ tags: ["other"] }), slugOf)).toBe(true)
  })

  // Pinned as-is: the Filter compares Tags exactly, so a differently-cased key does not match.
  it("compares Tag keys case-sensitively", () => {
    expect(matchesFilter(expense, filter({ tags: ["Food"] }), slugOf)).toBe(true)
  })
})

describe("itemMatches for an Exchange item", () => {
  const source = tx({ type: "exchange", exchangeId: "e", amountMinor: -1000, walletId: wallets.card.id, categoryId: null, tags: ["fx"] })
  const target = tx({ type: "exchange", exchangeId: "e", amountMinor: 900, walletId: wallets.cash.id, currency: "EUR", categoryId: null, tags: ["fx"] })
  const item: ListItem = { kind: "exchange", source, target }

  it("stays while either of its Wallets is selected", () => {
    expect(itemMatches(item, filter({ wallets: [wallets.card.id] }), slugOf)).toBe(true)
    expect(itemMatches(item, filter({ wallets: [wallets.cash.id] }), slugOf)).toBe(true)
    expect(itemMatches(item, filter({ wallets: [wallets.card.id, wallets.cash.id] }), slugOf)).toBe(false)
  })

  it("goes when the exchange Type or one of its Tags is deselected, ignoring Category chips", () => {
    expect(itemMatches(item, filter({ types: ["exchange"] }), slugOf)).toBe(false)
    expect(itemMatches(item, filter({ tags: ["fx"] }), slugOf)).toBe(false)
    expect(itemMatches(item, filter({ categories: ["groceries", UNCATEGORISED] }), slugOf)).toBe(true)
  })

  it("delegates a single item to matchesFilter", () => {
    expect(itemMatches({ kind: "single", transaction: expense }, filter({ types: ["expense"] }), slugOf)).toBe(false)
  })
})

describe("filterItems and filterRows", () => {
  const items: ReadonlyArray<ListItem> = [
    { kind: "single", transaction: expense },
    { kind: "single", transaction: income }
  ]

  it("return a fresh copy under an empty Filter", () => {
    expect(filterItems(items, emptyFilter, slugOf)).toEqual(items)
    expect(filterItems(items, emptyFilter, slugOf)).not.toBe(items)
    expect(filterRows([expense, income], emptyFilter, slugOf)).toEqual([expense, income])
  })

  it("drop what the Filter deselects, keeping order", () => {
    expect(filterItems(items, filter({ types: ["expense"] }), slugOf)).toEqual([{ kind: "single", transaction: income }])
    expect(filterRows([expense, income, init], filter({ types: ["income"] }), slugOf)).toEqual([expense])
  })
})

describe("toggleIn", () => {
  it("adds a missing key, removes a present one, and never mutates the input", () => {
    const once = toggleIn(emptyFilter, "tags", "food")
    expect(once.tags).toEqual(["food"])
    expect(emptyFilter.tags).toEqual([])
    const twice = toggleIn(once, "tags", "food")
    expect(twice.tags).toEqual([])
    expect(once.tags).toEqual(["food"])
  })

  it("touches only the given dimension", () => {
    const f = toggleIn(filter({ types: ["expense"] }), "wallets", UNASSIGNED)
    expect(f).toEqual(filter({ types: ["expense"], wallets: [UNASSIGNED] }))
  })
})

describe("slugLookup", () => {
  it("maps a Category id to its slug and unknown ids to undefined", () => {
    expect(slugOf(categories.groceries.id)).toBe("groceries")
    expect(slugOf("nope")).toBeUndefined()
    expect(slugLookup(undefined)(categories.groceries.id)).toBeUndefined()
  })
})

describe("Filter in the URL", () => {
  it("round-trips through filterParams and parseFilter", () => {
    const f = filter({ types: ["expense", "exchange"], categories: ["groceries", UNCATEGORISED], wallets: [wallets.card.id, UNASSIGNED], tags: ["food"] })
    expect(parseFilter(filterParams(f))).toEqual(f)
  })

  it("writes nothing for an empty Filter and reads nothing back", () => {
    expect(filterParams(emptyFilter).toString()).toBe("")
    expect(parseFilter(new URLSearchParams(""))).toEqual(emptyFilter)
    expect(filterSearch(emptyFilter)).toBe("")
  })

  it("filterSearch prefixes a question mark only when there is something to carry", () => {
    expect(filterSearch(filter({ categories: ["food"] }))).toBe("?xcat=food")
  })

  it("parseFilter drops unknown Types and blank keys", () => {
    const f = parseFilter(new URLSearchParams("xtype=init,expense&xtag=food,%20,weekly"))
    expect(f.types).toEqual(["expense"])
    expect(f.tags).toEqual(["food", "weekly"])
  })

  it("hasFilterParams sees only the Filter's own params, even when empty", () => {
    expect(hasFilterParams(new URLSearchParams("xtag=food"))).toBe(true)
    expect(hasFilterParams(new URLSearchParams("xtype="))).toBe(true)
    expect(hasFilterParams(new URLSearchParams("from=2026-09-01"))).toBe(false)
  })
})

describe("summarise", () => {
  const all = [
    { key: "a", label: "Alpha", color: "hsl(0 100% 70%)" },
    { key: "b", label: "Beta" },
    { key: "c", label: "Gamma" }
  ]

  it("says All when nothing is deselected", () => {
    expect(summarise(all, [])).toEqual({ label: "All", state: "all" })
  })

  it("names the one remaining item with its colour", () => {
    expect(summarise(all, ["b", "c"])).toEqual({ label: "Alpha", state: "one", color: "hsl(0 100% 70%)" })
  })

  it("counts the remaining items otherwise, and says None when nothing is left", () => {
    expect(summarise(all, ["c"])).toEqual({ label: "2 of 3", state: "some" })
    expect(summarise(all, ["a", "b", "c"])).toEqual({ label: "None", state: "none" })
  })
})

describe("walletOptions", () => {
  it("lists Wallets in order and Unassigned last, even with no Wallets", () => {
    const list: ReadonlyArray<Wallet> = [wallets.card, wallets.cash]
    expect(walletOptions(list)).toEqual([
      { key: wallets.card.id, label: "Card" },
      { key: wallets.cash.id, label: "Cash" },
      { key: UNASSIGNED, label: "Unassigned" }
    ])
    expect(walletOptions(undefined)).toEqual([{ key: UNASSIGNED, label: "Unassigned" }])
  })
})
