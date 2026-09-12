import { type CategoryId, type LocalDate, type MinorAmount, toMinor, type WalletId } from "@june/shared"
import { Either } from "effect"
import { useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { useCategories, useCreateChange, useCreateExchange, useMe, useTags, useWallets } from "../../api/queries"
import { FormPage } from "../../layout/FormPage"
import { todayLocal } from "../../lib/period"
import { AmountInput, Field, Input, Loading, Notice, Segmented, Select, Text } from "../../ui"
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
  const toggle = (
    <Field label="Type">
      <Segmented<Kind>
        options={[{ value: "change", label: "Expense" }, { value: "exchange", label: "Exchange" }]}
        value={kind}
        onChange={(k) => setParams(k === "exchange" ? { type: "exchange" } : {})}
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

function ChangeForm({ wallets, categories, tagSuggestions, toggle }: { wallets: Wallets; categories: Categories; tagSuggestions: ReadonlyArray<string>; toggle: React.ReactNode }) {
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

  const title = draft.sign === "-" ? "Add transaction" : "Add income"
  return (
    <FormPage title={title} backTo="/transactions" submitLabel="Save transaction" onSubmit={submit} busy={create.isPending} error={create.error?.message ?? null}>
      {toggle}
      <TransactionForm draft={draft} onChange={setDraft} wallets={wallets} categories={categories} tagSuggestions={tagSuggestions} mode="add" errors={errors} />
    </FormPage>
  )
}

function ExchangeForm({ wallets, tagSuggestions, toggle }: { wallets: Wallets; tagSuggestions: ReadonlyArray<string>; toggle: React.ReactNode }) {
  const navigate = useNavigate()
  const create = useCreateExchange()
  const [source, setSource] = useState<WalletId>(wallets[0]!.id)
  const [target, setTarget] = useState<WalletId>((wallets[1] ?? wallets[0])!.id)
  const [sent, setSent] = useState("")
  const [received, setReceived] = useState("")
  const [date, setDate] = useState<LocalDate>(todayLocal())
  const [error, setError] = useState<string | null>(null)
  void tagSuggestions

  const from = wallets.find((w) => w.id === source)!
  const to = wallets.find((w) => w.id === target)!
  const sameCurrency = from.currency === to.currency
  const implied = useMemo(() => {
    const s = Number(sent)
    const r = Number(received)
    return s > 0 && r > 0 ? (r / s).toFixed(4) : null
  }, [sent, received])

  const submit = () => {
    if (source === target) return setError("Pick two different wallets")
    const sentMinor = toMinor(Number(sent), from.currency)
    const receivedMinor = toMinor(Number(received || (sameCurrency ? sent : "")), to.currency)
    if (Either.isLeft(sentMinor) || sentMinor.right <= 0) return setError(Either.isLeft(sentMinor) ? sentMinor.left : "Enter the amount sent")
    if (Either.isLeft(receivedMinor) || receivedMinor.right <= 0) return setError(Either.isLeft(receivedMinor) ? receivedMinor.left : "Enter the amount received")
    setError(null)
    create.mutate(
      {
        sourceWalletId: source,
        sourceMinor: sentMinor.right as MinorAmount,
        targetWalletId: target,
        targetMinor: receivedMinor.right as MinorAmount,
        occurredOn: date
      },
      { onSuccess: () => navigate("/transactions") }
    )
  }

  const walletOptions = wallets.map((w) => (
    <option key={w.id} value={w.id}>
      {w.name} · {w.currency}
    </option>
  ))

  return (
    <FormPage title="Add exchange" backTo="/transactions" submitLabel="Save exchange" onSubmit={submit} busy={create.isPending} error={error ?? create.error?.message ?? null}>
      {toggle}
      <Field label="From wallet" htmlFor="from">
        <Select id="from" value={source} onChange={(e) => setSource(e.target.value as WalletId)}>
          {walletOptions}
        </Select>
      </Field>
      <Field label="To wallet" htmlFor="to">
        <Select id="to" value={target} onChange={(e) => setTarget(e.target.value as WalletId)}>
          {walletOptions}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Sent · ${from.currency}`} htmlFor="sent" hint={`Leaves ${from.name}`}>
          <AmountInput id="sent" value={sent} onChange={setSent} sign="-" />
        </Field>
        <Field label={`Received · ${to.currency}`} htmlFor="received" hint={`Arrives in ${to.name}`}>
          <AmountInput id="received" value={sameCurrency ? sent : received} onChange={setReceived} sign="+" disabled={sameCurrency} />
        </Field>
      </div>
      <Field label="Date" htmlFor="date">
        <Input id="date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value as LocalDate)} />
      </Field>
      {sameCurrency ? null : (
        <Notice accent="sky" label="Different currencies">
          {implied ? (
            <p className="font-mono">
              Your amounts imply 1 {from.currency} = {implied} {to.currency}.
            </p>
          ) : null}
          <p>The wallets record exactly what you enter.</p>
        </Notice>
      )}
    </FormPage>
  )
}
