import { CaretRight } from "@phosphor-icons/react"
import { Link } from "react-router"
import { useAttention } from "../api/queries"
import { Card, Text } from "../ui"

/** Anything that needs a Wallet: Recurrings whose Wallet was deleted, Transactions left Unassigned. */
export const useAttentionNeeded = (): boolean => {
  const attention = useAttention()
  return (attention.data?.recurringsWithoutWallet ?? 0) + (attention.data?.unassignedTransactions ?? 0) > 0
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/**
 * "Some items need attention", on every tabbed screen while a Recurring has no Wallet or a
 * Transaction is Unassigned. Leads to the list that holds the first kind of item.
 */
export function AttentionBanner() {
  const attention = useAttention()
  const recurrings = attention.data?.recurringsWithoutWallet ?? 0
  const unassigned = attention.data?.unassignedTransactions ?? 0
  const parts = [
    ...(recurrings > 0 ? [`${plural(recurrings, "recurring")} ${recurrings === 1 ? "has" : "have"} no wallet`] : []),
    ...(unassigned > 0 ? [`${plural(unassigned, "transaction")} ${unassigned === 1 ? "is" : "are"} unassigned`] : [])
  ]
  return (
    <Link to={recurrings > 0 ? "/more" : "/transactions"} className="block">
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
