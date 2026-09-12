import type { Category, Wallet } from "@june/shared"
import { CaretRight } from "@phosphor-icons/react"
import { type ReactNode, useMemo } from "react"
import { useNavigate } from "react-router"
import { Bar, BarChart, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { useCategories, useMe, useTransactions, useWallets } from "../../api/queries"
import { AppShell } from "../../layout/AppShell"
import { PeriodHeader } from "../../layout/PeriodHeader"
import { filterRows, slugLookup, useFilter } from "../../lib/filter"
import { moneyCode, signedMoney } from "../../lib/format"
import { todayLocal, usePeriod } from "../../lib/period"
import { Card, Empty, ErrorNotice, Heading, Label, Loading } from "../../ui"
import { breakdown, elapsedBuckets, flowSeries, granularityFor, incomeMinor, sideOf, spendSeries, spentMinor } from "./analysis"
import { BreakdownList, type Dimension, dimensionTitle, keysOf, lookOf } from "./BreakdownList"

const ROWS = 5

const tick = { fontFamily: "Space Mono", fontSize: 11 }

/** Section heading with an optional figure on the right, or an "All ›" link when the list is capped. */
function SectionHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mt-6 mb-3 flex items-baseline justify-between gap-3">
      <Heading as="h2">{children}</Heading>
      {aside ? <div className="shrink-0 whitespace-nowrap">{aside}</div> : null}
    </div>
  )
}

function AllLink({ to }: { to: string }) {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate(to)} className="inline-flex items-center gap-0.5 px-1 font-heading text-sm font-bold hover:underline">
      All
      <CaretRight size={14} weight="bold" />
    </button>
  )
}

/** Spent / Income cards, Per day, By category, Income vs expense, By wallet, By tag. Every section obeys the Filter. */
export function AnalysisPage() {
  const { period } = usePeriod()
  const { filter } = useFilter()
  const me = useMe()
  const transactions = useTransactions(period)
  const categories = useCategories()
  const wallets = useWallets()
  const currency = me.data?.defaultCurrency ?? "USD"
  const today = todayLocal()

  const categoryById = useMemo(() => new Map<string, Category>((categories.data ?? []).map((c) => [c.id, c])), [categories.data])
  const categoryBySlug = useMemo(() => new Map<string, Category>((categories.data ?? []).map((c) => [c.slug, c])), [categories.data])
  const walletById = useMemo(() => new Map<string, Wallet>((wallets.data?.wallets ?? []).map((w) => [w.id, w])), [wallets.data])
  const slugOf = useMemo(() => slugLookup(categories.data), [categories.data])
  const rows = useMemo(() => filterRows(transactions.data ?? [], filter, slugOf), [transactions.data, filter, slugOf])

  const spent = spentMinor(rows)
  const income = incomeMinor(rows)
  const spend = useMemo(() => spendSeries(rows, period, today), [rows, period, today])
  const flow = useMemo(() => flowSeries(rows, period), [rows, period])
  const granularity = granularityFor(period)
  const average = Math.abs(spent) / elapsedBuckets(period, today)
  // The breakdowns show spending, or income once Expense is deselected in the Type filter.
  const side = sideOf(filter.types)
  const slices = useMemo(
    () => ({
      categories: breakdown(rows, keysOf("categories", categoryById), side),
      wallets: breakdown(rows, keysOf("wallets", categoryById), side),
      tags: breakdown(rows, keysOf("tags", categoryById), side)
    }),
    [rows, categoryById, side]
  )
  const look = (dimension: Dimension) => (key: string) => lookOf(dimension, key, categoryBySlug, walletById)
  const total = side === "expense" ? Math.abs(spent) : income

  const section = (dimension: Dimension, title: string) => {
    const all = slices[dimension]
    const noun = dimensionTitle[dimension].toLowerCase()
    return (
      <>
        <SectionHeading aside={all.length > 0 ? <AllLink to={`/analysis/${dimension}`} /> : undefined}>
          {title}
          {side === "income" ? <span className="text-grey-ink"> · income</span> : null}
        </SectionHeading>
        {transactions.data && all.length === 0 ? (
          <Empty>
            No {side === "expense" ? "spending" : "income"} by {noun} in this period.
            {side === "expense" ? " Deselect Expense in the filter to see income instead." : ""}
          </Empty>
        ) : null}
        <BreakdownList slices={all.slice(0, ROWS)} look={look(dimension)} currency={currency} total={total} showNative={dimension === "wallets"} />
      </>
    )
  }

  return (
    <AppShell>
      <PeriodHeader title="Analysis" />
      {transactions.isError ? <ErrorNotice message={transactions.error.message} /> : null}
      {transactions.isPending ? <Loading /> : null}
      <div className="grid grid-cols-2 gap-3">
        <Card accent="coral" className="p-3">
          <Label as="div">Spent · {currency}</Label>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums">{transactions.data ? moneyCode(spent, currency) : "…"}</div>
        </Card>
        <Card accent="green" className="p-3">
          <Label as="div">Income · {currency}</Label>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums">{transactions.data ? moneyCode(income, currency) : "…"}</div>
        </Card>
      </div>

      <SectionHeading
        aside={
          transactions.data ? (
            <span className="font-mono text-sm tabular-nums text-grey-ink">
              avg {moneyCode(Math.round(average), currency)} / {granularity}
            </span>
          ) : undefined
        }
      >
        {granularity === "day" ? "Per day" : "Per month"}
      </SectionHeading>
      <Card className="h-48 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={spend} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={tick} interval="preserveStartEnd" minTickGap={12} />
            <YAxis yAxisId="bars" hide />
            <YAxis yAxisId="line" hide domain={[0, "dataMax"]} />
            <Bar yAxisId="bars" dataKey="spent" isAnimationActive={false} stroke="#000" strokeWidth={2}>
              {spend.map((p) => (
                <Cell key={p.key} fill={p.when === "today" ? "var(--color-accent)" : p.when === "future" ? "var(--color-grey)" : "#000"} />
              ))}
            </Bar>
            <Line yAxisId="line" type="monotone" dataKey="total" dot={false} isAnimationActive={false} stroke="var(--color-coral)" strokeWidth={3} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {section("categories", "By category")}

      <SectionHeading
        aside={
          transactions.data ? (
            <span className="font-mono text-sm font-bold tabular-nums">net {signedMoney(income + spent, currency)}</span>
          ) : undefined
        }
      >
        Income vs expense
      </SectionHeading>
      <Card className="h-48 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={flow} stackOffset="sign" margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={tick} interval="preserveStartEnd" minTickGap={12} />
            <YAxis hide />
            <ReferenceLine y={0} stroke="#000" strokeWidth={2} />
            <Bar dataKey="income" stackId="flow" isAnimationActive={false} fill="var(--color-green)" stroke="#000" strokeWidth={2} />
            <Bar dataKey="expense" stackId="flow" isAnimationActive={false} fill="var(--color-coral)" stroke="#000" strokeWidth={2} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {section("wallets", "By wallet")}
      {section("tags", "By tag")}
      <div className="pb-6" />
    </AppShell>
  )
}
