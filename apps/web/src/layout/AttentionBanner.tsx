import { CaretRight } from "@phosphor-icons/react"
import { Link } from "react-router"
import { useAttention } from "../api/queries"
import { plural } from "../lib/format"
import { routes } from "../routes"
import { Card, Text } from "../ui"

/** Anything that needs a Wallet: Recurrings whose Wallet was deleted, Transactions left Unassigned. */
export const useAttentionNeeded = (): boolean => {
  const attention = useAttention()
  return (attention.data?.recurringsWithoutWallet ?? 0) + (attention.data?.unassignedTransactions ?? 0) > 0
}

/**
 * "Some items need attention", on every tabbed screen while a Recurring has no Wallet or a
 * Transaction is Unassigned. Leads to the list that holds the first kind of item.
 */
export function AttentionBanner() {
  const attention = useAttention()
  const recurrings = attention.data?.recurringsWithoutWallet ?? 0
  const unassigned = attention.data?.unassignedTransactions ?? 0
  const parts = [
    ...(recurrings > 0 ? [`${recurrings} ${plural(recurrings, "recurring")} ${plural(recurrings, "has", "have")} no wallet`] : []),
    ...(unassigned > 0 ? [`${unassigned} ${plural(unassigned, "transaction")} ${plural(unassigned, "is", "are")} unassigned`] : [])
  ]
  return (
    <Link to={recurrings > 0 ? routes.more : routes.transactions} className="block">
      <Card accent="coral" shadow="sm" className="flex items-center gap-3 p-3 lift">
        <div className="min-w-0 flex-1">
          <div className="font-heading font-bold">Some items need attention</div>
          <Text className="text-sm">{parts.join(", ")}</Text>
        </div>
        <CaretRight size={22} weight="bold" />
      </Card>
    </Link>
  )
}
