import type { ReactNode } from "react"
import { cn } from "../ui"
import { gutter } from "./gutter"

/** A page header that stays at the top while the page scrolls, painting edge to edge across the column's gutter. */
export function StickyBar({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("sticky top-0 z-10 bg-paper", gutter.cancel, gutter.around, className)}>
      {children}
    </div>
  )
}
