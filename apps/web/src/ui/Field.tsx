import type { ReactNode } from "react"
import { cn } from "./cn"
import { Label } from "./Typography"

export interface FieldProps {
  label: string
  htmlFor?: string | undefined
  hint?: string | undefined
  error?: string | undefined
  className?: string | undefined
  children: ReactNode
}

/** Label + control + hint/error. The control passed as children should carry `id={htmlFor}`. */
export function Field({ label, htmlFor, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label as="label" {...(htmlFor ? { htmlFor } : {})}>
        {label}
      </Label>
      {children}
      {error ? (
        <span role="alert" className="font-mono text-sm text-coral">
          {error}
        </span>
      ) : hint ? (
        <span className="font-sans text-sm text-grey-ink">{hint}</span>
      ) : null}
    </div>
  )
}
