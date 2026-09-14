import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"
import { CurrencyCode } from "../currency.js"
import { Loan, LoanId, MinorAmount, NonZeroMinorAmount } from "../domain.js"
import { Authentication } from "./auth.js"
import { partialFields, pathOf } from "./compose.js"
import { RuleViolation } from "./errors.js"
import { CreateChange } from "./transactions.js"

const LoanPath = pathOf(LoanId)

/** Positive is Lent, negative is Borrowed. A Loan cannot start at zero. */
export class CreateLoan extends Schema.Class<CreateLoan>("CreateLoan")({
  amountMinor: NonZeroMinorAmount,
  currency: CurrencyCode,
  description: Schema.optional(Schema.String)
}) {}

/** The Create fields, but any amount goes, zero included; `archived` sets the Loan aside or brings it back. */
export class UpdateLoan extends Schema.Class<UpdateLoan>("UpdateLoan")({
  ...partialFields(CreateLoan.fields),
  amountMinor: Schema.optional(MinorAmount),
  archived: Schema.optional(Schema.Boolean)
}) {}

/**
 * Settling: the Change is recorded as given (its Wallet must hold the Loan's currency) and the
 * Loan moves by the opposite of the Change's amount, in one database transaction. Reaching zero
 * archives the Loan.
 */
export class SettleLoan extends Schema.Class<SettleLoan>("SettleLoan")({
  change: CreateChange
}) {}

export class LoansGroup extends HttpApiGroup.make("loans")
  .add(HttpApiEndpoint.get("list", "/loans").addSuccess(Schema.Array(Loan)))
  .add(HttpApiEndpoint.get("get", "/loans/:id").setPath(LoanPath).addSuccess(Loan).addError(HttpApiError.NotFound))
  .add(HttpApiEndpoint.post("create", "/loans").setPayload(CreateLoan).addSuccess(Loan, { status: 201 }))
  .add(HttpApiEndpoint.patch("update", "/loans/:id").setPath(LoanPath).setPayload(UpdateLoan).addSuccess(Loan).addError(HttpApiError.NotFound))
  .add(HttpApiEndpoint.del("delete", "/loans/:id").setPath(LoanPath).addSuccess(HttpApiSchema.NoContent).addError(HttpApiError.NotFound))
  .add(
    HttpApiEndpoint.post("settle", "/loans/:id/settle")
      .setPath(LoanPath)
      .setPayload(SettleLoan)
      .addSuccess(Loan)
      .addError(HttpApiError.NotFound)
      .addError(RuleViolation)
  )
  .middleware(Authentication) {}
