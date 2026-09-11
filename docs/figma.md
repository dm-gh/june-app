# Figma

Design work lives in the author's personal Figma account, never the work account.

- **June Design System**: https://www.figma.com/design/XTJHO4UWcgl2auRItphKcR
  Built 2026-09-12 from the code tokens in `apps/web/src/index.css` and the components in `apps/web/src/ui`.
  - Pages: Cover, Foundations, Components.
  - Variables: Primitives (13 colours, hidden), Color (19 semantic aliases), Spacing (22 floats), Typography (10 strings). Every variable carries WEB code syntax matching the Tailwind theme.
  - Styles: 4 hard-shadow effect styles, 18 text styles mirroring the Typography/Button/Badge/Amount components.
  - Component sets: Badge (8), Button (48), Input (4), Select (4), Textarea (4), Field (3), Card (27), Amount (12).
  - Screens page (added 2026-09-12): two screen-level components, Nav bar (3) and Transaction row (4), plus the five MVP screens as 390×844 phone frames: Sign in, Transactions, Add transaction, Analysis, Settings.
  - Phone screen titles use the text style Display/SM (Syne ExtraBold 28px); the code equivalent is `font-display text-3xl` and should be added to the Display component as a size prop when screens are implemented.

## Workflow

1. Tokens and primitives are authored in code first, then pushed to Figma. Code is the source of truth for values.
2. Screens are laid out in Figma from the library, then implemented in code from the file.
3. Code Connect mappings are not set up yet; add them once the library is published.

## Screen decisions captured in the mocks

- Bottom tab bar with three tabs: Transactions, Analysis, Settings. Add transaction is a full-screen form reached from a floating "+ Add" button, with no tab bar.
- Transaction list is grouped by day; Uncategorised rows show a grey Badge, Unassigned rows grey the whole card.
- Analysis stacks: Spent/Income cards, By category bars, Over time monthly bars (current month yellow), Wallet balances with an approximate total in Default Currency.
- Settings: ordered Wallets with drag handles (order drives Shortcut capture), Categories as badges, Default currency select, Shortcut card with masked Capture Token, Regenerate (danger) and Download Shortcut, sign out.
- Sign in: Google button, or email magic link; invite-only note.

## Constraints

- Plan: Professional, Full seat (upgraded 2026-09-12). Figma MCP allows 200 tool calls per day.
