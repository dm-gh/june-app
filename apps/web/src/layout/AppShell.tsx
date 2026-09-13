import { ChartBar, GearSix, type Icon, Plus, Receipt, SquaresFour } from "@phosphor-icons/react"
import { type ReactNode, useContext } from "react"
import { NavLink, useMatch, useNavigate } from "react-router"
import { signOut } from "../api/auth"
import { useMe } from "../api/queries"
import { FilterContext, filterSearch } from "../lib/filter"
import { cn, Display } from "../ui"
import { AttentionBanner, useAttentionNeeded } from "./AttentionBanner"

const tabs: ReadonlyArray<{ to: string; label: string; icon: Icon; filtered: boolean }> = [
  { to: "/analysis", label: "Analysis", icon: ChartBar, filtered: true },
  { to: "/transactions", label: "Transactions", icon: Receipt, filtered: true },
  { to: "/more", label: "More", icon: SquaresFour, filtered: false },
  { to: "/settings", label: "Settings", icon: GearSix, filtered: false }
]

/** Transactions and Analysis share the Filter, so their tab links carry it. */
const useTabLinks = () => {
  const filter = useContext(FilterContext)
  const search = filter ? filterSearch(filter.filter) : ""
  return tabs.map((tab) => ({ ...tab, link: { pathname: tab.to, search: tab.filtered ? search : "" } }))
}

/** Phone: the bottom tab bar, icons only; the active tab also shows its label. The plus slides up over Transactions when it is active. */
function TabBar() {
  const navigate = useNavigate()
  const tabs = useTabLinks()
  const onTransactions = useMatch({ path: "/transactions", end: false }) !== null
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 h-[calc(80px+env(safe-area-inset-bottom))] border-t-3 border-ink bg-paper pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid h-20 grid-cols-4 items-center">
        {tabs.map((tab) => {
          const withPlus = tab.to === "/transactions"
          const Glyph = tab.icon
          return (
            <li key={tab.to} className="relative flex justify-center">
              {withPlus ? (
                <button
                  type="button"
                  aria-label="Add transaction"
                  aria-hidden={!onTransactions}
                  tabIndex={onTransactions ? 0 : -1}
                  onClick={() => navigate("/transactions/new")}
                  className={cn(
                    "absolute bottom-full left-1/2 mb-1 flex size-11 -translate-x-1/2 items-center justify-center border-3 border-ink bg-accent shadow-hard-sm lift",
                    "lift-slide",
                    onTransactions ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-[calc(100%+4px)] opacity-0"
                  )}
                >
                  <Plus size={24} weight="bold" />
                </button>
              ) : null}
              <NavLink
                to={tab.link}
                aria-label={tab.label}
                className={({ isActive }) =>
                  cn(
                    "relative z-10 inline-flex h-11 min-w-[72px] flex-col items-center justify-center gap-0.5 border-3 px-2",
                    isActive ? "border-ink bg-accent text-ink shadow-hard-sm" : "border-transparent text-grey-ink"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Glyph size={isActive ? 20 : 24} weight="bold" />
                    {isActive ? <span className="font-heading text-[10px] leading-none font-bold uppercase tracking-wide">{tab.label}</span> : null}
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Desktop: the 240px left rail, icon and label per tab. The plus sits on the rail's edge beside Transactions while that tab is active. */
function Sidebar() {
  const me = useMe()
  const navigate = useNavigate()
  const tabs = useTabLinks()
  const onTransactions = useMatch({ path: "/transactions", end: false }) !== null
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r-3 border-ink bg-paper p-6 md:flex">
      <Display size="sm" as="div">
        June
      </Display>
      <nav aria-label="Main" className="mt-8 flex flex-col gap-2">
        {tabs.map((tab) => {
          const withPlus = tab.to === "/transactions"
          const Glyph = tab.icon
          return (
            <div key={tab.to} className="relative">
              <NavLink
                to={tab.link}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 border-3 px-3 py-2 font-heading font-bold",
                    isActive ? "border-ink bg-accent shadow-hard-sm" : "border-transparent text-grey-ink hover:text-ink",
                    // The active Transactions item gives way to the plus on the rail's edge.
                    isActive && withPlus && "mr-6"
                  )
                }
              >
                <Glyph size={22} weight="bold" />
                {tab.label}
              </NavLink>
              {withPlus ? (
                <button
                  type="button"
                  aria-label="Add transaction"
                  aria-hidden={!onTransactions}
                  tabIndex={onTransactions ? 0 : -1}
                  onClick={() => navigate("/transactions/new")}
                  className={cn(
                    // Straddles the rail's right border: the nav sits 24px inside the rail.
                    "absolute top-1/2 -right-6 z-10 flex size-11 -translate-y-1/2 translate-x-1/2 items-center justify-center border-3 border-ink bg-accent shadow-hard-sm lift",
                    "lift-slide",
                    onTransactions ? "opacity-100" : "pointer-events-none -translate-x-1/2 opacity-0"
                  )}
                >
                  <Plus size={24} weight="bold" />
                </button>
              ) : null}
            </div>
          )
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-4">
        <div className="font-mono text-xs text-grey-ink">{me.data?.email ?? ""}</div>
        <button
          type="button"
          onClick={() => signOut().then(() => navigate("/sign-in"))}
          className="self-start font-heading text-sm font-bold hover:underline"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}

export interface AppShellProps {
  /** Phone screens without the tab bar (full-screen forms). */
  fullscreen?: boolean
  /** Content column width: lists 720px, forms 560px. */
  width?: "list" | "form"
  children: ReactNode
}

export function AppShell({ fullscreen = false, width = "list", children }: AppShellProps) {
  // The banner shows on every tabbed screen; a page's sticky header swallows the column's top padding, so it gets its own.
  const attention = useAttentionNeeded() && !fullscreen
  return (
    <div className="min-h-dvh md:flex">
      <Sidebar />
      <main className={cn("flex min-h-dvh flex-1 flex-col", !fullscreen && "pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-0")}>
        <div
          className={cn(
            "mx-auto flex w-full flex-1 flex-col px-4 pt-4 md:px-8 md:pt-8",
            width === "form" ? "max-w-[calc(560px+4rem)]" : "max-w-[calc(720px+4rem)]"
          )}
        >
          {attention ? (
            <>
              <AttentionBanner />
              <div className="flex flex-1 flex-col pt-4 md:pt-8">{children}</div>
            </>
          ) : (
            children
          )}
        </div>
      </main>
      {fullscreen ? null : <TabBar />}
    </div>
  )
}
