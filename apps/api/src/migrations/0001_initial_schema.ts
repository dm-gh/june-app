import { SqlClient } from "@effect/sql"
import { Effect } from "effect"

/**
 * Initial June schema. Terminology follows CONTEXT.md; decisions in docs/mvp-scope.md and docs/adr.
 *
 * Money is stored as bigint minor units (cents), never floats.
 * Every domain table carries user_id: data is never shared between Users.
 *
 * The first four tables are Better Auth's, generated from apps/api/src/auth/authOptions.ts
 * (`getMigrations(...).compileMigrations()`) and pasted here so there is a single migration
 * pipeline. Better Auth's `user` table *is* the User: June's profile fields live on it, and
 * every domain table references it. Better Auth's `account` table is renamed `oauth_account`
 * so the bare word "account" never appears in the schema.
 */
export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  sql.unsafe(`
    -- ---------------------------------------------------------------- Better Auth (generated)

    create table "user" (
      id               uuid primary key default gen_random_uuid(),
      name             text not null,
      email            text not null unique,
      email_verified   boolean not null,
      image            text,
      created_at       timestamptz not null default current_timestamp,
      updated_at       timestamptz not null default current_timestamp,
      -- June: Default Currency. Every new User starts with USD.
      default_currency char(3) not null default 'USD'
    );

    create table session (
      id         uuid primary key default gen_random_uuid(),
      expires_at timestamptz not null,
      token      text not null unique,
      created_at timestamptz not null default current_timestamp,
      updated_at timestamptz not null,
      ip_address text,
      user_agent text,
      user_id    uuid not null references "user"(id) on delete cascade
    );

    create table oauth_account (
      id                       uuid primary key default gen_random_uuid(),
      account_id               text not null,
      provider_id              text not null,
      user_id                  uuid not null references "user"(id) on delete cascade,
      access_token             text,
      refresh_token            text,
      id_token                 text,
      access_token_expires_at  timestamptz,
      refresh_token_expires_at timestamptz,
      scope                    text,
      password                 text,
      created_at               timestamptz not null default current_timestamp,
      updated_at               timestamptz not null
    );

    create table verification (
      id         uuid primary key default gen_random_uuid(),
      identifier text not null,
      value      text not null,
      expires_at timestamptz not null,
      created_at timestamptz not null default current_timestamp,
      updated_at timestamptz not null default current_timestamp
    );

    create index session_user_id_idx on session (user_id);
    create index oauth_account_user_id_idx on oauth_account (user_id);
    create index verification_identifier_idx on verification (identifier);

    -- ---------------------------------------------------------------- June

    create table wallet (
      id         uuid primary key default gen_random_uuid(),
      user_id    uuid not null references "user"(id) on delete cascade,
      name       text not null,
      -- Fixed for the Wallet's lifetime; name and Init amount are editable.
      currency   char(3) not null,
      position   integer not null,
      created_at timestamptz not null default now(),
      -- Wallet Order: unique per User, deferrable so reordering can swap positions inside one transaction.
      constraint wallet_user_position_unique unique (user_id, position) deferrable initially immediate
    );

    -- Expense and Income Categories are two separate lists; a Change Transaction may only use a
    -- Category whose type matches the sign of its amount.
    create type category_type as enum ('expense', 'income');

    create table category (
      id         uuid primary key default gen_random_uuid(),
      user_id    uuid not null references "user"(id) on delete cascade,
      type       category_type not null,
      name       text not null,
      slug       text not null,
      emoji      text,
      -- Only the hue is chosen by the User; saturation and lightness are fixed in the app.
      hue        smallint not null check (hue between 0 and 359),
      created_at timestamptz not null default now(),
      constraint category_user_slug_unique unique (user_id, slug)
    );

    create type transaction_type as enum ('change', 'init', 'exchange');

    -- A Tag is a single lower-case word. Check constraints cannot hold subqueries, hence a function.
    create function tags_are_words(tags text[]) returns boolean
      language sql immutable as $$
        select coalesce(bool_and(t <> '' and t !~ '\\s' and t = lower(t)), true) from unnest(tags) t
      $$;

    -- An Exchange is two rows sharing exchange_id: the source leg (negative amount, source Wallet's
    -- currency) and the target leg (positive amount, target Wallet's currency). See ADR-0004.
    -- Balance of a Wallet is therefore always sum(amount_minor) where wallet_id = X.
    -- wallet_id is null for Unassigned Changes: captured with no matching Wallet, or whose Wallet
    -- was deleted. Deleting a Wallet removes its Init and collapses its Exchange legs into Changes
    -- in application code before the set-null fires.
    create table transaction (
      id           uuid primary key default gen_random_uuid(),
      user_id      uuid not null references "user"(id) on delete cascade,
      wallet_id    uuid references wallet(id) on delete set null,
      type         transaction_type not null,
      amount_minor bigint not null,
      currency     char(3) not null,
      occurred_on  date not null,
      description  text not null default '',
      -- Tags live on the Transaction: single words, no spaces, lower-cased. No Tag table.
      tags         text[] not null default '{}',
      -- Hidden from analysis: still listed (greyed out) but excluded from every analysis breakdown.
      hidden_from_analysis boolean not null default false,
      -- Deleting a Category leaves its Transactions Uncategorised.
      category_id  uuid references category(id) on delete set null,
      exchange_id  uuid,
      created_at   timestamptz not null default now(),
      updated_at   timestamptz not null default now(),
      constraint transaction_init_has_wallet
        check (type <> 'init' or (wallet_id is not null and exchange_id is null)),
      constraint transaction_exchange_has_wallet_and_group
        check (type <> 'exchange' or (wallet_id is not null and exchange_id is not null)),
      constraint transaction_change_has_no_group
        check (type <> 'change' or exchange_id is null),
      constraint transaction_tags_are_words check (tags_are_words(tags))
    );

    -- Exactly one Init per Wallet.
    create unique index transaction_one_init_per_wallet
      on transaction (wallet_id) where type = 'init';

    create index transaction_user_occurred_on_idx on transaction (user_id, occurred_on);
    create index transaction_wallet_idx on transaction (wallet_id);
    create index transaction_exchange_idx on transaction (exchange_id) where exchange_id is not null;

    -- Exchange Rate cache, USD-pivoted: one row per currency per date holding the rate against USD,
    -- filled one whole date at a time from the Rate Provider. Any pair is the ratio of two rows.
    -- Past dates are fetched once; today's rows may be refreshed until the day ends. See ADR-0001.
    create table exchange_rate (
      currency     char(3) not null,
      rate_date    date not null,
      rate_per_usd numeric(20, 10) not null check (rate_per_usd > 0),
      fetched_at   timestamptz not null default now(),
      primary key (currency, rate_date)
    );

    -- One Capture Token per User, created on first sign-in. Only the hash is stored.
    create table capture_token (
      user_id    uuid primary key references "user"(id) on delete cascade,
      token_hash text not null unique,
      created_at timestamptz not null default now()
    );
  `)
)
