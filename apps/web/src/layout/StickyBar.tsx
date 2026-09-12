import type { ReactNode } from "react"
import { cn } from "../ui"

/**
 * A page header that stays at the top while the page scrolls. It swallows the column's top
 * padding and side gutters so nothing shows through above or beside it.
 */
export function StickyBar({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("sticky top-0 z-10 -mx-4 -mt-4 bg-paper px-4 pt-4 md:-mx-8 md:-mt-8 md:px-8 md:pt-8", className)}>
      {children}
    </div>
  )
}
