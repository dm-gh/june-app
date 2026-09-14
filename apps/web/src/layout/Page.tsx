import { ArrowLeft } from "@phosphor-icons/react"
import type { ReactNode } from "react"
import { useNavigate } from "react-router"
import { Display, ErrorNotice, IconButton, Menu, type MenuItem } from "../ui"
import { AppShell } from "./AppShell"
import { StickyBar } from "./StickyBar"

/** Back goes to the given route, or one step into history when a screen has no fixed parent. */
export const useBack = (backTo?: string) => {
  const navigate = useNavigate()
  return () => (backTo ? navigate(backTo) : navigate(-1))
}

export interface DetailHeaderProps {
  title: ReactNode
  /** Where Back goes; defaults to history back. */
  backTo?: string | undefined
  menu?: ReadonlyArray<MenuItem> | undefined
}

/** The head of a detail or form screen: Back and the options menu in a sticky bar, the Display title below. */
export function DetailHeader({ title, backTo, menu }: DetailHeaderProps) {
  const back = useBack(backTo)
  return (
    <>
      <StickyBar className="pb-2">
        <div className="-ml-2.5 flex items-center justify-between">
          <IconButton icon={ArrowLeft} label="Back" onClick={back} />
          {menu ? <Menu items={menu} /> : null}
        </div>
      </StickyBar>
      <Display size="sm" className="mt-2 mb-5">
        {title}
      </Display>
    </>
  )
}

/** A list screen's name in its sticky header, beside the Back arrow when the screen has a parent. */
export function ListTitle({ title, backTo }: { title: string; backTo?: string | undefined }) {
  const back = useBack(backTo)
  return backTo ? (
    <div className="-ml-2.5 flex items-center gap-1">
      <IconButton icon={ArrowLeft} label="Back" onClick={back} />
      <Display size="sm">{title}</Display>
    </div>
  ) : (
    <Display size="sm">{title}</Display>
  )
}

/** The error card a screen shows under its content; nothing while there is no error. */
export function PageError({ message }: { message: string | null | undefined }) {
  return message ? (
    <div className="mt-5">
      <ErrorNotice message={message} />
    </div>
  ) : null
}

export interface PageProps extends DetailHeaderProps {
  /** The phone tab bar underneath; off for a full-screen guide. */
  tabs?: boolean
  error?: string | null
  children: ReactNode
}

/** A read-only detail screen (a Recurring, a Loan, the Shortcut guide): form width, DetailHeader, content, an error card last. */
export function Page({ tabs = true, error, children, ...header }: PageProps) {
  return (
    <AppShell tabs={tabs} width="form">
      <DetailHeader {...header} />
      {children}
      <PageError message={error} />
    </AppShell>
  )
}

/** A list screen without a period or Filter (More, the Loan Archive): its name in the sticky header, then the lists. */
export function ListPage({ title, backTo, children }: { title: string; backTo?: string; children: ReactNode }) {
  return (
    <AppShell>
      <StickyBar>
        <header className="pb-3">
          <ListTitle title={title} backTo={backTo} />
        </header>
      </StickyBar>
      {children}
    </AppShell>
  )
}
