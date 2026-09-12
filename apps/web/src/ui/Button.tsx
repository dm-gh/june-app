import type { ButtonHTMLAttributes } from "react"
import { cn } from "./cn.js"

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost"
export type ButtonSize = "sm" | "md" | "lg"

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-ink border-3 border-ink shadow-hard lift",
  secondary: "bg-paper text-ink border-3 border-ink shadow-hard lift",
  danger: "bg-coral text-ink border-3 border-ink shadow-hard lift",
  ghost: "bg-transparent text-ink border-3 border-transparent hover:border-ink"
}

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-14 px-7 text-lg"
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({ variant = "primary", size = "md", className, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-heading font-bold whitespace-nowrap select-none",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink",
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    />
  )
}
