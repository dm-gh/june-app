import type { LocalDate, Transaction, TransactionId } from "@june/shared"
import { PencilSimple, Trash, X } from "@phosphor-icons/react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { useCategories, useDeleteTransactions, useTransactions } from "../../api/queries"
import { AppShell } from "../../layout/AppShell"
import { PeriodHeader } from "../../layout/PeriodHeader"
import { StickyBar } from "../../layout/StickyBar"
import { dayHeading } from "../../lib/format"
import { usePeriod } from "../../lib/period"
import { Dialog, Empty, ErrorNotice, IconButton, Label, Loading, Menu } from "../../ui"
import { TransactionCard } from "./TransactionCard"

/** Spent in the period: negative Changes, in Default Currency, skipping Hidden rows and rows with no rate. */
export const spentMinor = (rows: ReadonlyArray<Transaction>): number =>
  rows.reduce((sum, t) => (t.type === "change" && !t.hiddenFromAnalysis && t.amountMinor < 0 ? sum + (t.defaultMinor ?? 0) : sum), 0)

export const incomeMinor = (rows: ReadonlyArray<Transaction>): number =>
  rows.reduce((sum, t) => (t.type === "change" && !t.hiddenFromAnalysis && t.amountMinor > 0 ? sum + (t.defaultMinor ?? 0) : sum), 0)

const groupByDay = (rows: ReadonlyArray<Transaction>): Array<[LocalDate, Array<Transaction>]> => {
  const map = new Map<LocalDate, Array<Transaction>>()
  for (const t of rows) {
    const list = map.get(t.occurredOn)
    if (list) list.push(t)
    else map.set(t.occurredOn, [t])
  }
  return [...map.entries()]
}

export function TransactionsPage() {
  const navigate = useNavigate()
  const { period } = usePeriod()
  const transactions = useTransactions(period)
  const categories = useCategories()
  const remove = useDeleteTransactions()
  const [selected, setSelected] = useState<ReadonlySet<TransactionId>>(new Set())
  const [selecting, setSelecting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const categoryById = useMemo(() => new Map((categories.data ?? []).map((c) => [c.id, c])), [categories.data])
  const groups = useMemo(() => groupByDay(transactions.data ?? []), [transactions.data])

  const toggle = (id: TransactionId) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const exitSelection = () => {
    setSelecting(false)
    setSelected(new Set())
  }
  const ids = [...selected]

  const deleteSelected = () =>
    remove.mutate(ids, {
      onSuccess: () => {
        setConfirmDelete(false)
        exitSelection()
      }
    })

  return (
    <AppShell>
      {selecting ? (
        <StickyBar className="pb-4">
          <header className="-mx-2.5 flex items-center justify-between">
            <IconButton icon={X} label="Cancel selection" onClick={exitSelection} />
            <span className="font-heading text-xl font-bold">{ids.length} selected</span>
            <Menu
              items={[
                {
                  label: `Edit ${ids.length} items`,
                  icon: PencilSimple,
                  disabled: ids.length === 0,
                  onSelect: () => navigate("/transactions/bulk-edit", { state: { ids } })
                },
                { label: `Delete ${ids.length} items`, icon: Trash, danger: true, disabled: ids.length === 0, onSelect: () => setConfirmDelete(true) }
              ]}
            />
          </header>
        </StickyBar>
      ) : (
        <PeriodHeader title="Transactions" />
      )}

      {transactions.isPending ? <Loading /> : null}
      {transactions.isError ? <ErrorNotice message={transactions.error.message} /> : null}
      {transactions.data && transactions.data.length === 0 ? <Empty>Nothing recorded in this period.</Empty> : null}

      <div className="flex flex-col gap-4 pb-6">
        {groups.map(([day, rows]) => (
          <section key={day}>
            <Label as="h2" className="mb-2 block text-grey-ink">
              {dayHeading(day)}
            </Label>
            <div className="flex flex-col gap-3">
              {rows.map((t) => (
                <TransactionCard
                  key={t.id}
                  transaction={t}
                  category={t.categoryId ? categoryById.get(t.categoryId) : undefined}
                  selecting={selecting}
                  selected={selected.has(t.id)}
                  onOpen={() => navigate(`/transactions/${t.id}`)}
                  onToggle={() => toggle(t.id)}
                  onLongPress={() => {
                    setSelecting(true)
                    setSelected((s) => new Set(s).add(t.id))
                  }}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <Dialog
        open={confirmDelete}
        title={`Delete ${ids.length} ${ids.length === 1 ? "transaction" : "transactions"}?`}
        body="They are removed for good and every affected Balance moves accordingly."
        confirmLabel="Delete"
        danger
        busy={remove.isPending}
        onConfirm={deleteSelected}
        onCancel={() => setConfirmDelete(false)}
      />
      {remove.isError ? (
        <div className="mb-4">
          <ErrorNotice message={remove.error.message} />
        </div>
      ) : null}
    </AppShell>
  )
}
