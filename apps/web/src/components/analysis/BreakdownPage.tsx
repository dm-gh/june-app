import { useMemo } from "react"
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"
import { useCategoryIndex, useMe, useTransactions, useWalletIndex } from "../../api/queries"
import { AppShell } from "../../layout/AppShell"
import { PeriodHeader } from "../../layout/PeriodHeader"
import { filterRows, useFilter } from "../../lib/filter"
import { balanceMoney, moneyCode } from "../../lib/format"
import { usePeriod } from "../../lib/period"
import { Card, Empty, ErrorNotice, Label, Loading } from "../../ui"
import { breakdown, breakdownBoth, type Side, withEveryWallet } from "./analysis"
import { BreakdownList, type Dimension, dimensionTitle, FlowList, keysOf, lookOf, walletBalance } from "./BreakdownList"

/**
 * The All page behind a capped section: every row, under the shared Filter. Categories open with
 * the Share donut; Wallets open with the total Balance and carry each Wallet's Balance.
 */
export function BreakdownPage({ dimension, side = "expense" }: { dimension: Dimension; side?: Side }) {
  const { period } = usePeriod()
  const { filter } = useFilter()
  const me = useMe()
  const transactions = useTransactions(period)
  const { byId: categoryById, bySlug: categoryBySlug, slugOf } = useCategoryIndex()
  const wallets = useWalletIndex()
  const walletById = wallets.byId
  const currency = me.data?.defaultCurrency ?? "USD"

  const rows = useMemo(() => filterRows(transactions.data ?? [], filter, slugOf), [transactions.data, filter, slugOf])
  const sides = { expense: !filter.types.includes("expense"), income: !filter.types.includes("income") }
  const twoSided = dimension !== "categories"
  const slices = useMemo(() => breakdown(rows, keysOf(dimension, categoryById), side), [rows, dimension, categoryById, side])
  const flows = useMemo(() => {
    if (!twoSided) return []
    const all = breakdownBoth(rows, keysOf(dimension, categoryById))
    return dimension === "wallets" ? withEveryWallet(all, wallets.list.map((w) => w.id)) : all
  }, [rows, dimension, categoryById, twoSided, wallets.list])
  const total = slices.reduce((sum, s) => sum + s.sum, 0)
  const look = (key: string) => lookOf(dimension, key, categoryBySlug, walletById)
  const count = twoSided ? flows.length : slices.length
  const totalBalance = wallets.totalDefaultMinor

  return (
    <AppShell>
      <PeriodHeader title={dimension === "categories" && side === "income" ? "Income categories" : dimensionTitle[dimension]} backTo="/analysis" />
      {transactions.isError ? <ErrorNotice message={transactions.error.message} /> : null}
      {transactions.isPending ? <Loading /> : null}

      {dimension === "wallets" && totalBalance !== null ? (
        <Card accent="sky" shadow="sm" className="mb-5 p-3">
          <Label as="div">Total balance · {currency}</Label>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums">≈ {balanceMoney(totalBalance, currency)}</div>
        </Card>
      ) : null}

      {dimension === "categories" && slices.length > 0 ? (
        <Card className="mb-5 p-3">
          <Label as="div">Share of {side === "expense" ? "spending" : "income"}</Label>
          <div className="relative h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="sum"
                  nameKey="key"
                  innerRadius="58%"
                  outerRadius="92%"
                  startAngle={90}
                  endAngle={-270}
                  stroke="#000"
                  strokeWidth={3}
                  isAnimationActive={false}
                >
                  {slices.map((s) => (
                    <Cell key={s.key} fill={look(s.key).color ?? "var(--color-grey)"} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <Label as="div" className="text-grey-ink">
                {side === "expense" ? "Spent" : "Income"}
              </Label>
              <div className="font-mono text-base font-bold tabular-nums">{moneyCode(total, currency)}</div>
            </div>
          </div>
        </Card>
      ) : null}

      {transactions.data && count === 0 ? (
        <Empty>
          {twoSided ? "Nothing" : `No ${side === "expense" ? "spending" : "income"}`} by {dimensionTitle[dimension].toLowerCase()} in this period.

        </Empty>
      ) : null}
      {twoSided ? (
        <FlowList
          slices={flows}
          look={look}
          currency={currency}
          showNative={dimension === "wallets"}
          detail={dimension === "wallets" ? walletBalance(walletById, currency) : undefined}
          hideEmptySide
          sides={sides}
        />
      ) : (
        <BreakdownList slices={slices} look={look} currency={currency} total={total} />
      )}
      <div className="pb-6" />
    </AppShell>
  )
}
