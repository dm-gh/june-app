import { Schema } from "effect"
import { CurrencyCode } from "./currency.js"

/** Domain schemas shared by api and web. Terminology follows CONTEXT.md. */

export const UserId = Schema.UUID.pipe(Schema.brand("UserId"))
export type UserId = typeof UserId.Type

export const WalletId = Schema.UUID.pipe(Schema.brand("WalletId"))
export type WalletId = typeof WalletId.Type

export const CategoryId = Schema.UUID.pipe(Schema.brand("CategoryId"))
export type CategoryId = typeof CategoryId.Type

export const TransactionId = Schema.UUID.pipe(Schema.brand("TransactionId"))
export type TransactionId = typeof TransactionId.Type

export const ExchangeId = Schema.UUID.pipe(Schema.brand("ExchangeId"))
export type ExchangeId = typeof ExchangeId.Type

/** A calendar date with no time and no zone, as YYYY-MM-DD. */
export const LocalDate = Schema.String.pipe(
  Schema.pattern(/^\d{4}-\d{2}-\d{2}$/, { message: () => "expected YYYY-MM-DD" }),
  Schema.filter((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), { message: () => "not a real date" }),
  Schema.brand("LocalDate")
)
export type LocalDate = typeof LocalDate.Type

/** Today's date in UTC, the fallback when a capture carries no date. */
export const todayUtc = (): LocalDate => new Date().toISOString().slice(0, 10) as LocalDate

/** Signed amount in minor units. Negative is money leaving, positive is money arriving. */
export const MinorAmount = Schema.Number.pipe(Schema.int(), Schema.brand("MinorAmount"))
export type MinorAmount = typeof MinorAmount.Type

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

export const slugify = (name: string): string =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

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
