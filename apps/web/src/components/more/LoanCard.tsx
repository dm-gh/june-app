import type { Loan } from "@june/shared"
import { useNavigate } from "react-router"
import { moneyCode } from "../../lib/format"
import { Badge, cn } from "../../ui"

/** Lent or Borrowed, read from the sign. */
export const direction = (loan: Pick<Loan, "amountMinor">): "Lent" | "Borrowed" => (loan.amountMinor < 0 ? "Borrowed" : "Lent")

export interface LoanCardProps {
  loan: Loan
  /** In a list the card opens the Loan's page; on that page it just sits there. */
  interactive?: boolean
  /** A line under the amount, for the page. */
  detail?: string | undefined
}

/**
 * The other party first, a Lent (green) or Borrowed (coral) tag flush in the corner like a
 * Transaction's category, the amount in the same colour. Archived cards are grey.
 */
export function LoanCard({ loan, interactive = true, detail }: LoanCardProps) {
  const navigate = useNavigate()
  const lent = loan.amountMinor >= 0
  const zero = loan.amountMinor === 0
  return (
    <article
      onClick={interactive ? () => navigate(`/more/loans/${loan.id}`) : undefined}
      className={cn("select-none border-3 border-ink p-3 shadow-hard", loan.archived ? "bg-grey" : "bg-white", interactive && "cursor-pointer lift")}
    >
      <div className="flex flex-row-reverse flex-wrap justify-end gap-x-2">
        <Badge accent={lent ? "green" : "coral"} className="-mt-3 -mr-3 ml-auto h-5 border-t-0 border-r-0 px-1.5 text-[10px]">
          {direction(loan)}
        </Badge>
        <div className="min-w-0 pt-1 font-heading font-bold">{loan.description || "Loan"}</div>
      </div>
      <div className={cn("mt-1 font-mono text-2xl font-bold tabular-nums whitespace-nowrap", zero ? "text-ink" : lent ? "text-green-ink" : "text-coral-ink")}>
        {moneyCode(Math.abs(loan.amountMinor), loan.currency)}
      </div>
      {detail ? <div className="mt-1 font-mono text-xs text-grey-ink">{detail}</div> : null}
    </article>
  )
}
