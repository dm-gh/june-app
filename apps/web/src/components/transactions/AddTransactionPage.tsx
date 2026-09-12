import { type CategoryId, type LocalDate, type MinorAmount, toMinor, type WalletId } from "@june/shared"
import { Either } from "effect"
import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { useCategories, useCreateChange, useCreateExchange, useMe, useTags, useWallets } from "../../api/queries"
import { FormPage } from "../../layout/FormPage"
import { todayLocal } from "../../lib/period"
import { Field, Loading, Notice, Segmented, Text } from "../../ui"
import { type ExchangeDraft, ExchangeFields, exchangePayload } from "./ExchangeForm"
import { type ChangeDraft, TransactionForm } from "./TransactionForm"

type Kind = "change" | "exchange"

/** Add transaction: a Change (Expense or Income by sign) or, via the type toggle, an Exchange. */
export function AddTransactionPage() {
  const [params, setParams] = useSearchParams()
  const kind: Kind = params.get("type") === "exchange" ? "exchange" : "change"
  const wallets = useWallets()
  const categories = useCategories()
  const tags = useTags()
  const me = useMe()

  if (wallets.isPending || categories.isPending || me.isPending) {
    return (
      <FormPage title="Add transaction">
        <Loading />
      </FormPage>
    )
  }
  const walletList = wallets.data?.wallets ?? []
  if (walletList.length === 0) {
    return (
      <FormPage title="Add transaction" backTo="/transactions">
        <Notice accent="lavender" label="No wallets yet">
          <Text>A Transaction needs a Wallet. Create your first one in Settings.</Text>
        </Notice>
      </FormPage>
    )
  }
  /** The first tab reads Expense or Income after the sign of the amount; under the hood both are a Change. */
  const toggle = (changeLabel: "Expense" | "Income") => (
    <Field label="Type">
      <Segmented<Kind>
        options={[{ value: "change", label: changeLabel }, { value: "exchange", label: "Exchange" }]}
        value={kind}
        onChange={(k) => setParams(k === "exchange" ? { type: "exchange" } : {}, { replace: true })}
      />
    </Field>
  )
  return kind === "exchange" ? (
    <ExchangeForm wallets={walletList} tagSuggestions={tags.data ?? []} toggle={toggle} />
  ) : (
    <ChangeForm wallets={walletList} categories={categories.data ?? []} tagSuggestions={tags.data ?? []} toggle={toggle} />
  )
}

type Wallets = NonNullable<ReturnType<typeof useWallets>["data"]>["wallets"]
type Categories = NonNullable<ReturnType<typeof useCategories>["data"]>

type Toggle = (changeLabel: "Expense" | "Income") => React.ReactNode

function ChangeForm({ wallets, categories, tagSuggestions, toggle }: { wallets: Wallets; categories: Categories; tagSuggestions: ReadonlyArray<string>; toggle: Toggle }) {
  const navigate = useNavigate()
  const create = useCreateChange()
  const first = wallets[0]!
  const [draft, setDraft] = useState<ChangeDraft>({
    sign: "-",
    amount: "",
    currency: first.currency,
    walletId: first.id,
    categoryId: "",
    date: todayLocal(),
    description: "",
    tags: [],
    hidden: false
  })
  const [errors, setErrors] = useState<{ amount?: string; wallet?: string }>({})

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
    create.mutate(
      {
        walletId: draft.walletId as WalletId,
        amountMinor,
        occurredOn: draft.date as LocalDate,
        description: draft.description.trim(),
        tags: draft.tags as never,
        categoryId: draft.categoryId === "" ? null : (draft.categoryId as CategoryId),
        hiddenFromAnalysis: draft.hidden
      },
      { onSuccess: () => navigate("/transactions") }
    )
  }

  return (
    <FormPage title="Add transaction" backTo="/transactions" submitLabel="Save transaction" onSubmit={submit} busy={create.isPending} error={create.error?.message ?? null}>
      {toggle(draft.sign === "-" ? "Expense" : "Income")}
      <TransactionForm draft={draft} onChange={setDraft} wallets={wallets} categories={categories} tagSuggestions={tagSuggestions} mode="add" errors={errors} />
    </FormPage>
  )
}

function ExchangeForm({ wallets, tagSuggestions, toggle }: { wallets: Wallets; tagSuggestions: ReadonlyArray<string>; toggle: Toggle }) {
  const navigate = useNavigate()
  const create = useCreateExchange()
  const [draft, setDraft] = useState<ExchangeDraft>({
    source: wallets[0]!.id,
    target: (wallets[1] ?? wallets[0])!.id,
    sent: "",
    received: "",
    date: todayLocal(),
    description: "",
    tags: []
  })
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const payload = exchangePayload(draft, wallets)
    if (Either.isLeft(payload)) return setError(payload.left)
    setError(null)
    create.mutate(payload.right, { onSuccess: () => navigate("/transactions") })
  }

  return (
    <FormPage title="Add transaction" backTo="/transactions" submitLabel="Save exchange" onSubmit={submit} busy={create.isPending} error={error ?? create.error?.message ?? null}>
      {toggle("Expense")}
      <ExchangeFields draft={draft} onChange={setDraft} wallets={wallets} tagSuggestions={tagSuggestions} />
    </FormPage>
  )
}
