import { useEffect, useMemo, useState } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router"
import { AnalysisPage } from "./components/analysis/AnalysisPage"
import { RequireAuth, SignInPage } from "./components/auth/SignInPage"
import { AddCategoryPage, EditCategoryPage } from "./components/settings/CategoryFormPage"
import { SettingsPage } from "./components/settings/SettingsPage"
import { AddWalletPage, EditWalletPage } from "./components/settings/WalletFormPage"
import { AddTransactionPage } from "./components/transactions/AddTransactionPage"
import { BulkEditPage } from "./components/transactions/BulkEditPage"
import { EditTransactionPage, TransactionPage } from "./components/transactions/TransactionPage"
import { TransactionsPage } from "./components/transactions/TransactionsPage"
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
                <Routes>
                  <Route index element={<Navigate to="/transactions" replace />} />
                  <Route path="transactions" element={<TransactionsPage />} />
                  <Route path="transactions/new" element={<AddTransactionPage />} />
                  <Route path="transactions/bulk-edit" element={<BulkEditPage />} />
                  <Route path="transactions/:id" element={<TransactionPage />} />
                  <Route path="transactions/:id/edit" element={<EditTransactionPage />} />
                  <Route path="analysis" element={<AnalysisPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="settings/wallets/new" element={<AddWalletPage />} />
                  <Route path="settings/wallets/:id" element={<EditWalletPage />} />
                  <Route path="settings/categories/new" element={<AddCategoryPage />} />
                  <Route path="settings/categories/:id" element={<EditCategoryPage />} />
                  <Route path="*" element={<Navigate to="/transactions" replace />} />
                </Routes>
              </PeriodProvider>
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
