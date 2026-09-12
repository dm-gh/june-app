import { currencyExponent, type LocalDate, type MinorAmount, toMinor, type Transaction, type UpdateExchange, type Wallet, type WalletId } from "@june/shared"
import { Either } from "effect"
import { useMemo } from "react"
import { AmountInput, DateInput, Field, Input, Notice, Select, TagInput } from "../../ui"

/** What the Exchange form edits: both Wallets, both magnitudes, and the fields shared by the legs. */
export interface ExchangeDraft {
  source: WalletId
  target: WalletId
  sent: string
  received: string
  date: LocalDate
  description: string
  tags: ReadonlyArray<string>
}

type ExchangePayload = ConstructorParameters<typeof UpdateExchange>[0]

/** The amount of a leg as the form shows it: unsigned, in major units, e.g. "12.50". */
const legAmount = (t: Transaction): string => (Math.abs(t.amountMinor) / 10 ** currencyExponent(t.currency)).toFixed(currencyExponent(t.currency))

/** The source leg is the negative one. Null when a leg lost its Wallet: such an Exchange cannot be edited. */
export const draftFromLegs = (legs: ReadonlyArray<Transaction>): ExchangeDraft | null => {
  const source = legs.find((l) => l.amountMinor < 0)
  const target = legs.find((l) => l.amountMinor > 0)
  if (!source || !target || !source.walletId || !target.walletId) return null
  return {
    source: source.walletId,
    target: target.walletId,
    sent: legAmount(source),
    received: legAmount(target),
    date: source.occurredOn,
    description: source.description,
    tags: source.tags
  }
}

/** Turn a draft into the payload both create and update take, or the message to show instead. */
export const exchangePayload = (draft: ExchangeDraft, wallets: ReadonlyArray<Wallet>): Either.Either<ExchangePayload, string> => {
  const from = wallets.find((w) => w.id === draft.source)
  const to = wallets.find((w) => w.id === draft.target)
  if (!from || !to) return Either.left("Pick both wallets")
  if (from.id === to.id) return Either.left("Pick two different wallets")
  const sameCurrency = from.currency === to.currency
  const sentMinor = toMinor(Number(draft.sent), from.currency)
  const receivedMinor = toMinor(Number(sameCurrency ? draft.sent : draft.received), to.currency)
  if (Either.isLeft(sentMinor) || sentMinor.right <= 0) return Either.left(Either.isLeft(sentMinor) ? sentMinor.left : "Enter the amount sent")
  if (Either.isLeft(receivedMinor) || receivedMinor.right <= 0) {
    return Either.left(Either.isLeft(receivedMinor) ? receivedMinor.left : "Enter the amount received")
  }
  return Either.right({
    sourceWalletId: from.id,
    sourceMinor: sentMinor.right as MinorAmount,
    targetWalletId: to.id,
    targetMinor: receivedMinor.right as MinorAmount,
    occurredOn: draft.date,
    description: draft.description.trim(),
    tags: draft.tags as never
  })
}

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

  const walletOptions = wallets.map((w) => (
    <option key={w.id} value={w.id}>
      {w.name} · {w.currency}
    </option>
  ))

  return (
    <>
      <Field label="From wallet" htmlFor="from">
        <Select id="from" value={draft.source} onChange={(e) => set("source", e.target.value as WalletId)}>
          {walletOptions}
        </Select>
      </Field>
      <Field label="To wallet" htmlFor="to">
        <Select id="to" value={draft.target} onChange={(e) => set("target", e.target.value as WalletId)}>
          {walletOptions}
        </Select>
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
      <Field label="Tags" htmlFor="tags" hint="Space-separated, e.g. vacation-2026">
        <TagInput id="tags" value={draft.tags} onChange={(tags) => set("tags", tags)} suggestions={tagSuggestions} />
      </Field>
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
