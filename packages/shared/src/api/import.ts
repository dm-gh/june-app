import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Schema } from "effect"
import { CurrencyCode } from "../currency.js"
import { CategoryId, LocalDate, MinorAmount, Tag, WalletId } from "../domain.js"
import { Authentication } from "./auth.js"

/**
 * CSV Import (CONTEXT.md). June's own template only; the web reads the file and posts its rows,
 * the api applies the same rules as a capture to each one and either previews or records them.
 */

export const IMPORT_COLUMNS = ["date", "amount", "currency", "category", "description", "tags"] as const
export type ImportColumn = (typeof IMPORT_COLUMNS)[number]

export const IMPORT_MAX_ROWS = 5000

/** One row of the file, every cell as written. `line` is where the row starts in the file. */
export const ImportRow = Schema.Struct({
  line: Schema.Int,
  date: Schema.String,
  amount: Schema.String,
  currency: Schema.String,
  category: Schema.String,
  description: Schema.String,
  tags: Schema.String
})
export type ImportRow = typeof ImportRow.Type

export class ImportRequest extends Schema.Class<ImportRequest>("ImportRequest")({
  rows: Schema.Array(ImportRow).pipe(Schema.maxItems(IMPORT_MAX_ROWS)),
  /** Read and check the rows, record nothing. */
  preview: Schema.Boolean,
  /** Leave out rows identical to a Transaction already recorded. */
  skipDuplicates: Schema.Boolean
}) {}

/** A row June could read, as it will be (or was) recorded. */
export const ImportPlanned = Schema.Struct({
  line: Schema.Int,
  walletId: Schema.NullOr(WalletId),
  categoryId: Schema.NullOr(CategoryId),
  amountMinor: MinorAmount,
  currency: CurrencyCode,
  occurredOn: LocalDate,
  description: Schema.String,
  tags: Schema.Array(Tag),
  /** An identical Change already exists: same date, amount, currency, Wallet, Category and description. */
  duplicate: Schema.Boolean
})
export type ImportPlanned = typeof ImportPlanned.Type

/** A row June could not read. The rest of the file still imports. */
export const ImportSkipped = Schema.Struct({
  line: Schema.Int,
  reason: Schema.String
})
export type ImportSkipped = typeof ImportSkipped.Type

export class ImportResult extends Schema.Class<ImportResult>("ImportResult")({
  /** Rows recorded; 0 on a preview. */
  imported: Schema.Int,
  rows: Schema.Array(ImportPlanned),
  skipped: Schema.Array(ImportSkipped)
}) {}

export class ImportGroup extends HttpApiGroup.make("import")
  .add(HttpApiEndpoint.post("run", "/import").setPayload(ImportRequest).addSuccess(ImportResult))
  .middleware(Authentication) {}
