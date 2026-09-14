import { type LoanId, type RecurringId, toMajorFixed } from "@june/shared"
import { Either } from "effect"
import { type ReactNode, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { useCategories, useCreateChange, useCreateExchange, useFireRecurring, useLoan, useRecurring, useSettleLoan, useTags, useWallets } from "../../api/queries"
import { FormPage } from "../../layout/FormPage"
import { todayLocal } from "../../lib/period"
import { Field, Notice, QueryState, Segmented, Text } from "../../ui"
import { type ChangeDraft, type ChangeErrors, type ChangePayload, readChangeDraft } from "./changeDraft"
import { type ExchangeDraft, exchangePayload } from "./exchangeDraft"
import { ExchangeFields } from "./ExchangeForm"
import { TransactionForm } from "./TransactionForm"

/** What Add transaction is opened for: a Recurring's Edit & submit, or a Loan's Settle. Plain Add carries neither. */
export type Prefill = { readonly recurring: RecurringId } | { readonly loan: LoanId }

/** The link to Add transaction prefilled from a Recurring or a Loan; `prefillFrom` reads it back. */
export const addTransactionFor = (prefill: Prefill): string =>
  "recurring" in prefill ? `/transactions/new?recurring=${prefill.recurring}` : `/transactions/new?loan=${prefill.loan}`

export const prefillFrom = (params: URLSearchParams): Prefill | null => {
  const recurring = params.get("recurring")
  if (recurring) return { recurring: recurring as RecurringId }
  const loan = params.get("loan")
  if (loan) return { loan: loan as LoanId }
  return null
}

/**
 * How a Change is saved and where the form leads. Plain Add records it; a Recurring's Edit & submit
 * fires the Recurring with it and advances the Schedule; a Loan's Settle records it and moves the Loan.
 */
export interface SaveChange {
  title: string
  backTo: string
  submitLabel: string
  /** Runs the mutation and, on success, leaves the form. */
  save: (change: ChangePayload) => void
  busy: boolean
  error: string | null
}

export function AddTransactionPage() {
  const [params] = useSearchParams()
  const prefill = prefillFrom(params)
  if (prefill === null) return <PlainAdd />
  return "recurring" in prefill ? <FromRecurring id={prefill.recurring} /> : <FromLoan id={prefill.loan} />
}

type Kind = "change" | "exchange"
type Wallets = NonNullable<ReturnType<typeof useWallets>["data"]>["wallets"]
type Categories = NonNullable<ReturnType<typeof useCategories>["data"]>
interface Lists {
  wallets: Wallets
  categories: Categories
  tags: ReadonlyArray<string>
}
/** The first tab reads Expense or Income after the sign of the amount; under the hood both are a Change. */
type Toggle = (changeLabel: "Expense" | "Income") => ReactNode

/** The lists every Add form needs, and what to show in the form's place until they are there, or when there is no Wallet at all. */
const useLists = (): { lists: Lists; waiting: ((title: string, backTo: string) => ReactNode) | null } => {
  const wallets = useWallets()
  const categories = useCategories()
  const tags = useTags()
  const list = wallets.data?.wallets ?? []
  const waiting =
    wallets.isPending || categories.isPending
      ? (title: string, backTo: string) => (
          <FormPage title={title} backTo={backTo}>
            <QueryState of={[wallets, categories]} />
          </FormPage>
        )
      : list.length === 0
        ? (title: string, backTo: string) => (
            <FormPage title={title} backTo={backTo}>
              <Notice accent="lavender" label="No wallets yet">
                <Text>A Transaction needs a Wallet. Create your first one in Settings.</Text>
              </Notice>
            </FormPage>
          )
        : null
  return { lists: { wallets: list, categories: categories.data ?? [], tags: tags.data ?? [] }, waiting }
}

/** Add transaction: a Change (Expense or Income by sign) or, via the type toggle, an Exchange. */
function PlainAdd() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const create = useCreateChange()
  const { lists, waiting } = useLists()
  const kind: Kind = params.get("type") === "exchange" ? "exchange" : "change"
  if (waiting) return waiting("Add transaction", "/transactions")
  const toggle: Toggle = (changeLabel) => (
    <Field label="Type">
      <Segmented<Kind>
        options={[{ value: "change", label: changeLabel }, { value: "exchange", label: "Exchange" }]}
        value={kind}
        onChange={(k) => setParams(k === "exchange" ? { type: "exchange" } : {}, { replace: true })}
      />
    </Field>
  )
  const saver: SaveChange = {
    title: "Add transaction",
    backTo: "/transactions",
    submitLabel: "Save transaction",
    save: (change) => create.mutate(change, { onSuccess: () => navigate("/transactions") }),
    busy: create.isPending,
    error: create.error?.message ?? null
  }
  return kind === "exchange" ? <ExchangeForm lists={lists} toggle={toggle} /> : <ChangeForm lists={lists} saver={saver} toggle={toggle} />
}

