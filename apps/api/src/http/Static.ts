import { HttpApiBuilder, HttpRouter, HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"
import * as path from "node:path"
import { AppConfig } from "../config.js"

/**
 * Same-origin hosting of the built web app (docs/mvp-scope.md, "Hosting").
 * A wildcard route with the lowest priority: anything no api endpoint matches lands here. Under
 * /api it is a JSON 404, so a typo never gets index.html; elsewhere it is the matching file from
 * the web build, or index.html so client-side routes deep-link. With no WEB_DIST (development,
 * where Vite serves the web app) everything is a 404.
 */
const fallback = Effect.gen(function* () {
  const config = yield* AppConfig
  const request = yield* HttpServerRequest.HttpServerRequest
  const url = new URL(request.url, "http://localhost")
  if (url.pathname.startsWith("/api/") || url.pathname === "/api" || config.webDist === undefined) {
    return HttpServerResponse.unsafeJson({ error: "Not found" }, { status: 404 })
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return HttpServerResponse.empty({ status: 405 })
  }
  const root = path.resolve(config.webDist)
  const requested = path.resolve(root, `.${path.posix.normalize(url.pathname)}`)
  const index = path.join(root, "index.html")
  // Only files inside the build directory, and only when the path looks like a file.
  const candidate = requested.startsWith(root + path.sep) && path.extname(requested) !== "" ? requested : index
  return yield* HttpServerResponse.file(candidate).pipe(
    Effect.catchAll(() => HttpServerResponse.file(index)),
    Effect.orDie
  )
})

export const StaticRoutesLive = HttpApiBuilder.Router.use((router) =>
  Effect.gen(function* () {
    const config = yield* AppConfig
    yield* router.addRoute(HttpRouter.makeRoute("*", "*", fallback.pipe(Effect.provideService(AppConfig, config))))
  })
)
