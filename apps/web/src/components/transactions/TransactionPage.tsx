import type { ExchangeId, TransactionId } from "@june/shared"
import { Either } from "effect"
import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import { useCategories, useDeleteTransactions, useExchange, useTags, useTransaction, useUpdateExchange, useUpdateTransaction, useWallets } from "../../api/queries"
import { FormPage } from "../../layout/FormPage"
import { useDeleteConfirm } from "../../layout/useDeleteConfirm"
import { ErrorNotice, QueryState, useDraft } from "../../ui"
import { type ChangeErrors, draftFromTransaction, readChangeDraft } from "./changeDraft"
import { draftFromLegs, exchangePayload } from "./exchangeDraft"
import { ExchangeFields } from "./ExchangeForm"
import { TransactionForm } from "./TransactionForm"

const titles = { change: "Edit transaction", init: "Edit opening balance", exchange: "Edit exchange" } as const

/** A Transaction opens straight into its edit form; Delete sits behind the options menu. The Transaction Type is fixed. */
export function EditTransactionPage() {
  const { id } = useParams()
  const transaction = useTransaction(id as TransactionId)
  if (transaction.data?.type === "exchange" && transaction.data.exchangeId !== null) {
    return <EditExchangePage exchangeId={transaction.data.exchangeId} />
  }
  return <EditChangePage id={id as TransactionId} />
}

/** An Exchange is edited as a whole: both Wallets, both amounts, and the shared date, description and tags. */
function EditExchangePage({ exchangeId }: { exchangeId: ExchangeId }) {
  const navigate = useNavigate()
  const legs = useExchange(exchangeId)
  const wallets = useWallets()
  const tags = useTags()
  const update = useUpdateExchange()
  const remove = useDeleteTransactions()
  const [draft, setDraft] = useDraft(legs.data, draftFromLegs)
  const [error, setError] = useState<string | null>(null)
  const confirmDelete = useDeleteConfirm({
    remove,
    id: legs.data?.[0] ? [legs.data[0].id] : undefined,
    title: "Delete this exchange?",
    body: "Both legs go, and both Wallets' Balances move back.",
    after: () => navigate("/transactions")
  })

  const walletList = wallets.data?.wallets ?? []
  if (legs.isPending || wallets.isPending) {
    return (
      <FormPage title="Edit exchange" backTo="/transactions">
        <QueryState of={[legs, wallets]} />
      </FormPage>
    )
  }
  if (draft === null) {
    return (
      <FormPage title="Edit exchange" backTo="/transactions">
        <ErrorNotice message="One side of this Exchange lost its Wallet, so it can only be deleted." />
      </FormPage>
    )
  }

  const submit = () => {
    const payload = exchangePayload(draft, walletList)
    if (Either.isLeft(payload)) return setError(payload.left)
    setError(null)
    update.mutate({ exchangeId, payload: payload.right }, { onSuccess: () => navigate("/transactions") })
  }

  return (
    <FormPage
      title="Edit exchange"
      backTo="/transactions"
      submitLabel="Save exchange"
      onSubmit={submit}
      busy={update.isPending}
      error={error ?? update.error?.message ?? remove.error?.message ?? null}
      menu={[confirmDelete.menuItem]}
    >
      <ExchangeFields draft={draft} onChange={setDraft} wallets={walletList} tagSuggestions={tags.data ?? []} />
      {confirmDelete.dialog}
    </FormPage>
  )
}

/** A Change or an Init: the single-row form. */
function EditChangePage({ id }: { id: TransactionId }) {
  const navigate = useNavigate()
  const transaction = useTransaction(id)
  const wallets = useWallets()
  const categories = useCategories()
  const tags = useTags()
  const update = useUpdateTransaction()
  const remove = useDeleteTransactions()
  const [draft, setDraft] = useDraft(transaction.data, draftFromTransaction)
  const [errors, setErrors] = useState<ChangeErrors>({})
  const confirmDelete = useDeleteConfirm({
    remove,
    id: transaction.data ? [transaction.data.id] : undefined,
    title: "Delete this transaction?",
    body: "It is removed for good and the Wallet's Balance moves accordingly.",
    after: () => navigate("/transactions")
  })

  if (transaction.isPending || wallets.isPending || categories.isPending || draft === null) {
    return (
      <FormPage title="Edit transaction" backTo="/transactions">
        <QueryState of={[transaction, wallets, categories]} />
      </FormPage>
    )
  }
  const t = transaction.data!

  const submit = () => {
    // An opening balance may be zero; a Change may not.
    const read = readChangeDraft(draft, { allowZero: t.type === "init" })
    if (Either.isLeft(read)) return setErrors(read.left)
    setErrors({})
    const { walletId: _wallet, currency: _currency, categoryId: _category, ...init } = read.right
    // An Init keeps its Wallet and currency; sending them, even unchanged, is refused by the api.
    const payload = t.type === "init" ? init : read.right
    update.mutate({ id: t.id, payload }, { onSuccess: () => navigate("/transactions") })
  }

  const canDelete = t.type !== "init"
  return (
    <FormPage
      title={titles[t.type]}
      backTo="/transactions"
      submitLabel="Save changes"
      onSubmit={submit}
      busy={update.isPending}
      error={update.error?.message ?? remove.error?.message ?? null}
      menu={canDelete ? [confirmDelete.menuItem] : undefined}
    >
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
      {confirmDelete.dialog}
    </FormPage>
  )
}
