import { splitTags } from "@june/shared"
import { X } from "@phosphor-icons/react"
import { useId, useState } from "react"
import { Badge } from "./Badge"
import { Input } from "./Input"

export interface TagInputProps {
  id?: string
  /** Current Tags, each a single lower-case word. */
  value: ReadonlyArray<string>
  onChange: (tags: ReadonlyArray<string>) => void
  /** Existing Tags offered as suggestions. */
  suggestions?: ReadonlyArray<string> | undefined
  disabled?: boolean
  placeholder?: string
}

export interface TagChipProps {
  tag: string
  /** With a handler the chip carries a remove button; without, it is read-only. */
  onRemove?: (() => void) | undefined
  removeLabel?: string | undefined
  /** Greyed and struck through: a Tag about to be taken away. */
  muted?: boolean | undefined
}

/** One Tag as a "#tag" chip, the same in the input and wherever Tags are picked over. */
export function TagChip({ tag, onRemove, removeLabel = `Remove ${tag}`, muted = false }: TagChipProps) {
  return (
    <Badge prefix="#" accent={muted ? "grey" : "paper"} className="gap-1.5 pr-1">
      <span className={muted ? "line-through" : undefined}>{tag}</span>
      {onRemove ? (
        <button type="button" aria-label={removeLabel} onClick={onRemove} className="ml-0.5 inline-flex size-5 items-center justify-center hover:bg-ink/10">
          <X size={12} weight="bold" />
        </button>
      ) : null}
    </Badge>
  )
}

/**
 * Space-separated: typing a space or pressing Enter turns the word into a chip; Backspace on an
 * empty field removes the last chip. Suggestions come through a native datalist.
 */
export function TagInput({ id, value, onChange, suggestions, disabled, placeholder = "Add tags" }: TagInputProps) {
  const [draft, setDraft] = useState("")
  const listId = useId()

  const commit = (text: string) => {
    const words = splitTags(text).filter((w) => !value.includes(w))
    if (words.length > 0) onChange([...value, ...words])
    setDraft("")
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <TagChip key={tag} tag={tag} onRemove={disabled ? undefined : () => onChange(value.filter((t) => t !== tag))} />
          ))}
        </div>
      ) : null}
      {!disabled ? (
        <>
          <Input
            id={id}
            list={listId}
            value={draft}
            placeholder={placeholder}
            autoComplete="off"
            autoCapitalize="none"
            onChange={(e) => {
              const text = e.target.value
              if (/\s$/.test(text)) commit(text)
              else setDraft(text)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && draft.trim() !== "") {
                e.preventDefault()
                commit(draft)
              } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
                onChange(value.slice(0, -1))
              }
            }}
            onBlur={() => {
              if (draft.trim() !== "") commit(draft)
            }}
          />
          <datalist id={listId}>
            {(suggestions ?? []).filter((s) => !value.includes(s)).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </>
      ) : value.length === 0 ? (
        <Input disabled value="" placeholder="No tags" readOnly />
      ) : null}
    </div>
  )
}
