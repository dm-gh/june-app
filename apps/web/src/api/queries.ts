import type {
  BulkUpdate,
  CategoryId,
  CreateCategory,
  CreateChange,
  CreateExchange,
  CreateWallet,
  CurrencyCode,
  TransactionId,
  UpdateCategory,
  UpdateTransaction,
  UpdateWallet,
  WalletId
} from "@june/shared"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Period } from "../lib/period"
import { api, run } from "./client"

export const keys = {
  me: ["me"] as const,
  wallets: ["wallets"] as const,
  categories: ["categories"] as const,
  tags: ["tags"] as const,
  transactions: (p: Period) => ["transactions", p.from, p.to] as const,
  transaction: (id: TransactionId) => ["transaction", id] as const
}

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => run(api.settings.me()) })

export const useWallets = () =>
  useQuery({ queryKey: keys.wallets, queryFn: () => run(api.wallets.list()), staleTime: 30_000 })

export const useCategories = () =>
  useQuery({ queryKey: keys.categories, queryFn: () => run(api.categories.list()), staleTime: 60_000 })

export const useTags = () => useQuery({ queryKey: keys.tags, queryFn: () => run(api.tags.list()), staleTime: 60_000 })

export const useTransactions = (period: Period) =>
  useQuery({
    queryKey: keys.transactions(period),
    queryFn: () => run(api.transactions.list({ urlParams: period })),
    staleTime: 15_000
  })

export const useTransaction = (id: TransactionId) =>
  useQuery({ queryKey: keys.transaction(id), queryFn: () => run(api.transactions.get({ path: { id } })) })

type Payload<T> = T extends { new (props: infer P): unknown } ? Exclude<P, void> : never

/** A mutation that invalidates the given query roots when it succeeds. */
const useInvalidating = <Input, Output>(fn: (input: Input) => Promise<Output>, roots: ReadonlyArray<string>) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all(roots.map((root) => queryClient.invalidateQueries({ queryKey: [root] })))
  })
}

const money = ["transactions", "transaction", "wallets", "tags"]

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
    ["categories", "transactions", "transaction"]
  )

export const useDeleteCategory = () =>
  useInvalidating((id: CategoryId) => run(api.categories.delete({ path: { id } })), ["categories", "transactions", "transaction"])

export const useSetDefaultCurrency = () =>
  useInvalidating((currency: CurrencyCode) => run(api.settings.setDefaultCurrency({ payload: { currency } })), [
    "me",
    "transactions",
    "transaction",
    "wallets"
  ])

export const useRegenerateCaptureToken = () => useInvalidating(() => run(api.settings.regenerateCaptureToken()), ["me"])
