import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"
import { CategoryId, LocalDate, MinorAmount, Recurring, RecurringId, Tag, Transaction, WalletId } from "../domain.js"
import { CronExpression } from "../schedule.js"
import { Authentication } from "./auth.js"
import { RateUnavailable, RuleViolation } from "./errors.js"
import { CreateChange } from "./transactions.js"

const RecurringPath = Schema.Struct({ id: RecurringId })

const NonZero = MinorAmount.pipe(Schema.filter((n) => n !== 0, { message: () => "amount cannot be zero" }))

/**
 * A new Recurring. The currency comes from the Wallet. The Schedule is `cron` (repeating) or
 * `nextOn` alone (once); with `cron` the server computes `nextOn` itself, from today. Auto needs
 * a Schedule.
 */
export class CreateRecurring extends Schema.Class<CreateRecurring>("CreateRecurring")({
  name: Schema.Trim.pipe(Schema.nonEmptyString()),
  walletId: WalletId,
  amountMinor: NonZero,
  categoryId: Schema.optional(Schema.NullOr(CategoryId)),
  description: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Tag)),
  auto: Schema.Boolean,
  cron: Schema.optional(Schema.NullOr(CronExpression)),
  nextOn: Schema.optional(Schema.NullOr(LocalDate))
}) {}

/** Omitted fields are left alone. Sending `cron`, `nextOn` or `auto` recomputes the next due date from today. */
export class UpdateRecurring extends Schema.Class<UpdateRecurring>("UpdateRecurring")({
  name: Schema.optional(Schema.Trim.pipe(Schema.nonEmptyString())),
  walletId: Schema.optional(WalletId),
  amountMinor: Schema.optional(NonZero),
  categoryId: Schema.optional(Schema.NullOr(CategoryId)),
  description: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Tag)),
  auto: Schema.optional(Schema.Boolean),
  cron: Schema.optional(Schema.NullOr(CronExpression)),
  nextOn: Schema.optional(Schema.NullOr(LocalDate))
}) {}

/**
 * Fire by hand. With no `change`, the Change is built from the Recurring and dated its due date
 * (today when it has none). With `change`, that Change is recorded instead (Edit & submit).
 * Either way the Schedule advances.
 */
export class FireRecurring extends Schema.Class<FireRecurring>("FireRecurring")({
  change: Schema.optional(CreateChange)
}) {}

export class RecurringsGroup extends HttpApiGroup.make("recurrings")
  .add(HttpApiEndpoint.get("list", "/recurrings").addSuccess(Schema.Array(Recurring)))
  .add(HttpApiEndpoint.get("get", "/recurrings/:id").setPath(RecurringPath).addSuccess(Recurring).addError(HttpApiError.NotFound))
  .add(HttpApiEndpoint.post("create", "/recurrings").setPayload(CreateRecurring).addSuccess(Recurring, { status: 201 }).addError(RuleViolation))
  .add(
    HttpApiEndpoint.patch("update", "/recurrings/:id")
      .setPath(RecurringPath)
      .setPayload(UpdateRecurring)
      .addSuccess(Recurring)
      .addError(HttpApiError.NotFound)
      .addError(RuleViolation)
  )
  .add(HttpApiEndpoint.del("delete", "/recurrings/:id").setPath(RecurringPath).addSuccess(HttpApiSchema.NoContent).addError(HttpApiError.NotFound))
  .add(
    HttpApiEndpoint.post("fire", "/recurrings/:id/fire")
      .setPath(RecurringPath)
      .setPayload(FireRecurring)
      .addSuccess(Transaction, { status: 201 })
      .addError(HttpApiError.NotFound)
      .addError(RuleViolation)
      .addError(RateUnavailable)
  )
  .middleware(Authentication) {}
