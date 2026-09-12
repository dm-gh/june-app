import { useEffect, useState } from "react"
import { useCategories, useTags, useWallets } from "../../api/queries"
import { type Filter, isEmptyFilter, KINDS, kindLabel, toggleIn, UNASSIGNED, UNCATEGORISED, useFilter } from "../../lib/filter"
import { hueColor } from "../../lib/format"
import { Button, cn, Label, Sheet } from "../../ui"

/** A chip that reads as selected until tapped: a deselected one keeps its colour at half opacity. */
function ToggleChip({
  label,
  color,
  prefix,
  muted,
  selected,
  onToggle
}: {
  label: string
  color?: string | undefined
  prefix?: string
  muted?: boolean
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        "inline-flex h-8 items-center gap-1 border-2 border-ink px-2 font-heading text-xs font-bold tracking-wide uppercase transition-opacity",
        muted ? "bg-grey text-grey-ink" : "bg-paper",
        !selected && "opacity-50"
      )}
      style={color ? { background: color } : undefined}
    >
      {prefix ? <span className="opacity-60">{prefix}</span> : null}
      {label}
    </button>
  )
}

/**
 * Type as a three-way multiselect, then Categories, Wallets and Tags as chip groups. Everything
 * reads selected until deselected; Reset clears every deselection, Apply commits the draft.
 */
export function FilterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { filter, setFilter } = useFilter()
  const categories = useCategories()
  const wallets = useWallets()
  const tags = useTags()
  const [draft, setDraft] = useState<Filter>(filter)

  useEffect(() => {
    if (open) setDraft(filter)
  }, [open, filter])

  const toggle = (dimension: keyof Filter, key: string) => setDraft((d) => toggleIn(d, dimension, key))
  const apply = () => {
    setFilter(draft)
    onClose()
  }

  const expense = (categories.data ?? []).filter((c) => c.type === "expense")
  const income = (categories.data ?? []).filter((c) => c.type === "income")
  const categoryChip = (c: (typeof expense)[number]) => (
    <ToggleChip
      key={c.id}
      label={`${c.emoji ? `${c.emoji} ` : ""}${c.name}`}
      color={hueColor(c.hue)}
      selected={!draft.categories.includes(c.slug)}
      onToggle={() => toggle("categories", c.slug)}
    />
  )

  return (
    <Sheet open={open} title="Filter" onClose={onClose}>
      <div className="-mx-4 max-h-[60dvh] overflow-y-auto px-4">
        <Label as="div" className="mb-2">
          Type
        </Label>
        <div role="group" className="grid grid-cols-3 gap-3">
          {KINDS.map((k) => {
            const on = !draft.types.includes(k)
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => toggle("types", k)}
                className={cn("h-10 border-3 border-ink font-heading text-sm font-bold", on ? "bg-accent shadow-hard-sm" : "bg-paper text-grey-ink hover:bg-ink/5")}
              >
                {kindLabel[k]}
              </button>
            )
          })}
        </div>

        <Label as="div" className="mt-5 mb-2">
          Categories
        </Label>
        <div className="flex flex-wrap gap-2">
          {expense.map(categoryChip)}
          {income.map(categoryChip)}
          <ToggleChip label="Uncategorised" muted selected={!draft.categories.includes(UNCATEGORISED)} onToggle={() => toggle("categories", UNCATEGORISED)} />
        </div>

        <Label as="div" className="mt-5 mb-2">
          Wallets
        </Label>
        <div className="flex flex-wrap gap-2">
          {(wallets.data?.wallets ?? []).map((w) => (
            <ToggleChip key={w.id} label={w.name} color="var(--color-sky)" selected={!draft.wallets.includes(w.id)} onToggle={() => toggle("wallets", w.id)} />
          ))}
          <ToggleChip label="Unassigned" muted selected={!draft.wallets.includes(UNASSIGNED)} onToggle={() => toggle("wallets", UNASSIGNED)} />
        </div>

        {(tags.data ?? []).length > 0 ? (
          <>
            <Label as="div" className="mt-5 mb-2">
              Tags
            </Label>
            <div className="flex flex-wrap gap-2">
              {(tags.data ?? []).map((t) => (
                <ToggleChip key={t} label={t} prefix="#" color="var(--color-yellow)" selected={!draft.tags.includes(t)} onToggle={() => toggle("tags", t)} />
              ))}
            </div>
          </>
        ) : null}
      </div>
      <div className="mt-5 flex items-center justify-end gap-3">
        <Button variant="ghost" disabled={isEmptyFilter(draft)} onClick={() => setDraft({ types: [], categories: [], wallets: [], tags: [] })}>
          Reset
        </Button>
        <Button size="lg" className="min-w-40" onClick={apply}>
          Apply
        </Button>
      </div>
    </Sheet>
  )
}
