# Figma

Design work lives in the author's personal Figma account, never the work account.

- **June Design System**: https://www.figma.com/design/XTJHO4UWcgl2auRItphKcR
  Built 2026-09-12 from the code tokens in `apps/web/src/index.css` and the components in `apps/web/src/ui`.
  - Pages: Cover, Foundations, Components.
  - Variables: Primitives (13 colours, hidden), Color (19 semantic aliases), Spacing (22 floats), Typography (10 strings). Every variable carries WEB code syntax matching the Tailwind theme.
  - Styles: 4 hard-shadow effect styles, 18 text styles mirroring the Typography/Button/Badge/Amount components.
  - Component sets: Badge (8), Button (48), Input (4), Select (4), Textarea (4), Field (3), Card (27), Amount (12).
  - Screens page (added 2026-09-12): screen-level components Nav bar (3), Transaction row (Kind × Hidden, 4), Sign toggle (2), Checkbox (2), Icon (9 Phosphor Bold glyphs), Icon button (Close, Menu, Back), Menu, Dialog, Hue slider, Top bar, Period sheet, plus the MVP screens as 390-wide phone frames (and, on Screens · Desktop, the same screens at 1440×1024 with the Sidebar nav): Sign in, Transactions (plus Selecting, Selecting · Menu, Selecting · Delete, Period), Bulk edit, Transaction (plus · Menu, · Delete), Edit transaction, Add transaction (Expense and Income states), Add exchange, Analysis, Settings, Add wallet, Add category.
  - Badge has a Size axis (MD 28px, SM 20px); SM is the corner tag on transaction cards. Effect styles Shadow/Hard SM Coral and Shadow/Hard SM Green colour the amount field by sign.
  - Phone screen titles use the text style Display/SM (Syne ExtraBold 24px, uppercase like all Display styles); the code equivalent is `font-display text-3xl` and should be added to the Display component as a size prop when screens are implemented.

## Workflow

1. Tokens and primitives are authored in code first, then pushed to Figma. Code is the source of truth for values.
2. Screens are laid out in Figma from the library, then implemented in code from the file.
3. Code Connect mappings are not set up yet; add them once the library is published.

## Screen decisions captured in the mocks

