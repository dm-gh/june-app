import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"
import { CurrencyCode } from "../currency.js"
import { Loan, LoanId, MinorAmount } from "../domain.js"
import { Authentication } from "./auth.js"
import { RuleViolation } from "./errors.js"
import { CreateChange } from "./transactions.js"

const LoanPath = Schema.Struct({ id: LoanId })

/** Positive is Lent, negative is Borrowed. A Loan cannot start at zero. */
export class CreateLoan extends Schema.Class<CreateLoan>("CreateLoan")({
  amountMinor: MinorAmount.pipe(Schema.filter((n) => n !== 0, { message: () => "amount cannot be zero" })),
  currency: CurrencyCode,
  description: Schema.optional(Schema.String)
}) {}

/** Any value goes, zero included; `archived` sets the Loan aside or brings it back. */
export class UpdateLoan extends Schema.Class<UpdateLoan>("UpdateLoan")({
  amountMinor: Schema.optional(MinorAmount),
  currency: Schema.optional(CurrencyCode),
  description: Schema.optional(Schema.String),
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
