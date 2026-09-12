import type { ReactNode } from "react"
import { type Accent, Card } from "./Card"
import { Label } from "./Typography"

export interface NoticeProps {
  accent?: Accent
  label: string
  children: ReactNode
}

/** A coloured panel with a small caps label: the "Wallet order" and "Different currencies" notes. */
export function Notice({ accent = "lavender", label, children }: NoticeProps) {
  return (
    <Card accent={accent} shadow="sm" className="p-3">
      <Label as="div" className="mb-1">
        {label}
      </Label>
      <div className="font-sans text-sm leading-snug">{children}</div>
    </Card>
  )
}
