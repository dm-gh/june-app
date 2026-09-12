# June MVP scope

Decided 2026-09-11. Terminology follows [CONTEXT.md](../CONTEXT.md); decisions with lasting consequences are in [docs/adr](./adr).

## Who
Personal finance tracker. Built by one developer for themself, with sign-in for up to roughly ten friends. Each User's data is fully isolated.

## Capture
- Primary: an Apple Shortcut the User builds in the Shortcuts app from June's in-app guide (Settings → Shortcut), which shows each action with the User's Categories, currencies and capture URL filled in, posting `amount`, `currency`, `category` (slug), `description`, `date` to a per-User URL containing a Capture Token (ADR-0003). `date` is the phone's local calendar date, filled in by the Shortcut itself with no prompt; if a request omits it the server uses today's UTC date. June never stores a User time zone.
- Secondary: in-app form, which can additionally set Wallet, Tags, date, and Transaction Type.
- Unknown category slug → Uncategorised. Currency with no matching Wallet → Unassigned. Invalid currency or malformed body → rejected.
- Transactions are editable and deletable in the app, including their date but never their Transaction Type. A single Transaction opens in a read-only view; Edit and Delete sit behind an options menu. Long-pressing a card enters selection mode for bulk actions: bulk Edit changes only Wallet, Category and Tags for every selected item, bulk Delete removes them. Every delete asks for confirmation first.
- Wallet rule on edit: the Wallet picker offers only Wallets in the Transaction's currency, and the form cannot be saved while the chosen currency has no Wallet (Unassigned is a capture-time state, never a form outcome). In bulk edit the Wallet field is disabled when the selection mixes currencies, and the Category field is disabled when it mixes expenses and income. The server enforces both rules and rejects a whole batch rather than part of it.
- Tags: space-separated single words, case-insensitive, stored on the Transaction itself (no Tag table). The tag input suggests the User's existing Tags. Bulk edit shows the Tags every selected item shares, each removable from all of them, plus an input to add Tags to all of them.
- A Transaction can be marked Hidden from analysis: it stays in the list, greyed out, and is left out of every analysis breakdown.

## Money model
- Wallets: ordered list per User, one currency each, one Init Transaction on creation.
- Transaction Types: Change (signed amount; negative is expense), Init (excluded from analysis), Exchange (between two Wallets, may cross currencies; excluded from spending analysis).
- Default Currency per User, changeable in settings.
- Exchange Rates looked up by Transaction date from a per-date cache filled from the Rate Provider, Open Exchange Rates (ADR-0001). The cache is USD-pivoted: one request per date stores every currency's rate against USD, and any pair is the ratio of two USD rates. Rates for past dates are fetched once; today's rate may be refreshed until the day ends. Fallback for missing dates: nearest earlier date with a rate. Currencies that matter first: GEL, RUB, USD, EUR.

## Analysis page
1. Spending by Category for a period (Uncategorised shown greyed out).
2. Spending over time, monthly.
3. Wallet Balances, plus total in Default Currency.
4. Single Category over time.
Plus a filterable Transaction list. All amounts shown in Default Currency.
- The server converts, the browser aggregates: the period's Transaction list comes back with each row's amount both in its own currency and in Default Currency (rate joined by date in SQL, missing dates fetched first). The charts are computed in the browser from that one response, skipping Init, Exchange and Hidden rows. Wallet Balances are all-time sums returned with the Wallet list, plus the total in Default Currency at today's rate.
- Period: both the Transactions list and Analysis run over one selected period. Tapping the period label opens a picker with From and To dates and single-month shortcuts; the chevrons step the period by its own length.

## Settings
Wallets (create, reorder, edit name and Init balance but never currency, delete: Changes become Unassigned, the Init is removed, Exchanges collapse into Changes in the other Wallet tagged `wallet_<currency>_delete_<dd.mm.yyyy>`, see ADR-0004), Categories (type, name, slug, emoji, hue, delete: Transactions become Uncategorised), Default Currency, Capture Token (regenerate), Shortcut generation and download.
- Capture Token: created on first sign-in so Settings can always offer the Shortcut; 32 random bytes as base64url, only its SHA-256 stored, shown once. The Shortcut posts to `/api/capture/<token>`; an unknown token is a 404, and the request logger redacts that path segment.
- Categories are two lists, Expense and Income (Category Type). A Category's colour is a single Hue the User picks on a slider; saturation and lightness are fixed by June.

