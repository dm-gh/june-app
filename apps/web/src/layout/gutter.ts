/**
 * The column's inset: 16px on phones, 32px from md up. AppShell puts `around` on the column; a
 * sticky header cancels it with `cancel` and puts `around` back inside itself, so it paints edge
 * to edge and nothing shows through above or beside it while the page scrolls.
 */
export const gutter = {
  around: "px-4 pt-4 md:px-8 md:pt-8",
  top: "pt-4 md:pt-8",
  cancel: "-mx-4 -mt-4 md:-mx-8 md:-mt-8"
} as const
