# Figma

Design work lives in the author's personal Figma account, never the work account.

- **June Design System**: https://www.figma.com/design/XTJHO4UWcgl2auRItphKcR
  Built 2026-09-12 from the code tokens in `apps/web/src/index.css` and the components in `apps/web/src/ui`.
  - Pages: Cover, Foundations, Components.
  - Variables: Primitives (13 colours, hidden), Color (19 semantic aliases), Spacing (22 floats), Typography (10 strings). Every variable carries WEB code syntax matching the Tailwind theme.
  - Styles: 4 hard-shadow effect styles, 18 text styles mirroring the Typography/Button/Badge/Amount components.
  - Component sets: Badge (8), Button (48), Input (4), Select (4), Textarea (4), Field (3), Card (27), Amount (12).
  - Screens page (added 2026-09-12): three screen-level components, Nav bar (3), Transaction row (4), Sign toggle (2), plus the MVP screens as 390×844 phone frames: Sign in, Transactions, Add transaction (Expense and Income states), Add exchange, Analysis, Settings.
  - Badge has a Size axis (MD 28px, SM 20px); SM is the corner tag on transaction cards. Effect styles Shadow/Hard SM Coral and Shadow/Hard SM Green colour the amount field by sign.
  - Phone screen titles use the text style Display/SM (Syne ExtraBold 28px); the code equivalent is `font-display text-3xl` and should be added to the Display component as a size prop when screens are implemented.

## Workflow

1. Tokens and primitives are authored in code first, then pushed to Figma. Code is the source of truth for values.
2. Screens are laid out in Figma from the library, then implemented in code from the file.
3. Code Connect mappings are not set up yet; add them once the library is published.

## Screen decisions captured in the mocks

- Bottom tab bar with three tabs: Transactions, Analysis, Settings. Add transaction is a full-screen form reached from a floating "+ Add" button, with no tab bar.
- Transaction list is grouped by day. The amount is the dominant element of a card, the description sits under it in small ink text, the Category is a small tag flush in the card's top-right corner, and the Wallet is not shown. Uncategorised rows show a grey tag, Unassigned rows grey the whole card.
- Categories show an emoji before the name wherever they appear.
- Add transaction: the User never types a sign. A Sign toggle left of the amount defaults to minus (expense, coral shadow on the field) and flips to plus (income, green shadow). The type toggle reads Expense or Income accordingly, or Exchange.
- Add exchange is a separate form: From wallet, To wallet, Sent and Received amounts in each wallet's currency, Date. No currency, category or description fields. When the wallets differ in currency a notice shows the reference rate for that date; the recorded legs are exactly what the User enters (ADR-0004).
- Analysis stacks: Spent (coral) / Income (green) cards, By category bars, Over time monthly bars (current month yellow), Wallet balances with an approximate total in Default Currency.
- Settings: ordered Wallets with drag handles (order drives Shortcut capture), Categories as a list with emoji, name, slug and colour, Default currency select, Shortcut card with masked Capture Token, Regenerate (danger) and Download Shortcut, sign out.
- Sign in: Google button, or email magic link; invite-only note.

## Constraints

- Plan: Professional, Full seat (upgraded 2026-09-12). Figma MCP allows 200 tool calls per day.
