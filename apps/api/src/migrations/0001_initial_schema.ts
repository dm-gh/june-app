import { SqlClient } from "@effect/sql"
import { Effect } from "effect"

/**
 * Initial June schema. Terminology follows CONTEXT.md.
 *
 * Money is stored as bigint minor units (cents), never floats.
 * Every domain table carries user_id: data is never shared between Users.
 *
 * The User table is deliberately named app_user. Better Auth will own its own
 * `user`, `session`, `account`, and `verification` tables; keeping ours separate
 * means the bare word "account" never appears in June's own schema (see CONTEXT.md).
 */
export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  sql.unsafe(`
    create table app_user (
      id               uuid primary key default gen_random_uuid(),
      email            text not null unique,
      default_currency char(3) not null,
      created_at       timestamptz not null default now()
    );

    create table wallet (
      id         uuid primary key default gen_random_uuid(),
      user_id    uuid not null references app_user(id) on delete cascade,
      name       text not null,
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
      user_id    uuid not null references app_user(id) on delete cascade,
      type       category_type not null,
      name       text not null,
      slug       text not null,
      -- Only the hue is chosen by the User; saturation and lightness are fixed in the app.
      hue        smallint not null check (hue between 0 and 359),
      created_at timestamptz not null default now(),
      constraint category_user_slug_unique unique (user_id, slug)
    );

    create table tag (
      id         uuid primary key default gen_random_uuid(),
      user_id    uuid not null references app_user(id) on delete cascade,
      name       text not null,
      created_at timestamptz not null default now(),
      constraint tag_user_name_unique unique (user_id, name)
    );

    create type transaction_type as enum ('change', 'init', 'exchange');

    -- An Exchange is two rows sharing exchange_id: the source leg (negative amount, source Wallet's
    -- currency) and the target leg (positive amount, target Wallet's currency). See ADR-0004.
    -- Balance of a Wallet is therefore always sum(amount_minor) where wallet_id = X.
    -- wallet_id is nullable only for Unassigned Change Transactions.
    create table transaction (
      id           uuid primary key default gen_random_uuid(),
      user_id      uuid not null references app_user(id) on delete cascade,
      wallet_id    uuid references wallet(id) on delete restrict,
      type         transaction_type not null,
      amount_minor bigint not null,
      currency     char(3) not null,
      occurred_on  date not null,
      description  text not null default '',
      -- Hidden from analysis: still listed (greyed out) but excluded from every analysis breakdown.
      hidden_from_analysis boolean not null default false,
      category_id  uuid references category(id) on delete set null,
      exchange_id  uuid,
      created_at   timestamptz not null default now(),
      updated_at   timestamptz not null default now(),
      constraint transaction_init_has_wallet
        check (type <> 'init' or (wallet_id is not null and exchange_id is null)),
      constraint transaction_exchange_has_wallet_and_group
        check (type <> 'exchange' or (wallet_id is not null and exchange_id is not null)),
      constraint transaction_change_has_no_group
        check (type <> 'change' or exchange_id is null)
    );

    -- Exactly one Init per Wallet.
    create unique index transaction_one_init_per_wallet
      on transaction (wallet_id) where type = 'init';

    create index transaction_user_occurred_on_idx on transaction (user_id, occurred_on);
    create index transaction_wallet_idx on transaction (wallet_id);
    create index transaction_exchange_idx on transaction (exchange_id) where exchange_id is not null;

    create table transaction_tag (
      transaction_id uuid not null references transaction(id) on delete cascade,
      tag_id         uuid not null references tag(id) on delete cascade,
      primary key (transaction_id, tag_id)
    );

    -- Per-date Exchange Rate cache, filled on demand from the Rate Provider. See ADR-0001.
    create table exchange_rate (
      base       char(3) not null,
      quote      char(3) not null,
      rate_date  date not null,
      rate       numeric(20, 10) not null,
      fetched_at timestamptz not null default now(),
      primary key (base, quote, rate_date)
    );

    -- One Capture Token per User for the MVP. Only the hash is stored.
    create table capture_token (
      user_id    uuid primary key references app_user(id) on delete cascade,
      token_hash text not null unique,
      created_at timestamptz not null default now()
    );
  `)
)
