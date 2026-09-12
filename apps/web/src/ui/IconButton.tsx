import type { Icon } from "@phosphor-icons/react"
import type { ButtonHTMLAttributes } from "react"
import { cn } from "./cn"

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: Icon
  /** Accessible name; the button shows only the glyph. */
  label: string
}

/** Ghost: no fill, border or shadow, a 24px Phosphor Bold glyph in a 44px hit area. */
export function IconButton({ icon: Glyph, label, className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center text-ink",
        "hover:bg-ink/5 active:translate-x-px active:translate-y-px disabled:opacity-40",
        "focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-ink",
        className
      )}
      {...rest}
    >
      <Glyph size={24} weight="bold" />
    </button>
  )
}
