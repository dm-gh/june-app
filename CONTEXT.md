# June

A personal finance tracker: a User records Transactions and analyses them through visualisations. Built for a handful of Users, primarily the author.

## Language

**User**:
A person who signs in to June and owns their own data. Data is never shared between Users.
_Avoid_: account, member, profile

**Wallet**:
A container of money owned by a User, such as a bank card, a cash stash, or a savings pot. Every Wallet holds exactly one currency, fixed for its lifetime; its name and its Init amount can be changed. Deleting a Wallet deletes its Init, keeps its Changes as Unassigned, and collapses each of its Exchanges into a Change in the other Wallet, marked with a system Tag naming the deleted Wallet's currency and the date. A User's Wallets form an ordered list.
_Avoid_: account, bank account, balance

**Balance**:
The current amount of money in a Wallet, in the Wallet's currency: its Init plus every Change and every Exchange leg touching it. Never stored, always derived. Unassigned Transactions contribute to no Balance.
_Avoid_: total, funds, amount

**Wallet Order**:
The User-defined ordering of their Wallets. Used to resolve which Wallet receives a captured Transaction: the first Wallet whose currency matches the Transaction's currency.
_Avoid_: default wallet, primary wallet

**Default Currency**:
The single currency a User chooses to view all their money in. Every Transaction is converted into it for analysis. Every new User starts with USD; changeable in settings.
_Avoid_: base currency, home currency, main currency

**Exchange Rate**:
The factor used to convert an amount from one currency into the Default Currency on a given date. Always looked up by the Transaction's date, never stored on the Transaction. Sourced from an external Rate Provider and cached per currency pair per date.
_Avoid_: conversion rate, FX

**Rate Provider**:
The external service June fetches Exchange Rates from when a date is not yet cached.
_Avoid_: rate API, feed

**Transaction**:
A single movement of money recorded by a User: a signed amount in a valid currency, on a date, in at most one Wallet, with an optional Category, a free-text description, and zero or more Tags. A Transaction's currency always equals its Wallet's currency when it has one. A currency that is not a real ISO currency is rejected at capture. Every Transaction has exactly one Transaction Type. A Transaction may be marked Hidden from analysis.
_Avoid_: entry, record, expense (when income is also meant), payment

**Transaction Type**:
One of three kinds a Transaction can be: **Change**, **Init**, or **Exchange**.
_Avoid_: kind, direction

**Change**:
The ordinary Transaction Type: money entering or leaving one Wallet. A negative amount is an expense, a positive amount is income. This is what a Shortcut captures.
_Avoid_: expense, income (as types), spend, payment

**Init**:
The Transaction Type that records a Wallet's opening balance at the moment the Wallet is created. Exactly one per Wallet. Excluded from all analysis.
_Avoid_: opening balance, initial deposit, seed

**Exchange**:
The Transaction Type that moves money from one Wallet to another. If the Wallets differ in currency, it carries both the amount leaving the source and the amount arriving at the target; if they share a currency, the amounts are equal. Not an expense or income, so excluded from spending analysis.
_Avoid_: transfer, conversion, move

**Category**:
A classification of a Transaction from the User's own list (e.g. Groceries, Rent). Each Category has a Category Type, a display name, a stable slug, a Hue, and an optional emoji shown wherever the Category appears. A Transaction has at most one Category, and only one whose Category Type matches the sign of its amount. Deleting a Category leaves its Transactions Uncategorised.

**Category Type**:
Expense or Income. Categories form two separate lists, one per Category Type. A negative Change may only carry an Expense Category, a positive Change only an Income Category.

**Hue**:
The one number (0 to 359 on the colour wheel) a User picks for a Category. June fixes saturation and lightness, so every Category colour belongs to the same family and only the hue tells them apart.
_Avoid_: type, group, label

**Hidden from analysis**:
A flag a User sets on a single Transaction. A hidden Transaction stays in the Transactions list, greyed out, and still counts towards its Wallet's Balance, but it appears in no analysis breakdown.

**Uncategorised**:
The state of a Transaction that has no Category, whether captured with an unknown slug or deliberately left blank. Shown as a greyed-out bucket in analysis; never rejected at capture.
_Avoid_: pending, inbox, unknown

**Tag**:
A single word, with no spaces, attached to a Transaction for cross-cutting grouping (e.g. "vacation-2026"). A Transaction may carry any number of Tags; a Tag has no existence of its own beyond the Transactions that carry it, so a Tag nobody uses simply disappears. Tags are typed space-separated and matched case-insensitively.
_Avoid_: label, hashtag

**Unassigned**:
The state of a Transaction that has no Wallet, either because at capture no Wallet matched its currency, or because its Wallet was later deleted. Kept in its original currency, included in analysis via the Exchange Rate, and shown as needing a Wallet. Never rejected at capture, but the in-app form never saves a Transaction into this state: a Transaction edited by hand must have a Wallet in its currency.
_Avoid_: orphan, pending, inbox

