import { CapturePayload } from "@june/shared"
import { Schema } from "effect"

const example = Schema.decodeUnknownSync(CapturePayload)({
  amount: -12.5,
  currency: "EUR",
  category: "coffee",
  description: "flat white"
})

export function App() {
  return (
    <main className="min-h-screen bg-paper p-8 font-sans text-ink">
      <h1 className="font-display text-5xl font-extrabold">June</h1>
      <p className="mt-4 inline-block border-[3px] border-ink bg-yellow px-4 py-2 font-mono shadow-hard">
        {example.amount} {example.currency} · {example.description}
      </p>
    </main>
  )
}
