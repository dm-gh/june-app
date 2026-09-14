import type { Loan } from "@june/shared"
import { useNavigate } from "react-router"
import { routes } from "../../routes"
import { ListAmount, ListCard } from "../../ui"

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
  return (
    <ListCard
      corner={{ label: direction(loan), accent: loan.amountMinor < 0 ? "coral" : "green" }}
      title={loan.description || "Loan"}
      muted={loan.archived}
      onOpen={interactive ? () => navigate(routes.loan(loan.id)) : undefined}
    >
      <ListAmount minor={loan.amountMinor} currency={loan.currency} signed={false} className="mt-1" />
      {detail ? <div className="mt-1 font-mono text-xs text-grey-ink">{detail}</div> : null}
    </ListCard>
  )
}
