import { Schema } from "effect"
import slugifyLib from "slugify"
import { CurrencyCode } from "./currency.js"
import { CronExpression, toLocalDate } from "./schedule.js"

/** Domain schemas shared by api and web. Terminology follows CONTEXT.md. */

/** Every id is a UUID branded with the name of what it identifies, so a WalletId never passes as a CategoryId. */
const brandedId = <B extends string>(brand: B) => Schema.UUID.pipe(Schema.brand(brand))

export const UserId = brandedId("UserId")
export type UserId = typeof UserId.Type

export const WalletId = brandedId("WalletId")
export type WalletId = typeof WalletId.Type

export const CategoryId = brandedId("CategoryId")
export type CategoryId = typeof CategoryId.Type

export const TransactionId = brandedId("TransactionId")
export type TransactionId = typeof TransactionId.Type

export const ExchangeId = brandedId("ExchangeId")
export type ExchangeId = typeof ExchangeId.Type

export const RecurringId = brandedId("RecurringId")
export type RecurringId = typeof RecurringId.Type

export const LoanId = brandedId("LoanId")
export type LoanId = typeof LoanId.Type

/** A calendar date with no time and no zone, as YYYY-MM-DD. */
export const LocalDate = Schema.String.pipe(
  Schema.pattern(/^\d{4}-\d{2}-\d{2}$/, { message: () => "expected YYYY-MM-DD" }),
  Schema.filter((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), { message: () => "not a real date" }),
  Schema.brand("LocalDate")
)
export type LocalDate = typeof LocalDate.Type

/** Today's date in UTC, the fallback when a capture carries no date. */
export const todayUtc = (): LocalDate => toLocalDate(new Date())

/** Signed amount in minor units. Negative is money leaving, positive is money arriving. */
export const MinorAmount = Schema.Number.pipe(Schema.int(), Schema.brand("MinorAmount"))
export type MinorAmount = typeof MinorAmount.Type

/** A MinorAmount that is not zero: what a Change, a Recurring and a new Loan carry. */
export const NonZeroMinorAmount = MinorAmount.pipe(Schema.filter((n) => n !== 0, { message: () => "amount cannot be zero" }))
export type NonZeroMinorAmount = typeof NonZeroMinorAmount.Type

/** A Tag is a single lower-case word with no whitespace. Input is lower-cased before validation. */
export const Tag = Schema.transform(Schema.String, Schema.String, {
  strict: true,
  decode: (s) => s.trim().toLowerCase(),
  encode: (s) => s
}).pipe(
  Schema.filter((s) => s.length > 0 && !/\s/.test(s), { message: () => "a tag is one word" }),
  Schema.brand("Tag")
)
export type Tag = typeof Tag.Type

/** Split a space-separated input into Tags, dropping blanks and duplicates. */
export const splitTags = (input: string): ReadonlyArray<string> => [
  ...new Set(input.trim().toLowerCase().split(/\s+/).filter((s) => s.length > 0))
]

export const CategoryType = Schema.Literal("expense", "income")
export type CategoryType = typeof CategoryType.Type

/** The sign of a Change as the form shows it: "-" for money leaving, "+" for money arriving. */
export type Sign = "-" | "+"

/**
 * The one Category Type a Change of this sign may carry (CONTEXT.md, Category Type): a negative
 * Change an Expense Category, a positive one an Income Category. Takes the form's sign or the
 * signed amount; zero, like "+", is income.
 */
export const categoryTypeForSign = (sign: Sign | number): CategoryType =>
  (typeof sign === "number" ? sign < 0 : sign === "-") ? "expense" : "income"

/** A Category fits a Change when its Category Type matches the sign of the amount. */
export const categoryFits = (category: { readonly type: CategoryType }, amountMinor: number): boolean =>
  category.type === categoryTypeForSign(amountMinor)

export const TransactionType = Schema.Literal("change", "init", "exchange")
export type TransactionType = typeof TransactionType.Type

