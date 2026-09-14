import { type CurrencyCode, type Loan, type LoanId, type MinorAmount, toMajorFixed } from "@june/shared"
import { Either } from "effect"
import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import { useCreateLoan, useDeleteLoan, useLoan, useMe, useUpdateLoan } from "../../api/queries"
import { FormPage } from "../../layout/FormPage"
import { useDeleteConfirm } from "../../layout/useDeleteConfirm"
import { CurrencySelect, Field, Input, QueryState, Segmented, useDraft } from "../../ui"
import { AmountInput } from "../../ui/AmountInput"
import { readAmount } from "../transactions/changeDraft"

export type Direction = "lent" | "borrowed"

export interface LoanDraft {
  direction: Direction
  amount: string
  currency: string
  description: string
}

export const draftFromLoan = (l: Loan): LoanDraft => ({
  direction: l.amountMinor < 0 ? "borrowed" : "lent",
  amount: toMajorFixed(l.amountMinor, l.currency),
  currency: l.currency,
  description: l.description
})

/** Zero is allowed when editing (a settled Loan), not when creating. */
export const readLoanDraft = (draft: LoanDraft, allowZero: boolean): Either.Either<{ amountMinor: MinorAmount; currency: CurrencyCode; description: string }, string> => {
  const amount = readAmount(draft.direction === "borrowed" ? "-" : "+", draft.amount || "0", draft.currency, { allowZero })
  return Either.map(amount, (amountMinor) => ({ amountMinor, currency: draft.currency as CurrencyCode, description: draft.description.trim() }))
}

export function LoanFields({ draft, onChange }: { draft: LoanDraft; onChange: (d: LoanDraft) => void }) {
  const set = <K extends keyof LoanDraft>(key: K, value: LoanDraft[K]) => onChange({ ...draft, [key]: value })
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
        <CurrencySelect id="currency" value={draft.currency} onChange={(currency) => set("currency", currency)} />
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
  const [draft, setDraft] = useState<LoanDraft>({ direction: "lent", amount: "", currency: "", description: "" })
  const [error, setError] = useState<string | null>(null)
  const effective = { ...draft, currency: draft.currency || me.data?.defaultCurrency || "USD" }

  const submit = () => {
    const read = readLoanDraft(effective, false)
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
  const [draft, setDraft] = useDraft(loan.data, draftFromLoan)
  const [error, setError] = useState<string | null>(null)
  const confirmDelete = useDeleteConfirm({
    remove,
    id: loan.data?.id,
    title: `Delete ${loan.data?.description || "this loan"}?`,
    body: "Any transactions recorded while settling it stay.",
    after: () => navigate("/more")
  })

  if (loan.isPending || draft === null) {
    return (
      <FormPage title="Edit loan" backTo="/more">
        <QueryState of={loan} />
      </FormPage>
    )
  }
  const l = loan.data!
  const submit = () => {
    const read = readLoanDraft(draft, true)
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
      menu={[confirmDelete.menuItem]}
    >
      <LoanFields draft={draft} onChange={setDraft} />
      {confirmDelete.dialog}
    </FormPage>
  )
}
