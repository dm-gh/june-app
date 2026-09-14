import type { LoanId } from "@june/shared"
import { Archive, ArrowCounterClockwise, ArrowLeft, PencilSimple, Trash } from "@phosphor-icons/react"
import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import { useDeleteLoan, useLoan, useUpdateLoan } from "../../api/queries"
import { AppShell } from "../../layout/AppShell"
import { StickyBar } from "../../layout/StickyBar"
import { formatLongDate, fromEpochMillis } from "../../lib/period"
import { Button, Dialog, Display, ErrorNotice, IconButton, Loading, Menu } from "../../ui"
import { LoanCard } from "./LoanCard"

/** A Loan's page: the same card as the list, and Settle. Edit, Archive and Delete sit behind the menu. */
export function LoanPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const loan = useLoan(id as LoanId)
  const update = useUpdateLoan()
  const remove = useDeleteLoan()
  const [confirm, setConfirm] = useState(false)
  const l = loan.data
  const who = l?.description || "this loan"
  const since = (d: { epochMillis: number }) => formatLongDate(fromEpochMillis(d.epochMillis))

  return (
    <AppShell width="form">
      <StickyBar className="pb-2">
        <div className="-ml-2.5 flex items-center justify-between">
          <IconButton icon={ArrowLeft} label="Back" onClick={() => navigate(l?.archived ? "/more/loans/archive" : "/more")} />
          {l ? (
            <Menu
              items={[
                { label: "Edit", icon: PencilSimple, onSelect: () => navigate(`/more/loans/${l.id}/edit`) },
                {
                  label: l.archived ? "Unarchive" : "Archive",
                  icon: l.archived ? ArrowCounterClockwise : Archive,
                  disabled: update.isPending,
                  onSelect: () => update.mutate({ id: l.id, payload: { archived: !l.archived } })
                },
                { label: "Delete", icon: Trash, danger: true, onSelect: () => setConfirm(true) }
              ]}
            />
          ) : null}
        </div>
      </StickyBar>
      <Display size="sm" className="mt-2 mb-5">
        {l ? l.description || "Loan" : "Loan"}
      </Display>
      {loan.isError ? <ErrorNotice message={loan.error.message} /> : null}
      {loan.isPending ? <Loading /> : null}
      {l ? (
        <div className="flex flex-col gap-5">
          <LoanCard loan={l} interactive={false} detail={`Since ${since(l.createdAt)}${l.archived ? " · Archived" : ""}`} />
          <Button size="lg" onClick={() => navigate(`/transactions/new?loan=${l.id}`)}>
            Settle
          </Button>
          {update.error ? <ErrorNotice message={update.error.message} /> : null}
          {remove.error ? <ErrorNotice message={remove.error.message} /> : null}
        </div>
      ) : null}
      <Dialog
        open={confirm}
        title={`Delete ${who}?`}
        body="Any transactions recorded while settling it stay."
        confirmLabel="Delete"
        danger
        busy={remove.isPending}
        onConfirm={() => l && remove.mutate(l.id, { onSuccess: () => navigate("/more") })}
        onCancel={() => setConfirm(false)}
      />
    </AppShell>
  )
}
