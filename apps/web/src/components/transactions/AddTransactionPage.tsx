import { type CategoryId, currencyExponent, type LoanId, type LocalDate, type MinorAmount, type RecurringId, toMinor, type WalletId } from "@june/shared"
import { Either } from "effect"
import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { useCategories, useCreateChange, useCreateExchange, useFireRecurring, useLoan, useMe, useRecurring, useSettleLoan, useTags, useWallets } from "../../api/queries"
import { FormPage } from "../../layout/FormPage"
import { todayLocal } from "../../lib/period"
import { Field, Loading, Notice, Segmented, Text } from "../../ui"
import { type ExchangeDraft, ExchangeFields, exchangePayload } from "./ExchangeForm"
import { type ChangeDraft, TransactionForm } from "./TransactionForm"

type Kind = "change" | "exchange"

/**
 * Where a prefilled Change goes when saved: a Recurring's Edit & submit fires it and advances the
 * Schedule, a Loan's Settle records it and moves the Loan. Plain is the ordinary Add transaction.
 */
export type Source = { kind: "plain" } | { kind: "recurring"; id: RecurringId } | { kind: "loan"; id: LoanId }

const decimal = (minor: number, currency: string) => (Math.abs(minor) / 10 ** currencyExponent(currency)).toFixed(currencyExponent(currency))

/** Add transaction: a Change (Expense or Income by sign) or, via the type toggle, an Exchange. */
export function AddTransactionPage() {
  const [params] = useSearchParams()
  const recurringId = params.get("recurring")
  const loanId = params.get("loan")
  if (recurringId) return <FromRecurring id={recurringId as RecurringId} />
  if (loanId) return <FromLoan id={loanId as LoanId} />
  return <PlainAddTransactionPage />
}

/** Edit & submit: the Change form with the Recurring's fields, dated its due date. */
function FromRecurring({ id }: { id: RecurringId }) {
  const recurring = useRecurring(id)
  const r = recurring.data
  if (!r) {
    return (
      <FormPage title="Submit" backTo="/more">
        {recurring.isError ? <Text>{recurring.error.message}</Text> : <Loading />}
      </FormPage>
    )
  }
  return (
    <PlainAddTransactionPage
      source={{ kind: "recurring", id }}
      title={`Submit ${r.name}`}
      initial={{
        sign: r.amountMinor < 0 ? "-" : "+",
        amount: decimal(r.amountMinor, r.currency),
        currency: r.currency,
        walletId: r.walletId ?? "",
        categoryId: r.categoryId ?? "",
        date: r.nextOn ?? todayLocal(),
        description: r.description,
        tags: r.tags,
        hidden: false
      }}
    />
  )
}

/** Settle: the Change form with the remaining amount signed toward zero and Hidden on. */
function FromLoan({ id }: { id: LoanId }) {
  const loan = useLoan(id)
  const wallets = useWallets()
  const l = loan.data
  if (!l || wallets.isPending) {
    return (
      <FormPage title="Settle" backTo="/more">
        {loan.isError ? <Text>{loan.error.message}</Text> : <Loading />}
      </FormPage>
    )
  }
  const first = (wallets.data?.wallets ?? []).find((w) => w.currency === l.currency)
  return (
    <PlainAddTransactionPage
      source={{ kind: "loan", id }}
      title={`Settle ${l.description || "loan"}`}
      initial={{
        // Lent (positive) settles with money coming back (+); Borrowed with money going out (−).
        sign: l.amountMinor >= 0 ? "+" : "-",
        amount: decimal(l.amountMinor, l.currency),
        currency: l.currency,
        walletId: first?.id ?? "",
        categoryId: "",
        date: todayLocal(),
        description: l.description,
        tags: [],
        hidden: true
      }}
    />
  )
}

function PlainAddTransactionPage({ source = { kind: "plain" }, title = "Add transaction", initial }: { source?: Source; title?: string; initial?: ChangeDraft }) {
  const [params, setParams] = useSearchParams()
  const kind: Kind = source.kind === "plain" && params.get("type") === "exchange" ? "exchange" : "change"
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
    <ChangeForm
      wallets={walletList}
      categories={categories.data ?? []}
      tagSuggestions={tags.data ?? []}
      toggle={source.kind === "plain" ? toggle : () => null}
      source={source}
      title={title}
      {...(initial ? { initial } : {})}
    />
  )
}

type Wallets = NonNullable<ReturnType<typeof useWallets>["data"]>["wallets"]
type Categories = NonNullable<ReturnType<typeof useCategories>["data"]>

type Toggle = (changeLabel: "Expense" | "Income") => React.ReactNode

function ChangeForm({
  wallets,
  categories,
  tagSuggestions,
  toggle,
  source,
  title,
  initial
}: {
  wallets: Wallets
  categories: Categories
  tagSuggestions: ReadonlyArray<string>
  toggle: Toggle
  source: Source
  title: string
  initial?: ChangeDraft
}) {
  const navigate = useNavigate()
  const create = useCreateChange()
  const fire = useFireRecurring()
  const settle = useSettleLoan()
  const first = wallets[0]!
  const [draft, setDraft] = useState<ChangeDraft>(
    initial ?? {
      sign: "-",
      amount: "",
      currency: first.currency,
      walletId: first.id,
      categoryId: "",
      date: todayLocal(),
      description: "",
      tags: [],
      hidden: false
    }
  )
  const [errors, setErrors] = useState<{ amount?: string; wallet?: string }>({})
  const busy = create.isPending || fire.isPending || settle.isPending
  const error = create.error?.message ?? fire.error?.message ?? settle.error?.message ?? null

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
    const change = {
      walletId: draft.walletId as WalletId,
      amountMinor,
      occurredOn: draft.date as LocalDate,
      description: draft.description.trim(),
      tags: draft.tags as never,
      categoryId: draft.categoryId === "" ? null : (draft.categoryId as CategoryId),
      hiddenFromAnalysis: draft.hidden
    }
    switch (source.kind) {
      case "plain":
        return create.mutate(change, { onSuccess: () => navigate("/transactions") })
      case "recurring":
        return fire.mutate({ id: source.id, payload: { change } }, { onSuccess: () => navigate("/transactions") })
      case "loan":
        return settle.mutate({ id: source.id, payload: { change } }, { onSuccess: () => navigate(`/more/loans/${source.id}`) })
    }
  }
  const backTo = source.kind === "plain" ? "/transactions" : source.kind === "recurring" ? `/more/recurrings/${source.id}` : `/more/loans/${source.id}`
  const submitLabel = source.kind === "plain" ? "Save transaction" : source.kind === "recurring" ? "Submit" : "Settle"

  return (
    <FormPage title={title} backTo={backTo} submitLabel={submitLabel} onSubmit={submit} busy={busy} error={error}>
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
