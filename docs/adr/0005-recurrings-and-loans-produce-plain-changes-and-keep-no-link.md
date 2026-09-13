---
status: accepted
---

# Recurrings and Loans produce plain Changes and keep no link to them

A Recurring fires Changes and a Loan is Settled through Changes, so both could have been modelled the way Balance is: the Transaction carries a `recurring_id` or `loan_id`, and "what this Recurring produced" or "what remains of this Loan" is derived from the linked rows. We decided the opposite. A fired Change is an ordinary Change carrying the Recurring's Category, description and Tags and nothing else; a Recurring only remembers the date it last fired. A Loan stores its current signed amount, and Settling writes the Change and moves that amount in one database transaction, with no foreign key between them. The owner did not want a history of lending and repayment recorded thoroughly, and a link would have made Recurrings and Loans a third and fourth relation that the Filter, bulk edit, import and every delete path would have to respect. Two columns and one join were not worth that for ten Users.

## Consequences

- Deleting or editing a settlement Change leaves the Loan unchanged; the User corrects the Loan by editing its amount. Deleting a Loan or a Recurring touches no Transaction.
- A Recurring's page cannot list the Changes it produced, and a Loan's page cannot list its settlements. Both show only their current state and the last relevant date.
- Any later "show what this produced" view would have to be reconstructed from descriptions and Tags, or start recording links from that day on; the history before it is not recoverable.
- Recurrings and Loans are absent from analysis by construction: only the Changes exist there, subject to the ordinary Hidden flag, which the Settle form turns on by default.