**Shortcut**:
An Apple Shortcuts automation on the User's iPhone, built by the User in the Shortcuts app by following June's guide, which shows every action with the User's Categories, currencies and capture URL filled in, that captures a Transaction by sending amount, currency, category slug, description, and the phone's local date to June, without asking for the date. It is the primary capture method; the in-app form is secondary. A Shortcut never names a Wallet; the Wallet is resolved by Wallet Order.
_Avoid_: webhook (that names the transport, not the capture method), integration

**CSV Import**:
A batch of Changes created from a file in June's own template, one row per Transaction. Each row obeys the same rules as a capture: the Wallet comes from Wallet Order and the row's currency, an unknown Category slug means Uncategorised, a currency no Wallet holds means Unassigned. A row June cannot read is skipped and reported by line; the rest still import.
_Avoid_: upload, sync, bank import

**Recurring**:
A User's template for a Change that repeats: a required name plus every field a Change has (amount, currency, Wallet, Category, description, Tags), a Schedule, and an Auto flag. A Recurring is not a Transaction and appears in no analysis; only the Changes it produces do. Producing a Change is called firing. With Auto on, June fires it on each due date; with Auto off, the User fires it by hand and the Schedule is optional and serves as a reminder. A Recurring whose Wallet was deleted still fires, Unassigned, and is flagged as needing attention; one whose Category was deleted fires Uncategorised.
_Avoid_: recurring transaction, subscription, scheduled transaction, template

**Schedule**:
When a Recurring is due: daily, weekly on one or more weekdays, monthly on one or more days of the month, yearly on a day of a month, or once on a date. The User never sees or types the expression behind it. A monthly Schedule on the 29th, 30th or 31st skips months without that day. A Recurring always knows its next due date; a Recurring that is due and unfired is Overdue.
_Avoid_: cron (that names the storage), frequency, period (already means the viewed date range)

**Firing**:
Creating one Change from a Recurring, dated the due date it was fired for, or today when the Recurring has no due date. Firing advances the Schedule to the next due date; a once Schedule is spent. Auto firing catches up every due date that was missed while June was unavailable.
_Avoid_: apply, run, execute, charge

**Loan**:
Money a User has lent or borrowed outside their Wallets, tracked so it is not forgotten: a signed amount in a currency and a description naming the other party. Positive is Lent (they owe the User), negative is Borrowed (the User owes them). The amount is stored as the current position and changes only through Settling or a direct edit; a Loan keeps no history and is never linked to a Transaction. A Loan appears in no analysis and affects no Balance.
_Avoid_: debt, credit, IOU, receivable

**Lent** / **Borrowed**:
The two directions of a Loan, read from the sign of its amount. Settling past zero flips one into the other.
_Avoid_: positive loan, negative loan, asset, liability

**Settling**:
Recording money moving between a Wallet and a Loan: the User enters an ordinary Change, Hidden from analysis unless they say otherwise, and the Loan's amount moves by the opposite of that Change. Returning money settles a Loan toward zero; lending or borrowing more moves it away. Settling more than remains flips the direction.
_Avoid_: repayment, pay off, adjust

**Archived**:
The state of a Loan set aside from the live list without being deleted. June archives a Loan when Settling brings it to zero; the User can archive or unarchive one at any time, and delete a Loan in either state.
_Avoid_: closed, settled (as a state), deleted

**Filter**:
A User's narrowing of what Transactions and Analysis show inside the selected period, by deselecting Transaction Types (expense, income, exchange; an Init counts as income), Categories, Wallets, or Tags. Everything is selected until deselected. One set applies to both screens at once. A Filter never changes what is stored.
_Avoid_: search, query, segment

**Capture Token**:
A per-User secret embedded in the URL the Shortcut posts to. It identifies the User without a sign-in session. Regenerating it invalidates every Shortcut built with the previous URL.
_Avoid_: API key, webhook secret, token (bare)

**OAuth account**:
An identity at an external provider (e.g. Google) linked to a User for sign-in. One User may have several. Google is the only provider for now. June never stores passwords.
_Avoid_: account (bare), login, credentials

## Flagged ambiguities


- **"account"** is never used on its own. It is overloaded between the money container (use **Wallet**) and the sign-in identity (use **User** or the qualified **OAuth account**).

## Example dialogue

**Dev:** When the Shortcut posts `{"amount": -45, "currency": "PLN", "category": "food"}`, which Wallet does it go to?

**Expert:** Walk the Wallet Order and take the first Wallet whose currency is PLN. If there isn't one, the Transaction is Unassigned. Don't reject it, and don't invent a Wallet.

**Dev:** And if the slug "food" doesn't exist?

**Expert:** Same idea: store it Uncategorised. Only a malformed body or a made-up currency gets rejected.

**Dev:** Is that Transaction a Change?

**Expert:** Yes. Every Shortcut capture is a Change, negative for an expense. Init only happens when a Wallet is created, and Exchange only when money moves between two Wallets.

**Dev:** How does an Unassigned PLN Transaction show up on the analysis page if Default Currency is USD?

**Expert:** Converted with the Exchange Rate for its date, fetched from the Rate Provider and cached. It appears in spending by Category. It just doesn't affect any Balance, because Balance is per Wallet.

**Dev:** If I change the Transaction's date, does the rate change?

**Expert:** Yes. The rate is never stored on the Transaction, so the new date means a new lookup.
