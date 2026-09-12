import type { Category, Transaction } from "@june/shared"
import { Check } from "@phosphor-icons/react"
import { useRef } from "react"
import { hueColor, signedMoney } from "../../lib/format"
import { Badge, cn } from "../../ui"

export interface TransactionCardProps {
  transaction: Transaction
  category: Category | undefined
  selecting: boolean
  selected: boolean
  onOpen: () => void
  onToggle: () => void
  onLongPress: () => void
}

const LONG_PRESS_MS = 450

/**
 * The amount dominates, the description sits under it, Tags as small chips, the Category as a tag
 * flush in the top-right corner. Grey means Hidden from analysis. Long-press starts selection.
 */
export function TransactionCard({ transaction: t, category, selecting, selected, onOpen, onToggle, onLongPress }: TransactionCardProps) {
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

  const tone = t.amountMinor < 0 ? "text-coral-ink" : "text-green-ink"
  const corner =
    t.type === "init" ? { label: "Opening balance", style: undefined } : t.type === "exchange" ? { label: "Exchange", style: undefined } : category
      ? { label: `${category.emoji ? `${category.emoji} ` : ""}${category.name}`, style: { background: hueColor(category.hue) } }
      : null

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
      className={cn(
        "relative cursor-pointer select-none border-3 border-ink p-3 shadow-hard lift",
        t.hiddenFromAnalysis ? "bg-grey" : "bg-white",
        selecting && "pl-12"
      )}
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
      {/* Reverse row that wraps: the badge sits in the corner and, when the amount cannot fit beside it, the amount drops below it. */}
      <div className="flex flex-row-reverse flex-wrap justify-end gap-x-2">
        {corner ? (
          <Badge
            className={cn("-mt-3 -mr-3 ml-auto h-5 max-w-full border-t-0 border-r-0 px-1.5 text-[10px]", t.type !== "change" && "bg-paper text-grey-ink")}
            style={corner.style}
          >
            <span className="truncate">{corner.label}</span>
          </Badge>
        ) : null}
        <div className={cn("font-mono text-2xl font-bold tabular-nums whitespace-nowrap", tone)}>{signedMoney(t.amountMinor, t.currency)}</div>
      </div>
      {t.description ? (
        <div className={cn("mt-0.5 font-sans text-base", t.hiddenFromAnalysis && "text-grey-ink")}>{t.description}</div>
      ) : null}
      {t.tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {t.tags.map((tag) => (
            <Badge key={tag} prefix="#" className="h-5 px-1.5 text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}
    </article>
  )
}
