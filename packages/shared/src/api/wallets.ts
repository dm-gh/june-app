import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"
import { CurrencyCode } from "../currency.js"
import { LocalDate, MinorAmount, Wallet, WalletId } from "../domain.js"
import { Authentication } from "./auth.js"
import { RateUnavailable, RuleViolation } from "./errors.js"

const WalletPath = Schema.Struct({ id: WalletId })

export class WalletList extends Schema.Class<WalletList>("WalletList")({
  wallets: Schema.Array(Wallet),
  /** Sum of every Balance in Default Currency at today's rate; null when a rate is missing. */
  totalDefaultMinor: Schema.NullOr(MinorAmount)
}) {}

export class CreateWallet extends Schema.Class<CreateWallet>("CreateWallet")({
  name: Schema.NonEmptyTrimmedString,
  currency: CurrencyCode,
  /** Opening balance, recorded as the Wallet's Init Transaction. */
  initMinor: MinorAmount,
  /** Date of the Init; defaults to today (UTC). */
  initOn: Schema.optional(LocalDate)
}) {}

export class UpdateWallet extends Schema.Class<UpdateWallet>("UpdateWallet")({
  name: Schema.optional(Schema.NonEmptyTrimmedString),
  initMinor: Schema.optional(MinorAmount),
  /** Moves the Init Transaction to another day. */
  initOn: Schema.optional(LocalDate)
}) {}

export class WalletOrder extends Schema.Class<WalletOrder>("WalletOrder")({
  /** Every Wallet of the User, first to last. */
  ids: Schema.Array(WalletId)
}) {}

export class WalletsGroup extends HttpApiGroup.make("wallets")
  .add(HttpApiEndpoint.get("list", "/wallets").addSuccess(WalletList).addError(RateUnavailable))
  .add(
    HttpApiEndpoint.post("create", "/wallets")
      .setPayload(CreateWallet)
      .addSuccess(Wallet, { status: 201 })
      .addError(RuleViolation)
      .addError(RateUnavailable)
  )
  .add(
    HttpApiEndpoint.patch("update", "/wallets/:id")
      .setPath(WalletPath)
      .setPayload(UpdateWallet)
      .addSuccess(Wallet)
      .addError(HttpApiError.NotFound)
      .addError(RateUnavailable)
  )
  .add(
    HttpApiEndpoint.put("reorder", "/wallets/order")
      .setPayload(WalletOrder)
      .addSuccess(HttpApiSchema.NoContent)
      .addError(RuleViolation)
  )
  .add(
    HttpApiEndpoint.del("delete", "/wallets/:id")
      .setPath(WalletPath)
      .addSuccess(HttpApiSchema.NoContent)
      .addError(HttpApiError.NotFound)
  )
  .middleware(Authentication) {}
