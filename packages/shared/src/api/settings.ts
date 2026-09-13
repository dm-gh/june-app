import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Schema } from "effect"
import { CurrencyCode } from "../currency.js"
import { Me } from "../domain.js"
import { Authentication } from "./auth.js"

export class SetDefaultCurrency extends Schema.Class<SetDefaultCurrency>("SetDefaultCurrency")({
  currency: CurrencyCode
}) {}

/** The plain Capture Token, returned exactly once. Only its hash is kept. */
export class CaptureTokenIssued extends Schema.Class<CaptureTokenIssued>("CaptureTokenIssued")({
  token: Schema.String,
  /** Full URL the Shortcut posts to. */
  captureUrl: Schema.String
}) {}

/** What the "Some items need attention" banner counts. */
export class Attention extends Schema.Class<Attention>("Attention")({
  recurringsWithoutWallet: Schema.Int,
  unassignedTransactions: Schema.Int
}) {}

export class SettingsGroup extends HttpApiGroup.make("settings")
  .add(HttpApiEndpoint.get("me", "/settings/me").addSuccess(Me))
  .add(HttpApiEndpoint.put("setDefaultCurrency", "/settings/default-currency").setPayload(SetDefaultCurrency).addSuccess(Me))
  .add(HttpApiEndpoint.post("regenerateCaptureToken", "/settings/capture-token").addSuccess(CaptureTokenIssued))
  .add(HttpApiEndpoint.get("attention", "/settings/attention").addSuccess(Attention))
  .middleware(Authentication) {}
