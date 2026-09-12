import type { ComponentPropsWithoutRef, ElementType } from "react"
import { cn } from "./cn"

type TextProps<T extends ElementType> = { as?: T; className?: string } & Omit<
  ComponentPropsWithoutRef<T>,
  "as" | "className"
>

/** Oversized, declarative. Page titles and hero numbers only. `sm` is the screen title size (Figma Display/SM). */
export function Display<T extends ElementType = "h1">({
  as,
  size = "md",
  className,
  ...rest
}: TextProps<T> & { size?: "sm" | "md" }) {
  const Tag = (as ?? "h1") as ElementType
  return (
    <Tag
      className={cn(
        "font-display font-extrabold uppercase leading-none tracking-tight",
        size === "sm" ? "text-3xl" : "text-5xl sm:text-6xl",
        className
      )}
      {...rest}
    />
  )
}

/** Structural headings inside a page. */
export function Heading<T extends ElementType = "h2">({ as, className, ...rest }: TextProps<T>) {
  const Tag = (as ?? "h2") as ElementType
  return <Tag className={cn("font-heading text-2xl font-bold leading-[1.15]", className)} {...rest} />
}

/** Small caps-style label used above fields and stat tiles. */
export function Label<T extends ElementType = "span">({ as, className, ...rest }: TextProps<T>) {
  const Tag = (as ?? "span") as ElementType
  return (
    <Tag className={cn("font-heading text-xs font-bold uppercase tracking-widest", className)} {...rest} />
  )
}

/** Body copy. */
export function Text<T extends ElementType = "p">({ as, className, ...rest }: TextProps<T>) {
  const Tag = (as ?? "p") as ElementType
  return <Tag className={cn("font-sans text-base leading-snug", className)} {...rest} />
}

/** Engineered feel: amounts, slugs, tokens, dates. */
export function Mono<T extends ElementType = "span">({ as, className, ...rest }: TextProps<T>) {
  const Tag = (as ?? "span") as ElementType
  return <Tag className={cn("font-mono", className)} {...rest} />
}
