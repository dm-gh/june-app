import { Check } from "@phosphor-icons/react"
import type { InputHTMLAttributes } from "react"
import { cn } from "./cn"

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string
}

/** 28px box, accent fill and an ink check when on, hard shadow (neubrutalism.com). */
export function Checkbox({ label, className, checked, ...rest }: CheckboxProps) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-3 select-none", className)}>
      <span className="relative inline-block size-7 shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} {...rest} />
        <span
          aria-hidden
          className={cn(
            "flex size-7 items-center justify-center border-3 border-ink bg-white shadow-hard-sm",
            "peer-checked:bg-accent peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
          )}
        >
          {checked ? <Check size={18} weight="bold" /> : null}
        </span>
      </span>
      {label ? <span className="font-sans text-base">{label}</span> : null}
    </label>
  )
}
