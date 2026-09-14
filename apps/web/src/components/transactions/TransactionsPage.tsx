import type { TransactionId } from "@june/shared"
import { PencilSimple, Trash, X } from "@phosphor-icons/react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { useCategoryIndex, useDeleteTransactions, useTransactions, useWalletIndex } from "../../api/queries"
import { AppShell } from "../../layout/AppShell"
import { PeriodHeader } from "../../layout/PeriodHeader"
import { StickyBar } from "../../layout/StickyBar"
import { filterItems, isEmptyFilter, useFilter } from "../../lib/filter"
import { dayHeading, plural } from "../../lib/format"
import { usePeriod } from "../../lib/period"
import { Dialog, Empty, ErrorNotice, IconButton, Label, Loading, Menu } from "../../ui"
import { groupByDay, itemIds, toItems } from "./listItems"
import { TransactionCard } from "./TransactionCard"

export function TransactionsPage() {
  const navigate = useNavigate()
  const { period } = usePeriod()
  const { filter } = useFilter()
  const transactions = useTransactions(period)
  const categories = useCategoryIndex()
  const wallets = useWalletIndex()
  const remove = useDeleteTransactions()
  const [selected, setSelected] = useState<ReadonlySet<TransactionId>>(new Set())
  const [selecting, setSelecting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const items = useMemo(() => filterItems(toItems(transactions.data ?? []), filter, categories.slugOf), [transactions.data, filter, categories.slugOf])
  const groups = useMemo(() => groupByDay(items), [items])

  /** An item is selected as a whole: both legs of an Exchange go in and out together. */
  const toggle = (ids: ReadonlyArray<TransactionId>) =>
    setSelected((s) => {
      const next = new Set(s)
      if (ids.every((id) => next.has(id))) for (const id of ids) next.delete(id)
      else for (const id of ids) next.add(id)
      return next
    })
  const exitSelection = () => {
    setSelecting(false)
    setSelected(new Set())
  }
  const ids = [...selected]
  const selectedCount = items.filter((item) => itemIds(item).every((id) => selected.has(id))).length

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
            <span className="font-heading text-xl font-bold">{selectedCount} selected</span>
            <Menu
              items={[
                {
                  label: `Edit ${selectedCount} items`,
                  icon: PencilSimple,
                  disabled: ids.length === 0,
                  onSelect: () => navigate("/transactions/bulk-edit", { state: { ids } })
                },
                { label: `Delete ${selectedCount} items`, icon: Trash, danger: true, disabled: ids.length === 0, onSelect: () => setConfirmDelete(true) }
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
      {transactions.data && transactions.data.length > 0 && items.length === 0 && !isEmptyFilter(filter) ? (
        <Empty>Nothing in this period matches the filter.</Empty>
      ) : null}

      <div className="flex flex-col gap-4">
        {groups.map(([day, rows]) => (
          <section key={day}>
            <Label as="h2" className="mb-2 block text-grey-ink">
              {dayHeading(day)}
            </Label>
            <div className="flex flex-col gap-3">
              {rows.map((item) => {
                const ids = itemIds(item)
                const t = item.kind === "single" ? item.transaction : item.source
                return (
                  <TransactionCard
                    key={t.id}
                    item={item}
                    category={categories.get(t.categoryId)}
                    walletName={wallets.name}
                    onOpen={() => navigate(`/transactions/${t.id}`)}
                    selectable={{
                      selecting,
                      selected: ids.every((id) => selected.has(id)),
                      onToggle: () => toggle(ids),
                      onLongPress: () => {
                        setSelecting(true)
                        setSelected((s) => new Set([...s, ...ids]))
                      }
                    }}
                  />
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <Dialog
        open={confirmDelete}
        title={`Delete ${selectedCount} ${plural(selectedCount, "transaction")}?`}
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
