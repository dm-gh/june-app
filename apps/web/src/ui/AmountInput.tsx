import { cn } from "./cn"
import { controlClass } from "./Input"

export interface AmountInputProps {
  id?: string
  /** Decimal text as typed, always unsigned. */
  value: string
  onChange: (value: string) => void
  /** Money leaving (−) or arriving (+). */
  sign: "-" | "+"
  onSignChange?: ((sign: "-" | "+") => void) | undefined
  disabled?: boolean
  invalid?: boolean
}

/**
 * The User never types a sign. The toggle on the left defaults to minus (expense, coral) and flips
 * to plus (income, green); the field's hard shadow takes the same colour.
 */
export function AmountInput({ id, value, onChange, sign, onSignChange, disabled, invalid }: AmountInputProps) {
  const negative = sign === "-"
  return (
    <div className="flex gap-2">
      <button
        type="button"
        aria-label={negative ? "Expense, tap for income" : "Income, tap for expense"}
        disabled={disabled || onSignChange === undefined}
        onClick={() => onSignChange?.(negative ? "+" : "-")}
        className={cn(
          "flex size-11 shrink-0 items-center justify-center border-3 border-ink font-mono text-xl font-bold shadow-hard-sm",
          negative ? "bg-coral" : "bg-green",
          "disabled:opacity-100 enabled:lift"
        )}
      >
        {negative ? "−" : "+"}
      </button>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value.replace(",", "."))}
        className={cn(
          controlClass,
          "h-11 font-mono font-bold",
          negative ? "shadow-[3px_3px_0_0_var(--color-coral)]" : "shadow-[3px_3px_0_0_var(--color-green)]",
          "focus:shadow-hard-sm"
        )}
      />
    </div>
  )
}
