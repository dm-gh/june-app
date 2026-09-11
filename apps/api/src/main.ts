import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup, HttpMiddleware, HttpServer } from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Config, Effect, Layer, Schema } from "effect"
import { createServer } from "node:http"

class HealthGroup extends HttpApiGroup.make("health").add(
  HttpApiEndpoint.get("status", "/health").addSuccess(Schema.Struct({ ok: Schema.Literal(true) }))
) {}

class JuneApi extends HttpApi.make("june").add(HealthGroup) {}

const HealthLive = HttpApiBuilder.group(JuneApi, "health", (handlers) =>
  handlers.handle("status", () => Effect.succeed({ ok: true as const }))
)

const ApiLive = HttpApiBuilder.api(JuneApi).pipe(Layer.provide(HealthLive))

const ServerLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(ApiLive),
  HttpServer.withLogAddress,
  Layer.provide(
    Layer.unwrapEffect(
      Config.integer("PORT").pipe(
        Config.withDefault(3000),
        Effect.map((port) => NodeHttpServer.layer(createServer, { port }))
      )
    )
  )
)

NodeRuntime.runMain(Layer.launch(ServerLive))
