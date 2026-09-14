import type { Category, Recurring } from "@june/shared"
import { useNavigate } from "react-router"
import { hueColor, signedMoney } from "../../lib/format"
import { Badge, Button, cn } from "../../ui"
import { dueState, scheduleWords } from "./recurring"

export interface RecurringCardProps {
  recurring: Recurring
  category: Category | undefined
  /** The Wallet's name; null once the Wallet was deleted. */
  walletName: string | null
  /** A manual Recurring carries Submit on its card. */
  onSubmit?: (() => void) | undefined
  /** In a list the card opens the Recurring's page; on that page it just sits there. */
  interactive?: boolean
}

/**
 * The Transaction card with the name first: the category tag flush in the corner, the amount
 * (and Submit beside it for a manual Recurring), the description, the Tags and the Wallet as on
 * a Transaction, then the Schedule line with the Auto badge, the words, the next date and, quietly,
 * how overdue it is.
 */
export function RecurringCard({ recurring: r, category, walletName, onSubmit, interactive = true }: RecurringCardProps) {
  const navigate = useNavigate()
  const due = dueState(r)
  return (
    <article
      onClick={interactive ? () => navigate(`/more/recurrings/${r.id}`) : undefined}
      className={cn("relative select-none border-3 border-ink bg-white p-3 shadow-hard", interactive && "cursor-pointer lift")}
    >
      {/* Reverse row that wraps: the tag sits in the corner and the name drops under it when they cannot share the line. */}
      <div className="flex flex-row-reverse flex-wrap justify-end gap-x-2">
        {category ? (
          <Badge className="-mt-3 -mr-3 ml-auto h-5 max-w-full border-t-0 border-r-0 px-1.5 text-[10px]" style={{ background: hueColor(category.hue) }}>
            <span className="truncate">
              {category.emoji ? `${category.emoji} ` : ""}
              {category.name}
            </span>
          </Badge>
        ) : null}
        <div className="pt-1 font-heading font-bold">{r.name}</div>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <div className={cn("font-mono text-2xl font-bold tabular-nums whitespace-nowrap", r.amountMinor < 0 ? "text-coral-ink" : "text-green-ink")}>
          {signedMoney(r.amountMinor, r.currency)}
        </div>
        {onSubmit ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onSubmit()
            }}
          >
            Submit
          </Button>
        ) : null}
      </div>
      {r.description ? <div className="mt-0.5 font-sans text-base">{r.description}</div> : null}
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {r.tags.map((tag) => (
            <Badge key={tag} prefix="#" className="h-5 px-1.5 text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
        <span className={cn("shrink-0 font-heading text-xs font-bold uppercase tracking-wide", walletName ? "text-ink" : "text-coral-ink")}>
          {walletName ?? "Needs a wallet"}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-grey-ink">
        {r.auto ? (
          <Badge accent="green" className="h-5 px-1.5 text-[10px]">
            Auto
          </Badge>
        ) : null}
        <span>{scheduleWords(r)}</span>
        {due.label ? <span>· {due.label}</span> : null}
        {due.overdue ? <span className="text-coral-ink">{due.overdue}</span> : null}
      </div>
    </article>
  )
}
