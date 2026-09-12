import { HttpApiBuilder, HttpApiError } from "@effect/platform"
import { JuneApi, RuleViolation, todayUtc, toMinor } from "@june/shared"
import { Effect, Either, Option } from "effect"
import { CategoriesRepo } from "../categories/Categories.js"
import { categoryFits } from "../transactions/Transactions.js"
import { TransactionsRepo } from "../transactions/TransactionsRepo.js"
import { WalletsRepo } from "../wallets/WalletsRepo.js"
import { CaptureTokens } from "./CaptureTokens.js"

/**
 * The Shortcut endpoint. See ADR-0003: never rejects for a bad slug or an unmatched currency,
 * only for an unknown token, a malformed body, or an amount the currency cannot express.
 */
export const CaptureHandlersLive = HttpApiBuilder.group(JuneApi, "capture", (handlers) =>
  Effect.gen(function* () {
    const tokens = yield* CaptureTokens
    const wallets = yield* WalletsRepo
    const categories = yield* CategoriesRepo
    const transactions = yield* TransactionsRepo

    return handlers.handle("capture", ({ path, payload }) =>
      Effect.gen(function* () {
        const userId = yield* tokens.resolveUser(path.token).pipe(
          Effect.flatMap(Option.match({ onNone: () => new HttpApiError.NotFound(), onSome: Effect.succeed }))
        )
        const amountMinor = yield* Either.match(toMinor(payload.amount, payload.currency), {
          onLeft: (message) => new RuleViolation({ message }),
          onRight: Effect.succeed
        })
        if (amountMinor === 0) return yield* new RuleViolation({ message: "Amount cannot be zero" })

        // Wallet Order resolves the Wallet; no match means Unassigned.
        const wallet = yield* wallets.firstWithCurrency(userId, payload.currency)
        // An unknown slug, or one of the wrong Category Type, means Uncategorised.
        const slug = payload.category?.trim().toLowerCase()
        const category =
          slug === undefined || slug.length === 0
            ? Option.none()
            : (yield* categories.findBySlug(userId, slug)).pipe(Option.filter((c) => categoryFits(c, amountMinor)))

        const row = yield* transactions.insert(userId, {
          walletId: Option.isSome(wallet) ? wallet.value.id : null,
          type: "change",
          amountMinor,
          currency: payload.currency,
          occurredOn: payload.date ?? todayUtc(),
          description: payload.description?.trim() ?? "",
          tags: [],
          hiddenFromAnalysis: false,
          categoryId: Option.isSome(category) ? category.value.id : null,
          exchangeId: null
        })
        return { id: row.id, unassigned: Option.isNone(wallet), uncategorised: Option.isNone(category) }
      })
    )
  })
)
