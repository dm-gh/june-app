import { useEffect, useMemo, useState } from "react"
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router"
import { AnalysisPage } from "./components/analysis/AnalysisPage"
import { BreakdownPage } from "./components/analysis/BreakdownPage"
import { RequireAuth, SignInPage } from "./components/auth/SignInPage"
import { AddLoanPage, EditLoanPage } from "./components/more/LoanFormPage"
import { LoanPage } from "./components/more/LoanPage"
import { LoansArchivePage } from "./components/more/LoansArchivePage"
import { MorePage } from "./components/more/MorePage"
import { AddRecurringPage, EditRecurringPage } from "./components/more/RecurringFormPage"
import { RecurringPage } from "./components/more/RecurringPage"
import { AddCategoryPage, EditCategoryPage } from "./components/settings/CategoryFormPage"
import { ImportPage } from "./components/settings/ImportPage"
import { SettingsPage } from "./components/settings/SettingsPage"
import { ShortcutPage } from "./components/settings/ShortcutPage"
import { AddWalletPage, EditWalletPage } from "./components/settings/WalletFormPage"
import { AddTransactionPage } from "./components/transactions/AddTransactionPage"
import { BulkEditPage } from "./components/transactions/BulkEditPage"
import { EditTransactionPage } from "./components/transactions/TransactionPage"
import { TransactionsPage } from "./components/transactions/TransactionsPage"
import { type Filter, FilterContext, parseFilter } from "./lib/filter"
import { monthPeriod, type Period, PeriodContext, todayLocal } from "./lib/period"
import { patterns, routes } from "./routes"

const PERIOD_KEY = "june.period"

const loadPeriod = (): Period => {
  try {
    const raw = localStorage.getItem(PERIOD_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Period
      if (typeof p.from === "string" && typeof p.to === "string") return p
    }
  } catch {
    // ignore
  }
  return monthPeriod(todayLocal())
}

/** The one selected period, shared by Transactions and Analysis and remembered per browser. */
function PeriodProvider({ children }: { children: React.ReactNode }) {
  const [period, setPeriod] = useState<Period>(loadPeriod)
  useEffect(() => {
    try {
      localStorage.setItem(PERIOD_KEY, JSON.stringify(period))
    } catch {
      // ignore
    }
  }, [period])
  const value = useMemo(() => ({ period, setPeriod }), [period])
  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>
}

/** The one Filter shared by Transactions and Analysis. A link's params seed it; the pages mirror it back into the URL. */
function FilterProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [filter, setFilter] = useState<Filter>(() => parseFilter(new URLSearchParams(location.search)))
  const value = useMemo(() => ({ filter, setFilter }), [filter])
  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={routes.signIn} element={<SignInPage />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <PeriodProvider>
                <FilterProvider>
                <Routes>
                  <Route index element={<Navigate to={routes.transactions} replace />} />
                  <Route path={routes.transactions} element={<TransactionsPage />} />
                  <Route path={routes.addTransaction()} element={<AddTransactionPage />} />
                  <Route path={routes.bulkEdit} element={<BulkEditPage />} />
                  <Route path={patterns.transaction} element={<EditTransactionPage />} />
                  <Route path={routes.analysis} element={<AnalysisPage />} />
                  <Route path={routes.breakdown("categories")} element={<BreakdownPage dimension="categories" />} />
                  <Route path={routes.breakdown("categories", "income")} element={<BreakdownPage dimension="categories" side="income" />} />
                  <Route path={routes.breakdown("wallets")} element={<BreakdownPage dimension="wallets" />} />
                  <Route path={routes.breakdown("tags")} element={<BreakdownPage dimension="tags" />} />
                  <Route path={routes.more} element={<MorePage />} />
                  <Route path={routes.addRecurring} element={<AddRecurringPage />} />
                  <Route path={patterns.recurring} element={<RecurringPage />} />
                  <Route path={patterns.editRecurring} element={<EditRecurringPage />} />
                  <Route path={routes.addLoan} element={<AddLoanPage />} />
                  <Route path={routes.loansArchive} element={<LoansArchivePage />} />
                  <Route path={patterns.loan} element={<LoanPage />} />
                  <Route path={patterns.editLoan} element={<EditLoanPage />} />
                  <Route path={routes.settings} element={<SettingsPage />} />
                  <Route path={routes.shortcut} element={<ShortcutPage />} />
                  <Route path={routes.importCsv} element={<ImportPage />} />
                  <Route path={routes.addWallet} element={<AddWalletPage />} />
                  <Route path={patterns.wallet} element={<EditWalletPage />} />
                  <Route path={routes.addCategory} element={<AddCategoryPage />} />
                  <Route path={patterns.category} element={<EditCategoryPage />} />
                  <Route path="*" element={<Navigate to={routes.transactions} replace />} />
                </Routes>
                </FilterProvider>
              </PeriodProvider>
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
