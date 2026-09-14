import type { LoanId } from "@june/shared"
import { Archive, ArrowCounterClockwise, PencilSimple } from "@phosphor-icons/react"
import { useNavigate, useParams } from "react-router"
import { useDeleteLoan, useLoan, useUpdateLoan } from "../../api/queries"
import { Page } from "../../layout/Page"
import { useDeleteConfirm } from "../../layout/useDeleteConfirm"
import { formatLongDate, fromEpochMillis } from "../../lib/period"
import { Button, QueryState } from "../../ui"
import { addTransactionFor } from "../transactions/AddTransactionPage"
import { LoanCard } from "./LoanCard"

/** A Loan's page: the same card as the list, and Settle. Edit, Archive and Delete sit behind the menu. */
export function LoanPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const loan = useLoan(id as LoanId)
  const update = useUpdateLoan()
  const remove = useDeleteLoan()
  const l = loan.data
  const confirmDelete = useDeleteConfirm({
    remove,
    id: l?.id,
    title: `Delete ${l?.description || "this loan"}?`,
    body: "Any transactions recorded while settling it stay.",
    after: () => navigate("/more")
  })
  const since = (d: { epochMillis: number }) => formatLongDate(fromEpochMillis(d.epochMillis))

  return (
    <Page
      title={l ? l.description || "Loan" : "Loan"}
      backTo={l?.archived ? "/more/loans/archive" : "/more"}
      menu={
        l
          ? [
              { label: "Edit", icon: PencilSimple, onSelect: () => navigate(`/more/loans/${l.id}/edit`) },
              {
                label: l.archived ? "Unarchive" : "Archive",
                icon: l.archived ? ArrowCounterClockwise : Archive,
                disabled: update.isPending,
                onSelect: () => update.mutate({ id: l.id, payload: { archived: !l.archived } })
              },
              confirmDelete.menuItem
            ]
          : undefined
      }
      error={update.error?.message ?? remove.error?.message ?? null}
    >
      <QueryState of={loan} />
      {l ? (
        <div className="flex flex-col gap-5">
          <LoanCard loan={l} interactive={false} detail={`Since ${since(l.createdAt)}${l.archived ? " · Archived" : ""}`} />
          <Button size="lg" onClick={() => navigate(addTransactionFor({ loan: l.id }))}>
            Settle
          </Button>
        </div>
      ) : null}
      {confirmDelete.dialog}
    </Page>
  )
}
