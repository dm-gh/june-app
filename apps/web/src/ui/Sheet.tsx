import { X } from "@phosphor-icons/react"
import { type ReactNode, useEffect, useRef } from "react"
import { IconButton } from "./IconButton"
import { Heading } from "./Typography"

export interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/** Slides up from the bottom on phones; sits centred with a full border and large shadow on wider screens. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
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
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={[
        "w-full max-w-none bg-paper p-4 backdrop:bg-ink/50",
        "mx-0 mt-auto mb-0 border-t-3 border-ink",
        "sm:m-auto sm:w-[440px] sm:border-3 sm:shadow-hard-lg"
      ].join(" ")}
    >
      <div className="mb-3 flex items-center justify-between">
        <Heading as="h2">{title}</Heading>
        <IconButton icon={X} label="Close" onClick={onClose} />
      </div>
      {children}
    </dialog>
  )
}
