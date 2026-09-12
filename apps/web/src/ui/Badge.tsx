import type { HTMLAttributes } from "react"
import { type Accent, accentBg } from "./Card"
import { cn } from "./cn"

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  accent?: Accent
  /** Hash-style prefix used for Tags. */
  prefix?: string
}

/** Small bordered chip. Categories use an accent, Tags use `prefix="#"`, Uncategorised/Unassigned use `accent="grey"`. */
export function Badge({ accent = "paper", prefix, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1 border-2 border-ink px-2 font-heading text-xs font-bold uppercase tracking-wide",
        accentBg[accent],
        accent === "grey" && "text-grey-ink",
        className
      )}
      {...rest}
    >
      {prefix ? <span className="opacity-60">{prefix}</span> : null}
      {children}
    </span>
  )
}
