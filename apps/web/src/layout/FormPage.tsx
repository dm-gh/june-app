import { ArrowLeft } from "@phosphor-icons/react"
import type { FormEvent, ReactNode } from "react"
import { useNavigate } from "react-router"
import { Button, Display, ErrorNotice, IconButton, Menu, type MenuItem } from "../ui"
import { AppShell } from "./AppShell"
import { StickyBar } from "./StickyBar"

export interface FormPageProps {
  title: ReactNode
  /** Where Back goes; defaults to history back. */
  backTo?: string
  menu?: ReadonlyArray<MenuItem> | undefined
  /** Omit for read-only pages: no action bar. */
  submitLabel?: string
  onSubmit?: () => void
  busy?: boolean
  canSubmit?: boolean
  error?: string | null
  children: ReactNode
}

/**
 * Every form screen: a Back arrow and options menu that stay at the top while the page scrolls,
 * Display title, fields, and an action bar that always sits at the bottom (sticky on phones,
 * pinned to the column's end on desktop). No rule above the bar.
 */
export function FormPage({ title, backTo, menu, submitLabel, onSubmit, busy, canSubmit = true, error, children }: FormPageProps) {
  const navigate = useNavigate()
  const back = () => (backTo ? navigate(backTo) : navigate(-1))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit?.()
  }
  return (
    <AppShell fullscreen width="form">
      <form onSubmit={submit} className="flex flex-1 flex-col">
        <StickyBar className="pb-2">
          <div className="-ml-2.5 flex items-center justify-between">
            <IconButton icon={ArrowLeft} label="Back" onClick={back} />
            {menu ? <Menu items={menu} /> : null}
          </div>
        </StickyBar>
        <Display size="sm" className="mt-2 mb-5">
          {title}
        </Display>
        <div className="flex flex-col gap-5">{children}</div>
        {error ? (
          <div className="mt-5">
            <ErrorNotice message={error} />
          </div>
        ) : null}
        {submitLabel ? (
          <div className="sticky bottom-0 mt-auto flex items-center justify-end gap-3 bg-paper pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-8">
            <Button variant="ghost" onClick={back} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" size="lg" className="min-w-56" disabled={busy || !canSubmit}>
              {submitLabel}
            </Button>
          </div>
        ) : (
          <div className="pb-8" />
        )}
      </form>
    </AppShell>
  )
}
