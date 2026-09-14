import type { CategoryId, LocalDate, RuleViolation, UserId, WalletId } from "@june/shared"
import { Context, Effect, Layer, Option } from "effect"
import { type CategoryRow, CategoriesRepo } from "../categories/Categories.js"
import { type WalletRow, WalletsRepo } from "../wallets/WalletsRepo.js"
import { categoryFits, checkChange } from "./rules.js"
import { type NewChange, type TransactionRow, TransactionsRepo } from "./TransactionsRepo.js"

/**
 * A Change the User entered by hand: the Transaction form, Settling a Loan, or firing a Recurring
 * with an edited Change. It names its Wallet, and the Wallet must exist.
 */
export interface HandChange {
  readonly walletId: WalletId
  readonly amountMinor: number
  /** The currency the Change must be in (a Loan's, a Recurring's); left out, the Wallet's own. */
  readonly currency?: string | undefined
  readonly occurredOn: LocalDate
  readonly categoryId?: CategoryId | null | undefined
  readonly description?: string | undefined
  readonly tags?: ReadonlyArray<string> | undefined
  readonly hiddenFromAnalysis?: boolean | undefined
}

/** What a field left blank on a hand-entered Change becomes. Unstated: "", no Tags, not hidden. */
export interface HandDefaults {
  readonly description?: string | undefined
  readonly tags?: ReadonlyArray<string> | undefined
  readonly hiddenFromAnalysis?: boolean | undefined
}

/**
 * A captured or imported Change as `readChange` read it: an amount, a currency and a date that
 * are already valid, a Category slug at most, and no Wallet, because a Shortcut and a CSV row
 * never name one.
 */
export interface LenientChange {
  readonly amountMinor: number
  readonly currency: string
  readonly occurredOn: LocalDate
  /** As typed; blank, null or absent means no Category was named. */
  readonly categorySlug?: string | null | undefined
  readonly description?: string | null | undefined
  readonly tags?: ReadonlyArray<string> | undefined
}

/** A lenient Change resolved, with what it resolved to, so a capture can say so in its answer. */
export interface PlannedChange {
  readonly change: NewChange
  /** None means Unassigned. */
  readonly wallet: Option.Option<WalletRow>
  /** None means Uncategorised. */
  readonly category: Option.Option<CategoryRow>
}

/**
 * The one way a Change is written. Every path that records a Change goes through here: the form,
 * the Shortcut, CSV Import, Settling a Loan and firing a Recurring. Editing a Change, an Init and
 * an Exchange are not Changes being recorded and live elsewhere.
 */
export interface RecordChangeShape {
  /**
   * By hand: the rules of `checkChange` apply. The Wallet must exist and hold the currency, the
   * amount is non-zero and the Category, if any, matches the sign. Fails with RuleViolation and
   * writes nothing otherwise; the caller owns the transaction boundary.
   */
  readonly strict: (userId: UserId, change: HandChange, defaults?: HandDefaults) => Effect.Effect<TransactionRow, RuleViolation>
  /**
   * Captured or imported: resolve without writing. The Wallet is the first in Wallet Order
   * holding the currency, Unassigned when none; the Category is the slug's, when it exists and
   * fits the sign, Uncategorised otherwise (ADR-0003). Never refuses. Description is trimmed,
   * Tags default to none, and a planned Change is never hidden.
   */
  readonly plan: (userId: UserId, changes: ReadonlyArray<LenientChange>) => Effect.Effect<ReadonlyArray<PlannedChange>>
  /**
   * The write, one statement however many rows, returning the rows in the order given. Takes
   * Changes whose Wallet and Category are already settled: the output of `plan`, or a Recurring's
   * own fields, which were checked when the Recurring was saved and may since have lost their
   * Wallet or Category to a deletion (Unassigned, Uncategorised; never a refusal).
   */
  readonly record: (userId: UserId, changes: ReadonlyArray<NewChange>) => Effect.Effect<ReadonlyArray<TransactionRow>>
}

export class RecordChange extends Context.Tag("RecordChange")<RecordChange, RecordChangeShape>() {}

/** A slug as a Shortcut or a CSV row typed it; empty means no Category was named. */
const normaliseSlug = (slug: string | null | undefined): string => slug?.trim().toLowerCase() ?? ""

export const RecordChangeLive = Layer.effect(
  RecordChange,
  Effect.gen(function* () {
    const transactions = yield* TransactionsRepo
    const wallets = yield* WalletsRepo
    const categories = yield* CategoriesRepo

    const record: RecordChangeShape["record"] = (userId, changes) => transactions.insertChanges(userId, changes)

    const strict: RecordChangeShape["strict"] = (userId, change, defaults = {}) =>
      Effect.gen(function* () {
        const categoryId = change.categoryId ?? null
        const wallet = yield* checkChange(userId, { walletId: change.walletId, amountMinor: change.amountMinor, currency: change.currency, categoryId })
        const rows = yield* record(userId, [
          {
            walletId: wallet.id,
            categoryId,
            amountMinor: change.amountMinor,
            currency: wallet.currency,
            occurredOn: change.occurredOn,
            description: change.description ?? defaults.description ?? "",
            tags: change.tags ?? defaults.tags ?? [],
            hiddenFromAnalysis: change.hiddenFromAnalysis ?? defaults.hiddenFromAnalysis ?? false
          }
        ])
        return rows[0]!
      }).pipe(Effect.provideService(WalletsRepo, wallets), Effect.provideService(CategoriesRepo, categories))

    const plan: RecordChangeShape["plan"] = (userId, changes) =>
      Effect.gen(function* () {
        // Wallet Order is stated once, in WalletsRepo.firstWithCurrency; one lookup per distinct currency in the batch.
        const walletByCurrency = new Map<string, Option.Option<WalletRow>>()
        for (const currency of new Set(changes.map((c) => c.currency))) {
          walletByCurrency.set(currency, yield* wallets.firstWithCurrency(userId, currency))
        }
        const namesACategory = changes.some((c) => normaliseSlug(c.categorySlug) !== "")
        const categoryBySlug = new Map(namesACategory ? (yield* categories.list(userId)).map((c) => [c.slug as string, c]) : [])

        return changes.map((c): PlannedChange => {
          const wallet = walletByCurrency.get(c.currency) ?? Option.none()
          const slug = normaliseSlug(c.categorySlug)
          const category = Option.fromNullable(slug === "" ? undefined : categoryBySlug.get(slug)).pipe(
            Option.filter((found) => categoryFits(found, c.amountMinor))
          )
          return {
            wallet,
            category,
            change: {
              walletId: Option.isSome(wallet) ? wallet.value.id : null,
              categoryId: Option.isSome(category) ? category.value.id : null,
              amountMinor: c.amountMinor,
              currency: c.currency,
              occurredOn: c.occurredOn,
              description: c.description?.trim() ?? "",
              tags: c.tags ?? [],
              hiddenFromAnalysis: false
            }
          }
        })
      })

    return { strict, plan, record }
  })
)
