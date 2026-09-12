import { HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

/**
 * Errors the API can answer with, beyond the platform's built-in ones
 * (Unauthorized 401, NotFound 404, HttpApiDecodeError 400).
 */

/** A well-formed request that breaks a domain rule: currency mismatch, wrong Category Type, and so on. */
export class RuleViolation extends Schema.TaggedError<RuleViolation>()(
  "RuleViolation",
  { message: Schema.String },
  HttpApiSchema.annotations({ status: 422 })
) {}

/** The Rate Provider could not supply a rate the request needed. */
export class RateUnavailable extends Schema.TaggedError<RateUnavailable>()(
  "RateUnavailable",
  { message: Schema.String },
  HttpApiSchema.annotations({ status: 503 })
) {}
