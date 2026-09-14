import { Funnel } from "@phosphor-icons/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useCategoryIndex, useTags, useWalletIndex } from "../api/queries"
import { FilterSheet } from "../components/transactions/FilterSheet"
import { type ChipSummary, KINDS, kindLabel, summarise, UNCATEGORISED, useFilter, walletOptions } from "../lib/filter"
import { categoryLabel, hueColor } from "../lib/format"
import { cn } from "../ui"

const kindColor: Record<string, string> = { expense: "var(--color-coral)", income: "var(--color-green)", exchange: "var(--color-lavender)" }

const IDLE_MS = 2000
const PAUSE_MS = 1500
const SPEED_PX_S = 28

/**
 * Left alone for a couple of seconds, an overflowing row drifts slowly to its end, pauses, and
 * drifts back, so a chip hidden off the right edge still gets seen. Any touch, wheel or drag
 * stops the drift; it resumes after the same idle wait. Respects prefers-reduced-motion.
 */
const useMarquee = (ref: React.RefObject<HTMLDivElement | null>, key: string) => {
  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let raf = 0
    let idle = 0
    let animating = false
    let programmatic = false
    let direction: 1 | -1 = 1
    let last = 0
    let pauseUntil = 0
    // Kept apart from el.scrollLeft, which rounds and would swallow a sub-pixel step.
    let pos = 0

    const overflow = () => el.scrollWidth - el.clientWidth
    const step = (now: number) => {
      if (!animating) return
      const max = overflow()
      if (max <= 0) {
        animating = false
        return
      }
      if (now >= pauseUntil) {
        const dt = last === 0 ? 0 : (now - last) / 1000
        pos += direction * SPEED_PX_S * dt
        if (pos >= max) {
          pos = max
          direction = -1
          pauseUntil = now + PAUSE_MS
        } else if (pos <= 0) {
          pos = 0
          direction = 1
          pauseUntil = now + PAUSE_MS
        }
        const rounded = Math.round(pos)
        if (rounded !== el.scrollLeft) {
          programmatic = true
          el.scrollLeft = rounded
        }
      }
      last = now
      raf = requestAnimationFrame(step)
    }
    const start = () => {
      if (overflow() <= 0) return
      animating = true
      last = 0
      pauseUntil = 0
      pos = el.scrollLeft
      direction = pos >= overflow() ? -1 : 1
      raf = requestAnimationFrame(step)
    }
    const stop = () => {
      animating = false
      cancelAnimationFrame(raf)
      window.clearTimeout(idle)
      idle = window.setTimeout(start, IDLE_MS)
    }
    const onScroll = () => {
      if (programmatic) {
        programmatic = false
        return
      }
      stop()
    }
    el.addEventListener("pointerdown", stop)
    el.addEventListener("touchstart", stop, { passive: true })
    el.addEventListener("wheel", stop, { passive: true })
    el.addEventListener("scroll", onScroll, { passive: true })
    idle = window.setTimeout(start, IDLE_MS)
    return () => {
      animating = false
      cancelAnimationFrame(raf)
      window.clearTimeout(idle)
      el.removeEventListener("pointerdown", stop)
      el.removeEventListener("touchstart", stop)
      el.removeEventListener("wheel", stop)
      el.removeEventListener("scroll", onScroll)
    }
  }, [ref, key])
}

function Chip({ name, summary, onClick }: { name: string; summary: ChipSummary; onClick: () => void }) {
  const narrowed = summary.state !== "all"
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 border-2 border-ink px-2 font-heading text-xs font-bold tracking-wide whitespace-nowrap uppercase",
        summary.state === "all" && "bg-paper",
        summary.state === "some" && "bg-accent",
        summary.state === "none" && "bg-grey text-grey-ink",
        narrowed && "shadow-hard-sm"
      )}
      style={summary.state === "one" ? { background: summary.color ?? "var(--color-accent)" } : undefined}
    >
      <span className="opacity-60">{name}:</span>
      {summary.label}
    </button>
  )
}

/** The ghost Filter button and the four always-visible chips: Type, Category, Wallet, Tag. One line, never wraps. */
export function FilterRow() {
  const { filter } = useFilter()
  const categories = useCategoryIndex()
  const wallets = useWalletIndex()
  const tags = useTags()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const summaries = useMemo(() => {
    const type = summarise(
      KINDS.map((k) => ({ key: k, label: kindLabel[k], color: kindColor[k] })),
      filter.types
    )
    const category = summarise(
      [
        ...categories.list.map((c) => ({ key: c.slug as string, label: categoryLabel(c), color: hueColor(c.hue) })),
        { key: UNCATEGORISED, label: "Uncategorised", color: "var(--color-grey)" }
      ],
      filter.categories
    )
    const wallet = summarise(
      walletOptions(wallets.list).map((w) => ({ ...w, color: w.key === "unassigned" ? "var(--color-grey)" : "var(--color-sky)" })),
      filter.wallets
    )
    const tag = summarise(
      (tags.data ?? []).map((t) => ({ key: t, label: `#${t}`, color: "var(--color-yellow)" })),
      filter.tags
    )
    return { type, category, wallet, tag }
  }, [filter, categories.list, wallets.list, tags.data])

  useMarquee(ref, [summaries.type.label, summaries.category.label, summaries.wallet.label, summaries.tag.label].join("|"))

  const openSheet = () => setOpen(true)
  return (
    <div className="-mx-4 flex items-center md:-mx-8">
      <button
        type="button"
        onClick={openSheet}
        aria-label="Filter"
        className="ml-1.5 inline-flex h-9 shrink-0 items-center gap-1.5 px-2.5 font-heading text-sm font-bold hover:bg-ink/5 md:ml-5"
      >
        <Funnel size={20} weight="bold" />
        Filter
      </button>
      <div ref={ref} className="flex flex-1 gap-2 overflow-x-auto px-2 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip name="Type" summary={summaries.type} onClick={openSheet} />
        <Chip name="Category" summary={summaries.category} onClick={openSheet} />
        <Chip name="Wallet" summary={summaries.wallet} onClick={openSheet} />
        <Chip name="Tag" summary={summaries.tag} onClick={openSheet} />
        <span className="w-2 shrink-0" aria-hidden />
      </div>
      <FilterSheet open={open} onClose={() => setOpen(false)} />
    </div>
  )
}
