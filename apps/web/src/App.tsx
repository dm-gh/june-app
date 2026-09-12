import { useEffect, useMemo, useState } from "react"
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router"
import { AnalysisPage } from "./components/analysis/AnalysisPage"
import { BreakdownPage } from "./components/analysis/BreakdownPage"
import { RequireAuth, SignInPage } from "./components/auth/SignInPage"
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
import { DesignShowcase } from "./pages/DesignShowcase"

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
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/design" element={<DesignShowcase />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <PeriodProvider>
                <FilterProvider>
                <Routes>
                  <Route index element={<Navigate to="/transactions" replace />} />
                  <Route path="transactions" element={<TransactionsPage />} />
                  <Route path="transactions/new" element={<AddTransactionPage />} />
                  <Route path="transactions/bulk-edit" element={<BulkEditPage />} />
                  <Route path="transactions/:id" element={<EditTransactionPage />} />
                  <Route path="analysis" element={<AnalysisPage />} />
                  <Route path="analysis/categories" element={<BreakdownPage dimension="categories" />} />
                  <Route path="analysis/wallets" element={<BreakdownPage dimension="wallets" />} />
                  <Route path="analysis/tags" element={<BreakdownPage dimension="tags" />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="settings/shortcut" element={<ShortcutPage />} />
                  <Route path="settings/import" element={<ImportPage />} />
                  <Route path="settings/wallets/new" element={<AddWalletPage />} />
                  <Route path="settings/wallets/:id" element={<EditWalletPage />} />
                  <Route path="settings/categories/new" element={<AddCategoryPage />} />
                  <Route path="settings/categories/:id" element={<EditCategoryPage />} />
                  <Route path="*" element={<Navigate to="/transactions" replace />} />
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
