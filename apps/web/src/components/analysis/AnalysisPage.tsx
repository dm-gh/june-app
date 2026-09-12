import type { Category, LocalDate, Transaction } from "@june/shared"
import { useMemo } from "react"
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis } from "recharts"
import { useCategories, useMe, useTransactions, useWallets } from "../../api/queries"
import { AppShell } from "../../layout/AppShell"
import { PeriodHeader } from "../../layout/PeriodHeader"
import { hueColor, moneyCode } from "../../lib/format"
import { addMonths, monthEnd, monthStart, type Period, usePeriod } from "../../lib/period"
import { Badge, Card, Empty, ErrorNotice, Heading, Label, Loading } from "../../ui"
import { incomeMinor, spentMinor } from "../transactions/TransactionsPage"

const counts = (rows: ReadonlyArray<Transaction>) => rows.filter((t) => t.type === "change" && !t.hiddenFromAnalysis)

/** Expense totals per Category (null key is Uncategorised), largest first. */
const byCategory = (rows: ReadonlyArray<Transaction>) => {
  const sums = new Map<string | null, number>()
  for (const t of counts(rows)) {
    if (t.amountMinor >= 0) continue
    sums.set(t.categoryId, (sums.get(t.categoryId) ?? 0) + Math.abs(t.defaultMinor ?? 0))
  }
  return [...sums.entries()].sort((a, b) => b[1] - a[1])
}

const monthLabel = new Intl.DateTimeFormat("en", { month: "short" })

export function AnalysisPage() {
  const { period } = usePeriod()
  const me = useMe()
  const transactions = useTransactions(period)
  const categories = useCategories()
  const wallets = useWallets()
  // Six months ending with the period's month, for the Over time bars.
  const trailing: Period = useMemo(() => ({ from: monthStart(addMonths(period.to, -5)), to: monthEnd(period.to) }), [period.to])
  const history = useTransactions(trailing)
  const currency = me.data?.defaultCurrency ?? "USD"

  const categoryById = useMemo(() => new Map<string, Category>((categories.data ?? []).map((c) => [c.id, c])), [categories.data])
  const buckets = useMemo(() => byCategory(transactions.data ?? []), [transactions.data])
  const maxBucket = buckets[0]?.[1] ?? 0
  const months = useMemo(() => {
    const result: Array<{ key: LocalDate; label: string; spent: number; current: boolean }> = []
    for (let i = 5; i >= 0; i--) {
      const start = monthStart(addMonths(period.to, -i))
      const end = monthEnd(start)
      const spent = Math.abs(spentMinor((history.data ?? []).filter((t) => t.occurredOn >= start && t.occurredOn <= end)))
      result.push({ key: start, label: monthLabel.format(new Date(start)), spent, current: i === 0 })
    }
    return result
  }, [history.data, period.to])

  return (
    <AppShell>
      <PeriodHeader title="Analysis" />
      {transactions.isError ? <ErrorNotice message={transactions.error.message} /> : null}
      <div className="grid grid-cols-2 gap-3">
        <Card accent="coral" className="p-3">
          <Label as="div">Spent · {currency}</Label>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums">{transactions.data ? moneyCode(spentMinor(transactions.data), currency) : "…"}</div>
        </Card>
        <Card accent="green" className="p-3">
          <Label as="div">Income · {currency}</Label>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums">{transactions.data ? moneyCode(incomeMinor(transactions.data), currency) : "…"}</div>
        </Card>
      </div>

      <Heading as="h2" className="mt-6 mb-3">
        By category
      </Heading>
      {transactions.isPending ? <Loading /> : null}
      {transactions.data && buckets.length === 0 ? <Empty>No expenses in this period.</Empty> : null}
      <div className="flex flex-col gap-3">
        {buckets.map(([id, sum]) => {
          const category = id === null ? undefined : categoryById.get(id)
          const color = category ? hueColor(category.hue) : undefined
          return (
            <div key={id ?? "uncategorised"}>
              <div className="flex items-center justify-between gap-3">
                <Badge accent={category ? "paper" : "grey"} style={color ? { background: color } : undefined}>
                  {category ? `${category.emoji ? `${category.emoji} ` : ""}${category.name}` : "Uncategorised"}
                </Badge>
                <span className="font-mono text-sm font-bold tabular-nums">{moneyCode(sum, currency)}</span>
              </div>
              <div className="mt-1.5 h-3 border-2 border-ink bg-white">
                <div className="h-full" style={{ width: `${maxBucket > 0 ? (sum / maxBucket) * 100 : 0}%`, background: color ?? "var(--color-grey)" }} />
              </div>
            </div>
          )
        })}
      </div>

      <Heading as="h2" className="mt-6 mb-3">
        Over time
      </Heading>
      <Card className="h-44 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={months} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontFamily: "Space Mono", fontSize: 12 }} />
            <Bar dataKey="spent" isAnimationActive={false} stroke="#000" strokeWidth={3}>
              {months.map((m) => (
                <Cell key={m.key} fill={m.current ? "var(--color-accent)" : "#000"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="mt-6 mb-3 flex items-baseline justify-between">
        <Heading as="h2">Wallets</Heading>
        {wallets.data?.totalDefaultMinor != null ? (
          <span className="font-mono text-sm font-bold tabular-nums">≈ {moneyCode(wallets.data.totalDefaultMinor, currency)}</span>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 pb-6">
        {(wallets.data?.wallets ?? []).map((w) => (
          <Card key={w.id} className="flex items-center justify-between p-3">
            <div>
              <div className="font-heading font-bold">{w.name}</div>
              <div className="font-mono text-xs text-grey-ink">{w.currency}</div>
            </div>
            <span className="font-mono text-base font-bold tabular-nums">{moneyCode(w.balanceMinor, w.currency)}</span>
          </Card>
        ))}
      </div>
    </AppShell>
  )
}
