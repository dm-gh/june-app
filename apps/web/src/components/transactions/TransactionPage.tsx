import { type CategoryId, type ExchangeId, type LocalDate, type MinorAmount, toMinor, type TransactionId, type WalletId } from "@june/shared"
import { Trash } from "@phosphor-icons/react"
import { Either } from "effect"
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { useCategories, useDeleteTransactions, useExchange, useTags, useTransaction, useUpdateExchange, useUpdateTransaction, useWallets } from "../../api/queries"
import { FormPage } from "../../layout/FormPage"
import { Dialog, ErrorNotice, Loading } from "../../ui"
import { draftFromLegs, type ExchangeDraft, ExchangeFields, exchangePayload } from "./ExchangeForm"
import { type ChangeDraft, draftFromTransaction, TransactionForm } from "./TransactionForm"

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
  const [draft, setDraft] = useState<ExchangeDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (legs.data && draft === null) setDraft(draftFromLegs(legs.data))
  }, [legs.data, draft])

  const walletList = wallets.data?.wallets ?? []
  if (legs.isPending || wallets.isPending) {
    return (
      <FormPage title="Edit exchange" backTo="/transactions">
        {legs.isError ? <ErrorNotice message={legs.error.message} /> : <Loading />}
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
      menu={[{ label: "Delete", icon: Trash, danger: true, onSelect: () => setConfirm(true) }]}
    >
      <ExchangeFields draft={draft} onChange={setDraft} wallets={walletList} tagSuggestions={tags.data ?? []} />
      <Dialog
        open={confirm}
        title="Delete this exchange?"
        body="Both legs go, and both Wallets' Balances move back."
        confirmLabel="Delete"
        danger
        busy={remove.isPending}
        onConfirm={() => remove.mutate([legs.data![0]!.id], { onSuccess: () => navigate("/transactions") })}
        onCancel={() => setConfirm(false)}
      />
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
  const [draft, setDraft] = useState<ChangeDraft | null>(null)
  const [errors, setErrors] = useState<{ amount?: string; wallet?: string }>({})
  const [confirm, setConfirm] = useState(false)

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
    const amountMinor = ((draft.sign === "-" ? -1 : 1) * parsed.right) as MinorAmount
    // An Init keeps its Wallet and currency; sending them, even unchanged, is refused by the api.
    const payload =
      t.type === "init"
        ? { amountMinor, occurredOn: draft.date as LocalDate, description: draft.description.trim(), tags: draft.tags as never, hiddenFromAnalysis: draft.hidden }
        : {
            walletId: draft.walletId as WalletId,
            amountMinor,
            currency: draft.currency as never,
            occurredOn: draft.date as LocalDate,
            description: draft.description.trim(),
            tags: draft.tags as never,
            categoryId: draft.categoryId === "" ? null : (draft.categoryId as CategoryId),
            hiddenFromAnalysis: draft.hidden
          }
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
      menu={canDelete ? [{ label: "Delete", icon: Trash, danger: true, onSelect: () => setConfirm(true) }] : undefined}
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
      <Dialog
        open={confirm}
        title="Delete this transaction?"
        body="It is removed for good and the Wallet's Balance moves accordingly."
        confirmLabel="Delete"
        danger
        busy={remove.isPending}
        onConfirm={() => remove.mutate([t.id], { onSuccess: () => navigate("/transactions") })}
        onCancel={() => setConfirm(false)}
      />
    </FormPage>
  )
}
