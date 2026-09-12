import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react"
import { cn } from "./cn"

/** Shared look for every text-like control. Focus is a hard offset shadow, not a glow. */
export const controlClass = cn(
  "w-full border-3 border-ink bg-white px-3 font-sans text-base text-ink",
  "placeholder:text-grey-ink",
  "focus:outline-none focus:shadow-hard-sm",
  "disabled:cursor-not-allowed disabled:bg-grey disabled:opacity-70",
  "aria-invalid:border-coral aria-invalid:bg-coral/10"
)

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export function Input({ className, invalid, ...rest }: InputProps) {
  return <input aria-invalid={invalid || undefined} className={cn(controlClass, "h-11", className)} {...rest} />
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export function Textarea({ className, invalid, ...rest }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(controlClass, "min-h-24 py-2 resize-y", className)}
      {...rest}
    />
  )
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

/** Native select with a hand-drawn chevron so the control stays flat and bordered on every platform. */
export function Select({ className, invalid, children, ...rest }: SelectProps) {
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        className={cn(controlClass, "h-11 appearance-none pr-10", className)}
        {...rest}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="square"
      >
        <path d="M3 6l5 5 5-5" />
      </svg>
    </div>
  )
}
