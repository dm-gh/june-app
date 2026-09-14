import { type CategoryId, type LocalDate, toMajorFixed, type Transaction, type WalletId } from "@june/shared"

/** What every Change form edits, as text: the sign and amount apart, the ids as "" when unset. */
export interface ChangeDraft {
  sign: "-" | "+"
  amount: string
  currency: string
  walletId: WalletId | ""
  categoryId: CategoryId | ""
  date: LocalDate
  description: string
  tags: ReadonlyArray<string>
  hidden: boolean
}

export const draftFromTransaction = (t: Transaction): ChangeDraft => ({
  sign: t.amountMinor < 0 ? "-" : "+",
  amount: toMajorFixed(t.amountMinor, t.currency),
  currency: t.currency,
  walletId: t.walletId ?? "",
  categoryId: t.categoryId ?? "",
  date: t.occurredOn,
  description: t.description,
  tags: t.tags,
  hidden: t.hiddenFromAnalysis
})
