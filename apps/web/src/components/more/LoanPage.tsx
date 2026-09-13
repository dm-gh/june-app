import type { LoanId } from "@june/shared"
import { ArrowLeft, Trash } from "@phosphor-icons/react"
import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import { useDeleteLoan, useLoan, useUpdateLoan } from "../../api/queries"
import { AppShell } from "../../layout/AppShell"
import { StickyBar } from "../../layout/StickyBar"
import { moneyCode } from "../../lib/format"
import { formatLongDate } from "../../lib/period"
import { Badge, Button, Card, cn, Dialog, Display, ErrorNotice, IconButton, Loading, Menu, Text } from "../../ui"
import { direction } from "./LoanCard"

/** A Loan's page: the position, Settle, Edit and Archive. Delete sits behind the menu. */
export function LoanPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const loan = useLoan(id as LoanId)
  const update = useUpdateLoan()
  const remove = useDeleteLoan()
  const [confirm, setConfirm] = useState(false)
  const l = loan.data
  const lent = (l?.amountMinor ?? 0) >= 0
  const zero = l?.amountMinor === 0
  const who = l?.description || "this loan"
  const toLocal = (d: { epochMillis: number }) => formatLongDate(new Date(d.epochMillis).toISOString().slice(0, 10) as never)

  return (
    <AppShell width="form">
      <StickyBar className="pb-2">
        <div className="-ml-2.5 flex items-center justify-between">
          <IconButton icon={ArrowLeft} label="Back" onClick={() => navigate(l?.archived ? "/more/loans/archive" : "/more")} />
          {l ? <Menu items={[{ label: "Delete", icon: Trash, danger: true, onSelect: () => setConfirm(true) }]} /> : null}
        </div>
      </StickyBar>
      <Display size="sm" className="mt-2 mb-5">
        {l ? l.description || "Loan" : "Loan"}
      </Display>
      {loan.isError ? <ErrorNotice message={loan.error.message} /> : null}
      {loan.isPending ? <Loading /> : null}
      {l ? (
        <div className="flex flex-col gap-5">
          <Card className={cn("relative p-3 pt-4", l.archived && "bg-grey")}>
            <Badge accent={lent ? "green" : "coral"} className="absolute -top-[3px] -right-[3px] h-5 border-t-0 border-r-0 px-1.5 text-[10px]">
              {direction(l)}
            </Badge>
            <div className={cn("font-mono text-3xl font-bold tabular-nums", zero ? "text-ink" : lent ? "text-green-ink" : "text-coral-ink")}>
              {moneyCode(Math.abs(l.amountMinor), l.currency)}
            </div>
            <div className="mt-1 font-mono text-xs text-grey-ink">
              Since {toLocal(l.createdAt)}
              {l.archived ? " · Archived" : ""}
            </div>
          </Card>
          <Text className="text-sm text-grey-ink">
            {zero ? "Nothing outstanding." : lent ? `${who} owes you ${moneyCode(l.amountMinor, l.currency)}.` : `You owe ${who} ${moneyCode(-l.amountMinor, l.currency)}.`}{" "}
            Settle records money coming back, or more going out, as a transaction hidden from analysis, and moves this amount.
          </Text>
          <Button size="lg" onClick={() => navigate(`/transactions/new?loan=${l.id}`)}>
            Settle
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => navigate(`/more/loans/${l.id}/edit`)}>
              Edit
            </Button>
            <Button variant="secondary" disabled={update.isPending} onClick={() => update.mutate({ id: l.id, payload: { archived: !l.archived } })}>
              {l.archived ? "Unarchive" : "Archive"}
            </Button>
          </div>
          {update.error ? <ErrorNotice message={update.error.message} /> : null}
          {remove.error ? <ErrorNotice message={remove.error.message} /> : null}
        </div>
      ) : null}
      <div className="pb-8" />
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
