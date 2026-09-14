import type { Category, Transaction, Wallet } from "@june/shared"
import { Checkbox, DateInput, Field, Input, TagsField } from "../../ui"
import type { ChangeDraft, ChangeErrors } from "./changeDraft"
import { ChangeFields } from "./ChangeFields"

export interface TransactionFormProps {
  draft: ChangeDraft
  onChange: (draft: ChangeDraft) => void
  wallets: ReadonlyArray<Wallet>
  categories: ReadonlyArray<Category>
  tagSuggestions: ReadonlyArray<string>
  mode: "add" | "edit"
  transactionType?: Transaction["type"]
  errors?: ChangeErrors
}

const amountHints: Record<Transaction["type"], string | undefined> = {
  change: "Tap the sign to switch between expense and income",
  init: "Tap the sign for a balance below zero",
  exchange: undefined
}

/** The shared body of Add transaction, Edit transaction and the read-only Transaction view. */
export function TransactionForm({ draft, onChange, wallets, categories, tagSuggestions, transactionType = "change", errors }: TransactionFormProps) {
  const isChange = transactionType === "change"
  const set = <K extends keyof ChangeDraft>(key: K, value: ChangeDraft[K]) => onChange({ ...draft, [key]: value })

  return (
    <>
      <ChangeFields
        draft={draft}
        onChange={(patch) => onChange({ ...draft, ...patch })}
        wallets={wallets}
        categories={categories}
        errors={errors}
        amountHint={amountHints[transactionType]}
        // A Change flips between expense and income; an Init flips below zero; an Exchange leg has a fixed side.
        signToggles={transactionType !== "exchange"}
        walletFixed={transactionType === "init"}
        showCategory={isChange}
      />
      <Field label="Date" htmlFor="date">
        <DateInput id="date" value={draft.date} onChange={(d) => set("date", d)} />
      </Field>
      <Field label="Description" htmlFor="description">
        <Input id="description" value={draft.description} onChange={(e) => set("description", e.target.value)} placeholder="What was it?" />
      </Field>
      <TagsField value={draft.tags} onChange={(tags) => set("tags", tags)} suggestions={tagSuggestions} />
      {isChange ? <Checkbox label="Hide from analysis" checked={draft.hidden} onChange={(e) => set("hidden", e.target.checked)} /> : null}
    </>
  )
}
