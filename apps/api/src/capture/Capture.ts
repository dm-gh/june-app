import { HttpApiBuilder, HttpApiError } from "@effect/platform"
import { type CaptureResult, currencyExponent, fromMinor, JuneApi } from "@june/shared"
import { Effect, Either, Option } from "effect"
import { CategoriesRepo } from "../categories/Categories.js"
import { readChange } from "../transactions/readChange.js"
import { categoryFits } from "../transactions/Transactions.js"
import { TransactionsRepo } from "../transactions/TransactionsRepo.js"
import { WalletsRepo } from "../wallets/WalletsRepo.js"
import { CaptureTokens } from "./CaptureTokens.js"

const refuse = (message: string): CaptureResult => ({ ok: false, message: `❌ Error: ${message}` })

/** "22" or "22.5": the amount as the User typed it, never with trailing zeros. */
const plainAmount = (minor: number, currency: string): string =>
  Math.abs(fromMinor(minor, currency)).toFixed(currencyExponent(currency)).replace(/\.?0+$/, "")

/**
 * The Shortcut endpoint. See ADR-0003: it never rejects for a bad slug or an unmatched currency,
 * and answers even a bad amount, currency or date with status 200 and a message the Shortcut
 * shows as a notification. Only an unknown token is an error status.
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
        const read = readChange({ amount: payload.amount, currency: payload.currency, date: payload.date ?? "" })
        if (Either.isLeft(read)) return refuse(read.left)
        const { amountMinor, currency, occurredOn } = read.right

        // Wallet Order resolves the Wallet; no match means Unassigned.
        const wallet = yield* wallets.firstWithCurrency(userId, currency)
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
          currency,
          occurredOn,
          description: payload.description?.trim() ?? "",
          tags: [],
          hiddenFromAnalysis: false,
          categoryId: Option.isSome(category) ? category.value.id : null,
          exchangeId: null
        })
        const categoryLabel = Option.match(category, {
          onNone: () => "Uncategorised",
          onSome: (c) => (c.emoji ? `${c.emoji} ${c.name}` : c.name)
        })
        const walletNote = Option.isNone(wallet) ? ` (no ${currency} wallet)` : ""
        const message = `✅ Saved ${amountMinor > 0 ? "+" : ""}${plainAmount(amountMinor, currency)} ${currency} | ${categoryLabel}${walletNote}`
        return { ok: true, message, id: row.id, unassigned: Option.isNone(wallet), uncategorised: Option.isNone(category) } satisfies CaptureResult
      })
    )
  })
)
