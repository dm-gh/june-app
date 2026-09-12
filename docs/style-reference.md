# Style reference: Neubrutalism

Source: https://neubrutalism.com/ (captured 2026-09-11). Adopted as June's visual language.

## Palette
| Role | Hex |
|---|---|
| Black (outline, text) | `#000000` |
| Off-white (base) | `#FFFDF5` |
| Yellow | `#FFD23F` |
| Coral | `#FF6B6B` |
| Sky blue | `#74B9FF` |
| Green | `#88D498` |
| Orange | `#FFA552` |
| Lavender | `#B8A9FA` |

Accent: soft lime #E6F9B2, chosen 2026-09-12. Used for every control and accent surface: primary buttons, the active nav tab, the plus button, checked boxes, selected calendar days and the Spent panel. Its bold companion accent-strong #BDEF36 appears only on the sign-in screen (brand block and Google button) and the cover. Yellow stays in the palette for categories and badges. In Figma the accent is `Primitives/accent` with modes Khaki and Yellow; the Accent lab frame on Foundations holds candidate swatches.

One neutral base, one dark outline, limited saturated accents. No gradients.

## Structure
- Borders: `3px solid #000` standard; `2px` thin, `4px` heavy.
- Shadows: hard offset, zero blur. `3px 3px 0 0 #000`, `5px 5px`, `8px 8px`, `12px 12px`.
- Corner radius: `0`, always.
- Hover: `transform: translate(-2px, -2px)` and shadow grows. Active: element presses in, shadow disappears.

## Typography
- Display: Syne 800, always uppercase (the author dislikes Syne lowercase)
- Heading: Space Grotesk 700
- Body: Inter 400
- Mono: Space Mono

Extreme type only for headlines and calls to action; body stays conventional.

## Layout
"Broken but not random": predictable navigation and reading order, with local breaks via offset cards, overlapped panels, and macro asymmetry. Micro details stay mechanically aligned.

## Notes for June
- Charts (Recharts, SVG) must follow the same grammar: black strokes, flat fills from the palette, no gradients, hard shadows on cards not on marks.
- Uncategorised and Unassigned buckets render in a neutral grey outside the accent palette so they read as "not yet classified".

## Icons

Phosphor Icons, Bold weight, via `@phosphor-icons/react` in code and an `Icon` component set in Figma. 24px in a 44px ghost hit area for icon buttons, 20px inline next to text.
