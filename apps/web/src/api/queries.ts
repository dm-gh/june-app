import type {
  BulkUpdate,
  Category,
  CategoryId,
  CreateCategory,
  CreateChange,
  CreateExchange,
  CreateLoan,
  CreateRecurring,
  CreateWallet,
  CurrencyCode,
  ExchangeId,
  FireRecurring,
  ImportRequest,
  LoanId,
  RecurringId,
  SettleLoan,
  TransactionId,
  UpdateCategory,
  UpdateExchange,
  UpdateLoan,
  UpdateRecurring,
  UpdateTransaction,
  UpdateWallet,
  Wallet,
  WalletId
} from "@june/shared"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"
import { slugLookup } from "../lib/filter"
import type { Period } from "../lib/period"
import { api, run } from "./client"

export const keys = {
  me: ["me"] as const,
  wallets: ["wallets"] as const,
  categories: ["categories"] as const,
  tags: ["tags"] as const,
  transactions: (p: Period) => ["transactions", p.from, p.to] as const,
  transaction: (id: TransactionId) => ["transaction", id] as const,
  /** Null while there is no Exchange to ask for: the query stays disabled under an honest key. */
  exchange: (id: ExchangeId | null) => ["exchange", id] as const,
  recurrings: ["recurrings"] as const,
  recurring: (id: RecurringId) => ["recurring", id] as const,
  loans: ["loans"] as const,
  loan: (id: LoanId) => ["loan", id] as const,
  attention: ["attention"] as const
}

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => run(api.settings.me()) })

export const useWallets = () =>
  useQuery({ queryKey: keys.wallets, queryFn: () => run(api.wallets.list()), staleTime: 30_000 })

export const useCategories = () =>
  useQuery({ queryKey: keys.categories, queryFn: () => run(api.categories.list()), staleTime: 60_000 })

export const useTags = () => useQuery({ queryKey: keys.tags, queryFn: () => run(api.tags.list()), staleTime: 60_000 })

export interface CategoryIndex {
  readonly list: ReadonlyArray<Category>
  readonly byId: ReadonlyMap<string, Category>
  readonly bySlug: ReadonlyMap<string, Category>
  /** The Filter keys Categories by slug. */
  readonly slugOf: (id: string) => string | undefined
  /** The Category behind an optional id: undefined for Uncategorised or one deleted since. */
  readonly get: (id: string | null | undefined) => Category | undefined
}

const emptyCategories: ReadonlyArray<Category> = []

/** The Categories as every page looks them up, derived once per fetch. Empty until they load. */
export const useCategoryIndex = (): CategoryIndex => {
  const list = useCategories().data ?? emptyCategories
  return useMemo(() => {
    const byId = new Map(list.map((c) => [c.id as string, c]))
    return { list, byId, bySlug: new Map(list.map((c) => [c.slug as string, c])), slugOf: slugLookup(list), get: (id) => (id ? byId.get(id) : undefined) }
  }, [list])
}

export interface WalletIndex {
  readonly list: ReadonlyArray<Wallet>
  readonly byId: ReadonlyMap<string, Wallet>
  /** A Wallet's name for a card; null for Unassigned or a Wallet deleted since. */
  readonly name: (id: WalletId | null) => string | null
  /** Every Balance in Default Currency; null until the Wallets load or while a rate is unknown. */
  readonly totalDefaultMinor: number | null
}

const emptyWallets: ReadonlyArray<Wallet> = []

/** The Wallets as every page looks them up, derived once per fetch. Empty until they load. */
export const useWalletIndex = (): WalletIndex => {
  const data = useWallets().data
  const list = data?.wallets ?? emptyWallets
  const totalDefaultMinor = data?.totalDefaultMinor ?? null
  return useMemo(() => {
    const byId = new Map(list.map((w) => [w.id as string, w]))
    return { list, byId, name: (id) => (id === null ? null : (byId.get(id)?.name ?? null)), totalDefaultMinor }
  }, [list, totalDefaultMinor])
}