/** Hue on the colour wheel; saturation and lightness are fixed by the app. */
export const Hue = Schema.Number.pipe(Schema.int(), Schema.between(0, 359), Schema.brand("Hue"))
export type Hue = typeof Hue.Type

/** URL-safe identifier a Shortcut sends for a Category. */
export const Slug = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: () => "lower-case letters, digits and dashes" }),
  Schema.brand("Slug")
)
export type Slug = typeof Slug.Type

/** Slug from a name, transliterating non-Latin scripts: "Продукты" → "produkty", "Café" → "cafe". */
export const slugify = (name: string): string => slugifyLib(name, { lower: true, strict: true, trim: true })

export class Wallet extends Schema.Class<Wallet>("Wallet")({
  id: WalletId,
  name: Schema.String,
  currency: CurrencyCode,
  position: Schema.Int,
  /** Balance in the Wallet's currency: derived, never stored. */
  balanceMinor: MinorAmount,
  /** Amount of the Wallet's Init Transaction. */
  initMinor: MinorAmount,
  /** Balance converted into Default Currency at today's rate; null when no rate is known. */
  balanceDefaultMinor: Schema.NullOr(MinorAmount)
}) {}

export class Category extends Schema.Class<Category>("Category")({
  id: CategoryId,
  type: CategoryType,
  name: Schema.String,
  slug: Slug,
  emoji: Schema.NullOr(Schema.String),
  hue: Hue
}) {}

/** A Transaction as the API returns it. An Exchange appears as two rows sharing exchangeId. */
export class Transaction extends Schema.Class<Transaction>("Transaction")({
  id: TransactionId,
  type: TransactionType,
  walletId: Schema.NullOr(WalletId),
  amountMinor: MinorAmount,
  currency: CurrencyCode,
  occurredOn: LocalDate,
  description: Schema.String,
  tags: Schema.Array(Tag),
  hiddenFromAnalysis: Schema.Boolean,
  categoryId: Schema.NullOr(CategoryId),
  exchangeId: Schema.NullOr(ExchangeId),
  /** amountMinor converted into the User's Default Currency for occurredOn; null when no rate is known. */
  defaultMinor: Schema.NullOr(MinorAmount),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc
}) {}

export class Me extends Schema.Class<Me>("Me")({
  id: UserId,
  email: Schema.String,
  name: Schema.String,
  image: Schema.NullOr(Schema.String),
  defaultCurrency: CurrencyCode,
  hasCaptureToken: Schema.Boolean
}) {}

/**
 * A Recurring: a named template for a Change with a Schedule and an Auto flag. Not a Transaction,
 * never in analysis. `cron` is the Schedule for a repeating one; a once Schedule is `nextOn`
 * alone; neither means no Schedule (only allowed with Auto off). `walletId` is null once the
 * Wallet was deleted: it still fires, Unassigned, and needs attention.
 */
export class Recurring extends Schema.Class<Recurring>("Recurring")({
  id: RecurringId,
  name: Schema.String,
  walletId: Schema.NullOr(WalletId),
  amountMinor: MinorAmount,
  currency: CurrencyCode,
  categoryId: Schema.NullOr(CategoryId),
  description: Schema.String,
  tags: Schema.Array(Tag),
  auto: Schema.Boolean,
  cron: Schema.NullOr(CronExpression),
  /** The next due date; null when there is no Schedule or a once Schedule was spent. */
  nextOn: Schema.NullOr(LocalDate),
  lastFiredOn: Schema.NullOr(LocalDate),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc
}) {}

/** A Loan: positive is Lent (they owe the User), negative is Borrowed. The amount is the current position. */
export class Loan extends Schema.Class<Loan>("Loan")({
  id: LoanId,
  amountMinor: MinorAmount,
  currency: CurrencyCode,
  description: Schema.String,
  archived: Schema.Boolean,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc
}) {}
