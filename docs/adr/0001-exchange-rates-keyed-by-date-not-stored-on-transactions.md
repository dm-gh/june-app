---
status: accepted
---

# Exchange rates are looked up by transaction date and cached per date, never stored on the transaction

June is multi-currency and every Transaction is shown converted into the User's Default Currency. We decided that a Transaction stores only its original amount and currency, and conversion uses the Exchange Rate for the Transaction's date, read from a cache table keyed by (currency, date) holding that currency's rate against USD, filled on demand from an external Rate Provider. Any pair is the ratio of two USD rates. The pivot is USD because the chosen provider, Open Exchange Rates, serves USD-based rates on its free plan and returns every currency for a date in one request. We rejected storing a converted amount or rate on the Transaction because the date is editable and a stored value would silently go stale; we rejected converting at the current rate because historical charts would drift as rates move.

## Consequences

- Editing a Transaction's date changes its converted value with no migration.
- Changing Default Currency needs no new fetches: every currency for a cached date is already stored.
- A Transaction on a not-yet-cached date costs one provider request; the free plan's 1,000 requests a month is ample because past dates are fetched exactly once.
- The Rate Provider is MVP scope, not a later add-on. A fixed manual table is not sufficient.
- If the provider has no rate for a date (weekend, holiday, outage) a fallback rule is needed and is not yet decided.
