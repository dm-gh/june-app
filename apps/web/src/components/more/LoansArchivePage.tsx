import { useLoans } from "../../api/queries"
import { ListPage } from "../../layout/Page"
import { routes } from "../../routes"
import { Empty, QueryState, Text } from "../../ui"
import { LoanCard } from "./LoanCard"

/** Loans set aside: settled ones land here by themselves, any can be brought back or deleted from its page. */
export function LoansArchivePage() {
  const loans = useLoans()
  const archived = (loans.data ?? []).filter((l) => l.archived)
  return (
    <ListPage title="Archive" backTo={routes.more}>
      <Text className="mb-3 text-sm text-grey-ink">Loans set aside. A settled loan lands here by itself; open one to bring it back or delete it.</Text>
      <QueryState of={loans} />
      {loans.data && archived.length === 0 ? <Empty>Nothing archived.</Empty> : null}
      <div className="flex flex-col gap-3">
        {archived.map((l) => (
          <LoanCard key={l.id} loan={l} />
        ))}
      </div>
    </ListPage>
  )
}