/** Edit & submit: the Change form with the Recurring's fields, dated its due date. */
function FromRecurring({ id }: { id: RecurringId }) {
  const navigate = useNavigate()
  const recurring = useRecurring(id)
  const fire = useFireRecurring()
  const { lists, waiting } = useLists()
  const r = recurring.data
  if (!r) {
    return (
      <FormPage title="Submit" backTo="/more">
        <QueryState of={recurring} />
      </FormPage>
    )
  }
  const saver: SaveChange = {
    title: `Submit ${r.name}`,
    backTo: `/more/recurrings/${id}`,
    submitLabel: "Submit",
    save: (change) => fire.mutate({ id, payload: { change } }, { onSuccess: () => navigate("/transactions") }),
    busy: fire.isPending,
    error: fire.error?.message ?? null
  }
  if (waiting) return waiting(saver.title, saver.backTo)
  return (
    <ChangeForm
      lists={lists}
      saver={saver}
      initial={{
        sign: r.amountMinor < 0 ? "-" : "+",
        amount: toMajorFixed(r.amountMinor, r.currency),
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
  const navigate = useNavigate()
  const loan = useLoan(id)
  const settle = useSettleLoan()
  const { lists, waiting } = useLists()
  const l = loan.data
  if (!l) {
    return (
      <FormPage title="Settle" backTo="/more">
        <QueryState of={loan} />
      </FormPage>
    )
  }
  const saver: SaveChange = {
    title: `Settle ${l.description || "loan"}`,
    backTo: `/more/loans/${id}`,
    submitLabel: "Settle",
    save: (change) => settle.mutate({ id, payload: { change } }, { onSuccess: () => navigate(`/more/loans/${id}`) }),
    busy: settle.isPending,
    error: settle.error?.message ?? null
  }
  if (waiting) return waiting(saver.title, saver.backTo)
  const first = lists.wallets.find((w) => w.currency === l.currency)
  return (
    <ChangeForm
      lists={lists}
      saver={saver}
      initial={{
        // Lent (positive) settles with money coming back (+); Borrowed with money going out (−).
        sign: l.amountMinor >= 0 ? "+" : "-",
        amount: toMajorFixed(l.amountMinor, l.currency),
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

function ChangeForm({ lists, saver, toggle, initial }: { lists: Lists; saver: SaveChange; toggle?: Toggle; initial?: ChangeDraft }) {
  const first = lists.wallets[0]!
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
  const [errors, setErrors] = useState<ChangeErrors>({})

  const submit = () => {
    const read = readChangeDraft(draft)
    if (Either.isLeft(read)) return setErrors(read.left)
    setErrors({})
    saver.save(read.right)
  }

  return (
    <FormPage title={saver.title} backTo={saver.backTo} submitLabel={saver.submitLabel} onSubmit={submit} busy={saver.busy} error={saver.error}>
      {toggle ? toggle(draft.sign === "-" ? "Expense" : "Income") : null}
      <TransactionForm draft={draft} onChange={setDraft} wallets={lists.wallets} categories={lists.categories} tagSuggestions={lists.tags} mode="add" errors={errors} />
    </FormPage>
  )
}

function ExchangeForm({ lists, toggle }: { lists: Lists; toggle: Toggle }) {
  const navigate = useNavigate()
  const create = useCreateExchange()
  const [draft, setDraft] = useState<ExchangeDraft>({
    source: lists.wallets[0]!.id,
    target: (lists.wallets[1] ?? lists.wallets[0])!.id,
    sent: "",
    received: "",
    date: todayLocal(),
    description: "",
    tags: []
  })
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const payload = exchangePayload(draft, lists.wallets)
    if (Either.isLeft(payload)) return setError(payload.left)
    setError(null)
    create.mutate(payload.right, { onSuccess: () => navigate("/transactions") })
  }

  return (
    <FormPage title="Add transaction" backTo="/transactions" submitLabel="Save exchange" onSubmit={submit} busy={create.isPending} error={error ?? create.error?.message ?? null}>
      {toggle("Expense")}
      <ExchangeFields draft={draft} onChange={setDraft} wallets={lists.wallets} tagSuggestions={lists.tags} />
    </FormPage>
  )
}
