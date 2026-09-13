import type { Loan } from "@june/shared"
import { useNavigate } from "react-router"
import { moneyCode } from "../../lib/format"
import { Badge, cn } from "../../ui"

/** Lent or Borrowed, read from the sign. */
export const direction = (loan: Pick<Loan, "amountMinor">): "Lent" | "Borrowed" => (loan.amountMinor < 0 ? "Borrowed" : "Lent")

/** The other party first, a Lent (green) or Borrowed (coral) badge, the amount in the same colour. Archived cards are grey. */
export function LoanCard({ loan }: { loan: Loan }) {
  const navigate = useNavigate()
  const lent = loan.amountMinor >= 0
  const zero = loan.amountMinor === 0
  return (
    <article
      onClick={() => navigate(`/more/loans/${loan.id}`)}
      className={cn("cursor-pointer select-none border-3 border-ink p-3 shadow-hard lift", loan.archived ? "bg-grey" : "bg-white")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 truncate font-heading font-bold">{loan.description || "Loan"}</div>
        <Badge accent={lent ? "green" : "coral"} className="h-5 px-1.5 text-[10px]">
          {direction(loan)}
        </Badge>
      </div>
      <div className={cn("mt-1 font-mono text-2xl font-bold tabular-nums whitespace-nowrap", zero ? "text-ink" : lent ? "text-green-ink" : "text-coral-ink")}>
        {moneyCode(Math.abs(loan.amountMinor), loan.currency)}
      </div>
    </article>
  )
}
