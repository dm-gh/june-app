import type { Attention, Category, Loan, Me, Recurring, Transaction, Wallet } from "@june/shared"
import { DateTime } from "effect"

/** Stable sample data for unit and screenshot tests. Every id is a fixed UUID so snapshots never move. */
const at = DateTime.unsafeMake("2026-09-10T12:00:00Z")
const cast = <T>(value: unknown) => value as T

export const wallets = {
  card: cast<Wallet>({ id: "11111111-1111-4111-8111-111111111111", name: "Card", currency: "USD", position: 0, balanceMinor: 125000, initMinor: 100000, balanceDefaultMinor: 125000 }),
  cash: cast<Wallet>({ id: "22222222-2222-4222-8222-222222222222", name: "Cash", currency: "EUR", position: 1, balanceMinor: 4000, initMinor: 5000, balanceDefaultMinor: 4300 })
}

export const categories = {
  groceries: cast<Category>({ id: "33333333-3333-4333-8333-333333333333", type: "expense", name: "Groceries", slug: "groceries", emoji: "🥕", hue: 120 }),
  salary: cast<Category>({ id: "44444444-4444-4444-8444-444444444444", type: "income", name: "Salary", slug: "salary", emoji: null, hue: 40 })
}

export const transaction = (over: Partial<Transaction> = {}): Transaction =>
  cast<Transaction>({
    id: "55555555-5555-4555-8555-555555555555",
    type: "change",
    walletId: wallets.card.id,
    amountMinor: -4250,
    currency: "USD",
    occurredOn: "2026-09-10",
    description: "Weekly shop",
    tags: ["food", "weekly"],
    hiddenFromAnalysis: false,
    categoryId: categories.groceries.id,
    exchangeId: null,
    defaultMinor: -4250,
    createdAt: at,
    updatedAt: at,
    ...over
  })

export const recurring = (over: Partial<Recurring> = {}): Recurring =>
  cast<Recurring>({
    id: "66666666-6666-4666-8666-666666666666",
    name: "Rent",
    walletId: wallets.card.id,
    amountMinor: -120000,
    currency: "USD",
    categoryId: categories.groceries.id,
    description: "Flat on Elm street",
    tags: ["home"],
    auto: true,
    cron: "0 0 1 * *",
    nextOn: "2026-10-01",
    lastFiredOn: "2026-09-01",
    createdAt: at,
    updatedAt: at,
    ...over
  })

export const loan = (over: Partial<Loan> = {}): Loan =>
  cast<Loan>({
    id: "77777777-7777-4777-8777-777777777777",
    amountMinor: 50000,
    currency: "USD",
    description: "Alex · laptop",
    archived: false,
    createdAt: at,
    updatedAt: at,
    ...over
  })

export const me = cast<Me>({
  id: "88888888-8888-4888-8888-888888888888",
  email: "june@example.com",
  name: "June",
  image: null,
  defaultCurrency: "USD",
  hasCaptureToken: true
})

/** Nothing needs attention: no banner in a page screenshot unless a test asks for one. */
export const attention = cast<Attention>({ recurringsWithoutWallet: 0, unassignedTransactions: 0 })
