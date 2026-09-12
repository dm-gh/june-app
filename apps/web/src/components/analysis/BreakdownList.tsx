import type { Category, Transaction, Wallet } from "@june/shared"
import { UNASSIGNED, UNCATEGORISED } from "../../lib/filter"
import { hueColor, moneyCode } from "../../lib/format"
import { Badge, cn } from "../../ui"
import type { Slice } from "./analysis"

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
  /** Keys drawn at half opacity, after the rest. */
  excluded?: ReadonlySet<string>
  onRowClick?: (key: string) => void
}

/** Rows of chip, amount, share and a bar scaled to the largest row, excluded rows included. */
export function BreakdownList({ slices, look, currency, total, excluded, onRowClick }: BreakdownListProps) {
  const max = slices.reduce((m, s) => Math.max(m, s.sum), 0)
  return (
    <div className="flex flex-col gap-3">
      {slices.map(({ key, sum }) => {
        const l = look(key)
        const out = excluded?.has(key) ?? false
        const Row = onRowClick ? "button" : "div"
        return (
          <Row
            key={key}
            type={onRowClick ? "button" : undefined}
            aria-pressed={onRowClick ? !out : undefined}
            onClick={onRowClick ? () => onRowClick(key) : undefined}
            className={cn("block w-full text-left transition-opacity", out && "opacity-50", onRowClick && "cursor-pointer")}
          >
            <div className="flex items-center justify-between gap-3">
              <Badge accent={l.muted ? "grey" : "paper"} {...(l.prefix ? { prefix: l.prefix } : {})} className="min-w-0" style={l.color ? { background: l.color } : undefined}>
                <span className="truncate">{l.label}</span>
              </Badge>
              <span className="flex shrink-0 items-baseline gap-2">
                {total !== undefined && !out ? (
                  <span className="font-mono text-xs text-grey-ink tabular-nums">{total > 0 ? `${Math.round((sum / total) * 100)}%` : "0%"}</span>
                ) : null}
                <span className="font-mono text-sm font-bold tabular-nums">{moneyCode(sum, currency)}</span>
              </span>
            </div>
            <div className="mt-1.5 h-3 overflow-hidden border-2 border-ink bg-white">
              <div className="h-full" style={{ width: `${max > 0 ? Math.min(100, (sum / max) * 100) : 0}%`, background: l.color ?? "var(--color-grey)" }} />
            </div>
          </Row>
        )
      })}
    </div>
  )
}
