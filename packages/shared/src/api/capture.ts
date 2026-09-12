import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from "@effect/platform"
import { Schema } from "effect"
import { TransactionId } from "../domain.js"

/**
 * Body a Shortcut posts to the capture endpoint. See ADR-0003. Deliberately loose: the endpoint
 * answers a bad value with a message the Shortcut can show, never with an error status, because
 * Shortcuts aborts the whole run on a non-2xx response.
 * `amount` is a signed decimal, negative for an expense; a string is accepted and parsed.
 * `currency` is an ISO 4217 code. `category` is a Category slug; unknown slugs are stored
 * Uncategorised. `date` is the phone's local calendar date as YYYY-MM-DD; absent means today (UTC).
 */
export class CapturePayload extends Schema.Class<CapturePayload>("CapturePayload")({
  amount: Schema.Union(Schema.Number, Schema.String),
  currency: Schema.String,
  category: Schema.optional(Schema.NullOr(Schema.String)),
  description: Schema.optional(Schema.NullOr(Schema.String)),
  date: Schema.optional(Schema.NullOr(Schema.String))
}) {}

/** The Transaction was recorded. `message` reads like "✅ Saved 22 GEL | ☕ Coffee". */
export class CaptureSaved extends Schema.Class<CaptureSaved>("CaptureSaved")({
  ok: Schema.Literal(true),
  message: Schema.String,
  id: TransactionId,
  /** True when no Wallet matched the currency and the Transaction was stored Unassigned. */
  unassigned: Schema.Boolean,
  /** True when the slug matched no Category and the Transaction was stored Uncategorised. */
  uncategorised: Schema.Boolean
}) {}

/** Nothing was recorded. `message` reads like "❌ Error: currency "XYZ" is invalid". */
export class CaptureRefused extends Schema.Class<CaptureRefused>("CaptureRefused")({
  ok: Schema.Literal(false),
  message: Schema.String
}) {}

export const CaptureResult = Schema.Union(CaptureSaved, CaptureRefused)
export type CaptureResult = typeof CaptureResult.Type

/** No session: the token in the path identifies the User. An unknown token is the one 404. */
export class CaptureGroup extends HttpApiGroup.make("capture").add(
  HttpApiEndpoint.post("capture", "/capture/:token")
    .setPath(Schema.Struct({ token: Schema.String }))
    .setPayload(CapturePayload)
    .addSuccess(CaptureResult)
    .addError(HttpApiError.NotFound)
) {}
