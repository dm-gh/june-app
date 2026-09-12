import { Check, Copy } from "@phosphor-icons/react"
import { useState } from "react"

/** Small bordered "Copy" that reads "Copied" for a moment after the click. */
export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () =>
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`${label}: ${value}`}
      className="inline-flex h-7 shrink-0 items-center gap-1 border-2 border-ink bg-paper px-2 font-heading text-xs font-bold hover:bg-ink/5"
    >
      {copied ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />}
      {copied ? "Copied" : label}
    </button>
  )
}
