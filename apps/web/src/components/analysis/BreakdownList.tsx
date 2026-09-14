import type { Category, Transaction, Wallet } from "@june/shared"
import type { ReactNode } from "react"
import { UNASSIGNED, UNCATEGORISED } from "../../lib/filter"
import { balanceMoney, hueColor, moneyCode, signedMoney } from "../../lib/format"
import { Badge, cn } from "../../ui"
import type { SideSum, Slice, TwoSidedSlice } from "./analysis"

export type Dimension = "categories" | "wallets" | "tags"

export const dimensionTitle: Record<Dimension, string> = { categories: "Categories", wallets: "Wallets", tags: "Tags" }

/** How a row is keyed in the Filter: Categories by slug, Wallets by id, Tags by the Tag itself. */
export const keysOf = (dimension: Dimension, categoryById: ReadonlyMap<string, Category>) => (t: Transaction): ReadonlyArray<string> => {
  switch (dimension) {
    case "categories":
      return [t.categoryId === null ? UNCATEGORISED : (categoryById.get(t.categoryId)?.slug ?? UNCATEGORISED)]
    case "wallets":
      return [t.walletId ?? UNASSIGNED]
    case "tags":
      return t.tags
  }
}

export interface RowLook {
  readonly label: string
  readonly color: string | undefined
  readonly muted: boolean
  readonly prefix?: string
}

/** What a key looks like as a chip. */
export const lookOf = (
  dimension: Dimension,
  key: string,
  categoryBySlug: ReadonlyMap<string, Category>,
  walletById: ReadonlyMap<string, Wallet>
): RowLook => {
  switch (dimension) {
    case "categories": {
      const c = categoryBySlug.get(key)
      return c ? { label: `${c.emoji ? `${c.emoji} ` : ""}${c.name}`, color: hueColor(c.hue), muted: false } : { label: "Uncategorised", color: undefined, muted: true }
    }
    case "wallets": {
      const w = walletById.get(key)
      return w ? { label: w.name, color: "var(--color-sky)", muted: false } : { label: "Unassigned", color: undefined, muted: true }
    }
    case "tags":
      return { label: key, color: "var(--color-yellow)", muted: false, prefix: "#" }
  }
}

export interface BreakdownListProps {
  slices: ReadonlyArray<Slice>
  look: (key: string) => RowLook
  currency: string
  /** Total the shares are measured against; omit to hide shares. */
  total?: number
  /** Show the amount in the row's own currency, with the Default Currency figure in parentheses. */
  showNative?: boolean
}

