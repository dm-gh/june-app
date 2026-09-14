import type { Category } from "@june/shared"
import type { ReactNode } from "react"
import { categoryLabel } from "../lib/format"
import { Select, type SelectProps } from "./Input"

export interface CategorySelectProps<V extends string> extends Omit<SelectProps, "value" | "onChange" | "children"> {
  categories: ReadonlyArray<Category>
  /** Only Categories of this Category Type are offered: a negative Change takes an Expense Category, a positive one an Income Category. */
  type: Category["type"]
  /** A Category id, "" for Uncategorised, or whatever the extra options carry. */
  value: V
  onChange: (value: V) => void
  /** Extra options before Uncategorised. */
  children?: ReactNode
}

/** Uncategorised first, then the Categories of one Category Type as "🥕 Groceries". */
export function CategorySelect<V extends string>({ categories, type, value, onChange, children, ...rest }: CategorySelectProps<V>) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value as V)} {...rest}>
      {children}
      <option value="">Uncategorised</option>
      {categories
        .filter((c) => c.type === type)
        .map((c) => (
          <option key={c.id} value={c.id}>
            {categoryLabel(c)}
          </option>
        ))}
    </Select>
  )
}
