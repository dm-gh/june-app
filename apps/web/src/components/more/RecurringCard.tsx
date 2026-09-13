import type { Category, Recurring } from "@june/shared"
import { useNavigate } from "react-router"
import { hueColor, signedMoney } from "../../lib/format"
import { Badge, Button, cn } from "../../ui"
import { dueState, scheduleWords } from "./recurring"

export interface RecurringCardProps {
  recurring: Recurring
  category: Category | undefined
  onSubmit?: (() => void) | undefined
}

/**
 * A Transaction card with the name first: the category tag flush in the corner, the amount (and
 * Submit beside it for a manual Recurring), the description, then the Schedule line with the Auto
 * badge, the words, the next date and, quietly, how overdue it is.
 */
export function RecurringCard({ recurring: r, category, onSubmit }: RecurringCardProps) {
  const navigate = useNavigate()
  const due = dueState(r)
  return (
    <article
      onClick={() => navigate(`/more/recurrings/${r.id}`)}
      className="relative cursor-pointer select-none border-3 border-ink bg-white p-3 pt-4 shadow-hard lift"
    >
      <div className="flex flex-row-reverse flex-wrap justify-end gap-x-2">
        {category ? (
          <Badge className="-mt-4 -mr-3 ml-auto h-5 max-w-full border-t-0 border-r-0 px-1.5 text-[10px]" style={{ background: hueColor(category.hue) }}>
            <span className="truncate">
              {category.emoji ? `${category.emoji} ` : ""}
              {category.name}
            </span>
          </Badge>
        ) : null}
        <div className="font-heading font-bold">{r.name}</div>
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
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-grey-ink">
        {r.auto ? (
          <Badge accent="green" className="h-5 px-1.5 text-[10px]">
            Auto
          </Badge>
        ) : null}
        <span>{scheduleWords(r)}</span>
        {due.label ? <span>· {due.label}</span> : null}
        {due.overdue ? <span className="text-coral-ink">{due.overdue}</span> : null}
        {r.walletId === null ? <span className="text-coral-ink">Needs a wallet</span> : null}
      </div>
    </article>
  )
}
