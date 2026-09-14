import type { Category, Wallet } from "@june/shared"
import { ArrowRight } from "@phosphor-icons/react"
import { categoryCorner, ListAmount, ListCard, type ListCardSelection } from "../../ui"
import type { ListItem } from "./listItems"

export interface TransactionCardProps {
  item: ListItem
  category: Category | undefined
  walletName: (id: Wallet["id"] | null) => string | null
  onOpen: () => void
  /** Long-press starts selection and a click then toggles; omit where the list cannot be selected. */
  selectable?: ListCardSelection | undefined
}

/**
 * The amount dominates, the description sits under it, Tags as small chips, the Category as a tag
 * flush in the top-right corner and the Wallet in the bottom-right one. An Exchange is one card with
 * both amounts and "From → To". Grey means Hidden from analysis.
 */
export function TransactionCard({ item, category, walletName, onOpen, selectable }: TransactionCardProps) {
  const t = item.kind === "single" ? item.transaction : item.source
  const name = (id: Wallet["id"] | null) => walletName(id) ?? "Unassigned"
  const corner =
    item.kind === "exchange" ? { label: "Exchange", muted: true } : t.type === "init" ? { label: "Opening balance", muted: true } : category
      ? categoryCorner(category, t.type !== "change")
      : null
  return (
    <ListCard
      corner={corner}
      headline={
        item.kind === "exchange" ? (
          <div className="flex flex-wrap gap-x-3">
            <ListAmount minor={item.source.amountMinor} currency={item.source.currency} />
            <ListAmount minor={item.target.amountMinor} currency={item.target.currency} />
          </div>
        ) : (
          <ListAmount minor={t.amountMinor} currency={t.currency} />
        )
      }
      description={t.description}
      tags={t.tags}
      trailing={
        item.kind === "exchange"
          ? {
              label: (
                <>
                  {name(item.source.walletId)}
                  <ArrowRight size={12} weight="bold" />
                  {name(item.target.walletId)}
                </>
              )
            }
          : { label: name(t.walletId), tone: t.walletId === null ? "muted" : "ink" }
      }
      muted={t.hiddenFromAnalysis}
      onOpen={onOpen}
      selectable={selectable}
    />
  )
}
