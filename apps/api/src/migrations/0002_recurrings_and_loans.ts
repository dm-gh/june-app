import { SqlClient } from "@effect/sql"
import { Effect } from "effect"

/**
 * Round 3: Recurrings and Loans (CONTEXT.md, docs/mvp-scope.md "Round 3", ADR-0005).
 *
 * Neither table links to `transaction`: a fired Change and a settlement Change are plain
 * Changes, and a Loan's amount is its stored current position.
 */
export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  sql.unsafe(`
    -- A Recurring is a template for a Change plus a Schedule. The Schedule is a five-field cron
    -- expression (repeating) or next_on alone (once); auto needs a next date to fire on.
    -- wallet_id goes null with its Wallet: the Recurring still fires, Unassigned, and needs attention.
    create table recurring (
      id            uuid primary key default gen_random_uuid(),
      user_id       uuid not null references "user"(id) on delete cascade,
      name          text not null,
      wallet_id     uuid references wallet(id) on delete set null,
      amount_minor  bigint not null check (amount_minor <> 0),
      currency      char(3) not null,
      category_id   uuid references category(id) on delete set null,
      description   text not null default '',
      tags          text[] not null default '{}',
      auto          boolean not null default false,
      cron          text,
      next_on       date,
      last_fired_on date,
      created_at    timestamptz not null default now(),
      updated_at    timestamptz not null default now(),
      constraint recurring_tags_are_words check (tags_are_words(tags)),
      constraint recurring_auto_has_next check (not auto or next_on is not null)
    );

    create index recurring_user_idx on recurring (user_id);
    -- The hourly tick: every auto Recurring whose due date has passed.
    create index recurring_due_idx on recurring (next_on) where auto;

    -- A Loan: positive is Lent, negative is Borrowed. Settling moves amount_minor; zero archives it.
    create table loan (
      id           uuid primary key default gen_random_uuid(),
      user_id      uuid not null references "user"(id) on delete cascade,
      amount_minor bigint not null,
      currency     char(3) not null,
      description  text not null default '',
      archived     boolean not null default false,
      created_at   timestamptz not null default now(),
      updated_at   timestamptz not null default now()
    );

    create index loan_user_idx on loan (user_id);
  `)
)