## Auth
Google sign-in via Better Auth, wrapped in a thin in-house Effect layer (Better Auth's handler mounted as a raw route, plus a `CurrentUser` service that reads the session). No passwords. Sign-up is open: anyone who signs in gets a User.
- Better Auth's `user` table *is* the User: June's profile fields (Default Currency, defaulting to USD) are Better Auth additional fields, and every domain table's `user_id` references it. Better Auth's `account` table is renamed `oauth_account`. Better Auth's schema is generated once and lives in June's own migrations; there is a single migration pipeline.

## Stack
- Frontend: React, TypeScript, Vite with PWA plugin, Tailwind, Recharts. Neubrutalism style ([style-reference.md](./style-reference.md)).
- Backend: TypeScript on Effect (ADR-0002): HttpApi, Schema, SQL client. Feature folders (`auth`, `capture`, `wallets`, `categories`, `tags`, `transactions`, `rates`, `settings`, `http`, `db`), each with a `Repo` layer owning its SQL and a `Handlers` layer implementing its contract group; features call each other through `Repo` services.
- Tests: Vitest with `@effect/vitest` against the local docker compose Postgres only, never Railway. Each test file creates a throwaway `june_test_<random>` database from `TEST_DATABASE_URL`, runs the migrations into it and drops it afterwards; there is no fallback to `DATABASE_URL`. The Rate Provider is stubbed behind its service with one recorded response. No web tests in this phase.
- Database: PostgreSQL. Money stored as integer minor units. The valid currency list and each currency's minor-unit exponent come from the runtime's built-in ISO 4217 data (`Intl.supportedValuesOf("currency")`, `Intl.NumberFormat`), wrapped in a shared `Currency` module; no dependency. Amounts travel through the API as minor-unit integers plus a currency code, never as decimals; the capture payload's decimal amount is converted on the server and rejected if it has more decimals than the currency allows.
- Hosting: Railway, one service plus managed Postgres. The api serves the built web app as static files with an `index.html` fallback, so web and api share one origin: no CORS, plain session cookie. `/api/*` is the HttpApi, `/api/auth/*` is Better Auth.
- Repo: one Git repository with pnpm workspaces: `apps/web`, `apps/api`, `packages/shared`. The whole HttpApi contract (`JuneApi`) is defined in `packages/shared`, one file per group, so the api derives handlers and the web derives a typed client from the same value. Groups under `/api`: `wallets`, `categories`, `tags` (created implicitly by use), `transactions` (list by period, get, create Change, create Exchange, update, bulk update, delete, bulk delete), `settings` (me, Default Currency, Capture Token, Shortcut), `capture` (the Shortcut endpoint, the only group without the session middleware), `health`.

## Design workflow
1. Design primitives in code: tokens, colours, typography, form elements, cards, buttons.
2. Push them to Figma as a library.
3. Lay out the MVP screens in Figma: sign-in, transaction list, add/edit transaction, analysis, settings.
4. Implement screens in code from the Figma file.

## Explicitly out of the MVP
- Budgets and targets per Category
- Recurring or scheduled Transactions
- Sharing Wallets between Users
- Receipt attachments
- LLM extraction from free text or screenshots
- Native iOS app
- Email magic link sign-in (needs an email provider; the fields stay hidden in Figma)
- Multiple Capture Tokens per User
- Manual per-Transaction Exchange Rate override

First candidates after launch: LLM extraction, budgets.

## Round 2 (designed 2026-09-12, see docs/figma.md "Round 2 screens")
- Filters: one set shared by Transactions and Analysis, kept in the URL: Transaction Type (all, expense, income), Categories, Tags, Wallets.
- Analysis becomes: Per day (bars plus running total), By category, Income vs expense, By tag, By wallet, each breakdown capped at five rows with an All page behind it (the categories page opens with a Share donut). Charts show days for a period of a month or less, months beyond. Over time and the Wallet balances list are removed. Rows on the All pages toggle that item in the shared filter.
- CSV Import in June's own template (`date,amount,currency,category,description,tags`) with a preview, per-row skipping with reasons, and an optional duplicate skip. Bank formats stay out: the User reshapes an export into the template.

## Still open
