import { type CategoryId, type CurrencyCode, type LocalDate, type MinorAmount, type Tag, toMajorFixed, toMinor, type Transaction, type WalletId } from "@june/shared"
import { Either } from "effect"

export type Sign = "-" | "+"

/** The fields every Change form edits, as text: sign and amount apart, the ids "" when unset. A Recurring edits exactly these. */
export interface ChangeFieldsDraft {
  sign: Sign
  amount: string
  currency: string
  walletId: WalletId | ""
  categoryId: CategoryId | ""
  description: string
  tags: ReadonlyArray<string>
}

/** A Transaction's draft: the Change fields plus its date and the Hidden flag. */
export interface ChangeDraft extends ChangeFieldsDraft {
  date: LocalDate
  hidden: boolean
}

export type ChangeErrors = Partial<Record<"amount" | "wallet", string>>

export interface ChangeFieldsPayload {
  walletId: WalletId
  amountMinor: MinorAmount
  currency: CurrencyCode
  categoryId: CategoryId | null
  description: string
  tags: ReadonlyArray<Tag>
}

export interface ChangePayload extends ChangeFieldsPayload {
  occurredOn: LocalDate
  hiddenFromAnalysis: boolean
}

export interface ReadOptions {
  /** An opening balance or a settled Loan may be zero; a Change may not. */
  allowZero?: boolean
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

/** The unsigned text and the sign as signed minor units, or the message to show under the field. */
export const readAmount = (sign: Sign, amount: string, currency: string, { allowZero = false }: ReadOptions = {}): Either.Either<MinorAmount, string> => {
  const parsed = toMinor(Number(amount), currency)
  if (Either.isLeft(parsed)) return Either.left(parsed.left)
  if (amount.trim() === "" || (parsed.right === 0 && !allowZero)) return Either.left("Enter an amount")
  const signed = sign === "-" ? -parsed.right : parsed.right
  return Either.right((signed === 0 ? 0 : signed) as MinorAmount)
}

/** Reads a draft into the payload the api takes, or the errors to show by field. A Transaction's draft also yields its date and Hidden flag. */
export function readChangeDraft(draft: ChangeDraft, options?: ReadOptions): Either.Either<ChangePayload, ChangeErrors>
export function readChangeDraft(draft: ChangeFieldsDraft, options?: ReadOptions): Either.Either<ChangeFieldsPayload, ChangeErrors>
export function readChangeDraft(draft: ChangeFieldsDraft | ChangeDraft, options: ReadOptions = {}): Either.Either<ChangeFieldsPayload, ChangeErrors> {
  const errors: ChangeErrors = {}
  const amount = readAmount(draft.sign, draft.amount, draft.currency, options)
  if (Either.isLeft(amount)) errors.amount = amount.left
  if (draft.walletId === "") errors.wallet = `Create a ${draft.currency} wallet first`
  if (Either.isLeft(amount) || draft.walletId === "") return Either.left(errors)
  const fields: ChangeFieldsPayload = {
    walletId: draft.walletId,
    amountMinor: amount.right,
    currency: draft.currency as CurrencyCode,
    categoryId: draft.categoryId === "" ? null : draft.categoryId,
    description: draft.description.trim(),
    tags: draft.tags as unknown as ReadonlyArray<Tag>
  }
  return Either.right("date" in draft ? { ...fields, occurredOn: draft.date, hiddenFromAnalysis: draft.hidden } : fields)
}
