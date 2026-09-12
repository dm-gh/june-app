import type { Icon } from "@phosphor-icons/react"
import { List } from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"
import { cn } from "./cn"
import { IconButton } from "./IconButton"

export interface MenuItem {
  label: string
  icon: Icon
  danger?: boolean
  onSelect: () => void
}

export interface MenuProps {
  items: ReadonlyArray<MenuItem>
  label?: string
}

/** The options menu: a ghost Menu icon button that drops a bordered list under itself. */
export function Menu({ items, label = "Options" }: MenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <IconButton icon={List} label={label} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)} />
      {open ? (
        <div role="menu" className="absolute top-full right-0 z-20 mt-1 min-w-56 border-3 border-ink bg-paper shadow-hard">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
              className={cn(
                "flex w-full items-center gap-3 border-b-3 border-ink px-4 py-3 text-left font-heading font-bold last:border-b-0 hover:bg-ink/5",
                item.danger && "text-coral-ink"
              )}
            >
              <item.icon size={20} weight="bold" />
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
