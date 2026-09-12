import type { Category, Wallet } from "@june/shared"
import { CaretRight } from "@phosphor-icons/react"
import { type ReactNode, useMemo } from "react"
import { useNavigate } from "react-router"
import { Bar, BarChart, Cell, ComposedChart, LabelList, type LabelProps, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useCategories, useMe, useTransactions, useWallets } from "../../api/queries"
import { AppShell } from "../../layout/AppShell"
import { PeriodHeader } from "../../layout/PeriodHeader"
import { filterRows, slugLookup, useFilter } from "../../lib/filter"
import { fromMinor } from "@june/shared"
import { moneyCode, signedMoney } from "../../lib/format"
import { todayLocal, usePeriod } from "../../lib/period"
import { Card, Empty, ErrorNotice, Heading, Label, Loading } from "../../ui"
import { breakdown, breakdownBoth, elapsedBuckets, flowSeries, granularityFor, incomeMinor, sideOf, spendSeries, spentMinor } from "./analysis"
import { BreakdownList, type Dimension, dimensionTitle, FlowList, keysOf, lookOf } from "./BreakdownList"

const ROWS = 5

const tick = { fontFamily: "Space Mono", fontSize: 11 }

const compactFormat = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 })
/** "128", "1.2K": the amount on a bar, without the currency, which the section heading names. */
const compact = (minor: number, currency: string): string => compactFormat.format(Math.abs(fromMinor(minor, currency)))

/** Room above the bars for a label; rotated labels need more. */
const labelMargin = (buckets: number) => (buckets > 12 ? 40 : 18)

/**
 * The amount over (or, for a negative bar, under) its bar. Zero bars stay unlabelled. With more
 * than twelve buckets the labels stand upright so neighbours never collide.
 */
const amountLabel = (currency: string, buckets: number) =>
  function AmountLabel(props: LabelProps) {
    const value = Number(props.value ?? 0)
    if (value === 0) return null
    const x = Number(props.x ?? 0) + Number(props.width ?? 0) / 2
    // A bar below the zero line comes with a negative height.
    const y0 = Number(props.y ?? 0)
    const y1 = y0 + Number(props.height ?? 0)
    const top = Math.min(y0, y1)
    const bottom = Math.max(y0, y1)
    const rotated = buckets > 12
    const below = value < 0
    const y = below ? bottom + 4 : top - 4
    const text = compact(value, currency)
    return (
      <text
        x={x}
        y={y}
        fontFamily="Space Mono"
        fontSize={9}
        fontWeight={700}
        fill="#000"
        textAnchor={rotated ? (below ? "end" : "start") : "middle"}
        dominantBaseline={rotated ? "middle" : below ? "hanging" : "auto"}
        transform={rotated ? `rotate(-90 ${x} ${y})` : undefined}
      >
        {text}
      </text>
    )
  }

