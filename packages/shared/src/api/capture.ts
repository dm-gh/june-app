import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from "@effect/platform"
import { Schema } from "effect"
import { CurrencyCode } from "../currency.js"
import { LocalDate, TransactionId } from "../domain.js"
import { RuleViolation } from "./errors.js"

/**
 * Body a Shortcut posts to the capture endpoint. See ADR-0003.
 * `amount` is a signed decimal: negative is an expense, positive is income. Converted to minor
 * units on the server and rejected if it has more decimals than the currency allows.
 * `category` is a Category slug; unknown slugs are accepted and stored Uncategorised.
 * `date` is the phone's local calendar date, filled in by the Shortcut; absent means today (UTC).
 */
export class CapturePayload extends Schema.Class<CapturePayload>("CapturePayload")({
  amount: Schema.Number,
  currency: CurrencyCode,
  category: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  date: Schema.optional(LocalDate)
}) {}

export class Captured extends Schema.Class<Captured>("Captured")({
  id: TransactionId,
  /** True when no Wallet matched the currency and the Transaction was stored Unassigned. */
  unassigned: Schema.Boolean,
  /** True when the slug matched no Category and the Transaction was stored Uncategorised. */
  uncategorised: Schema.Boolean
}) {}

/** No session: the token in the path identifies the User. An unknown token is a 404. */
export class CaptureGroup extends HttpApiGroup.make("capture").add(
  HttpApiEndpoint.post("capture", "/capture/:token")
    .setPath(Schema.Struct({ token: Schema.String }))
    .setPayload(CapturePayload)
    .addSuccess(Captured, { status: 201 })
    .addError(HttpApiError.NotFound)
    .addError(RuleViolation)
) {}
