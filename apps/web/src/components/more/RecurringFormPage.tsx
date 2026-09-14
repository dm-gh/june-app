import { type Recurring, type RecurringId, toMajorFixed } from "@june/shared"
import { Either } from "effect"
import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import { useCategories, useCreateRecurring, useDeleteRecurring, useRecurring, useTags, useUpdateRecurring, useWallets } from "../../api/queries"
import { FormPage } from "../../layout/FormPage"
import { useDeleteConfirm } from "../../layout/useDeleteConfirm"
import { Checkbox, Field, Input, Notice, QueryState, TagsField, Text, useDraft } from "../../ui"
import { type ChangeErrors, type ChangeFieldsDraft, readChangeDraft } from "../transactions/changeDraft"
import { ChangeFields } from "../transactions/ChangeFields"
import { emptySchedule, type ScheduleDraft, scheduleFromRecurring, schedulePayload, SchedulePicker } from "./SchedulePicker"

export interface RecurringDraft extends ChangeFieldsDraft {
  name: string
  auto: boolean
  schedule: ScheduleDraft
}

export type RecurringErrors = ChangeErrors & Partial<Record<"name" | "schedule", string>>

export const draftFromRecurring = (r: Recurring): RecurringDraft => ({
  name: r.name,
  sign: r.amountMinor < 0 ? "-" : "+",
  amount: toMajorFixed(r.amountMinor, r.currency),
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
export function RecurringFields({ draft, onChange, wallets, categories, tagSuggestions, errors }: { draft: RecurringDraft; onChange: (d: RecurringDraft) => void; wallets: Wallets; categories: Categories; tagSuggestions: ReadonlyArray<string>; errors: RecurringErrors }) {
  const set = <K extends keyof RecurringDraft>(key: K, value: RecurringDraft[K]) => onChange({ ...draft, [key]: value })
  return (
    <>
      <Field label="Name" htmlFor="name" error={errors.name}>
        <Input id="name" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Rent" invalid={errors.name !== undefined} autoFocus />
      </Field>
      <ChangeFields draft={draft} onChange={(patch) => onChange({ ...draft, ...patch })} wallets={wallets} categories={categories} errors={errors} amountHint="Tap the sign to switch between expense and income" />
      <Field label="Description" htmlFor="description">
        <Input id="description" value={draft.description} onChange={(e) => set("description", e.target.value)} placeholder="What is it?" />
      </Field>
      <TagsField value={draft.tags} onChange={(tags) => set("tags", tags)} suggestions={tagSuggestions} />
      <div>
        <Checkbox label="Auto: fire by itself on the due date" checked={draft.auto} onChange={(e) => set("auto", e.target.checked)} />
        <Text className="mt-1.5 text-sm text-grey-ink">Auto fires within the hour after 00:00 UTC on the due date, and the transaction is dated that day.</Text>
      </div>
      <SchedulePicker value={draft.schedule} onChange={(schedule) => set("schedule", schedule)} required={draft.auto} error={errors.schedule} />
    </>
  )
}

/** Reads the draft into a payload, or the errors to show. */
export const readRecurringDraft = (draft: RecurringDraft) => {
  const errors: RecurringErrors = {}
  if (draft.name.trim() === "") errors.name = "Give it a name"
  const change = readChangeDraft(draft)
  if (Either.isLeft(change)) Object.assign(errors, change.left)
  const schedule = schedulePayload(draft.schedule)
  if (Either.isLeft(schedule)) errors.schedule = schedule.left
  else if (draft.auto && schedule.right.cron === null && schedule.right.nextOn === null) errors.schedule = "Auto needs a schedule"
  if (Object.keys(errors).length > 0 || Either.isLeft(change) || Either.isLeft(schedule)) return Either.left(errors)
  const { currency: _currency, ...fields } = change.right
  return Either.right({ name: draft.name.trim(), ...fields, auto: draft.auto, cron: schedule.right.cron, nextOn: schedule.right.nextOn })
}

export function AddRecurringPage() {
  const navigate = useNavigate()
  const wallets = useWallets()
  const categories = useCategories()
  const tags = useTags()
  const create = useCreateRecurring()
  // Seeded into the first Wallet once the list is there; with no Wallet at all there is nothing to seed.
  const [draft, setDraft] = useDraft(wallets.data, ({ wallets: [first] }): RecurringDraft | null =>
    first ? { name: "", sign: "-", amount: "", currency: first.currency, walletId: first.id, categoryId: "", description: "", tags: [], auto: false, schedule: { ...emptySchedule(), kind: "monthly" } } : null
  )
  const [errors, setErrors] = useState<RecurringErrors>({})

  if (wallets.isPending || categories.isPending) {
    return (
      <FormPage title="Add recurring" backTo="/more">
        <QueryState of={[wallets, categories]} />
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
    const read = readRecurringDraft(draft)
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
  const [draft, setDraft] = useDraft(recurring.data, draftFromRecurring)
  const [errors, setErrors] = useState<RecurringErrors>({})
  const confirmDelete = useDeleteConfirm({
    remove,
    id: recurring.data?.id,
    title: `Delete ${recurring.data?.name ?? "this recurring"}?`,
    body: "The transactions it already recorded stay.",
    after: () => navigate("/more")
  })

  if (recurring.isPending || wallets.isPending || categories.isPending || draft === null) {
    return (
      <FormPage title="Edit recurring" backTo="/more">
        <QueryState of={[recurring, wallets, categories]} />
      </FormPage>
    )
  }
  const r = recurring.data!
  const submit = () => {
    const read = readRecurringDraft(draft)
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
      menu={[confirmDelete.menuItem]}
    >
      <RecurringFields draft={draft} onChange={setDraft} wallets={wallets.data?.wallets ?? []} categories={categories.data ?? []} tagSuggestions={tags.data ?? []} errors={errors} />
      {confirmDelete.dialog}
    </FormPage>
  )
}
