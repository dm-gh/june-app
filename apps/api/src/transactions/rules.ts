import { type CategoryId, type CurrentUserShape, RuleViolation, type WalletId } from "@june/shared"
import { Effect, Option } from "effect"
import { type CategoryRow, CategoriesRepo } from "../categories/Categories.js"
import { type WalletRow, WalletsRepo } from "../wallets/WalletsRepo.js"

export const violation = (message: string) => new RuleViolation({ message })

/** A Category fits a Change when its type matches the sign of the amount. */
export const categoryFits = (category: CategoryRow, amountMinor: number): boolean =>
  amountMinor < 0 ? category.type === "expense" : category.type === "income"

export const requireWallet = (user: CurrentUserShape, id: WalletId): Effect.Effect<WalletRow, RuleViolation, WalletsRepo> =>
  WalletsRepo.pipe(
    Effect.flatMap((wallets) => wallets.find(user.id, id)),
    Effect.flatMap(Option.match({ onNone: () => violation("Wallet not found"), onSome: Effect.succeed }))
  )

export const requireCategory = (user: CurrentUserShape, id: CategoryId): Effect.Effect<CategoryRow, RuleViolation, CategoriesRepo> =>
  CategoriesRepo.pipe(
    Effect.flatMap((categories) => categories.find(user.id, id)),
    Effect.flatMap(Option.match({ onNone: () => violation("Category not found"), onSome: Effect.succeed }))
  )

/**
 * The one rule every Change entered by hand must satisfy: a non-zero amount, a Wallet holding
 * the currency, and a Category of the matching type. Shared by the Transaction form, Settling a
 * Loan and firing a Recurring by hand.
 */
export const checkChange = (
  user: CurrentUserShape,
  change: { walletId: WalletId | null; amountMinor: number; currency: string; categoryId: CategoryId | null }
): Effect.Effect<WalletRow, RuleViolation, WalletsRepo | CategoriesRepo> =>
  Effect.gen(function* () {
    if (change.amountMinor === 0) return yield* violation("Amount cannot be zero")
    if (change.walletId === null) return yield* violation(`No Wallet in ${change.currency}`)
    const wallet = yield* requireWallet(user, change.walletId)
    if (wallet.currency !== change.currency) {
      return yield* violation(`Wallet ${wallet.name} holds ${wallet.currency}, not ${change.currency}`)
    }
    if (change.categoryId !== null) {
      const category = yield* requireCategory(user, change.categoryId)
      if (!categoryFits(category, change.amountMinor)) {
        return yield* violation(`${category.name} is an ${category.type} Category`)
      }
    }
    return wallet
  })
