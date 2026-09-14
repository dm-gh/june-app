import { type LocalDate, type MinorAmount, toMajorFixed, toMinor, type Transaction, type UpdateExchange, type Wallet, type WalletId } from "@june/shared"
import { Either } from "effect"

/** What the Exchange form edits: both Wallets, both magnitudes, and the fields shared by the legs. */
export interface ExchangeDraft {
  source: WalletId
  target: WalletId
  sent: string
  received: string
  date: LocalDate
  description: string
  tags: ReadonlyArray<string>
}

type ExchangePayload = ConstructorParameters<typeof UpdateExchange>[0]

/** The amount of a leg as the form shows it: unsigned, in major units, e.g. "12.50". */
const legAmount = (t: Transaction): string => toMajorFixed(t.amountMinor, t.currency)

/** The source leg is the negative one. Null when a leg lost its Wallet: such an Exchange cannot be edited. */
export const draftFromLegs = (legs: ReadonlyArray<Transaction>): ExchangeDraft | null => {
  const source = legs.find((l) => l.amountMinor < 0)
  const target = legs.find((l) => l.amountMinor > 0)
  if (!source || !target || !source.walletId || !target.walletId) return null
  return {
    source: source.walletId,
    target: target.walletId,
    sent: legAmount(source),
    received: legAmount(target),
    date: source.occurredOn,
    description: source.description,
    tags: source.tags
  }
}

/** Turn a draft into the payload both create and update take, or the message to show instead. */
export const exchangePayload = (draft: ExchangeDraft, wallets: ReadonlyArray<Wallet>): Either.Either<ExchangePayload, string> => {
  const from = wallets.find((w) => w.id === draft.source)
  const to = wallets.find((w) => w.id === draft.target)
  if (!from || !to) return Either.left("Pick both wallets")
  if (from.id === to.id) return Either.left("Pick two different wallets")
  const sameCurrency = from.currency === to.currency
  const sentMinor = toMinor(Number(draft.sent), from.currency)
  const receivedMinor = toMinor(Number(sameCurrency ? draft.sent : draft.received), to.currency)
  if (Either.isLeft(sentMinor) || sentMinor.right <= 0) return Either.left(Either.isLeft(sentMinor) ? sentMinor.left : "Enter the amount sent")
  if (Either.isLeft(receivedMinor) || receivedMinor.right <= 0) {
    return Either.left(Either.isLeft(receivedMinor) ? receivedMinor.left : "Enter the amount received")
  }
  return Either.right({
    sourceWalletId: from.id,
    sourceMinor: sentMinor.right as MinorAmount,
    targetWalletId: to.id,
    targetMinor: receivedMinor.right as MinorAmount,
    occurredOn: draft.date,
    description: draft.description.trim(),
    tags: draft.tags as never
  })
}
