import type { Category } from "@june/shared"
import { Check } from "@phosphor-icons/react"
import { type CSSProperties, type MouseEvent, type ReactNode, useRef } from "react"
import { hueColor, moneyCode, signedMoney } from "../lib/format"
import { Badge } from "./Badge"
import type { Accent } from "./Card"
import { cn } from "./cn"

/**
 * The card every list of money-things is made of: Transactions, Recurrings, Loans. One shell,
 * one tag flush in the top-right corner, one reverse row beside it that wraps under it when they
 * cannot share the line, Tag chips bottom-left, a small uppercase line bottom-right, and the long
 * press that starts selection. Adapters decide what goes in each slot; nothing here knows a domain
 * type beyond a Category's look.
 */

/** The tag flush in the top-right corner: a Category, "Opening balance", "Lent". */
export interface ListCardCorner {
  label: ReactNode
  /** Inline colour, for a Category's Hue. */
  style?: CSSProperties | undefined
  accent?: Accent | undefined
  /** Paper with grey text, for anything that is not a Category. */
  muted?: boolean | undefined
}

/** The small uppercase line bottom-right: the Wallet, or what is missing instead. */
export interface ListCardTrailing {
  label: ReactNode
  tone?: "ink" | "muted" | "coral" | undefined
}

/** Long-press starts selection; while selecting a click toggles the card instead of opening it. */
export interface ListCardSelection {
  selecting: boolean
  selected: boolean
  onToggle: () => void
  onLongPress: () => void
}

export interface ListCardProps {
  corner?: ListCardCorner | null | undefined
  /** The name, in heading type, beside the corner. */
  title?: string | undefined
  /** Anything else beside the corner, such as the amount. Ignored when `title` is given. */
  headline?: ReactNode
  /** Body lines under the corner row, before the description. */
  children?: ReactNode
  description?: string | null | undefined
  /** Tag chips bottom-left. The bottom row renders when either Tags or a trailing line is given. */
  tags?: ReadonlyArray<string> | undefined
  trailing?: ListCardTrailing | undefined
  /** Lines under the bottom row. */
  footer?: ReactNode
  /** Grey: Hidden from analysis, Archived. */
  muted?: boolean | undefined
  /** Given, the card lifts and a click opens it. */
  onOpen?: (() => void) | undefined
  selectable?: ListCardSelection | undefined
  className?: string | undefined
}

const LONG_PRESS_MS = 450

const trailingTone = { ink: "text-ink", muted: "text-grey-ink", coral: "text-coral-ink" } as const

export function ListCard({ corner, title, headline, children, description, tags, trailing, footer, muted, onOpen, selectable, className }: ListCardProps) {
  const timer = useRef<number | null>(null)
  const longPressed = useRef(false)
  const selecting = selectable?.selecting === true
  const interactive = onOpen !== undefined || selecting

  const start = () => {
    longPressed.current = false
    timer.current = window.setTimeout(() => {
      longPressed.current = true
      selectable?.onLongPress()
    }, LONG_PRESS_MS)
  }
  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }
  const click = () => {
    if (longPressed.current) return
    if (selectable?.selecting) selectable.onToggle()
    else onOpen?.()
  }
  const press = selectable
    ? {
        onPointerDown: start,
        onPointerUp: cancel,
        onPointerLeave: cancel,
        onPointerCancel: cancel,
        onContextMenu: (e: MouseEvent) => {
          e.preventDefault()
          selectable.onLongPress()
        }
      }
    : {}

  return (
    <article
      {...press}
      onClick={interactive ? click : undefined}
      aria-selected={selecting ? selectable?.selected : undefined}
      className={cn(
        "relative select-none border-3 border-ink p-3 shadow-hard",
        muted ? "bg-grey" : "bg-white",
        interactive && "cursor-pointer lift",
        selecting && "pl-12",
        className
      )}
    >
      {selecting ? (
        <span
          aria-hidden
          className={cn(
            "absolute top-0 left-0 flex size-7 items-center justify-center border-r-3 border-b-3 border-ink",
            selectable?.selected ? "bg-accent" : "bg-white"
          )}
        >
          {selectable?.selected ? <Check size={18} weight="bold" /> : null}
        </span>
      ) : null}
      {/* Reverse row that wraps: the corner tag stays put and the headline drops under it when they cannot share the line. */}
      <div className="flex flex-row-reverse flex-wrap justify-end gap-x-2">
        {corner ? (
          <Badge
            accent={corner.accent ?? "paper"}
            style={corner.style}
            className={cn("-mt-3 -mr-3 ml-auto h-5 max-w-full border-t-0 border-r-0 px-1.5 text-[10px]", corner.muted && "bg-paper text-grey-ink")}
          >
            <span className="truncate">{corner.label}</span>
          </Badge>
        ) : null}
        {title !== undefined ? <div className="min-w-0 pt-1 font-heading font-bold">{title}</div> : headline}
      </div>
      {children}
      {description ? <div className={cn("mt-0.5 font-sans text-base", muted && "text-grey-ink")}>{description}</div> : null}
      {tags !== undefined || trailing !== undefined ? (
        <div className="mt-2 flex items-end justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {tags?.map((tag) => (
              <Badge key={tag} prefix="#" className="h-5 px-1.5 text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
          {trailing ? (
            <span className={cn("inline-flex shrink-0 items-center gap-1 font-heading text-xs font-bold uppercase tracking-wide", trailingTone[trailing.tone ?? "ink"])}>
              {trailing.label}
            </span>
          ) : null}
        </div>
      ) : null}
      {footer}
    </article>
  )
}

/** The tone of money: coral going out, green coming in, ink at zero. Defined once for every list card. */
export const amountClass = (minor: number): string =>
  cn("font-mono text-2xl font-bold tabular-nums whitespace-nowrap", minor < 0 ? "text-coral-ink" : minor > 0 ? "text-green-ink" : "text-ink")

export interface ListAmountProps {
  minor: number
  currency: string
  /** A leading sign, as a flow reads; off for a position such as a Loan. */
  signed?: boolean | undefined
  className?: string | undefined
}

/** The big amount on a list card. */
export function ListAmount({ minor, currency, signed = true, className }: ListAmountProps) {
  return <div className={cn(amountClass(minor), className)}>{signed ? signedMoney(minor, currency) : moneyCode(minor, currency)}</div>
}

/** A Category as a corner tag: its emoji and name on its Hue. */
export const categoryCorner = (category: Pick<Category, "name" | "emoji" | "hue">, muted?: boolean): ListCardCorner => ({
  label: `${category.emoji ? `${category.emoji} ` : ""}${category.name}`,
  style: { background: hueColor(category.hue) },
  muted
})
