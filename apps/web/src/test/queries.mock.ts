import { type Attention, type Category, type Loan, type Me, MinorAmount, type Recurring, Tag, type Transaction, type WalletList } from "@june/shared"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { keys } from "../api/queries"
import { emptyFilter, type Filter, FilterContext } from "../lib/filter"
import { type Period, PeriodContext } from "../lib/period"
import { attention, categories, loan, me, recurring, transaction, wallets } from "./fixtures"

/**
 * What a page reads through the real query hooks, seeded straight into a QueryClient under the
 * real `keys`. Nothing is ever fetched: every query is fresh forever and never retried, so the
 * hooks, the lookups derived from them and the pages stay exactly as they ship.
 */
export interface Seed {
  readonly me: Me
  readonly wallets: WalletList
  readonly categories: ReadonlyArray<Category>
  readonly tags: ReadonlyArray<Tag>
  /** The period the Transactions are seeded under; the pages open on it. */
  readonly period: Period
  readonly transactions: ReadonlyArray<Transaction>
  readonly recurrings: ReadonlyArray<Recurring>
  readonly loans: ReadonlyArray<Loan>
  readonly attention: Attention
  readonly filter: Filter
}

/** September 2026, the month every fixture date falls in. */
export const fixturePeriod: Period = { from: "2026-09-01", to: "2026-09-30" } as Period

export const defaultSeed: Seed = {
  me,
  wallets: { wallets: [wallets.card, wallets.cash], totalDefaultMinor: MinorAmount.make(129300) },
  categories: [categories.groceries, categories.salary],
  tags: [Tag.make("food"), Tag.make("weekly")],
  period: fixturePeriod,
  transactions: [transaction()],
  recurrings: [recurring()],
  loans: [loan()],
  attention,
  filter: emptyFilter
}

export interface MockedQueries {
  readonly client: QueryClient
  readonly seed: Seed
  /** QueryClient, MemoryRouter, Period and Filter around a page, as App provides them. */
  readonly wrap: (node: ReactNode, initialEntries?: ReadonlyArray<string>) => ReactNode
}

export const mockQueries = (overrides: Partial<Seed> = {}): MockedQueries => {
  const seed: Seed = { ...defaultSeed, ...overrides }
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, refetchOnWindowFocus: false } } })
  client.setQueryData(keys.me, seed.me)
  client.setQueryData(keys.wallets, seed.wallets)
  client.setQueryData(keys.categories, seed.categories)
  client.setQueryData(keys.tags, seed.tags)
  client.setQueryData(keys.transactions(seed.period), seed.transactions)
  client.setQueryData(keys.recurrings, seed.recurrings)
  client.setQueryData(keys.loans, seed.loans)
  client.setQueryData(keys.attention, seed.attention)
  for (const t of seed.transactions) client.setQueryData(keys.transaction(t.id), t)
  for (const r of seed.recurrings) client.setQueryData(keys.recurring(r.id), r)
  for (const l of seed.loans) client.setQueryData(keys.loan(l.id), l)

  const period = { period: seed.period, setPeriod: () => undefined }
  const filter = { filter: seed.filter, setFilter: () => undefined }
  const wrap = (node: ReactNode, initialEntries: ReadonlyArray<string> = ["/"]): ReactNode =>
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: [...initialEntries] },
        createElement(PeriodContext.Provider, { value: period }, createElement(FilterContext.Provider, { value: filter }, node))
      )
    )
  return { client, seed, wrap }
}
