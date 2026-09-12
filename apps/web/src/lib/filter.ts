import type { Category, Transaction, Wallet } from "@june/shared"
import { createContext, useContext } from "react"
import type { ListItem } from "../components/transactions/listItems"

/**
 * The one Filter shared by Transactions and Analysis (CONTEXT.md: "Filter"). It works by
 * exclusion, so what is stored is what the User deselected; an empty Filter shows everything,
 * and a Category or Tag created later is included without any change here.
 */

/** What the Type chips offer. An Init counts as income; there is no separate Init type. */
export type Kind = "expense" | "income" | "exchange"
export const KINDS: ReadonlyArray<Kind> = ["expense", "income", "exchange"]
export const kindLabel: Record<Kind, string> = { expense: "Expense", income: "Income", exchange: "Exchange" }

/** Categories are keyed by slug so a link stays readable; Uncategorised is its own key. */
export const UNCATEGORISED = "uncategorised"
/** Wallets have no slug, so they are keyed by id; Unassigned is its own key. */
export const UNASSIGNED = "unassigned"

export interface Filter {
  /** Deselected Types. */
  readonly types: ReadonlyArray<Kind>
  /** Deselected Category slugs, or UNCATEGORISED. */
  readonly categories: ReadonlyArray<string>
  /** Deselected Wallet ids, or UNASSIGNED. */
  readonly wallets: ReadonlyArray<string>
  /** Deselected Tags. */
  readonly tags: ReadonlyArray<string>
}

export const emptyFilter: Filter = { types: [], categories: [], wallets: [], tags: [] }

export const isEmptyFilter = (f: Filter): boolean =>
  f.types.length === 0 && f.categories.length === 0 && f.wallets.length === 0 && f.tags.length === 0

export const kindOf = (t: Transaction): Kind =>
  t.type === "exchange" ? "exchange" : t.type === "init" || t.amountMinor > 0 ? "income" : "expense"

/** One row against the Filter. The Category chips apply to Changes only: an Init or an Exchange has no Category. */
export const matchesFilter = (t: Transaction, f: Filter, slugOf: (id: string) => string | undefined): boolean => {
  if (f.types.includes(kindOf(t))) return false
  if (f.wallets.includes(t.walletId ?? UNASSIGNED)) return false
  if (t.type === "change" && f.categories.includes(t.categoryId === null ? UNCATEGORISED : (slugOf(t.categoryId) ?? UNCATEGORISED))) return false
  if (t.tags.some((tag) => f.tags.includes(tag))) return false
  return true
}

/** A list item against the Filter. An Exchange stays as long as either of its Wallets is selected. */
export const itemMatches = (item: ListItem, f: Filter, slugOf: (id: string) => string | undefined): boolean => {
  if (item.kind === "single") return matchesFilter(item.transaction, f, slugOf)
  if (f.types.includes("exchange")) return false
  const walletOk = !f.wallets.includes(item.source.walletId ?? UNASSIGNED) || !f.wallets.includes(item.target.walletId ?? UNASSIGNED)
  return walletOk && !item.source.tags.some((tag) => f.tags.includes(tag))
}

export const filterItems = (items: ReadonlyArray<ListItem>, f: Filter, slugOf: (id: string) => string | undefined): Array<ListItem> =>
  isEmptyFilter(f) ? [...items] : items.filter((item) => itemMatches(item, f, slugOf))

export const filterRows = (rows: ReadonlyArray<Transaction>, f: Filter, slugOf: (id: string) => string | undefined): Array<Transaction> =>
  isEmptyFilter(f) ? [...rows] : rows.filter((t) => matchesFilter(t, f, slugOf))

/** Toggle one key in one dimension. */
export const toggleIn = (f: Filter, dimension: keyof Filter, key: string): Filter => {
  const list = f[dimension] as ReadonlyArray<string>
  const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key]
  return { ...f, [dimension]: next }
}

export const slugLookup = (categories: ReadonlyArray<Category> | undefined) => {
  const map = new Map((categories ?? []).map((c) => [c.id as string, c.slug as string]))
  return (id: string) => map.get(id)
}

/* ---------- URL ---------- */

const PARAMS: Record<keyof Filter, string> = { types: "xtype", categories: "xcat", wallets: "xwallet", tags: "xtag" }

const list = (params: URLSearchParams, name: string): ReadonlyArray<string> =>
  (params.get(name) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

export const hasFilterParams = (params: URLSearchParams): boolean => Object.values(PARAMS).some((p) => params.has(p))

export const parseFilter = (params: URLSearchParams): Filter => ({
  types: list(params, PARAMS.types).filter((k): k is Kind => (KINDS as ReadonlyArray<string>).includes(k)),
  categories: list(params, PARAMS.categories),
  wallets: list(params, PARAMS.wallets),
  tags: list(params, PARAMS.tags)
})

/** The Filter as URL params, so a link carries it. */
export const filterParams = (f: Filter): URLSearchParams => {
  const params = new URLSearchParams()
  for (const key of Object.keys(PARAMS) as Array<keyof Filter>) {
    if (f[key].length > 0) params.set(PARAMS[key], f[key].join(","))
  }
  return params
}

/** "?xcat=food" or "" — for links between the tabs. */
export const filterSearch = (f: Filter): string => {
  const s = filterParams(f).toString()
  return s === "" ? "" : `?${s}`
}

/* ---------- Chip summaries ---------- */

export interface ChipSummary {
  readonly label: string
  /** How narrowed the dimension is; "one" carries the remaining item's colour. */
  readonly state: "all" | "some" | "one" | "none"
  readonly color?: string | undefined
}

/** "All", the one remaining item's name, "5 of 7", or "None". */
export const summarise = (
  all: ReadonlyArray<{ key: string; label: string; color?: string | undefined }>,
  excluded: ReadonlyArray<string>
): ChipSummary => {
  if (excluded.length === 0) return { label: "All", state: "all" }
  const remaining = all.filter((item) => !excluded.includes(item.key))
  if (remaining.length === 0) return { label: "None", state: "none" }
  if (remaining.length === 1) return { label: remaining[0]!.label, state: "one", color: remaining[0]!.color }
  return { label: `${remaining.length} of ${all.length}`, state: "some" }
}

export const walletOptions = (wallets: ReadonlyArray<Wallet> | undefined) => [
  ...(wallets ?? []).map((w) => ({ key: w.id as string, label: w.name })),
  { key: UNASSIGNED, label: "Unassigned" }
]

/* ---------- Context ---------- */

export interface FilterState {
  readonly filter: Filter
  readonly setFilter: (f: Filter) => void
}

export const FilterContext = createContext<FilterState | null>(null)

export const useFilter = (): FilterState => {
  const value = useContext(FilterContext)
  if (value === null) throw new Error("useFilter outside FilterProvider")
  return value
}
