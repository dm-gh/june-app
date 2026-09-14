import type { Recurring } from "@june/shared"
import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { useCategoryIndex, useLoans, useRecurrings, useWalletIndex } from "../../api/queries"
import { ListPage } from "../../layout/Page"
import { routes } from "../../routes"
import { Button, Empty, Heading, QueryState } from "../../ui"
import { LoanCard } from "./LoanCard"
import { RecurringCard } from "./RecurringCard"
import { SubmitDialog } from "./SubmitDialog"

/** More: Recurrings and Loans, each a full list with "+ Add" in its heading. No period, no filter. */
export function MorePage() {
  const navigate = useNavigate()
  const recurrings = useRecurrings()
  const loans = useLoans()
  const categories = useCategoryIndex()
  const wallets = useWalletIndex()
  const [submitting, setSubmitting] = useState<Recurring | null>(null)
  const live = (loans.data ?? []).filter((l) => !l.archived)
  const archived = (loans.data ?? []).filter((l) => l.archived)

  return (
    <ListPage title="More">
      <div className="mt-2 flex items-center justify-between">
        <Heading as="h2">Recurring</Heading>
        <Button variant="secondary" size="sm" onClick={() => navigate(routes.addRecurring)}>
          + Add
        </Button>
      </div>
      <QueryState of={recurrings} />
      {recurrings.data && recurrings.data.length === 0 ? <Empty>Nothing repeats yet. Add rent, a salary or a subscription.</Empty> : null}
      <div className="mt-3 flex flex-col gap-3">
        {(recurrings.data ?? []).map((r) => (
          <RecurringCard
            key={r.id}
            recurring={r}
            category={categories.get(r.categoryId)}
            walletName={wallets.name(r.walletId)}
            onSubmit={r.auto ? undefined : () => setSubmitting(r)}
          />
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Heading as="h2">Loans</Heading>
        <Button variant="secondary" size="sm" onClick={() => navigate(routes.addLoan)}>
          + Add
        </Button>
      </div>
      <QueryState of={loans} />
      {loans.data && live.length === 0 ? <Empty>No open loans. Money you lend or borrow goes here so it is not forgotten.</Empty> : null}
      <div className="mt-3 flex flex-col gap-3">
        {live.map((l) => (
          <LoanCard key={l.id} loan={l} />
        ))}
      </div>
      {archived.length > 0 ? (
        <div className="mt-3 flex justify-end">
          <Link to={routes.loansArchive} className="font-heading text-sm font-bold hover:underline">
            Archive ({archived.length}) ›
          </Link>
        </div>
      ) : null}

      {submitting ? <SubmitDialog recurring={submitting} onClose={() => setSubmitting(null)} /> : null}
    </ListPage>
  )
}
