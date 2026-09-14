import type { CategoryId, TransactionId, WalletId } from "@june/shared"
import { useMemo, useState } from "react"
import { Navigate, useLocation, useNavigate } from "react-router"
import { useBulkUpdate, useCategories, useTags, useTransactions, useWallets } from "../../api/queries"
import { FormPage } from "../../layout/FormPage"
import { usePeriod } from "../../lib/period"
import { CategorySelect, Field, Loading, TagChip, TagInput, WalletSelect } from "../../ui"

const KEEP = "__keep__"

/** Bulk edit: Wallet, Category and Tags only. "Keep as is" leaves a field untouched on every item. */
export function BulkEditPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const ids = ((location.state as { ids?: Array<TransactionId> } | null)?.ids ?? []) as Array<TransactionId>
  const { period } = usePeriod()
  const transactions = useTransactions(period)
  const wallets = useWallets()
  const categories = useCategories()
  const tags = useTags()
  const bulk = useBulkUpdate()
  const [walletId, setWalletId] = useState<string>(KEEP)
  const [categoryId, setCategoryId] = useState<string>(KEEP)
  const [removed, setRemoved] = useState<ReadonlyArray<string>>([])
  const [added, setAdded] = useState<ReadonlyArray<string>>([])

  const rows = useMemo(() => (transactions.data ?? []).filter((t) => ids.includes(t.id)), [transactions.data, ids])
  const currencies = new Set(rows.map((r) => r.currency))
  const signs = new Set(rows.map((r) => (r.amountMinor < 0 ? "expense" : "income")))
  const allChanges = rows.every((r) => r.type === "change")
  const shared = useMemo(
    () => (rows.length === 0 ? [] : rows[0]!.tags.filter((tag) => rows.every((r) => r.tags.includes(tag)))),
    [rows]
  )

  if (ids.length === 0) return <Navigate to="/transactions" replace />
  if (transactions.isPending || wallets.isPending || categories.isPending) {
    return (
      <FormPage title={`Edit ${ids.length} items`}>
        <Loading />
      </FormPage>
    )
  }

  const walletLocked = !allChanges || currencies.size !== 1
  const categoryLocked = !allChanges || signs.size !== 1
  const currency = [...currencies][0]
  const sign = [...signs][0]
  const walletOptions = (wallets.data?.wallets ?? []).filter((w) => w.currency === currency)

  const submit = () =>
    bulk.mutate(
      {
        ids: ids as [TransactionId, ...TransactionId[]],
        ...(walletId !== KEEP ? { walletId: walletId as WalletId } : {}),
        ...(categoryId !== KEEP ? { categoryId: categoryId === "" ? null : (categoryId as CategoryId) } : {}),
        addTags: added as never,
        removeTags: removed as never
      },
      { onSuccess: () => navigate("/transactions") }
    )

  return (
    <FormPage title={`Edit ${ids.length} items`} backTo="/transactions" submitLabel={`Save ${ids.length} items`} onSubmit={submit} busy={bulk.isPending} error={bulk.error?.message ?? null}>
      <Field label="Wallet" htmlFor="wallet" hint={walletLocked ? (allChanges ? "The selection mixes currencies, so the Wallet stays as it is" : "Only ordinary transactions can move Wallet") : undefined}>
        <WalletSelect<string> id="wallet" wallets={walletOptions} value={walletId} disabled={walletLocked} onChange={setWalletId}>
          <option value={KEEP}>Keep as is</option>
        </WalletSelect>
      </Field>
      <Field label="Category" htmlFor="category" hint={categoryLocked ? (allChanges ? "The selection mixes expenses and income, so the Category stays as it is" : "Only ordinary transactions have a Category") : undefined}>
        <CategorySelect<string> id="category" categories={categories.data ?? []} type={sign ?? "expense"} value={categoryId} disabled={categoryLocked} onChange={setCategoryId}>
          <option value={KEEP}>Keep as is</option>
        </CategorySelect>
      </Field>
      <Field label="Tags" htmlFor="tags" hint="Tags every selected item shares; remove any, or add tags to all of them">
        <div className="flex flex-col gap-2">
          {shared.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {shared.map((tag) => {
                const gone = removed.includes(tag)
                return (
                  <TagChip
                    key={tag}
                    tag={tag}
                    muted={gone}
                    removeLabel={gone ? `Keep ${tag}` : `Remove ${tag} from all`}
                    onRemove={() => setRemoved((r) => (gone ? r.filter((t) => t !== tag) : [...r, tag]))}
                  />
                )
              })}
            </div>
          ) : null}
          <TagInput id="tags" value={added} onChange={setAdded} suggestions={tags.data} placeholder="Add tags to all" />
        </div>
      </Field>
    </FormPage>
  )
}
