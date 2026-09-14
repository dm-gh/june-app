import { type Dispatch, type SetStateAction, useEffect, useState } from "react"

/**
 * A form's draft, seeded once from loaded data and owned by the form from then on: a refetch never
 * overwrites what the User is typing. Seeded on the first render when the data is already cached, else
 * as soon as it arrives; null until then (or while `from` says there is no draft to seed).
 */
export function useDraft<T, D>(data: T | undefined, from: (data: T) => D | null): [D | null, Dispatch<SetStateAction<D | null>>] {
  const [draft, setDraft] = useState<D | null>(() => (data === undefined ? null : from(data)))
  useEffect(() => {
    if (data !== undefined && draft === null) setDraft(from(data))
    // `from` is a pure adapter; only the data and the seeded state matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, draft])
  return [draft, setDraft]
}
