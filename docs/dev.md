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
In production one service serves both: `WEB_DIST` points the api at the built web app.

## Tests
```sh
pnpm --filter @june/api test
```
Tests use the compose Postgres only (`TEST_DATABASE_URL`, default `postgres://june:june@localhost:5432/june`).
Each test creates a `june_test_<random>` database from the migrations, runs the real api in-process through a typed
client with the session middleware replaced by a fixed User and the Rate Provider stubbed, and drops the database
afterwards. `DATABASE_URL` is never read by tests.
