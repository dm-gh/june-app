import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Schema } from "effect"

export class HealthGroup extends HttpApiGroup.make("health").add(
  HttpApiEndpoint.get("status", "/health").addSuccess(Schema.Struct({ ok: Schema.Literal(true) }))
) {}
