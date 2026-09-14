import { cn } from "./cn"

export interface SegmentedProps<V extends string> {
  options: ReadonlyArray<{ value: V; label: string }>
  value: V
  onChange: (value: V) => void
  disabled?: boolean
  className?: string
}

const cols: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" }

/** Two or three bordered buttons; the active one is filled with the accent and lifted with a hard shadow. */
export function Segmented<V extends string>({ options, value, onChange, disabled, className }: SegmentedProps<V>) {
  return (
    <div role="radiogroup" className={cn("grid gap-3", cols[Math.min(options.length, 5)], className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-10 border-3 border-ink px-1 font-heading text-sm font-bold",
              active ? "bg-accent shadow-hard-sm" : "bg-paper hover:bg-ink/5",
              "disabled:cursor-not-allowed disabled:opacity-60"
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
