import type { LocalDate, Transaction, TransactionId } from "@june/shared"

/** What the list shows: a Change or Init on its own, or both legs of an Exchange as one item. */
export type ListItem =
  | { readonly kind: "single"; readonly transaction: Transaction }
  | { readonly kind: "exchange"; readonly source: Transaction; readonly target: Transaction }

export const itemIds = (item: ListItem): ReadonlyArray<TransactionId> =>
  item.kind === "single" ? [item.transaction.id] : [item.source.id, item.target.id]

export const itemDate = (item: ListItem): LocalDate => (item.kind === "single" ? item.transaction : item.source).occurredOn

/** Pair Exchange legs by exchangeId, keeping the list order of the first leg. A leg on its own stays single. */
export const toItems = (rows: ReadonlyArray<Transaction>): Array<ListItem> => {
  const legs = new Map<string, Array<Transaction>>()
  for (const t of rows) {
    if (t.exchangeId === null) continue
    const list = legs.get(t.exchangeId)
    if (list) list.push(t)
    else legs.set(t.exchangeId, [t])
  }
  const seen = new Set<string>()
  const items: Array<ListItem> = []
  for (const t of rows) {
    if (t.exchangeId === null) {
      items.push({ kind: "single", transaction: t })
      continue
    }
    if (seen.has(t.exchangeId)) continue
    seen.add(t.exchangeId)
    const pair = legs.get(t.exchangeId)!
    const source = pair.find((l) => l.amountMinor < 0)
    const target = pair.find((l) => l.amountMinor > 0)
    if (source && target) items.push({ kind: "exchange", source, target })
    else for (const leg of pair) items.push({ kind: "single", transaction: leg })
  }
  return items
}

export const groupByDay = (items: ReadonlyArray<ListItem>): Array<[LocalDate, Array<ListItem>]> => {
  const map = new Map<LocalDate, Array<ListItem>>()
  for (const item of items) {
    const day = itemDate(item)
    const list = map.get(day)
    if (list) list.push(item)
    else map.set(day, [item])
  }
  return [...map.entries()]
}