- Bottom tab bar with three tabs: Analysis, Transactions (centre), Settings. When Transactions is active its tab shrinks to 28px and a square yellow "+" button slides up out of it, overlapping the top border of the bar. That button opens Add transaction, a full-screen form with no tab bar. There is no floating action button. The bar keeps the same 80px height in every state so content never jumps between tabs.
- Transactions opens with a Spent panel in the accent, labelled just SPENT, with the currency inside the value (−USD 1,834.20). The list is grouped by day. The amount is the dominant element of a card, the description sits under it in small ink text, the Category is a small tag flush in the card's top-right corner, and the Wallet is not shown. Uncategorised and Unassigned rows show no tag at all. A grey card means the Transaction is Hidden from analysis, nothing else.
- Categories show an emoji before the name wherever they appear. Tags appear under the description on a card as small `#` chips (Badge Size=SM with prefix).
- Add wallet: name, currency, opening balance (explained as the Init transaction), and a note that new wallets go last in Wallet Order.
- Add category: Category Type toggle (Expense / Income) first, then emoji picker, name, auto-generated read-only slug, a Hue slider (saturation and lightness locked, hsl(h, 100%, 70%)) and a live badge preview. No helper hints under the fields.
- Add transaction and Edit transaction end with a "Hide from analysis" checkbox, off by default. The User never types a sign. A Sign toggle left of the amount defaults to minus (expense, coral shadow on the field) and flips to plus (income, green shadow). The type toggle reads Expense or Income accordingly, or Exchange.
- Add exchange is a separate form: From wallet, To wallet, Sent and Received amounts in each wallet's currency, Date. No currency, category or description fields. When the wallets differ in currency a notice shows the reference rate for that date; the recorded legs are exactly what the User enters (ADR-0004).
- Analysis stacks: Spent (coral) / Income (green) cards, By category bars, Over time monthly bars (current month yellow), Wallet balances with an approximate total in Default Currency.
- Settings: ordered Wallets with drag handles (order drives Shortcut capture), Categories as two lists, Expense and Income, each row with emoji, name, slug and colour, Default currency select, Shortcut card with masked Capture Token, Regenerate (danger) and Download Shortcut, sign out.
- Sign in: brand block, Google button only; the "or / Email / Send magic link" block is kept but hidden until magic link is in scope. No invite-only note, no tagline.
- Form action bars have no top rule. On desktop they are pinned to the bottom of the content column.
- Period: on Transactions and Analysis the month label carries a calendar icon and opens the Period sheet from the bottom over a scrim: From and To date fields, a Monday-first calendar with caret buttons to step the month, the selected range in the accent and the two ends bordered with a hard shadow, and a full-width Apply. No month shortcut chips: a whole month is picked on the calendar. The chevrons beside the label step the current period by its own length.
- Accent colour: every accent use is bound to `Color/bg/accent/primary`, which aliases `Primitives/accent`. `Primitives/accent` is #CEF366; paste a new hex into it to retheme every accent use at once. The "Accent lab" frame on Foundations shows a hue ramp and a saturation/lightness ramp of candidates.
- Back buttons on every form are the ghost ArrowLeft icon button; period chevrons on Transactions, Analysis and the Period sheet are ghost CaretLeft/CaretRight icon buttons; the nav plus button carries the Phosphor Plus glyph.
- Icons come from Phosphor (Bold weight), mirrored in code by @phosphor-icons/react. Icon buttons are ghost: no fill, border or shadow, just the 24px glyph in a 44px hit area.
- Selection mode: long-pressing a card shows a Checkbox flush in the top-left corner of every card (28px, yellow with an ink check when on, hard shadow, per neubrutalism.com) and swaps the header for a Top bar with a ghost Close icon button on the left, "N selected" in the middle and a ghost Menu icon button on the right. The Menu offers "Edit N items" (pencil) and "Delete N items" (trash, coral). The tab bar stays.
- Bulk edit: a form with only Wallet, Category and Tags; each control defaults to "Keep as is" so an untouched field leaves every selected item unchanged.
- Transaction view is the Edit transaction form with every control in its Disabled (read-only) state and no action bar. Header: ghost Back icon on the left, ghost Menu icon on the right (Edit with pencil, Delete with trash in coral).
- Edit transaction: same form as Add transaction with the current values filled in, titled EDIT TRANSACTION, ghost Back icon in the header, Save changes. There is no type toggle: a Transaction's Transaction Type is fixed once recorded, since a Change, an Init and an Exchange are different things.
- Every Delete, single or bulk, opens the Dialog over a 50% ink scrim: Cancel (ghost) or Delete (coral Danger button).

## Desktop variants

The "Screens · Desktop" page mirrors every mobile screen at 1440×1024. The bottom Nav bar is replaced by a Sidebar nav component (240px left rail: brand, Analysis / Transactions / Settings with the active item as an accent block, an Add transaction button with the Plus icon, and the session block). Content sits in a centred column: 720px for Transactions, Analysis and Settings, 560px for every form, 440px for Sign in, which has no sidebar. The column is built from the same content as the phone screen, so both stay in step. Menus anchor under the header's menu button; dialogs and the Period sheet open centred over a 50% ink scrim, the sheet gaining a full border and large hard shadow.

## Constraints

- Plan: Professional, Full seat (upgraded 2026-09-12). Figma MCP allows 200 tool calls per day.

## Not yet designed
- Edit wallet (name, Init balance; currency read-only) with Delete behind the options menu and a confirmation dialog.
- Delete on Edit category, with confirmation.
- Tag input: space-separated, suggestions list of existing Tags; bulk edit shows shared Tags as removable chips plus an add field.

## Where the code departs from the mocks (decided 2026-09-12, after using the app)
- Add wallet has no field hints and no Wallet order banner.
- Add category: the title is the preview ("ADD" followed by the same bordered badge a Transaction card wears, shrinking to fit two lines); there is no Preview row. The emoji is picked from a full emoji panel restyled in June's look; names are capped at 50 characters; slugs transliterate non-Latin names. Edit category shows no "fixed" hint under the type toggle.
- Add transaction is always titled ADD TRANSACTION. The type tabs stay as mocked: the first reads Expense or Income after the sign, the second is Exchange.
- Transactions has no Spent panel; the period's totals live on Analysis. In selection mode with nothing selected, Edit and Delete are greyed in the menu.
- Dates are never picked with the system control: a Date field opens June's own calendar in a sheet (with Yesterday and Today shortcuts), and the Period sheet fills whichever of From or To is active from the same calendar.
- There is no read-only Transaction view: a card opens the edit form, with Delete behind its options menu.
- Hover: the element rises 2px while its shadow stays put (the shadow grows), rather than the whole thing moving.