export const useTransactions = (period: Period) =>
  useQuery({
    queryKey: keys.transactions(period),
    queryFn: () => run(api.transactions.list({ urlParams: period })),
    staleTime: 15_000
  })

export const useTransaction = (id: TransactionId) =>
  useQuery({ queryKey: keys.transaction(id), queryFn: () => run(api.transactions.get({ path: { id } })) })

export const useExchange = (id: ExchangeId | null) =>
  useQuery({
    queryKey: keys.exchange(id),
    queryFn: () => run(api.transactions.getExchange({ path: { exchangeId: id! } })),
    enabled: id !== null
  })

type Payload<T> = T extends { new (props: infer P): unknown } ? Exclude<P, void> : never

/** A query root: the first element of a key, which is always the key's own name. */
export type Root = keyof typeof keys

/** A mutation that invalidates the given query roots when it succeeds. */
const useInvalidating = <Input, Output>(fn: (input: Input) => Promise<Output>, roots: ReadonlyArray<Root>) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all(roots.map((root) => queryClient.invalidateQueries({ queryKey: [root] })))
  })
}

/**
 * Which roots each kind of mutation refreshes. Money: anything that records a Transaction or
 * touches a Wallet; deleting a Wallet also orphans Recurrings and feeds the attention banner, so
 * those ride along. Category: a rename shows on every card, and deleting one sets a Recurring's
 * Category null. Default Currency: every converted figure, the Exchange's defaultMinor included.
 */
export const invalidates = {
  money: ["transactions", "transaction", "exchange", "wallets", "tags", "recurrings", "recurring", "attention"],
  category: ["categories", "transactions", "transaction", "recurrings", "recurring"],
  defaultCurrency: ["me", "transactions", "transaction", "exchange", "wallets"],
  recurring: ["recurrings", "recurring", "attention"],
  loan: ["loans", "loan"]
} as const satisfies Record<string, ReadonlyArray<Root>>

const { money, recurring: recurringRoots, loan: loanRoots } = invalidates

export const useCreateChange = () =>
  useInvalidating((payload: Payload<typeof CreateChange>) => run(api.transactions.createChange({ payload })), money)

export const useCreateExchange = () =>
  useInvalidating((payload: Payload<typeof CreateExchange>) => run(api.transactions.createExchange({ payload })), money)

export const useUpdateTransaction = () =>
  useInvalidating(
    ({ id, payload }: { id: TransactionId; payload: Payload<typeof UpdateTransaction> }) =>
      run(api.transactions.update({ path: { id }, payload })),
    money
  )

export const useUpdateExchange = () =>
  useInvalidating(
    ({ exchangeId, payload }: { exchangeId: ExchangeId; payload: Payload<typeof UpdateExchange> }) =>
      run(api.transactions.updateExchange({ path: { exchangeId }, payload })),
    money
  )

export const useBulkUpdate = () =>
  useInvalidating((payload: Payload<typeof BulkUpdate>) => run(api.transactions.bulkUpdate({ payload })), money)

export const useDeleteTransactions = () =>
  useInvalidating(
    (ids: ReadonlyArray<TransactionId>) =>
      ids.length === 1
        ? run(api.transactions.delete({ path: { id: ids[0]! } }))
        : run(api.transactions.bulkDelete({ payload: { ids: ids as [TransactionId, ...TransactionId[]] } })),
    money
  )

export const useCreateWallet = () =>
  useInvalidating((payload: Payload<typeof CreateWallet>) => run(api.wallets.create({ payload })), money)

export const useUpdateWallet = () =>
  useInvalidating(
    ({ id, payload }: { id: WalletId; payload: Payload<typeof UpdateWallet> }) => run(api.wallets.update({ path: { id }, payload })),
    money
  )

