import { allCurrencies, type CurrencyCode, currencyExponent, type Loan, type LoanId, type MinorAmount, toMinor } from "@june/shared"
import { Trash } from "@phosphor-icons/react"
import { Either } from "effect"
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { useCreateLoan, useDeleteLoan, useLoan, useMe, useUpdateLoan } from "../../api/queries"
import { FormPage } from "../../layout/FormPage"
import { Dialog, Field, Input, Loading, Segmented, Select, Text } from "../../ui"
import { AmountInput } from "../../ui/AmountInput"

const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" })

type Direction = "lent" | "borrowed"

interface Draft {
  direction: Direction
  amount: string
  currency: string
  description: string
}

const draftFromLoan = (l: Loan): Draft => ({
  direction: l.amountMinor < 0 ? "borrowed" : "lent",
  amount: (Math.abs(l.amountMinor) / 10 ** currencyExponent(l.currency)).toFixed(currencyExponent(l.currency)),
  currency: l.currency,
  description: l.description
})

/** Zero is allowed when editing (a settled Loan), not when creating. */
const readDraft = (draft: Draft, allowZero: boolean): Either.Either<{ amountMinor: MinorAmount; currency: CurrencyCode; description: string }, string> => {
  const parsed = toMinor(Number(draft.amount || "0"), draft.currency)
  if (Either.isLeft(parsed)) return Either.left(parsed.left)
  if (parsed.right === 0 && !allowZero) return Either.left("Enter an amount")
  return Either.right({
    amountMinor: ((draft.direction === "borrowed" ? -1 : 1) * parsed.right) as MinorAmount,
    currency: draft.currency as CurrencyCode,
    description: draft.description.trim()
  })
}

function LoanFields({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => onChange({ ...draft, [key]: value })
  return (
    <>
      <Field label="Direction" hint="Lent: they owe you. Borrowed: you owe them.">
        <Segmented<Direction>
          options={[
            { value: "lent", label: "Lent" },
            { value: "borrowed", label: "Borrowed" }
          ]}
          value={draft.direction}
          onChange={(direction) => set("direction", direction)}
        />
      </Field>
      <Field label="Amount" htmlFor="amount">
        <AmountInput
          id="amount"
          value={draft.amount}
          onChange={(amount) => set("amount", amount)}
          sign={draft.direction === "borrowed" ? "-" : "+"}
          onSignChange={(sign) => set("direction", sign === "-" ? "borrowed" : "lent")}
        />
      </Field>
      <Field label="Currency" htmlFor="currency">
        <Select id="currency" value={draft.currency} onChange={(e) => set("currency", e.target.value)}>
          {allCurrencies.map((c) => (
            <option key={c} value={c}>
              {c} · {currencyNames.of(c) ?? c}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Description" htmlFor="description">
        <Input id="description" value={draft.description} onChange={(e) => set("description", e.target.value)} placeholder="Alex · laptop" autoFocus />
      </Field>
    </>
  )
}

export function AddLoanPage() {
  const navigate = useNavigate()
  const me = useMe()
  const create = useCreateLoan()
  const [draft, setDraft] = useState<Draft>({ direction: "lent", amount: "", currency: "", description: "" })
  const [error, setError] = useState<string | null>(null)
  const effective = { ...draft, currency: draft.currency || me.data?.defaultCurrency || "USD" }

  const submit = () => {
    const read = readDraft(effective, false)
    if (Either.isLeft(read)) return setError(read.left)
    setError(null)
    create.mutate(read.right, { onSuccess: () => navigate("/more") })
  }
  return (
    <FormPage title="Add loan" backTo="/more" submitLabel="Save loan" onSubmit={submit} busy={create.isPending} error={error ?? create.error?.message ?? null}>
      <LoanFields draft={effective} onChange={setDraft} />
    </FormPage>
  )
}

export function EditLoanPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const loan = useLoan(id as LoanId)
  const update = useUpdateLoan()
  const remove = useDeleteLoan()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (loan.data && draft === null) setDraft(draftFromLoan(loan.data))
  }, [loan.data, draft])

  if (loan.isPending || draft === null) {
    return (
      <FormPage title="Edit loan" backTo="/more">
        {loan.isError ? <Text>{loan.error.message}</Text> : <Loading />}
      </FormPage>
    )
  }
  const l = loan.data!
  const submit = () => {
    const read = readDraft(draft, true)
    if (Either.isLeft(read)) return setError(read.left)
    setError(null)
    update.mutate({ id: l.id, payload: read.right }, { onSuccess: () => navigate(`/more/loans/${l.id}`) })
  }
  return (
    <FormPage
      title="Edit loan"
      backTo={`/more/loans/${l.id}`}
      submitLabel="Save loan"
      onSubmit={submit}
      busy={update.isPending}
      error={error ?? update.error?.message ?? remove.error?.message ?? null}
      menu={[{ label: "Delete", icon: Trash, danger: true, onSelect: () => setConfirm(true) }]}
    >
      <LoanFields draft={draft} onChange={setDraft} />
      <Dialog
        open={confirm}
        title={`Delete ${l.description || "this loan"}?`}
        body="Any transactions recorded while settling it stay."
        confirmLabel="Delete"
        danger
        busy={remove.isPending}
        onConfirm={() => remove.mutate(l.id, { onSuccess: () => navigate("/more") })}
        onCancel={() => setConfirm(false)}
      />
    </FormPage>
  )
}
