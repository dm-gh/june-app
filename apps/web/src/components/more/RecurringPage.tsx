import type { Category, RecurringId, Wallet } from "@june/shared"
import { ArrowLeft, PencilSimple, Trash } from "@phosphor-icons/react"
import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { useCategories, useDeleteRecurring, useRecurring, useWallets } from "../../api/queries"
import { AppShell } from "../../layout/AppShell"
import { StickyBar } from "../../layout/StickyBar"
import { hueColor, signedMoney } from "../../lib/format"
import { formatLongDate } from "../../lib/period"
import { Badge, Button, Card, cn, Dialog, Display, ErrorNotice, IconButton, Label, Loading, Menu, Text } from "../../ui"
import { dueState, scheduleWords } from "./recurring"
import { SubmitDialog } from "./SubmitDialog"

/** A Recurring's page: what it records, its Schedule, and Submit. Edit and Delete sit behind the menu. */
export function RecurringPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const recurring = useRecurring(id as RecurringId)
  const categories = useCategories()
  const wallets = useWallets()
  const remove = useDeleteRecurring()
  const [submitting, setSubmitting] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const categoryById = useMemo(() => new Map<string, Category>((categories.data ?? []).map((c) => [c.id, c])), [categories.data])
  const walletById = useMemo(() => new Map<string, Wallet>((wallets.data?.wallets ?? []).map((w) => [w.id, w])), [wallets.data])

  const r = recurring.data
  const category = r?.categoryId ? categoryById.get(r.categoryId) : undefined
  const wallet = r?.walletId ? walletById.get(r.walletId) : undefined
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
          <Card className="relative p-3 pt-4">
            {category ? (
              <Badge className="absolute -top-[3px] -right-[3px] h-5 border-t-0 border-r-0 px-1.5 text-[10px]" style={{ background: hueColor(category.hue) }}>
                {category.emoji ? `${category.emoji} ` : ""}
                {category.name}
              </Badge>
            ) : null}
            <div className={cn("font-mono text-3xl font-bold tabular-nums", r.amountMinor < 0 ? "text-coral-ink" : "text-green-ink")}>
              {signedMoney(r.amountMinor, r.currency)}
            </div>
            {r.description ? <Text className="mt-1">{r.description}</Text> : null}
            <div className={cn("mt-1 font-mono text-xs", wallet ? "text-grey-ink" : "text-coral-ink")}>
              {wallet ? `${wallet.name} · ${wallet.currency}` : `Needs a wallet · fires unassigned in ${r.currency}`}
            </div>
            {r.tags.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.tags.map((tag) => (
                  <Badge key={tag} prefix="#" className="h-5 px-1.5 text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </Card>

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
            <Text className="mt-2 text-sm text-grey-ink">
              {r.auto ? "Fires by itself on the due date. " : ""}
              Submit records it now for the due date, or lets you edit first.
            </Text>
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
