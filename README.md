<p align="center">
  <img src="apps/web/public/icon-192.png" width="96" height="96" alt="June" />
</p>

<h1 align="center">June</h1>

<p align="center">
  A personal finance tracker for people who record every coffee.<br />
  Capture from your iPhone in one tap, see where the month went, and keep every wallet and currency honest.
</p>

---

## What it does

- **One-tap capture.** June guides you through building an Apple Shortcut with your own categories, currencies and capture URL filled in. Tap it, type an amount, and the transaction is saved before your coffee cools. The notification tells you what was recorded, or what went wrong.
- **Wallets in any currency.** Each wallet holds one currency. Exchanges between wallets are one transaction with two legs, and every amount is also shown in your default currency at that day's rate.
- **Analysis that answers questions.** Spent and income for any period, per day with a running total, by category, by wallet, by tag, income against expense. Days for a month, months for longer.
- **Filters that travel.** One filter, shared by the list and the analysis, kept in the URL so a link carries it. Tap a category on an analysis page to leave it out.
- **CSV import.** A six-column template, a preview of what every row becomes, unreadable rows reported by line, duplicates skipped.
- **Recurrings.** Rent, salary, subscriptions: a named template with a weekly, monthly, yearly or one-off schedule. Fire it yourself, or let June fire it on the day and catch up anything missed while it was down.
- **Loans.** What you lent and what you borrowed, in one list, so it is not forgotten. Settle part or all of it as an ordinary transaction, hidden from analysis, and the loan moves with it.
- **Installable.** A PWA with a neubrutalist face: hard shadows, thick borders, one acid-green accent.

## How it is built

| Layer | Choice |
| --- | --- |
| Language | TypeScript end to end, one contract shared by server and client |
| Server | [Effect](https://effect.website) with `@effect/platform` HTTP API, `@effect/sql-pg`, and an in-process hourly tick for recurrings |
| Database | Postgres 17, plain SQL migrations |
| Auth | Better Auth, Google sign-in only |
| Web | React 19, Vite, Tailwind 4, Recharts, TanStack Query, react-router |
| Rates | Open Exchange Rates, cached per day and pivoted through USD |
| Hosting | One Docker image on Railway serving the API and the built web app |

The API contract lives in `packages/shared` as Effect schemas. The server derives its handlers from it and the web derives a typed client, so a change to the contract breaks the build instead of a request.

## Running it

```sh
cp .env.example .env               # fill in the secrets it names
docker compose up -d               # Postgres on localhost:5432
pnpm install
pnpm --filter @june/api db:migrate
pnpm dev                           # api on :3000, web on Vite with /api proxied
```

Tests: the api suite runs the real API in-process against a throwaway database; the shared and
web suites cover the pure modules (dates, money, filters, analysis, schedules, CSV) in Node; the
web browser suite renders the list cards in headless Chromium and compares screenshots with the
references in `__screenshots__` (`pnpm --filter @june/web test:update` after an intended visual change).

```sh
pnpm test                          # every package
pnpm --filter @june/api test
pnpm --filter @june/web test       # unit + browser projects
```

The full setup, including the Railway deploy, is in [docs/dev.md](docs/dev.md).

## Reading further

- [CONTEXT.md](CONTEXT.md) is the glossary. Wallet, Change, Init, Exchange, Capture Token, Filter: every word means one thing.
- [docs/mvp-scope.md](docs/mvp-scope.md) records what is in, what is out, and why.
- [docs/adr](docs/adr) holds the decisions that would surprise a future reader: why rates are keyed by date, why the backend is on Effect, why the Shortcut is the primary way in, why an exchange is two rows.
- [docs/figma.md](docs/figma.md) describes the design file and where the code departs from it.

## Status

Built by one person for themself and a handful of friends. Expect opinions, not options.
