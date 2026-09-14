import type { CategoryId, LoanId, RecurringId, TransactionId, WalletId } from "@june/shared"
import type { Side } from "./components/analysis/analysis"
import type { Dimension } from "./components/analysis/BreakdownList"

/** What Add transaction is opened for: a Recurring's Edit & submit, or a Loan's Settle. Plain Add carries neither. */
export type Prefill = { readonly recurring: RecurringId } | { readonly loan: LoanId }

/** The `?recurring=` / `?loan=` protocol of Add transaction, read back from its search params. */
export const prefillFrom = (params: URLSearchParams): Prefill | null => {
  const recurring = params.get("recurring")
  if (recurring) return { recurring: recurring as RecurringId }
  const loan = params.get("loan")
  if (loan) return { loan: loan as LoanId }
  return null
}

/**
 * The patterns App.tsx matches for pages that open one thing by id. Absolute, since the signed-in
 * `<Routes>` sits under the `/*` gate and so sees the whole pathname; `routes` fills them in.
 */
export const patterns = {
  transaction: "/transactions/:id",
  recurring: "/more/recurrings/:id",
  editRecurring: "/more/recurrings/:id/edit",
  loan: "/more/loans/:id",
  editLoan: "/more/loans/:id/edit",
  wallet: "/settings/wallets/:id",
  category: "/settings/categories/:id"
} as const

const fill = <Id extends string>(pattern: string) => (id: Id) => pattern.replace(":id", id)

/** Every link in the app. A fixed page is its path; a page that opens one thing is a builder from its id. */
export const routes = {
  signIn: "/sign-in",
  analysis: "/analysis",
  /** The All page behind an Analysis section; income categories have a page of their own. */
  breakdown: (dimension: Dimension, side: Side = "expense"): string =>
    dimension === "categories" && side === "income" ? "/analysis/categories/income" : `/analysis/${dimension}`,
  transactions: "/transactions",
  /** Add transaction, prefilled from a Recurring or a Loan when given one. */
  addTransaction: (prefill?: Prefill): string =>
    prefill === undefined ? "/transactions/new" : "recurring" in prefill ? `/transactions/new?recurring=${prefill.recurring}` : `/transactions/new?loan=${prefill.loan}`,
  bulkEdit: "/transactions/bulk-edit",
  transaction: fill<TransactionId>(patterns.transaction),
  more: "/more",
  addRecurring: "/more/recurrings/new",
  recurring: fill<RecurringId>(patterns.recurring),
  editRecurring: fill<RecurringId>(patterns.editRecurring),
  addLoan: "/more/loans/new",
  loansArchive: "/more/loans/archive",
  loan: fill<LoanId>(patterns.loan),
  editLoan: fill<LoanId>(patterns.editLoan),
  settings: "/settings",
  shortcut: "/settings/shortcut",
  importCsv: "/settings/import",
  addWallet: "/settings/wallets/new",
  wallet: fill<WalletId>(patterns.wallet),
  addCategory: "/settings/categories/new",
  category: fill<CategoryId>(patterns.category)
} as const
