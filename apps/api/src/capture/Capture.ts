import { HttpApiBuilder } from "@effect/platform"
import { type CaptureResult, currencyExponent, fromMinor, JuneApi } from "@june/shared"
import { Effect, Either, Option } from "effect"
import { orNotFound } from "../http/errors.js"
import { readChange } from "../transactions/readChange.js"
import { RecordChange } from "../transactions/RecordChange.js"
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
    const recordChange = yield* RecordChange

    return handlers.handle("capture", ({ path, payload }) =>
      Effect.gen(function* () {
        const userId = yield* orNotFound(tokens.resolveUser(path.token))
        const read = readChange({ amount: payload.amount, currency: payload.currency, date: payload.date ?? "" })
        if (Either.isLeft(read)) return refuse(read.left)
        const { amountMinor, currency, occurredOn } = read.right

        // Wallet Order resolves the Wallet (none means Unassigned); the slug its Category (none, or the wrong type, means Uncategorised).
        const [planned] = yield* recordChange.plan(userId, [{ amountMinor, currency, occurredOn, categorySlug: payload.category, description: payload.description }])
        const { wallet, category } = planned!
        const [row] = yield* recordChange.record(userId, [planned!.change])
        const categoryLabel = Option.match(category, {
          onNone: () => "Uncategorised",
          onSome: (c) => (c.emoji ? `${c.emoji} ${c.name}` : c.name)
        })
        const walletNote = Option.isNone(wallet) ? ` (no ${currency} wallet)` : ""
        const message = `✅ Saved ${amountMinor > 0 ? "+" : ""}${plainAmount(amountMinor, currency)} ${currency} | ${categoryLabel}${walletNote}`
        return { ok: true, message, id: row!.id, unassigned: Option.isNone(wallet), uncategorised: Option.isNone(category) } satisfies CaptureResult
      })
    )
  })
)
