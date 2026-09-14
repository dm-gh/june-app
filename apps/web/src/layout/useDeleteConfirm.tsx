import { Trash } from "@phosphor-icons/react"
import { type ReactNode, useState } from "react"
import { Dialog, type MenuItem } from "../ui"

/** The mutation behind a delete, as api/queries returns it. */
export interface Remover<Id> {
  readonly isPending: boolean
  mutate(id: Id, options?: { onSuccess?: () => void }): void
}

export interface DeleteConfirmOptions<Id> {
  remove: Remover<Id>
  /** What to delete; undefined until it has loaded, when confirming does nothing. */
  id: Id | undefined
  /** The dialog's question, naming the thing, and what happens to what it leaves behind. */
  title: string
  body: string
  /** Where to go, or what to reset, once it is gone. */
  after: () => void
  /** The menu entry's label; "Delete" unless it names a count. */
  label?: string
  disabled?: boolean
}

export interface DeleteConfirm {
  /** The red Delete entry for the options menu. */
  menuItem: MenuItem
  /** The confirmation dialog; render it anywhere on the screen. */
  dialog: ReactNode
}

/** Delete behind a confirmation: the menu entry opens the dialog, Confirm runs the mutation and then `after`. */
export function useDeleteConfirm<Id>({ remove, id, title, body, after, label = "Delete", disabled }: DeleteConfirmOptions<Id>): DeleteConfirm {
  const [open, setOpen] = useState(false)
  const menuItem: MenuItem = { label, icon: Trash, danger: true, ...(disabled === undefined ? {} : { disabled }), onSelect: () => setOpen(true) }
  const confirm = () => {
    if (id === undefined) return
    remove.mutate(id, {
      onSuccess: () => {
        setOpen(false)
        after()
      }
    })
  }
  const dialog = <Dialog open={open} title={title} body={body} confirmLabel="Delete" danger busy={remove.isPending} onConfirm={confirm} onCancel={() => setOpen(false)} />
  return { menuItem, dialog }
}
