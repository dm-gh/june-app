import { useEffect, useRef } from "react"
import { Button } from "./Button"
import { Heading, Text } from "./Typography"

export interface DialogProps {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmation over a 50% ink scrim: Cancel (ghost) or the action (Danger for deletes). */
export function Dialog({ open, title, body, confirmLabel, danger, busy, onConfirm, onCancel }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCancel()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm border-3 border-ink bg-paper p-5 shadow-hard-lg backdrop:bg-ink/50"
    >
      <Heading as="h2">{title}</Heading>
      <Text className="mt-2">{body}</Text>
      <div className="mt-5 flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
