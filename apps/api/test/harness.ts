import { FetchHttpClient, HttpApiBuilder, HttpApiClient, HttpServer } from "@effect/platform"
import { NodeContext } from "@effect/platform-node"
import { SqlClient } from "@effect/sql"
import * as PgMigrator from "@effect/sql-pg/PgMigrator"
import { Authentication, type CurrencyCode, type CurrentUserShape, JuneApi, type UserId } from "@june/shared"
import { Context, Effect, Layer, Redacted } from "effect"
import { randomBytes, randomUUID } from "node:crypto"
import * as path from "node:path"
import { Client } from "pg"
import { CaptureTokens, CaptureTokensLive } from "../src/capture/CaptureTokens.js"
import { CategoriesRepoLive } from "../src/categories/Categories.js"
import { AppConfig } from "../src/config.js"
import { PgLiveForUrl } from "../src/db/PgLive.js"
import { HandlersLive } from "../src/http/Api.js"
import { LoansRepoLive } from "../src/loans/LoansRepo.js"
import { RecurringFiringLive } from "../src/recurrings/Firing.js"
import { RecurringsRepoLive } from "../src/recurrings/RecurringsRepo.js"
import { RateProvider, type RateProviderShape } from "../src/rates/RateProvider.js"
import { RatesLive } from "../src/rates/Rates.js"
import { RecordChangeLive } from "../src/transactions/RecordChange.js"
import { TransactionsRepoLive } from "../src/transactions/TransactionsRepo.js"
import { WalletsRepoLive } from "../src/wallets/WalletsRepo.js"

/**
 * Tests run against the local docker compose Postgres only, never Railway (docs/mvp-scope.md,
 * "Tests"). TEST_DATABASE_URL names the admin connection; each harness creates its own
 * june_test_<random> database from the migrations and drops it afterwards. DATABASE_URL is
 * deliberately never read here.
 */
const adminUrl = process.env.TEST_DATABASE_URL ?? "postgres://june:june@localhost:5432/june"

const migrationsDirectory = path.join(import.meta.dirname, "..", "src", "migrations")

const withAdmin = <A>(f: (client: Client) => Promise<A>) =>
  Effect.promise(async () => {
    const client = new Client({ connectionString: adminUrl })
    await client.connect()
    try {
      return await f(client)
    } finally {
      await client.end()
    }
  })

/** A fresh, migrated database for the duration of the scope. */
export const testDatabase = Effect.acquireRelease(
  Effect.gen(function* () {
    const name = `june_test_${randomBytes(4).toString("hex")}`
    yield* withAdmin((c) => c.query(`create database "${name}"`))
    const url = new URL(adminUrl)
    url.pathname = `/${name}`
    yield* PgMigrator.run({ loader: PgMigrator.fromFileSystem(migrationsDirectory) }).pipe(
      Effect.provide(PgLiveForUrl(url.toString())),
      Effect.provide(NodeContext.layer)
    )
    return { name, url: url.toString() }
  }),
  ({ name }) => withAdmin((c) => c.query(`drop database "${name}" with (force)`)).pipe(Effect.orDie)
)

export const testUser: CurrentUserShape = {
  id: "00000000-0000-4000-8000-000000000001" as UserId,
  email: "test@example.com",
  name: "Test User",
  image: null,
  defaultCurrency: "USD" as CurrencyCode
}

/** Units per 1 USD, the same for every date unless a test overrides the provider. */
export const stubRates: ReadonlyMap<string, number> = new Map([
  ["USD", 1],
  ["EUR", 0.9],
  ["GEL", 2.7]
])

const testConfig = Layer.succeed(AppConfig, {
  port: 0,
  baseUrl: "http://june.test",
  authSecret: Redacted.make("test-secret"),
  googleClientId: "",
  googleClientSecret: Redacted.make(""),
  openExchangeRatesAppId: Redacted.make(""),
  webDist: undefined
})

/**
 * The whole api in-process: a migrated database, the real handlers and repos, a stubbed Rate
 * Provider, and the session middleware replaced by a fixed test User. Requests go through the
 * real HttpApi web handler, so encoding, validation and status codes are exercised too.
 */
export const makeHarness = (options?: {
  readonly user?: Partial<CurrentUserShape>
  readonly rateProvider?: RateProviderShape
}) =>
  Effect.gen(function* () {
    const user: CurrentUserShape = { ...testUser, ...options?.user }
    const db = yield* testDatabase
    const PgTest = PgLiveForUrl(db.url)

    const services = Layer.mergeAll(RatesLive, CaptureTokensLive, RecurringFiringLive).pipe(
      Layer.provideMerge(RecordChangeLive),
      Layer.provideMerge(Layer.mergeAll(WalletsRepoLive, CategoriesRepoLive, TransactionsRepoLive, RecurringsRepoLive, LoansRepoLive)),
      Layer.provideMerge(
        Layer.mergeAll(
          CaptureTokensLive,
          Layer.succeed(
            RateProvider,
            options?.rateProvider ?? { ratesFor: () => Effect.succeed(stubRates) }
          )
        )
      ),
      Layer.provideMerge(Layer.mergeAll(testConfig, PgTest))
    )

    const AuthStub = Layer.succeed(Authentication, Effect.succeed(user))

    // Build the services once for the test's scope so the handlers and the test share one pool.
    const context = yield* Layer.build(services)
    const api = HttpApiBuilder.api(JuneApi).pipe(
      Layer.provide(HandlersLive),
      Layer.provide(AuthStub),
      Layer.provide(Layer.succeedContext(context))
    )
    const { handler, dispose } = HttpApiBuilder.toWebHandler(Layer.mergeAll(api, HttpServer.layerContext), {
      // A 5xx in a test is a defect; print its cause instead of a bare status.
      middleware: (app) => app.pipe(Effect.tapErrorCause((cause) => Effect.logError("api failed", cause)))
    })
    yield* Effect.addFinalizer(() => Effect.promise(dispose))

    const sql = Context.get(context, SqlClient.SqlClient)
    yield* sql`insert into "user" (id, name, email, email_verified, default_currency)
               values (${user.id}, ${user.name}, ${user.email}, true, ${user.defaultCurrency})`
    const tokens = Context.get(context, CaptureTokens)
    const { token } = yield* tokens.regenerate(user.id)

    const fetchViaHandler: typeof fetch = (input, init) => handler(new Request(input, init))
    const client = yield* HttpApiClient.make(JuneApi, { baseUrl: "http://june.test" }).pipe(
      Effect.provide(FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetchViaHandler))))
    )

    return { client, sql, captureToken: token, handler, userId: user.id, dbUrl: db.url, context }
  })

/** Raw fetch against the in-process handler, for endpoints the typed client cannot express (e.g. bad bodies). */
export const rawPost = (handler: (r: Request) => Promise<Response>, url: string, body: unknown) =>
  Effect.promise(() =>
    handler(new Request(`http://june.test${url}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }))
  )

export const uuid = () => randomUUID()