/** Rows of chip, amount, share and a bar scaled to the largest row. */
export function BreakdownList({ slices, look, currency, total, showNative }: BreakdownListProps) {
  const max = slices.reduce((m, s) => Math.max(m, s.sum), 0)
  return (
    <div className="flex flex-col gap-3">
      {slices.map(({ key, sum, native }) => {
        const l = look(key)
        return (
          <div key={key}>
            <div className="flex items-center justify-between gap-3">
              <Badge accent={l.muted ? "grey" : "paper"} {...(l.prefix ? { prefix: l.prefix } : {})} className="min-w-0" style={l.color ? { background: l.color } : undefined}>
                <span className="truncate">{l.label}</span>
              </Badge>
              <span className="flex shrink-0 items-baseline gap-2">
                {total !== undefined ? (
                  <span className="font-mono text-xs text-grey-ink tabular-nums">{total > 0 ? `${Math.round((sum / total) * 100)}%` : "0%"}</span>
                ) : null}
                {showNative && native && native.currency !== currency ? (
                  <span className="font-mono text-sm tabular-nums">
                    <span className="font-bold">{moneyCode(native.minor, native.currency)}</span>{" "}
                    <span className="text-grey-ink">({moneyCode(sum, currency)})</span>
                  </span>
                ) : (
                  <span className="font-mono text-sm font-bold tabular-nums">{moneyCode(sum, currency)}</span>
                )}
              </span>
            </div>
            <div className="mt-1.5 h-3 overflow-hidden border-2 border-ink bg-white">
              <div className="h-full" style={{ width: `${max > 0 ? Math.min(100, (sum / max) * 100) : 0}%`, background: l.color ?? "var(--color-grey)" }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export interface FlowListProps {
  slices: ReadonlyArray<TwoSidedSlice>
  look: (key: string) => RowLook
  currency: string
  showNative?: boolean
  /** A line under the chip: a Wallet's Balance. */
  detail?: ((key: string) => ReactNode) | undefined
  /** Leave out a side that has nothing, line and bar both. A Wallet with nothing moved shows only its Balance. */
  hideEmptySide?: boolean
  /** Which sides the Type filter leaves on. */
  sides?: Sides
}

export interface Sides {
  readonly expense: boolean
  readonly income: boolean
}

export const bothSides: Sides = { expense: true, income: true }

/** "−GEL 119.84 (USD 45.57)" on the spent line, "+…" on the income line, grey when nothing moved. */
function SideAmount({ side, sign, currency, showNative }: { side: SideSum; sign: -1 | 1; currency: string; showNative: boolean }) {
  if (side.sum === 0) return <span className="font-mono text-sm text-grey-ink tabular-nums">{moneyCode(0, currency)}</span>
  const tone = sign < 0 ? "text-coral-ink" : "text-green-ink"
  const native = showNative && side.native && side.native.currency !== currency ? side.native : null
  return (
    <span className="font-mono text-sm tabular-nums">
      <span className={cn("font-bold", tone)}>{signedMoney(sign * (native ? native.minor : side.sum), native ? native.currency : currency)}</span>
      {native ? <span className="text-grey-ink"> ({moneyCode(side.sum, currency)})</span> : null}
    </span>
  )
}

/** Rows with both sides: a coral bar for spending and a green one for income, each scaled to the largest amount on either side. */
export function FlowList({ slices, look, currency, showNative = false, detail, hideEmptySide = false, sides = bothSides }: FlowListProps) {
  const max = slices.reduce((m, s) => Math.max(m, s.expense.sum, s.income.sum), 0)
  const width = (sum: number) => `${max > 0 ? Math.min(100, (sum / max) * 100) : 0}%`
  return (
    <div className="flex flex-col gap-3">
      {slices.map((s) => {
        const l = look(s.key)
        const showExpense = sides.expense && (!hideEmptySide || s.expense.sum !== 0)
        const showIncome = sides.income && (!hideEmptySide || s.income.sum !== 0)
        const extra = detail?.(s.key)
        return (
          <div key={s.key}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col items-start gap-1">
                <Badge accent={l.muted ? "grey" : "paper"} {...(l.prefix ? { prefix: l.prefix } : {})} className="min-w-0 max-w-full" style={l.color ? { background: l.color } : undefined}>
                  <span className="truncate">{l.label}</span>
                </Badge>
                {extra ? <div className="font-mono text-xs text-grey-ink tabular-nums">{extra}</div> : null}
              </div>
              <span className="flex shrink-0 flex-col items-end gap-0.5">
                {showExpense ? <SideAmount side={s.expense} sign={-1} currency={currency} showNative={showNative} /> : null}
                {showIncome ? <SideAmount side={s.income} sign={1} currency={currency} showNative={showNative} /> : null}
              </span>
            </div>
            {showExpense ? (
              <div className="mt-1.5 h-2.5 overflow-hidden border-2 border-ink bg-white">
                <div className="h-full bg-coral" style={{ width: width(s.expense.sum) }} />
              </div>
            ) : null}
            {showIncome ? (
              <div className="mt-1 h-2.5 overflow-hidden border-2 border-ink bg-white">
                <div className="h-full bg-green" style={{ width: width(s.income.sum) }} />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/** "GEL 2,000.00 (≈ USD 740.00)": a Wallet's Balance for the line under its chip; nothing for Unassigned. */
export const walletBalance = (walletById: ReadonlyMap<string, Wallet>, currency: string) => (key: string): ReactNode => {
  const w = walletById.get(key)
  if (!w) return null
  const own = balanceMoney(w.balanceMinor, w.currency)
  const converted = w.currency !== currency && w.balanceDefaultMinor !== null ? ` (≈ ${balanceMoney(w.balanceDefaultMinor, currency)})` : ""
  return `Balance ${own}${converted}`
}
