import { type Category, type CategoryId, currencyExponent, type LocalDate, type Transaction, type Wallet, type WalletId } from "@june/shared"
import { useMemo } from "react"
import { Checkbox, Field, Input, Select, TagInput } from "../../ui"
import { AmountInput } from "../../ui/AmountInput"

export interface ChangeDraft {
  sign: "-" | "+"
  amount: string
  currency: string
  walletId: WalletId | ""
  categoryId: CategoryId | ""
  date: LocalDate
  description: string
  tags: ReadonlyArray<string>
  hidden: boolean
}

export const draftFromTransaction = (t: Transaction): ChangeDraft => ({
  sign: t.amountMinor < 0 ? "-" : "+",
  amount: (Math.abs(t.amountMinor) / 10 ** currencyExponent(t.currency)).toFixed(currencyExponent(t.currency)),
  currency: t.currency,
  walletId: t.walletId ?? "",
  categoryId: t.categoryId ?? "",
  date: t.occurredOn,
  description: t.description,
  tags: t.tags,
  hidden: t.hiddenFromAnalysis
})

export interface TransactionFormProps {
  draft: ChangeDraft
  onChange: (draft: ChangeDraft) => void
  wallets: ReadonlyArray<Wallet>
  categories: ReadonlyArray<Category>
  tagSuggestions: ReadonlyArray<string>
  mode: "add" | "edit"
  transactionType?: Transaction["type"]
  errors?: Partial<Record<"amount" | "wallet", string>>
}

/** The shared body of Add transaction, Edit transaction and the read-only Transaction view. */
export function TransactionForm({ draft, onChange, wallets, categories, tagSuggestions, mode, transactionType = "change", errors }: TransactionFormProps) {
  const disabled = false
  const isChange = transactionType === "change"
  const signToggles = isChange
  const set = <K extends keyof ChangeDraft>(key: K, value: ChangeDraft[K]) => onChange({ ...draft, [key]: value })

  // Only currencies a Wallet holds can be chosen: a Transaction entered by hand always has a Wallet.
  const currencies = useMemo(() => {
    const set = new Set<string>(wallets.map((w) => w.currency))
    if (draft.currency) set.add(draft.currency)
    return [...set].sort()
  }, [wallets, draft.currency])
  const walletsInCurrency = wallets.filter((w) => w.currency === draft.currency)
  const categoriesForSign = categories.filter((c) => (draft.sign === "-" ? c.type === "expense" : c.type === "income"))

  return (
    <>
      <Field label="Amount" htmlFor="amount" error={errors?.amount} hint={signToggles ? "Tap the sign to switch between expense and income" : undefined}>
        <AmountInput
          id="amount"
          value={draft.amount}
          onChange={(amount) => set("amount", amount)}
          sign={draft.sign}
          onSignChange={signToggles ? (sign) => onChange({ ...draft, sign, categoryId: "" }) : undefined}
          disabled={disabled}
          invalid={errors?.amount !== undefined}
        />
      </Field>
      <Field label="Currency" htmlFor="currency">
        <Select
          id="currency"
          value={draft.currency}
          disabled={disabled || transactionType === "init"}
          onChange={(e) => {
            const currency = e.target.value
            const first = wallets.find((w) => w.currency === currency)
            onChange({ ...draft, currency, walletId: first?.id ?? "" })
          }}
        >
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Wallet" htmlFor="wallet" error={errors?.wallet}>
        <Select
          id="wallet"
          value={draft.walletId}
          disabled={disabled || transactionType === "init"}
          invalid={errors?.wallet !== undefined}
          onChange={(e) => set("walletId", e.target.value as WalletId)}
        >
          {walletsInCurrency.length === 0 ? <option value="">No wallet in {draft.currency}</option> : null}
          {walletsInCurrency.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} · {w.currency}
            </option>
          ))}
        </Select>
      </Field>
      {isChange ? (
        <Field label="Category" htmlFor="category">
          <Select id="category" value={draft.categoryId} disabled={disabled} onChange={(e) => set("categoryId", e.target.value as CategoryId)}>
            <option value="">Uncategorised</option>
            {categoriesForSign.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji ? `${c.emoji} ` : ""}
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label="Date" htmlFor="date">
        <Input id="date" type="date" value={draft.date} disabled={disabled} onChange={(e) => e.target.value && set("date", e.target.value as LocalDate)} />
      </Field>
      <Field label="Description" htmlFor="description">
        <Input id="description" value={draft.description} disabled={disabled} onChange={(e) => set("description", e.target.value)} placeholder="What was it?" />
      </Field>
      <Field label="Tags" htmlFor="tags" hint="Space-separated, e.g. vacation-2026">
        <TagInput id="tags" value={draft.tags} onChange={(tags) => set("tags", tags)} suggestions={tagSuggestions} disabled={disabled} />
      </Field>
      {isChange ? (
        <Checkbox label="Hide from analysis" checked={draft.hidden} disabled={disabled} onChange={(e) => set("hidden", e.target.checked)} />
      ) : null}
    </>
  )
}
