import type { Category, Recurring } from "@june/shared"
import { useNavigate } from "react-router"
import { Badge, Button, categoryCorner, ListAmount, ListCard } from "../../ui"
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
    <ListCard
      corner={category ? categoryCorner(category) : null}
      title={r.name}
      description={r.description}
      tags={r.tags}
      trailing={{ label: walletName ?? "Needs a wallet", tone: walletName ? "ink" : "coral" }}
      onOpen={interactive ? () => navigate(`/more/recurrings/${r.id}`) : undefined}
      footer={
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
      }
    >
      <div className="mt-1 flex items-center justify-between gap-3">
        <ListAmount minor={r.amountMinor} currency={r.currency} />
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
    </ListCard>
  )
}
