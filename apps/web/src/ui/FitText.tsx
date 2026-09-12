import { type ReactNode, useLayoutEffect, useRef, useState } from "react"

export interface FitTextProps {
  /** Largest size in px; the text shrinks from here until it fits `maxLines` lines. */
  max: number
  min?: number
  maxLines?: number
  className?: string
  children: ReactNode
}

/** Text that shrinks its font size, step by step, until it fits the allowed number of lines. */
export function FitText({ max, min = 14, maxLines = 2, className, children }: FitTextProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [size, setSize] = useState(max)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let current = max
    el.style.fontSize = `${current}px`
    const fits = () => el.scrollHeight <= Math.round(parseFloat(getComputedStyle(el).lineHeight) * maxLines) + 1
    while (!fits() && current > min) {
      current -= 1
      el.style.fontSize = `${current}px`
    }
    setSize(current)
  }, [children, max, min, maxLines])

  return (
    <span ref={ref} className={className} style={{ fontSize: size, display: "block" }}>
      {children}
    </span>
  )
}
