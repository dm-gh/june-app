import type { HTMLAttributes } from "react"
import { cn } from "./cn.js"

export type Accent = "paper" | "white" | "yellow" | "coral" | "sky" | "green" | "orange" | "lavender" | "grey"

export const accentBg: Record<Accent, string> = {
  paper: "bg-paper",
  white: "bg-white",
  yellow: "bg-yellow",
  coral: "bg-coral",
  sky: "bg-sky",
  green: "bg-green",
  orange: "bg-orange",
  lavender: "bg-lavender",
  grey: "bg-grey"
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  accent?: Accent
  shadow?: "sm" | "md" | "lg" | "xl" | "none"
  /** Lift on hover; use only when the whole card is clickable. */
  interactive?: boolean
}

const shadows = {
  sm: "shadow-hard-sm",
  md: "shadow-hard",
  lg: "shadow-hard-lg",
  xl: "shadow-hard-xl",
  none: ""
}

export function Card({ accent = "white", shadow = "md", interactive, className, ...rest }: CardProps) {
  return (
    <div
      className={cn("border-3 border-ink p-4", accentBg[accent], shadows[shadow], interactive && "lift", className)}
      {...rest}
    />
  )
}
