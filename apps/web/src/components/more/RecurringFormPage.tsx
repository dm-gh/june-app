import { type CategoryId, currencyExponent, type MinorAmount, type Recurring, type RecurringId, toMinor, type WalletId } from "@june/shared"
import { Trash } from "@phosphor-icons/react"
import { Either } from "effect"
import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { useCategories, useCreateRecurring, useDeleteRecurring, useRecurring, useTags, useUpdateRecurring, useWallets } from "../../api/queries"
import { FormPage } from "../../layout/FormPage"
import { Checkbox, Dialog, Field, Input, Loading, Notice, Select, TagInput, Text } from "../../ui"
import { AmountInput } from "../../ui/AmountInput"
import { emptySchedule, type ScheduleDraft, scheduleFromRecurring, schedulePayload, SchedulePicker } from "./SchedulePicker"

interface Draft {
  name: string
  sign: "-" | "+"
  amount: string
  currency: string
  walletId: WalletId | ""
  categoryId: CategoryId | ""
  description: string
  tags: ReadonlyArray<string>
  auto: boolean
  schedule: ScheduleDraft
}

type Errors = Partial<Record<"name" | "amount" | "wallet" | "schedule", string>>

const draftFromRecurring = (r: Recurring): Draft => ({
  name: r.name,
  sign: r.amountMinor < 0 ? "-" : "+",
  amount: (Math.abs(r.amountMinor) / 10 ** currencyExponent(r.currency)).toFixed(currencyExponent(r.currency)),
  currency: r.currency,
  walletId: r.walletId ?? "",
  categoryId: r.categoryId ?? "",
  description: r.description,
  tags: r.tags,
  auto: r.auto,
  schedule: scheduleFromRecurring(r)
})

type Wallets = NonNullable<ReturnType<typeof useWallets>["data"]>["wallets"]
type Categories = NonNullable<ReturnType<typeof useCategories>["data"]>

/** The fields of a Recurring: every field of a Change but the date, plus a name, Auto and the Schedule. */
function RecurringFields({ draft, onChange, wallets, categories, tagSuggestions, errors }: { draft: Draft; onChange: (d: Draft) => void; wallets: Wallets; categories: Categories; tagSuggestions: ReadonlyArray<string>; errors: Errors }) {
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => onChange({ ...draft, [key]: value })
  const currencies = useMemo(() => {
    const set = new Set<string>(wallets.map((w) => w.currency))
    if (draft.currency) set.add(draft.currency)
    return [...set].sort()
  }, [wallets, draft.currency])
  const walletsInCurrency = wallets.filter((w) => w.currency === draft.currency)
  const categoriesForSign = categories.filter((c) => (draft.sign === "-" ? c.type === "expense" : c.type === "income"))
  return (
    <>
      <Field label="Name" htmlFor="name" error={errors.name}>
        <Input id="name" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Rent" invalid={errors.name !== undefined} autoFocus />
      </Field>
      <Field label="Amount" htmlFor="amount" error={errors.amount} hint="Tap the sign to switch between expense and income">
        <AmountInput
          id="amount"
          value={draft.amount}
          onChange={(amount) => set("amount", amount)}
          sign={draft.sign}
          onSignChange={(sign) => onChange({ ...draft, sign, categoryId: "" })}
          invalid={errors.amount !== undefined}
        />
      </Field>
      <Field label="Currency" htmlFor="currency">
        <Select
          id="currency"
          value={draft.currency}
          onChange={(e) => {
            const currency = e.target.value
            onChange({ ...draft, currency, walletId: wallets.find((w) => w.currency === currency)?.id ?? "" })
          }}
        >
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Wallet" htmlFor="wallet" error={errors.wallet}>
        <Select id="wallet" value={draft.walletId} invalid={errors.wallet !== undefined} onChange={(e) => set("walletId", e.target.value as WalletId)}>
          {walletsInCurrency.length === 0 ? <option value="">No wallet in {draft.currency}</option> : null}
          {walletsInCurrency.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} · {w.currency}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Category" htmlFor="category">
        <Select id="category" value={draft.categoryId} onChange={(e) => set("categoryId", e.target.value as CategoryId)}>
          <option value="">Uncategorised</option>
          {categoriesForSign.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji ? `${c.emoji} ` : ""}
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Description" htmlFor="description">
        <Input id="description" value={draft.description} onChange={(e) => set("description", e.target.value)} placeholder="What is it?" />
      </Field>
      <Field label="Tags" htmlFor="tags" hint="Space-separated, e.g. vacation-2026">
        <TagInput id="tags" value={draft.tags} onChange={(tags) => set("tags", tags)} suggestions={tagSuggestions} />
      </Field>
      <div>
        <Checkbox label="Auto: fire by itself on the due date" checked={draft.auto} onChange={(e) => set("auto", e.target.checked)} />
        <Text className="mt-1.5 text-sm text-grey-ink">Auto fires within the hour after 00:00 UTC on the due date, and the transaction is dated that day.</Text>
      </div>
      <SchedulePicker value={draft.schedule} onChange={(schedule) => set("schedule", schedule)} required={draft.auto} error={errors.schedule} />
    </>
  )
}

