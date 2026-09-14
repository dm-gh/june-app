import { type Category, categoryTypeForSign, type Wallet } from "@june/shared"
import { useMemo } from "react"
import { AmountInput, CategorySelect, Field, Select, WalletSelect } from "../../ui"
import type { ChangeErrors, ChangeFieldsDraft } from "./changeDraft"

export interface ChangeFieldsProps {
  draft: ChangeFieldsDraft
  /** Merged into the form's own draft. A sign flip also clears the Category; a currency change also moves the Wallet. */
  onChange: (patch: Partial<ChangeFieldsDraft>) => void
  wallets: ReadonlyArray<Wallet>
  categories: ReadonlyArray<Category>
  errors?: ChangeErrors | undefined
  amountHint?: string | undefined
  /** Off for an Exchange leg, whose side is fixed. */
  signToggles?: boolean
  /** An Init keeps its Wallet and currency. */
  walletFixed?: boolean
  /** An Init has no Category. */
  showCategory?: boolean
}

/**
 * Amount, currency, Wallet and Category: the fields a Change and a Recurring share, with the rules
 * between them. Only currencies a Wallet holds can be chosen, because a Transaction entered by
 * hand always has a Wallet; the Category list follows the sign.
 */
export function ChangeFields({ draft, onChange, wallets, categories, errors, amountHint, signToggles = true, walletFixed = false, showCategory = true }: ChangeFieldsProps) {
  const currencies = useMemo(() => {
    const held = new Set<string>(wallets.map((w) => w.currency))
    if (draft.currency) held.add(draft.currency)
    return [...held].sort()
  }, [wallets, draft.currency])

  return (
    <>
      <Field label="Amount" htmlFor="amount" error={errors?.amount} hint={amountHint}>
        <AmountInput
          id="amount"
          value={draft.amount}
          onChange={(amount) => onChange({ amount })}
          sign={draft.sign}
          onSignChange={signToggles ? (sign) => onChange({ sign, categoryId: "" }) : undefined}
          invalid={errors?.amount !== undefined}
        />
      </Field>
      <Field label="Currency" htmlFor="currency">
        <Select
          id="currency"
          value={draft.currency}
          disabled={walletFixed}
          onChange={(e) => {
            const currency = e.target.value
            onChange({ currency, walletId: wallets.find((w) => w.currency === currency)?.id ?? "" })
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
        <WalletSelect id="wallet" wallets={wallets} currency={draft.currency} value={draft.walletId} disabled={walletFixed} invalid={errors?.wallet !== undefined} onChange={(walletId) => onChange({ walletId })} />
      </Field>
      {showCategory ? (
        <Field label="Category" htmlFor="category">
          <CategorySelect id="category" categories={categories} type={categoryTypeForSign(draft.sign)} value={draft.categoryId} onChange={(categoryId) => onChange({ categoryId })} />
        </Field>
      ) : null}
    </>
  )
}
