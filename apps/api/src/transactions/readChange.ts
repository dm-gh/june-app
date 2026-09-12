import { isCurrency, LocalDate, todayUtc, toMinor } from "@june/shared"
import { Either, Schema } from "effect"

/** What a capture or an Import row says, every value as typed. */
export interface ChangeInput {
  readonly amount: string | number
  readonly currency: string
  /** Empty means today (UTC). */
  readonly date: string
}

export interface ReadChange {
  readonly amountMinor: number
  readonly currency: string
  readonly occurredOn: LocalDate
}

/**
 * The lenient reading a capture and an Import share: a decimal comma, a lower-case currency
 * code and a string amount are all accepted; a value June cannot read is a plain message.
 */
export const readChange = (input: ChangeInput): Either.Either<ReadChange, string> => {
  const amount = typeof input.amount === "number" ? input.amount : Number(input.amount.trim().replace(",", "."))
  if (input.amount === "" || !Number.isFinite(amount)) return Either.left(`amount "${input.amount}" is not a number`)
  const currency = input.currency.trim().toUpperCase()
  if (!isCurrency(currency)) return Either.left(`currency "${input.currency}" is invalid`)
  const parsed = toMinor(amount, currency)
  if (Either.isLeft(parsed)) return Either.left(parsed.left)
  if (parsed.right === 0) return Either.left("amount is zero")
  const dateInput = input.date.trim()
  const date = dateInput === "" ? Either.right(todayUtc()) : Schema.decodeUnknownEither(LocalDate)(dateInput)
  if (Either.isLeft(date)) return Either.left(`date "${dateInput}" must be YYYY-MM-DD`)
  return Either.right({ amountMinor: parsed.right, currency, occurredOn: date.right })
}
