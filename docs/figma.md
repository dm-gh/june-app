# Figma

Design work lives in the author's personal Figma account, never the work account.

- **June Design System**: https://www.figma.com/design/XTJHO4UWcgl2auRItphKcR
  Built 2026-09-12 from the code tokens in `apps/web/src/index.css` and the components in `apps/web/src/ui`.
  - Pages: Cover, Foundations, Components.
  - Variables: Primitives (13 colours, hidden), Color (19 semantic aliases), Spacing (22 floats), Typography (10 strings). Every variable carries WEB code syntax matching the Tailwind theme.
  - Styles: 4 hard-shadow effect styles, 18 text styles mirroring the Typography/Button/Badge/Amount components.
  - Component sets: Badge (8), Button (48), Input (4), Select (4), Textarea (4), Field (3), Card (27), Amount (12).

## Workflow

1. Tokens and primitives are authored in code first, then pushed to Figma. Code is the source of truth for values.
2. Screens are laid out in Figma from the library, then implemented in code from the file.
3. Code Connect mappings are not set up yet; add them once the library is published.

## Constraints

- Plan: Professional, Full seat (upgraded 2026-09-12). Figma MCP allows 200 tool calls per day.
