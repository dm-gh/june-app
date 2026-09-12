import { fromMinor } from "@june/shared"
import { cn } from "./cn"

export interface AmountProps {
  /** Signed value in major units. Negative is an expense, positive is income. Or pass `minor`. */
  value?: number
  /** Signed value in minor units (cents); converted with the currency's exponent. */
  minor?: number
  currency: string
  /** Show a leading + on positive values. */
  signed?: boolean
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

const sizes = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl",
  xl: "text-4xl sm:text-5xl"
}

const formatters = new Map<string, Intl.NumberFormat>()
const formatter = (currency: string) => {
  let f = formatters.get(currency)
  if (!f) {
    f = new Intl.NumberFormat(undefined, { style: "currency", currency, currencyDisplay: "code" })
    formatters.set(currency, f)
  }
  return f
}

/** Money is always mono. Colour only carries direction: coral out, green in, ink for neutral totals. */
export function Amount({ value: major, minor, currency, signed = true, size = "md", className }: AmountProps) {
  const value = major ?? (minor === undefined ? 0 : fromMinor(minor, currency))
  const text = formatter(currency).format(Math.abs(value)).replace(/\u00a0/g, " ")
  const sign = value < 0 ? "−" : signed && value > 0 ? "+" : ""
  const tone = !signed ? "text-ink" : value < 0 ? "text-coral-ink" : value > 0 ? "text-green-ink" : "text-ink"
  return (
    <span className={cn("font-mono font-bold tabular-nums whitespace-nowrap", sizes[size], tone, className)}>
      {sign}
      {text}
    </span>
  )
}
