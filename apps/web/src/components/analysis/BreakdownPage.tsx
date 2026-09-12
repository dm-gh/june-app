import type { Category, Wallet } from "@june/shared"
import { useMemo } from "react"
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"
import { useCategories, useMe, useTransactions, useWallets } from "../../api/queries"
import { AppShell } from "../../layout/AppShell"
import { PeriodHeader } from "../../layout/PeriodHeader"
import { filterRows, slugLookup, toggleIn, useFilter } from "../../lib/filter"
import { moneyCode } from "../../lib/format"
import { usePeriod } from "../../lib/period"
import { Card, Empty, ErrorNotice, Label, Loading, Text } from "../../ui"
import { breakdown, incomeMinor, sideOf, spentMinor } from "./analysis"
import { BreakdownList, type Dimension, dimensionTitle, keysOf, lookOf } from "./BreakdownList"

/**
 * The All page behind a capped section. Rows obey every part of the Filter except their own
 * dimension, so a deselected row stays visible at half opacity at the foot of the list, and
 * tapping any row toggles it in the shared Filter. Categories open with the Share of spending donut.
 */
export function BreakdownPage({ dimension }: { dimension: Dimension }) {
  const { period } = usePeriod()
  const { filter, setFilter } = useFilter()
  const me = useMe()
  const transactions = useTransactions(period)
  const categories = useCategories()
  const wallets = useWallets()
  const currency = me.data?.defaultCurrency ?? "USD"

  const categoryById = useMemo(() => new Map<string, Category>((categories.data ?? []).map((c) => [c.id, c])), [categories.data])
  const categoryBySlug = useMemo(() => new Map<string, Category>((categories.data ?? []).map((c) => [c.slug, c])), [categories.data])
  const walletById = useMemo(() => new Map<string, Wallet>((wallets.data?.wallets ?? []).map((w) => [w.id, w])), [wallets.data])
  const slugOf = useMemo(() => slugLookup(categories.data), [categories.data])

  const excluded = useMemo(() => new Set(filter[dimension]), [filter, dimension])
  const rows = useMemo(
    () => filterRows(transactions.data ?? [], { ...filter, [dimension]: [] }, slugOf),
    [transactions.data, filter, dimension, slugOf]
  )
  const side = sideOf(filter.types)
  const slices = useMemo(() => {
    const all = breakdown(rows, keysOf(dimension, categoryById), side)
    return [...all.filter((s) => !excluded.has(s.key)), ...all.filter((s) => excluded.has(s.key))]
  }, [rows, dimension, categoryById, excluded, side])
  const selected = slices.filter((s) => !excluded.has(s.key))
  // Categories and Wallets partition the rows, so their shares add up to the whole. A row can carry
  // several Tags, so Tag shares are measured against the period's total under the full Filter.
  const fullyFiltered = useMemo(() => filterRows(transactions.data ?? [], filter, slugOf), [transactions.data, filter, slugOf])
  const total =
    dimension === "tags"
      ? side === "expense"
        ? Math.abs(spentMinor(fullyFiltered))
        : incomeMinor(fullyFiltered)
      : selected.reduce((sum, s) => sum + s.sum, 0)
  const look = (key: string) => lookOf(dimension, key, categoryBySlug, walletById)

  return (
    <AppShell>
      <PeriodHeader title={dimensionTitle[dimension]} backTo="/analysis" />
      {transactions.isError ? <ErrorNotice message={transactions.error.message} /> : null}
      {transactions.isPending ? <Loading /> : null}

      {dimension === "categories" && selected.length > 0 ? (
        <Card className="mb-5 p-3">
          <Label as="div">Share of {side === "expense" ? "spending" : "income"}</Label>
          <div className="relative h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={selected}
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
                  {selected.map((s) => (
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

      {transactions.data && slices.length === 0 ? (
        <Empty>
          No {side === "expense" ? "spending" : "income"} by {dimensionTitle[dimension].toLowerCase()} in this period.
          {side === "expense" ? " Deselect Expense in the filter to see income instead." : ""}
        </Empty>
      ) : null}
      <BreakdownList slices={slices} look={look} currency={currency} total={total} excluded={excluded} onRowClick={(key) => setFilter(toggleIn(filter, dimension, key))} />
      {slices.length > 0 ? (
        <Text className="mt-4 pb-6 text-sm text-grey-ink">Tap a row to leave it out of the filter; tap again to bring it back.</Text>
      ) : (
        <div className="pb-6" />
      )}
    </AppShell>
  )
}
