import { matchPath } from "react-router"
import { describe, expect, it } from "vitest"
import { categories, loan, recurring, transaction, wallets } from "./test/fixtures"
import { patterns, prefillFrom, routes } from "./routes"

const lent = loan()
const rent = recurring()
const t = transaction()
const card = wallets.card
const groceries = categories.groceries

describe("routes", () => {
  it("names the tabs and the sign-in page", () => {
    expect(routes.signIn).toBe("/sign-in")
    expect(routes.analysis).toBe("/analysis")
    expect(routes.transactions).toBe("/transactions")
    expect(routes.more).toBe("/more")
    expect(routes.settings).toBe("/settings")
  })

  it("builds the transaction links", () => {
    expect(routes.addTransaction()).toBe("/transactions/new")
    expect(routes.bulkEdit).toBe("/transactions/bulk-edit")
    expect(routes.transaction(t.id)).toBe(`/transactions/${t.id}`)
  })

  it("builds the analysis breakdown links, income categories on their own page", () => {
    expect(routes.breakdown("categories")).toBe("/analysis/categories")
    expect(routes.breakdown("categories", "income")).toBe("/analysis/categories/income")
    expect(routes.breakdown("wallets")).toBe("/analysis/wallets")
    expect(routes.breakdown("tags")).toBe("/analysis/tags")
    expect(routes.breakdown("wallets", "income")).toBe("/analysis/wallets")
  })

  it("builds the More links", () => {
    expect(routes.addRecurring).toBe("/more/recurrings/new")
    expect(routes.recurring(rent.id)).toBe(`/more/recurrings/${rent.id}`)
    expect(routes.editRecurring(rent.id)).toBe(`/more/recurrings/${rent.id}/edit`)
    expect(routes.addLoan).toBe("/more/loans/new")
    expect(routes.loansArchive).toBe("/more/loans/archive")
    expect(routes.loan(lent.id)).toBe(`/more/loans/${lent.id}`)
    expect(routes.editLoan(lent.id)).toBe(`/more/loans/${lent.id}/edit`)
  })

  it("builds the Settings links", () => {
    expect(routes.shortcut).toBe("/settings/shortcut")
    expect(routes.importCsv).toBe("/settings/import")
    expect(routes.addWallet).toBe("/settings/wallets/new")
    expect(routes.wallet(card.id)).toBe(`/settings/wallets/${card.id}`)
    expect(routes.addCategory).toBe("/settings/categories/new")
    expect(routes.category(groceries.id)).toBe(`/settings/categories/${groceries.id}`)
  })

  it("every :id pattern matches the link its builder makes, and yields the id back", () => {
    const pairs = [
      [patterns.transaction, routes.transaction(t.id), t.id],
      [patterns.recurring, routes.recurring(rent.id), rent.id],
      [patterns.editRecurring, routes.editRecurring(rent.id), rent.id],
      [patterns.loan, routes.loan(lent.id), lent.id],
      [patterns.editLoan, routes.editLoan(lent.id), lent.id],
      [patterns.wallet, routes.wallet(card.id), card.id],
      [patterns.category, routes.category(groceries.id), groceries.id]
    ] as const
    for (const [pattern, link, id] of pairs) expect(matchPath(pattern, link)?.params.id).toBe(id)
  })
})

describe("addTransaction prefill", () => {
  it("writes the query string that prefillFrom reads back; plain Add carries nothing", () => {
    expect(routes.addTransaction({ loan: lent.id })).toBe(`/transactions/new?loan=${lent.id}`)
    expect(routes.addTransaction({ recurring: rent.id })).toBe(`/transactions/new?recurring=${rent.id}`)
    expect(prefillFrom(new URLSearchParams(routes.addTransaction({ loan: lent.id }).split("?")[1]))).toEqual({ loan: lent.id })
    expect(prefillFrom(new URLSearchParams(routes.addTransaction({ recurring: rent.id }).split("?")[1]))).toEqual({ recurring: rent.id })
    expect(prefillFrom(new URLSearchParams("type=exchange"))).toBeNull()
  })
})
