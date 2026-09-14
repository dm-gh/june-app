import type { FormEvent, ReactNode } from "react"
import { Button, type MenuItem } from "../ui"
import { AppShell } from "./AppShell"
import { DetailHeader, PageError, useBack } from "./Page"

export interface FormPageProps {
  title: ReactNode
  /** Where Back goes; defaults to history back. */
  backTo?: string
  menu?: ReadonlyArray<MenuItem> | undefined
  /** Omit while the form has nothing to submit yet (loading, no Wallet): no action bar. */
  submitLabel?: string
  onSubmit?: () => void
  busy?: boolean
  canSubmit?: boolean
  error?: string | null
  children: ReactNode
}

/**
 * Every form screen: the DetailHeader, fields in a 20px column, and an action bar that always
 * sits at the bottom (sticky on phones, pinned to the column's end on desktop). No rule above the bar.
 */
export function FormPage({ title, backTo, menu, submitLabel, onSubmit, busy, canSubmit = true, error, children }: FormPageProps) {
  const back = useBack(backTo)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit?.()
  }
  return (
    <AppShell tabs={false} width="form" bottom={submitLabel ? "bar" : "gap"}>
      <form onSubmit={submit} className="flex flex-1 flex-col">
        <DetailHeader title={title} backTo={backTo} menu={menu} />
        <div className="flex flex-col gap-5">{children}</div>
        <PageError message={error} />
        {submitLabel ? (
          <div className="sticky bottom-0 mt-auto flex items-center justify-end gap-3 bg-paper pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-8">
            <Button variant="ghost" onClick={back} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" size="lg" className="min-w-56" disabled={busy || !canSubmit}>
              {submitLabel}
            </Button>
          </div>
        ) : null}
      </form>
    </AppShell>
  )
}
