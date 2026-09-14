import type { RecurringId } from "@june/shared"
import { ArrowLeft, PencilSimple, Trash } from "@phosphor-icons/react"
import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import { useCategoryIndex, useDeleteRecurring, useRecurring, useWalletIndex } from "../../api/queries"
import { AppShell } from "../../layout/AppShell"
import { StickyBar } from "../../layout/StickyBar"
import { formatLongDate } from "../../lib/period"
import { Badge, Button, Card, Dialog, Display, ErrorNotice, IconButton, Label, Loading, Menu } from "../../ui"
import { dueState, scheduleWords } from "./recurring"
import { RecurringCard } from "./RecurringCard"
import { SubmitDialog } from "./SubmitDialog"

/** A Recurring's page: the same card as the list, its Schedule, and Submit. Edit and Delete sit behind the menu. */
export function RecurringPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const recurring = useRecurring(id as RecurringId)
  const categories = useCategoryIndex()
  const wallets = useWalletIndex()
  const remove = useDeleteRecurring()
  const [submitting, setSubmitting] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const r = recurring.data
  const category = categories.get(r?.categoryId)
  const wallet = r?.walletId ? wallets.byId.get(r.walletId) : undefined
  const due = r ? dueState(r) : null

  return (
    <AppShell width="form">
      <StickyBar className="pb-2">
        <div className="-ml-2.5 flex items-center justify-between">
          <IconButton icon={ArrowLeft} label="Back" onClick={() => navigate("/more")} />
          {r ? (
            <Menu
              items={[
                { label: "Edit", icon: PencilSimple, onSelect: () => navigate(`/more/recurrings/${r.id}/edit`) },
                { label: "Delete", icon: Trash, danger: true, onSelect: () => setConfirm(true) }
              ]}
            />
          ) : null}
        </div>
      </StickyBar>
      <Display size="sm" className="mt-2 mb-5">
        {r?.name ?? "Recurring"}
      </Display>
      {recurring.isError ? <ErrorNotice message={recurring.error.message} /> : null}
      {recurring.isPending ? <Loading /> : null}
      {r && due ? (
        <div className="flex flex-col gap-5">
          <RecurringCard recurring={r} category={category} walletName={wallet ? `${wallet.name} · ${wallet.currency}` : null} interactive={false} />

          <Card accent="sky" shadow="sm" className="p-3">
            <div className="flex items-center justify-between">
              <Label as="div">Schedule</Label>
              {r.auto ? (
                <Badge accent="green" className="h-5 px-1.5 text-[10px]">
                  Auto
                </Badge>
              ) : null}
            </div>
            <div className="mt-1 font-heading font-bold">{scheduleWords(r)}</div>
            <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 font-mono text-sm">
              <span className="text-grey-ink">Next</span>
              <span>
                {r.nextOn ? formatLongDate(r.nextOn) : "—"}
                {due.overdue ? <span className="ml-2 text-coral-ink">{due.overdue}</span> : null}
              </span>
              <span className="text-grey-ink">Last</span>
              <span className="text-grey-ink">{r.lastFiredOn ? formatLongDate(r.lastFiredOn) : "never"}</span>
            </div>
          </Card>

          <Button size="lg" onClick={() => setSubmitting(true)}>
            Submit
          </Button>
          {remove.error ? <ErrorNotice message={remove.error.message} /> : null}
        </div>
      ) : null}
      <div className="pb-8" />

      {r && submitting ? <SubmitDialog recurring={r} onClose={() => setSubmitting(false)} /> : null}
      <Dialog
        open={confirm}
        title={`Delete ${r?.name ?? "this recurring"}?`}
        body="The transactions it already recorded stay."
        confirmLabel="Delete"
        danger
        busy={remove.isPending}
        onConfirm={() => r && remove.mutate(r.id, { onSuccess: () => navigate("/more") })}
        onCancel={() => setConfirm(false)}
      />
    </AppShell>
  )
}
