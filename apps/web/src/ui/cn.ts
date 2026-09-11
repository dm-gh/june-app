/** Join class names, skipping falsy values. Small enough that a dependency is not worth it. */
export const cn = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(" ")
