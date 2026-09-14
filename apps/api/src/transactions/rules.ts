import { type CategoryId, RuleViolation, type UserId, type WalletId } from "@june/shared"
import { Effect, Option } from "effect"
import { type CategoryRow, CategoriesRepo } from "../categories/Categories.js"
import { type WalletRow, WalletsRepo } from "../wallets/WalletsRepo.js"

export const violation = (message: string) => new RuleViolation({ message })

/** A Category fits a Change when its type matches the sign of the amount. */
export const categoryFits = (category: CategoryRow, amountMinor: number): boolean =>
  amountMinor < 0 ? category.type === "expense" : category.type === "income"

export const requireWallet = (userId: UserId, id: WalletId): Effect.Effect<WalletRow, RuleViolation, WalletsRepo> =>
  WalletsRepo.pipe(
    Effect.flatMap((wallets) => wallets.find(userId, id)),
    Effect.flatMap(Option.match({ onNone: () => violation("Wallet not found"), onSome: Effect.succeed }))
  )

export const requireCategory = (userId: UserId, id: CategoryId): Effect.Effect<CategoryRow, RuleViolation, CategoriesRepo> =>
  CategoriesRepo.pipe(
    Effect.flatMap((categories) => categories.find(userId, id)),
    Effect.flatMap(Option.match({ onNone: () => violation("Category not found"), onSome: Effect.succeed }))
  )

/**
 * The one rule every Change entered by hand must satisfy: a non-zero amount, a Wallet holding
 * the currency, and a Category of the matching type. Recording goes through RecordChange, which
 * applies it; editing a Change applies it directly. `currency` is the one the Change must be in
 * (a Loan's, a Recurring's, the edited row's); left out, the Wallet's own currency stands.
 */
export const checkChange = (
  userId: UserId,
  change: { walletId: WalletId | null; amountMinor: number; currency?: string | undefined; categoryId: CategoryId | null }
): Effect.Effect<WalletRow, RuleViolation, WalletsRepo | CategoriesRepo> =>
  Effect.gen(function* () {
    if (change.amountMinor === 0) return yield* violation("Amount cannot be zero")
    if (change.walletId === null) return yield* violation(`No Wallet in ${change.currency}`)
    const wallet = yield* requireWallet(userId, change.walletId)
    if (change.currency !== undefined && wallet.currency !== change.currency) {
      return yield* violation(`Wallet ${wallet.name} holds ${wallet.currency}, not ${change.currency}`)
    }
    if (change.categoryId !== null) {
      const category = yield* requireCategory(userId, change.categoryId)
      if (!categoryFits(category, change.amountMinor)) {
        return yield* violation(`${category.name} is an ${category.type} Category`)
      }
    }
    return wallet
  })
