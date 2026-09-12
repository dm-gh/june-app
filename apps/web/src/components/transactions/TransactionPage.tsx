import { type CategoryId, type LocalDate, type MinorAmount, toMinor, type TransactionId, type WalletId } from "@june/shared"
import { PencilSimple, Trash } from "@phosphor-icons/react"
import { Either } from "effect"
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { useCategories, useDeleteTransactions, useTags, useTransaction, useUpdateTransaction, useWallets } from "../../api/queries"
import { FormPage } from "../../layout/FormPage"
import { Dialog, ErrorNotice, Loading } from "../../ui"
import { type ChangeDraft, draftFromTransaction, TransactionForm } from "./TransactionForm"

const titles = { change: "Transaction", init: "Opening balance", exchange: "Exchange" } as const

/** Read-only view: the edit form with every control disabled, Edit and Delete behind the menu. */
export function TransactionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const transaction = useTransaction(id as TransactionId)
  const wallets = useWallets()
  const categories = useCategories()
  const remove = useDeleteTransactions()
  const [confirm, setConfirm] = useState(false)

  if (transaction.isPending || wallets.isPending || categories.isPending) {
    return (
      <FormPage title="Transaction" backTo="/transactions">
        <Loading />
      </FormPage>
    )
  }
  if (transaction.isError) {
    return (
      <FormPage title="Transaction" backTo="/transactions">
        <ErrorNotice message={transaction.error.message} />
      </FormPage>
    )
  }
  const t = transaction.data
  const canDelete = t.type !== "init"
  return (
    <FormPage
      title={titles[t.type]}
      backTo="/transactions"
      menu={[
        { label: "Edit", icon: PencilSimple, onSelect: () => navigate(`/transactions/${t.id}/edit`) },
        ...(canDelete ? [{ label: "Delete", icon: Trash, danger: true, onSelect: () => setConfirm(true) }] : [])
      ]}
    >
      <TransactionForm
        draft={draftFromTransaction(t)}
        onChange={() => {}}
        wallets={wallets.data?.wallets ?? []}
        categories={categories.data ?? []}
        tagSuggestions={[]}
        mode="view"
        transactionType={t.type}
      />
      {remove.isError ? <ErrorNotice message={remove.error.message} /> : null}
      <Dialog
        open={confirm}
        title={t.type === "exchange" ? "Delete this exchange?" : "Delete this transaction?"}
        body={t.type === "exchange" ? "Both legs go, and both Wallets' Balances move back." : "It is removed for good and the Wallet's Balance moves accordingly."}
        confirmLabel="Delete"
        danger
        busy={remove.isPending}
        onConfirm={() => remove.mutate([t.id], { onSuccess: () => navigate("/transactions") })}
        onCancel={() => setConfirm(false)}
      />
    </FormPage>
  )
}

/** Edit: the same form with the current values; the Transaction Type is fixed. */
export function EditTransactionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const transaction = useTransaction(id as TransactionId)
  const wallets = useWallets()
  const categories = useCategories()
  const tags = useTags()
  const update = useUpdateTransaction()
  const [draft, setDraft] = useState<ChangeDraft | null>(null)
  const [errors, setErrors] = useState<{ amount?: string; wallet?: string }>({})

  useEffect(() => {
    if (transaction.data && draft === null) setDraft(draftFromTransaction(transaction.data))
  }, [transaction.data, draft])

  if (transaction.isPending || wallets.isPending || categories.isPending || draft === null) {
    return (
      <FormPage title="Edit transaction" backTo="/transactions">
        {transaction.isError ? <ErrorNotice message={transaction.error.message} /> : <Loading />}
      </FormPage>
    )
  }
  const t = transaction.data!

  const submit = () => {
    const parsed = toMinor(Number(draft.amount), draft.currency)
    const next: typeof errors = {}
    if (draft.amount.trim() === "" || Either.isLeft(parsed) || parsed.right === 0) {
      next.amount = Either.isLeft(parsed) ? parsed.left : "Enter an amount"
    }
    if (draft.walletId === "") next.wallet = `Create a ${draft.currency} wallet first`
    setErrors(next)
    if (Object.keys(next).length > 0 || Either.isLeft(parsed)) return
    update.mutate(
      {
        id: t.id,
        payload: {
          walletId: draft.walletId as WalletId,
          amountMinor: ((draft.sign === "-" ? -1 : 1) * parsed.right) as MinorAmount,
          currency: draft.currency as never,
          occurredOn: draft.date as LocalDate,
          description: draft.description.trim(),
          tags: draft.tags as never,
          categoryId: t.type === "change" ? (draft.categoryId === "" ? null : (draft.categoryId as CategoryId)) : null,
          hiddenFromAnalysis: draft.hidden
        }
      },
      { onSuccess: () => navigate(`/transactions/${t.id}`) }
    )
  }

  return (
    <FormPage title={`Edit ${titles[t.type].toLowerCase()}`} submitLabel="Save changes" onSubmit={submit} busy={update.isPending} error={update.error?.message ?? null}>
      <TransactionForm
        draft={draft}
        onChange={setDraft}
        wallets={wallets.data?.wallets ?? []}
        categories={categories.data ?? []}
        tagSuggestions={tags.data ?? []}
        mode="edit"
        transactionType={t.type}
        errors={errors}
      />
    </FormPage>
  )
}