/** Reads the draft into a payload, or the errors to show. */
const readDraft = (draft: Draft) => {
  const errors: Errors = {}
  if (draft.name.trim() === "") errors.name = "Give it a name"
  const parsed = toMinor(Number(draft.amount), draft.currency)
  if (draft.amount.trim() === "" || Either.isLeft(parsed) || parsed.right === 0) errors.amount = Either.isLeft(parsed) ? parsed.left : "Enter an amount"
  if (draft.walletId === "") errors.wallet = `Create a ${draft.currency} wallet first`
  const schedule = schedulePayload(draft.schedule)
  if (Either.isLeft(schedule)) errors.schedule = schedule.left
  else if (draft.auto && schedule.right.cron === null && schedule.right.nextOn === null) errors.schedule = "Auto needs a schedule"
  if (Object.keys(errors).length > 0 || Either.isLeft(parsed) || Either.isLeft(schedule)) return Either.left(errors)
  return Either.right({
    name: draft.name.trim(),
    walletId: draft.walletId as WalletId,
    amountMinor: ((draft.sign === "-" ? -1 : 1) * parsed.right) as MinorAmount,
    categoryId: draft.categoryId === "" ? null : (draft.categoryId as CategoryId),
    description: draft.description.trim(),
    tags: draft.tags as never,
    auto: draft.auto,
    cron: schedule.right.cron,
    nextOn: schedule.right.nextOn
  })
}

export function AddRecurringPage() {
  const navigate = useNavigate()
  const wallets = useWallets()
  const categories = useCategories()
  const tags = useTags()
  const create = useCreateRecurring()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [errors, setErrors] = useState<Errors>({})

  useEffect(() => {
    const first = wallets.data?.wallets[0]
    if (first && draft === null) {
      setDraft({ name: "", sign: "-", amount: "", currency: first.currency, walletId: first.id, categoryId: "", description: "", tags: [], auto: false, schedule: { ...emptySchedule(), kind: "monthly" } })
    }
  }, [wallets.data, draft])

  if (wallets.isPending || categories.isPending) {
    return (
      <FormPage title="Add recurring" backTo="/more">
        <Loading />
      </FormPage>
    )
  }
  if ((wallets.data?.wallets ?? []).length === 0 || draft === null) {
    return (
      <FormPage title="Add recurring" backTo="/more">
        <Notice accent="lavender" label="No wallets yet">
          <Text>A Recurring needs a Wallet to fire into. Create your first one in Settings.</Text>
        </Notice>
      </FormPage>
    )
  }
  const submit = () => {
    const read = readDraft(draft)
    if (Either.isLeft(read)) return setErrors(read.left)
    setErrors({})
    create.mutate(read.right, { onSuccess: () => navigate("/more") })
  }
  return (
    <FormPage title="Add recurring" backTo="/more" submitLabel="Save recurring" onSubmit={submit} busy={create.isPending} error={create.error?.message ?? null}>
      <RecurringFields draft={draft} onChange={setDraft} wallets={wallets.data?.wallets ?? []} categories={categories.data ?? []} tagSuggestions={tags.data ?? []} errors={errors} />
    </FormPage>
  )
}

export function EditRecurringPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const recurring = useRecurring(id as RecurringId)
  const wallets = useWallets()
  const categories = useCategories()
  const tags = useTags()
  const update = useUpdateRecurring()
  const remove = useDeleteRecurring()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (recurring.data && draft === null) setDraft(draftFromRecurring(recurring.data))
  }, [recurring.data, draft])

  if (recurring.isPending || wallets.isPending || categories.isPending || draft === null) {
    return (
      <FormPage title="Edit recurring" backTo="/more">
        {recurring.isError ? <Text>{recurring.error.message}</Text> : <Loading />}
      </FormPage>
    )
  }
  const r = recurring.data!
  const submit = () => {
    const read = readDraft(draft)
    if (Either.isLeft(read)) return setErrors(read.left)
    setErrors({})
    const p = read.right
    // The Schedule is sent only when it changed, so an untouched one keeps its next date.
    const scheduleChanged = p.cron !== r.cron || p.nextOn !== (r.cron === null ? r.nextOn : null) || p.auto !== r.auto
    update.mutate(
      {
        id: r.id,
        payload: {
          name: p.name,
          walletId: p.walletId,
          amountMinor: p.amountMinor,
          categoryId: p.categoryId,
          description: p.description,
          tags: p.tags,
          ...(scheduleChanged ? { auto: p.auto, cron: p.cron, nextOn: p.nextOn } : {})
        }
      },
      { onSuccess: () => navigate(`/more/recurrings/${r.id}`) }
    )
  }
  return (
    <FormPage
      title="Edit recurring"
      backTo={`/more/recurrings/${r.id}`}
      submitLabel="Save recurring"
      onSubmit={submit}
      busy={update.isPending}
      error={update.error?.message ?? remove.error?.message ?? null}
      menu={[{ label: "Delete", icon: Trash, danger: true, onSelect: () => setConfirm(true) }]}
    >
      <RecurringFields draft={draft} onChange={setDraft} wallets={wallets.data?.wallets ?? []} categories={categories.data ?? []} tagSuggestions={tags.data ?? []} errors={errors} />
      <Dialog
        open={confirm}
        title={`Delete ${r.name}?`}
        body="The transactions it already recorded stay."
        confirmLabel="Delete"
        danger
        busy={remove.isPending}
        onConfirm={() => remove.mutate(r.id, { onSuccess: () => navigate("/more") })}
        onCancel={() => setConfirm(false)}
      />
    </FormPage>
  )
}
