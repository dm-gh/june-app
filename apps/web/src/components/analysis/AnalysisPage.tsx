import { CaretRight } from "@phosphor-icons/react"
import { type ReactNode, useMemo } from "react"
import { useNavigate } from "react-router"
import { Bar, BarChart, Cell, ComposedChart, LabelList, type LabelProps, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useCategoryIndex, useMe, useTransactions, useWalletIndex } from "../../api/queries"
import { AppShell } from "../../layout/AppShell"
import { PeriodHeader } from "../../layout/PeriodHeader"
import { filterRows, useFilter } from "../../lib/filter"
import { fromMinor } from "@june/shared"
import { balanceMoney, moneyCode, signedMoney } from "../../lib/format"
import { todayLocal, usePeriod } from "../../lib/period"
import { routes } from "../../routes"
import { Card, cn, Empty, Heading, Label, QueryState } from "../../ui"
import { breakdown, breakdownBoth, elapsedBuckets, flowSeries, granularityFor, incomeMinor, type Side, spendSeries, spentMinor, withEveryWallet } from "./analysis"
import { BreakdownList, type Dimension, dimensionTitle, FlowList, keysOf, lookOf, type Sides, walletBalance } from "./BreakdownList"

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

/** The Spent and Income cards double as the Type filter: the side that is off reads greyed. */
function SideCard({ side, on, label, value, onPick }: { side: Side; on: boolean; label: string; value: string; onPick: (side: Side) => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onPick(side)}
      className={cn("border-3 border-ink p-3 text-left shadow-hard lift lift-fade", side === "expense" ? "bg-coral" : "bg-green", !on && "opacity-50")}
    >
      <Label as="div">{label}</Label>
      <div className="mt-1 font-mono text-xl font-bold tabular-nums">{value}</div>
    </button>
  )
}

/** Spent / Income cards, Per day, By category, Income vs expense, By wallet, By tag. Every section obeys the Filter. */
export function AnalysisPage() {
  const { period } = usePeriod()
  const { filter, setFilter } = useFilter()
  const me = useMe()
  const transactions = useTransactions(period)
  const { byId: categoryById, bySlug: categoryBySlug, slugOf } = useCategoryIndex()
  const wallets = useWalletIndex()
  const walletById = wallets.byId
  const currency = me.data?.defaultCurrency ?? "USD"
  const today = todayLocal()

  const rows = useMemo(() => filterRows(transactions.data ?? [], filter, slugOf), [transactions.data, filter, slugOf])

  const spent = spentMinor(rows)
  const income = incomeMinor(rows)
  // The cards ignore the Expense/Income part of the filter: a greyed card still says what it leaves out.
  const cardRows = useMemo(
    () => filterRows(transactions.data ?? [], { ...filter, types: filter.types.filter((t) => t === "exchange") }, slugOf),
    [transactions.data, filter, slugOf]
  )
  const cardSpent = spentMinor(cardRows)
  const cardIncome = incomeMinor(cardRows)
  const spend = useMemo(() => spendSeries(rows, period, today), [rows, period, today])
  const flow = useMemo(() => flowSeries(rows, period), [rows, period])
  const granularity = granularityFor(period)
  const average = Math.abs(spent) / elapsedBuckets(period, today)
  // The Type filter decides which sides show: cards, lists and the Per day chart follow it.
  const sides: Sides = { expense: !filter.types.includes("expense"), income: !filter.types.includes("income") }
  const categorySlices = useMemo(
    () => ({
      expense: breakdown(rows, keysOf("categories", categoryById), "expense"),
      income: breakdown(rows, keysOf("categories", categoryById), "income")
    }),
    [rows, categoryById]
  )
  const walletSlices = useMemo(
    () => withEveryWallet(breakdownBoth(rows, keysOf("wallets", categoryById)), wallets.list.map((w) => w.id)),
    [rows, categoryById, wallets.list]
  )
  const totalBalance = wallets.totalDefaultMinor
  const tagSlices = useMemo(() => breakdownBoth(rows, keysOf("tags", categoryById)), [rows, categoryById])
  const look = (dimension: Dimension) => (key: string) => lookOf(dimension, key, categoryBySlug, walletById)

  /** Tapping Spent leaves only expenses on, tapping Income only income; tapping the side that is already alone brings both back. */
  const pick = (side: Side) => {
    const other: Side = side === "expense" ? "income" : "expense"
    const rest = filter.types.filter((t) => t !== "expense" && t !== "income")
    const alone = sides[side] && !sides[other]
    setFilter({ ...filter, types: alone ? rest : [...rest, other] })
  }

  const heading = (title: string, count: number, to: string) => (
    <SectionHeading aside={count > 0 ? <AllLink to={to} /> : undefined}>{title}</SectionHeading>
  )

  /** Spent or Income by category: one list per side the filter leaves on. */
  const categorySection = (side: Side) => {
    const slices = categorySlices[side]
    const title = sides.expense && sides.income ? (side === "expense" ? "Spent by category" : "Income by category") : "By category"
    return (
      <>
        {heading(title, slices.length, routes.breakdown("categories", side))}
        {transactions.data && slices.length === 0 ? <Empty>No {side === "expense" ? "spending" : "income"} by category in this period.</Empty> : null}
        <BreakdownList slices={slices.slice(0, ROWS)} look={look("categories")} currency={currency} total={side === "expense" ? Math.abs(spent) : income} />
      </>
    )
  }
  const flowSection = (dimension: "wallets" | "tags", title: string, slices: typeof walletSlices) => (
    <>
      {heading(title, slices.length, routes.breakdown(dimension))}
      {dimension === "wallets" && totalBalance !== null ? (
        <div className="-mt-1 mb-3 font-mono text-sm tabular-nums">
          <span className="text-grey-ink">Total balance</span> ≈ <span className="font-bold">{balanceMoney(totalBalance, currency)}</span>
        </div>
      ) : null}
      {transactions.data && slices.length === 0 ? <Empty>Nothing by {dimensionTitle[dimension].toLowerCase()} in this period.</Empty> : null}
      <FlowList
        slices={slices.slice(0, ROWS)}
        look={look(dimension)}
        currency={currency}
        showNative={dimension === "wallets"}
        detail={dimension === "wallets" ? walletBalance(walletById, currency) : undefined}
        hideEmptySide
        sides={sides}
      />
    </>
  )

  return (
    <AppShell>
      <PeriodHeader title="Analysis" />
      <QueryState of={transactions} />
      <div className="grid grid-cols-2 gap-3">
        <SideCard side="expense" on={sides.expense} label={`Spent · ${currency}`} value={transactions.data ? moneyCode(cardSpent, currency) : "…"} onPick={pick} />
        <SideCard side="income" on={sides.income} label={`Income · ${currency}`} value={transactions.data ? moneyCode(cardIncome, currency) : "…"} onPick={pick} />
      </div>

      {sides.expense ? (
        <>
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
        </>
      ) : null}

      {sides.expense ? categorySection("expense") : null}
      {sides.income ? categorySection("income") : null}

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
    </AppShell>
  )
}
