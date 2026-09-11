---
status: accepted
---

# An Exchange is stored as two linked Transaction rows, not one row with two amounts

An Exchange moves money from one Wallet to another, possibly across currencies, so it inherently has two amounts in two currencies. We decided to store it as two rows in the `transaction` table, one per Wallet leg, sharing an `exchange_id`: the source leg carries a negative amount in the source Wallet's currency, the target leg a positive amount in the target Wallet's currency. We rejected a single row with source/target columns because then Balance would need a union of three cases (Changes, outgoing legs, incoming legs) instead of one `sum(amount_minor) where wallet_id = X`, and every Wallet-scoped query would have to know about Exchange as a special shape. With two rows, Balance is a single sum, and analysis excludes Exchanges by filtering on `type`.

## Consequences

- Creating, editing, or deleting an Exchange must touch both rows atomically, always inside one database transaction.
- The implied rate of an Exchange is derived from the two legs, never looked up from the Rate Provider.
- A single leg row is invalid on its own; a check constraint requires `exchange_id` on every `exchange` row, but the "exactly two legs" rule is enforced in application code.
