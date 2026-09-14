import type { ReactNode } from "react"
import { Card } from "./Card"
import { Text } from "./Typography"

/** Loading placeholder that keeps the page's rhythm. */
export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="py-8 text-center font-mono text-sm text-grey-ink">
      {label}…
    </div>
  )
}

export function ErrorNotice({ message }: { message: string }) {
  return (
    <Card accent="coral" shadow="sm" role="alert" className="p-3 font-mono text-sm">
      {message}
    </Card>
  )
}

export interface QueryLike {
  readonly isPending: boolean
  readonly isError: boolean
  readonly error: Error | null
}

/**
 * What a screen shows while it waits on its queries: the first error as a card, or Loading while
 * any is still pending. Nothing once every query has its data.
 */
export function QueryState({ of }: { of: QueryLike | ReadonlyArray<QueryLike> }) {
  const queries: ReadonlyArray<QueryLike> = "isPending" in of ? [of] : of
  const failed = queries.find((q) => q.isError)
  if (failed?.error) return <ErrorNotice message={failed.error.message} />
  if (queries.some((q) => q.isPending)) return <Loading />
  return null
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <Card accent="paper" shadow="none" className="border-dashed p-6 text-center">
      <Text className="text-grey-ink">{children}</Text>
    </Card>
  )
}
