import { hueColor } from "../lib/format"

export interface HueSliderProps {
  id?: string
  value: number
  onChange: (hue: number) => void
  disabled?: boolean
}

const rainbow = `linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360].map((h) => hueColor(h)).join(", ")})`

/** Saturation and lightness are locked; the User only slides the hue. */
export function HueSlider({ id, value, onChange, disabled }: HueSliderProps) {
  return (
    <div className="relative h-11">
      <div aria-hidden className="absolute inset-y-2 inset-x-0 border-3 border-ink" style={{ background: rainbow }} />
      <input
        id={id}
        type="range"
        min={0}
        max={359}
        step={1}
        value={value}
        disabled={disabled}
        aria-label="Hue"
        onChange={(e) => onChange(Number(e.target.value))}
        className="hue-slider absolute inset-0 w-full cursor-pointer appearance-none bg-transparent"
        style={{ "--thumb": hueColor(value) } as React.CSSProperties}
      />
    </div>
  )
}
