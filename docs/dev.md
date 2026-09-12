# Running June locally

Decisions behind this setup are in [mvp-scope.md](./mvp-scope.md) ("Stack", "Auth", "Hosting", "Tests").

## Prerequisites
- Node 22, pnpm, Docker Desktop.
- Copy `.env.example` to `.env` and fill in the secrets. `BETTER_AUTH_SECRET` is any 32+ random bytes
  (`openssl rand -base64 32`); the Google OAuth client's redirect URI is `$BASE_URL/api/auth/callback/google`;
  `OPEN_EXCHANGE_RATES_APP_ID` comes from a free openexchangerates.org plan.

## Database
```sh
docker compose up -d                      # Postgres 17 on localhost:5432, user/db/password "june"
pnpm --filter @june/api db:migrate        # applies apps/api/src/migrations in order
```
Migrations are plain SQL in TypeScript files run by `@effect/sql-pg`'s migrator. Better Auth's tables are part of
`0001_initial_schema.ts`; regenerate them with `getMigrations(authOptions(...)).compileMigrations()` when Better Auth's
schema changes and add a new numbered migration.

## Running
```sh
pnpm dev            # api on :3000 (tsx watch) and web on Vite, which proxies /api to the api
```
`@june/shared` is consumed from its TypeScript source in development: its package exports carry a `june-source`
condition that the api's dev scripts (`node --conditions=june-source`), Vite and Vitest select. `pnpm build`
compiles it to `dist`, which the built api and web use.

## Production build and deploy
```sh
pnpm build                         # shared → api (dist/) → web (dist/)
pnpm start                         # runs pending migrations, then serves the api and the web build
docker build -t june .             # the same, as the image Railway builds
```
The image runs `node dist/db/migrate.js && node dist/main.js`, so migrations apply on every deploy before the
server starts. `railway.json` points Railway at the Dockerfile and health-checks `/api/health`.

Railway setup, once per project: a Postgres service (Railway injects `DATABASE_URL` when it is referenced as
`${{Postgres.DATABASE_URL}}`), and on the app service the variables from `.env.example` except `PORT` and
`WEB_DIST`, which the image sets. `BASE_URL` is the public domain Railway assigns, and that domain's
`/api/auth/callback/google` must be added to the Google OAuth client's redirect URIs.

## Tests
```sh
pnpm --filter @june/api test
```
Tests use the compose Postgres only (`TEST_DATABASE_URL`, default `postgres://june:june@localhost:5432/june`).
Each test creates a `june_test_<random>` database from the migrations, runs the real api in-process through a typed
client with the session middleware replaced by a fixed User and the Rate Provider stubbed, and drops the database
afterwards. `DATABASE_URL` is never read by tests.
