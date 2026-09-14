import type { Wallet } from "@june/shared"
import { useMemo } from "react"
import { AmountInput, DateInput, Field, Input, Notice, TagsField, WalletSelect } from "../../ui"
import type { ExchangeDraft } from "./exchangeDraft"

export interface ExchangeFieldsProps {
  draft: ExchangeDraft
  onChange: (draft: ExchangeDraft) => void
  wallets: ReadonlyArray<Wallet>
  tagSuggestions: ReadonlyArray<string>
}

/** The body shared by Add transaction (Exchange tab) and Edit exchange. */
export function ExchangeFields({ draft, onChange, wallets, tagSuggestions }: ExchangeFieldsProps) {
  const set = <K extends keyof ExchangeDraft>(key: K, value: ExchangeDraft[K]) => onChange({ ...draft, [key]: value })
  const from = wallets.find((w) => w.id === draft.source)
  const to = wallets.find((w) => w.id === draft.target)
  const sameCurrency = from !== undefined && to !== undefined && from.currency === to.currency
  const implied = useMemo(() => {
    const s = Number(draft.sent)
    const r = Number(draft.received)
    return s > 0 && r > 0 ? (r / s).toFixed(4) : null
  }, [draft.sent, draft.received])

  return (
    <>
      <Field label="From wallet" htmlFor="from">
        <WalletSelect id="from" wallets={wallets} value={draft.source} onChange={(source) => set("source", source)} />
      </Field>
      <Field label="To wallet" htmlFor="to">
        <WalletSelect id="to" wallets={wallets} value={draft.target} onChange={(target) => set("target", target)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Sent · ${from?.currency ?? ""}`} htmlFor="sent" hint={from ? `Leaves ${from.name}` : undefined}>
          <AmountInput id="sent" value={draft.sent} onChange={(v) => set("sent", v)} sign="-" />
        </Field>
        <Field label={`Received · ${to?.currency ?? ""}`} htmlFor="received" hint={to ? `Arrives in ${to.name}` : undefined}>
          <AmountInput id="received" value={sameCurrency ? draft.sent : draft.received} onChange={(v) => set("received", v)} sign="+" disabled={sameCurrency} />
        </Field>
      </div>
      <Field label="Date" htmlFor="date">
        <DateInput id="date" value={draft.date} onChange={(d) => set("date", d)} />
      </Field>
      <Field label="Description" htmlFor="description">
        <Input id="description" value={draft.description} onChange={(e) => set("description", e.target.value)} placeholder="What was it?" />
      </Field>
      <TagsField value={draft.tags} onChange={(tags) => set("tags", tags)} suggestions={tagSuggestions} />
      {sameCurrency || !from || !to ? null : (
        <Notice accent="sky" label="Different currencies">
          {implied ? (
            <p className="font-mono">
              Your amounts imply 1 {from.currency} = {implied} {to.currency}.
            </p>
          ) : null}
          <p>The wallets record exactly what you enter.</p>
        </Notice>
      )}
    </>
  )
}
