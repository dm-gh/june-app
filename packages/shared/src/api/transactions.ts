import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"
import { CurrencyCode } from "../currency.js"
import { CategoryId, ExchangeId, LocalDate, MinorAmount, Tag, Transaction, TransactionId, WalletId } from "../domain.js"
import { Authentication } from "./auth.js"
import { partialFields, pathOf } from "./compose.js"
import { RateUnavailable, RuleViolation } from "./errors.js"

const TransactionPath = pathOf(TransactionId)
const ExchangePath = Schema.Struct({ exchangeId: ExchangeId })

/** Period bounds, inclusive. */
export class Period extends Schema.Class<Period>("Period")({
  from: LocalDate,
  to: LocalDate
}) {}

/**
 * A Change entered in the app. Unlike a capture, the form names the Wallet, and the Wallet must
 * exist and share the currency: the form never creates an Unassigned Transaction.
 */
export class CreateChange extends Schema.Class<CreateChange>("CreateChange")({
  walletId: WalletId,
  amountMinor: MinorAmount,
  occurredOn: LocalDate,
  description: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Tag)),
  categoryId: Schema.optional(Schema.NullOr(CategoryId)),
  hiddenFromAnalysis: Schema.optional(Schema.Boolean)
}) {}

/** Both legs of an Exchange; amounts are positive magnitudes, the api signs them. */
export class CreateExchange extends Schema.Class<CreateExchange>("CreateExchange")({
  sourceWalletId: WalletId,
  sourceMinor: MinorAmount.pipe(Schema.positive()),
  targetWalletId: WalletId,
  targetMinor: MinorAmount.pipe(Schema.positive()),
  occurredOn: LocalDate,
  description: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Tag))
}) {}

/** An Exchange is edited as a whole: both legs are rewritten from the same fields that created it. */
export class UpdateExchange extends Schema.Class<UpdateExchange>("UpdateExchange")(CreateExchange.fields) {}

/**
 * Fields a single edit may change: any field of a Change, plus the currency of an Unassigned
 * one. Transaction Type never changes. Exchange legs are refused here: an Exchange is edited
 * as a whole through updateExchange.
 */
export class UpdateTransaction extends Schema.Class<UpdateTransaction>("UpdateTransaction")({
  ...partialFields(CreateChange.fields),
  currency: Schema.optional(CurrencyCode)
}) {}

/** Bulk edit: only Wallet, Category and Tags. Omitted fields are left alone. */
export class BulkUpdate extends Schema.Class<BulkUpdate>("BulkUpdate")({
  ids: Schema.NonEmptyArray(TransactionId),
  walletId: Schema.optional(WalletId),
  categoryId: Schema.optional(Schema.NullOr(CategoryId)),
  addTags: Schema.optional(Schema.Array(Tag)),
  removeTags: Schema.optional(Schema.Array(Tag))
}) {}

export class BulkIds extends Schema.Class<BulkIds>("BulkIds")({
  ids: Schema.NonEmptyArray(TransactionId)
}) {}

export class TransactionsGroup extends HttpApiGroup.make("transactions")
  .add(
    HttpApiEndpoint.get("list", "/transactions")
      .setUrlParams(Period)
      .addSuccess(Schema.Array(Transaction))
      .addError(RateUnavailable)
  )
  .add(
    HttpApiEndpoint.get("get", "/transactions/:id")
      .setPath(TransactionPath)
      .addSuccess(Transaction)
      .addError(HttpApiError.NotFound)
      .addError(RateUnavailable)
  )
  .add(
    HttpApiEndpoint.post("createChange", "/transactions")
      .setPayload(CreateChange)
      .addSuccess(Transaction, { status: 201 })
      .addError(RuleViolation)
      .addError(RateUnavailable)
  )
  .add(
    HttpApiEndpoint.post("createExchange", "/transactions/exchange")
      .setPayload(CreateExchange)
      .addSuccess(Schema.Array(Transaction), { status: 201 })
      .addError(RuleViolation)
      .addError(RateUnavailable)
  )
  .add(
    HttpApiEndpoint.get("getExchange", "/transactions/exchange/:exchangeId")
      .setPath(ExchangePath)
      .addSuccess(Schema.Array(Transaction))
      .addError(HttpApiError.NotFound)
      .addError(RateUnavailable)
  )
  .add(
    HttpApiEndpoint.patch("updateExchange", "/transactions/exchange/:exchangeId")
      .setPath(ExchangePath)
      .setPayload(UpdateExchange)
      .addSuccess(Schema.Array(Transaction))
      .addError(HttpApiError.NotFound)
      .addError(RuleViolation)
      .addError(RateUnavailable)
  )
  .add(
    HttpApiEndpoint.patch("update", "/transactions/:id")
      .setPath(TransactionPath)
      .setPayload(UpdateTransaction)
      .addSuccess(Transaction)
      .addError(HttpApiError.NotFound)
      .addError(RuleViolation)
      .addError(RateUnavailable)
  )
  .add(
    HttpApiEndpoint.post("bulkUpdate", "/transactions/bulk-update")
      .setPayload(BulkUpdate)
      .addSuccess(HttpApiSchema.NoContent)
      .addError(HttpApiError.NotFound)
      .addError(RuleViolation)
  )
  .add(
    HttpApiEndpoint.del("delete", "/transactions/:id")
      .setPath(TransactionPath)
      .addSuccess(HttpApiSchema.NoContent)
      .addError(HttpApiError.NotFound)
      .addError(RuleViolation)
  )
  .add(
    HttpApiEndpoint.post("bulkDelete", "/transactions/bulk-delete")
      .setPayload(BulkIds)
      .addSuccess(HttpApiSchema.NoContent)
      .addError(HttpApiError.NotFound)
      .addError(RuleViolation)
  )
  .middleware(Authentication) {}