/** Tap a bar: the day and its full amounts in a bordered card. */
function ChartTip({ active, label, payload, currency }: { active?: boolean; label?: string; payload?: ReadonlyArray<{ dataKey?: string | number; value?: number | string }>; currency: string }) {
  if (!active || !payload || payload.length === 0) return null
  const rows = payload.filter((p) => Number(p.value) !== 0)
  if (rows.length === 0) return null
  const names: Record<string, string> = { spent: "Spent", total: "So far", income: "Income", expense: "Expense" }
  return (
    <div className="border-3 border-ink bg-paper px-2.5 py-1.5 font-mono text-xs shadow-hard-sm">
      <div className="font-heading font-bold">{label}</div>
      {rows.map((p) => (
        <div key={String(p.dataKey)} className="tabular-nums">
          {names[String(p.dataKey)] ?? String(p.dataKey)} {moneyCode(Number(p.value), currency)}
        </div>
      ))}
    </div>
  )
}

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
  // By category shows spending, or income once Expense is deselected in the Type filter. Wallets and Tags show both sides.
  const side = sideOf(filter.types)
  const categorySlices = useMemo(() => breakdown(rows, keysOf("categories", categoryById), side), [rows, categoryById, side])
  const walletSlices = useMemo(() => breakdownBoth(rows, keysOf("wallets", categoryById)), [rows, categoryById])
  const tagSlices = useMemo(() => breakdownBoth(rows, keysOf("tags", categoryById)), [rows, categoryById])
  const look = (dimension: Dimension) => (key: string) => lookOf(dimension, key, categoryBySlug, walletById)
  const total = side === "expense" ? Math.abs(spent) : income

  const heading = (dimension: Dimension, title: string, count: number) => (
    <SectionHeading aside={count > 0 ? <AllLink to={`/analysis/${dimension}`} /> : undefined}>
      {title}
      {dimension === "categories" && side === "income" ? <span className="text-grey-ink"> · income</span> : null}
    </SectionHeading>
  )
  const nothing = (dimension: Dimension) =>
    transactions.data ? <Empty>Nothing by {dimensionTitle[dimension].toLowerCase()} in this period.</Empty> : null

  const categorySection = (
    <>
      {heading("categories", "By category", categorySlices.length)}
      {transactions.data && categorySlices.length === 0 ? (
        <Empty>
          No {side === "expense" ? "spending" : "income"} by category in this period.
          {side === "expense" ? " Deselect Expense in the filter to see income instead." : ""}
        </Empty>
      ) : null}
      <BreakdownList slices={categorySlices.slice(0, ROWS)} look={look("categories")} currency={currency} total={total} />
    </>
  )
  const flowSection = (dimension: "wallets" | "tags", title: string, slices: typeof walletSlices) => (
    <>
      {heading(dimension, title, slices.length)}
      {slices.length === 0 ? nothing(dimension) : null}
      <FlowList slices={slices.slice(0, ROWS)} look={look(dimension)} currency={currency} showNative={dimension === "wallets"} />
    </>
  )

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
      <Card className="h-52 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={spend} margin={{ top: labelMargin(spend.length), right: 8, left: 8, bottom: 0 }}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={tick} interval="preserveStartEnd" minTickGap={12} />
            <YAxis yAxisId="bars" hide />
            <YAxis yAxisId="line" hide domain={[0, "dataMax"]} />
            <Tooltip cursor={{ fill: "rgba(0,0,0,0.06)" }} content={<ChartTip currency={currency} />} />
            <Bar yAxisId="bars" dataKey="spent" isAnimationActive={false} stroke="#000" strokeWidth={2}>
              {spend.map((p) => (
                <Cell key={p.key} fill={p.when === "today" ? "var(--color-accent)" : p.when === "future" ? "var(--color-grey)" : "#000"} />
              ))}
              <LabelList dataKey="spent" content={amountLabel(currency, spend.length)} />
            </Bar>
            <Line yAxisId="line" type="monotone" dataKey="total" dot={false} isAnimationActive={false} stroke="var(--color-coral)" strokeWidth={3} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {categorySection}

      <SectionHeading
        aside={
          transactions.data ? (
            <span className="font-mono text-sm font-bold tabular-nums">net {signedMoney(income + spent, currency)}</span>
          ) : undefined
        }
      >
        Income vs expense
      </SectionHeading>
      <Card className="h-56 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={flow} stackOffset="sign" margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={tick} interval="preserveStartEnd" minTickGap={12} />
            {/* Headroom on both sides of the zero line so the labels clear the tallest bars and the axis. */}
            <YAxis hide domain={[(min: number) => min * (flow.length > 12 ? 1.6 : 1.3), (max: number) => max * (flow.length > 12 ? 1.6 : 1.3)]} />
            <Tooltip cursor={{ fill: "rgba(0,0,0,0.06)" }} content={<ChartTip currency={currency} />} />
            <ReferenceLine y={0} stroke="#000" strokeWidth={2} />
            <Bar dataKey="income" stackId="flow" isAnimationActive={false} fill="var(--color-green)" stroke="#000" strokeWidth={2}>
              <LabelList dataKey="income" content={amountLabel(currency, flow.length)} />
            </Bar>
            <Bar dataKey="expense" stackId="flow" isAnimationActive={false} fill="var(--color-coral)" stroke="#000" strokeWidth={2}>
              <LabelList dataKey="expense" content={amountLabel(currency, flow.length)} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {flowSection("wallets", "By wallet", walletSlices)}
      {flowSection("tags", "By tag", tagSlices)}
      <div className="pb-6" />
    </AppShell>
  )
}