export const useReorderWallets = () =>
  useInvalidating((ids: ReadonlyArray<WalletId>) => run(api.wallets.reorder({ payload: { ids } })), ["wallets"])

export const useDeleteWallet = () => useInvalidating((id: WalletId) => run(api.wallets.delete({ path: { id } })), money)

export const useCreateCategory = () =>
  useInvalidating((payload: Payload<typeof CreateCategory>) => run(api.categories.create({ payload })), ["categories"])

export const useUpdateCategory = () =>
  useInvalidating(
    ({ id, payload }: { id: CategoryId; payload: Payload<typeof UpdateCategory> }) =>
      run(api.categories.update({ path: { id }, payload })),
    invalidates.category
  )

export const useDeleteCategory = () => useInvalidating((id: CategoryId) => run(api.categories.delete({ path: { id } })), invalidates.category)

export const useSetDefaultCurrency = () =>
  useInvalidating((currency: CurrencyCode) => run(api.settings.setDefaultCurrency({ payload: { currency } })), invalidates.defaultCurrency)

/** A preview records nothing, so nothing is invalidated. */
export const useImportPreview = () =>
  useMutation({ mutationFn: (payload: Payload<typeof ImportRequest>) => run(api.import.run({ payload })) })

export const useImportRun = () => useInvalidating((payload: Payload<typeof ImportRequest>) => run(api.import.run({ payload })), money)

export const useRegenerateCaptureToken = () => useInvalidating(() => run(api.settings.regenerateCaptureToken()), ["me"])

export const useAttention = () => useQuery({ queryKey: keys.attention, queryFn: () => run(api.settings.attention()), staleTime: 30_000 })

export const useRecurrings = () => useQuery({ queryKey: keys.recurrings, queryFn: () => run(api.recurrings.list()), staleTime: 30_000 })

export const useRecurring = (id: RecurringId) =>
  useQuery({ queryKey: keys.recurring(id), queryFn: () => run(api.recurrings.get({ path: { id } })) })

export const useCreateRecurring = () =>
  useInvalidating((payload: Payload<typeof CreateRecurring>) => run(api.recurrings.create({ payload })), recurringRoots)

export const useUpdateRecurring = () =>
  useInvalidating(
    ({ id, payload }: { id: RecurringId; payload: Payload<typeof UpdateRecurring> }) => run(api.recurrings.update({ path: { id }, payload })),
    recurringRoots
  )

export const useDeleteRecurring = () => useInvalidating((id: RecurringId) => run(api.recurrings.delete({ path: { id } })), recurringRoots)

/** Firing records a Change and advances the Schedule; the money roots already cover both. */
export const useFireRecurring = () =>
  useInvalidating(
    ({ id, payload }: { id: RecurringId; payload: Payload<typeof FireRecurring> }) => run(api.recurrings.fire({ path: { id }, payload })),
    money
  )

export const useLoans = () => useQuery({ queryKey: keys.loans, queryFn: () => run(api.loans.list()), staleTime: 30_000 })

export const useLoan = (id: LoanId) => useQuery({ queryKey: keys.loan(id), queryFn: () => run(api.loans.get({ path: { id } })) })

export const useCreateLoan = () => useInvalidating((payload: Payload<typeof CreateLoan>) => run(api.loans.create({ payload })), loanRoots)

export const useUpdateLoan = () =>
  useInvalidating(({ id, payload }: { id: LoanId; payload: Payload<typeof UpdateLoan> }) => run(api.loans.update({ path: { id }, payload })), loanRoots)

export const useDeleteLoan = () => useInvalidating((id: LoanId) => run(api.loans.delete({ path: { id } })), loanRoots)

/** Settling records a Change and moves the Loan. */
export const useSettleLoan = () =>
  useInvalidating(
    ({ id, payload }: { id: LoanId; payload: Payload<typeof SettleLoan> }) => run(api.loans.settle({ path: { id }, payload })),
    [...money, ...loanRoots]
  )
