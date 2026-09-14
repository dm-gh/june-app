import type { Wallet } from "@june/shared"
import type { ReactNode } from "react"
import { Select, type SelectProps } from "./Input"

export interface WalletSelectProps<V extends string> extends Omit<SelectProps, "value" | "onChange" | "children"> {
  wallets: ReadonlyArray<Wallet>
  /** When given, only the Wallets in this currency are offered, and with none of them one placeholder reads "No wallet in X". */
  currency?: string | undefined
  /** A Wallet id, or whatever the extra options carry ("" for the placeholder, a sentinel for "Keep as is"). */
  value: V
  onChange: (value: V) => void
  /** Extra options before the Wallets. */
  children?: ReactNode
}

/** Wallets as "Card · USD". A Transaction entered by hand always has a Wallet in its currency, so the placeholder is a dead end the User must leave. */
export function WalletSelect<V extends string>({ wallets, currency, value, onChange, children, ...rest }: WalletSelectProps<V>) {
  const offered = currency === undefined ? wallets : wallets.filter((w) => w.currency === currency)
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value as V)} {...rest}>
      {children}
      {currency !== undefined && offered.length === 0 ? <option value="">No wallet in {currency}</option> : null}
      {offered.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name} · {w.currency}
        </option>
      ))}
    </Select>
  )
}
