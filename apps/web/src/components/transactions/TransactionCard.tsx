import type { Category, Transaction, Wallet } from "@june/shared"
import { ArrowRight, Check } from "@phosphor-icons/react"
import { type ReactNode, useRef } from "react"
import { hueColor, signedMoney } from "../../lib/format"
import { Badge, cn } from "../../ui"
import type { ListItem } from "./listItems"

export interface TransactionCardProps {
  item: ListItem
  category: Category | undefined
  walletName: (id: Wallet["id"] | null) => string | null
  selecting: boolean
  selected: boolean
  onOpen: () => void
  onToggle: () => void
  onLongPress: () => void
}

const LONG_PRESS_MS = 450

const amountClass = (minor: number) =>
  cn("font-mono text-2xl font-bold tabular-nums whitespace-nowrap", minor < 0 ? "text-coral-ink" : "text-green-ink")

/** Bottom-right of every card: the Wallet, or for an Exchange "Card → Cash". Unassigned reads grey. */
function WalletLine({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 font-heading text-xs font-bold uppercase tracking-wide", muted ? "text-grey-ink" : "text-ink")}>
      {children}
    </span>
  )
}

/**
 * The amount dominates, the description sits under it, Tags as small chips, the Category as a tag
 * flush in the top-right corner and the Wallet in the bottom-right one. An Exchange is one card with
 * both amounts and "From → To". Grey means Hidden from analysis. Long-press starts selection.
 */
export function TransactionCard({ item, category, walletName, selecting, selected, onOpen, onToggle, onLongPress }: TransactionCardProps) {
  const timer = useRef<number | null>(null)
  const longPressed = useRef(false)

  const start = () => {
    longPressed.current = false
    timer.current = window.setTimeout(() => {
      longPressed.current = true
      onLongPress()
    }, LONG_PRESS_MS)
  }
  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }
  const click = () => {
    if (longPressed.current) return
    if (selecting) onToggle()
    else onOpen()
  }

  const t: Transaction = item.kind === "single" ? item.transaction : item.source
  const corner =
    item.kind === "exchange" ? { label: "Exchange", style: undefined } : t.type === "init" ? { label: "Opening balance", style: undefined } : category
      ? { label: `${category.emoji ? `${category.emoji} ` : ""}${category.name}`, style: { background: hueColor(category.hue) } }
      : null
  const hidden = t.hiddenFromAnalysis

  const wallet =
    item.kind === "exchange" ? (
      <WalletLine>
        {walletName(item.source.walletId) ?? "Unassigned"}
        <ArrowRight size={12} weight="bold" />
        {walletName(item.target.walletId) ?? "Unassigned"}
      </WalletLine>
    ) : (
      <WalletLine muted={t.walletId === null}>{walletName(t.walletId) ?? "Unassigned"}</WalletLine>
    )

  return (
    <article
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => {
        e.preventDefault()
        onLongPress()
      }}
      onClick={click}
      aria-selected={selecting ? selected : undefined}
      className={cn("relative cursor-pointer select-none border-3 border-ink p-3 shadow-hard lift", hidden ? "bg-grey" : "bg-white", selecting && "pl-12")}
    >
      {selecting ? (
        <span
          aria-hidden
          className={cn(
            "absolute top-0 left-0 flex size-7 items-center justify-center border-r-3 border-b-3 border-ink",
            selected ? "bg-accent" : "bg-white"
          )}
        >
          {selected ? <Check size={18} weight="bold" /> : null}
        </span>
      ) : null}
      {/* Reverse row that wraps: the badge sits in the corner and, when the amounts cannot fit beside it, they drop below it. */}
      <div className="flex flex-row-reverse flex-wrap justify-end gap-x-2">
        {corner ? (
          <Badge
            className={cn("-mt-3 -mr-3 ml-auto h-5 max-w-full border-t-0 border-r-0 px-1.5 text-[10px]", t.type !== "change" && "bg-paper text-grey-ink")}
            style={corner.style}
          >
            <span className="truncate">{corner.label}</span>
          </Badge>
        ) : null}
        {item.kind === "exchange" ? (
          <div className="flex flex-wrap gap-x-3">
            <span className={amountClass(item.source.amountMinor)}>{signedMoney(item.source.amountMinor, item.source.currency)}</span>
            <span className={amountClass(item.target.amountMinor)}>{signedMoney(item.target.amountMinor, item.target.currency)}</span>
          </div>
        ) : (
          <div className={amountClass(t.amountMinor)}>{signedMoney(t.amountMinor, t.currency)}</div>
        )}
      </div>
      {t.description ? <div className={cn("mt-0.5 font-sans text-base", hidden && "text-grey-ink")}>{t.description}</div> : null}
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {t.tags.map((tag) => (
            <Badge key={tag} prefix="#" className="h-5 px-1.5 text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
        {wallet}
      </div>
    </article>
  )
}
