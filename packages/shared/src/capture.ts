import { Schema } from "effect"

/** ISO 4217 alphabetic code. Validity against the real currency list is checked server-side. */
export const CurrencyCode = Schema.String.pipe(
  Schema.pattern(/^[A-Z]{3}$/),
  Schema.brand("CurrencyCode")
)
export type CurrencyCode = typeof CurrencyCode.Type

/**
 * Body a Shortcut posts to the capture endpoint. See ADR-0003.
 * Amount is signed: negative is an expense, positive is income.
 * `category` is a Category slug; unknown slugs are accepted and stored Uncategorised.
 */
export class CapturePayload extends Schema.Class<CapturePayload>("CapturePayload")({
  amount: Schema.Number,
  currency: CurrencyCode,
  category: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String)
}) {}
