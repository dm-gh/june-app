import { allCurrencies, currencyName } from "@june/shared"
import { Select, type SelectProps } from "./Input"

export interface CurrencySelectProps extends Omit<SelectProps, "value" | "onChange" | "children"> {
  value: string
  onChange?: ((code: string) => void) | undefined
}

/** Every ISO currency by code and name, "USD · US Dollar": for a Wallet, a Loan and the Default Currency. */
export function CurrencySelect({ value, onChange, ...rest }: CurrencySelectProps) {
  return (
    <Select value={value} onChange={(e) => onChange?.(e.target.value)} {...rest}>
      {allCurrencies.map((c) => (
        <option key={c} value={c}>
          {c} · {currencyName(c)}
        </option>
      ))}
    </Select>
  )
}
