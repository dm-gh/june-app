import { Field } from "./Field"
import { TagInput, type TagInputProps } from "./TagInput"

/** The Tags field as every Change form shows it: the label, the input and the same hint. */
export function TagsField({ id = "tags", ...rest }: TagInputProps) {
  return (
    <Field label="Tags" htmlFor={id} hint="Space-separated, e.g. vacation-2026">
      <TagInput id={id} {...rest} />
    </Field>
  )
}
