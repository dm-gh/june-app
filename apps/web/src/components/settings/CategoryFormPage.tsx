import { type CategoryId, type CategoryType, type Hue, type Slug, slugify } from "@june/shared"
import { Trash } from "@phosphor-icons/react"
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from "../../api/queries"
import { FormPage } from "../../layout/FormPage"
import { hueColor } from "../../lib/format"
import { Badge, Dialog, Field, HueSlider, Input, Loading, Segmented } from "../../ui"

interface Draft {
  type: CategoryType
  emoji: string
  name: string
  hue: number
}

function CategoryFields({ draft, onChange, slug, typeLocked }: { draft: Draft; onChange: (d: Draft) => void; slug: string; typeLocked: boolean }) {
  const label = `${draft.emoji ? `${draft.emoji} ` : ""}${draft.name || "Category"}`
  return (
    <>
      <Field label="Type" hint={typeLocked ? "Fixed once the category exists" : undefined}>
        <Segmented<CategoryType>
          options={[{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }]}
          value={draft.type}
          disabled={typeLocked}
          onChange={(type) => onChange({ ...draft, type })}
        />
      </Field>
      <div className="grid grid-cols-[4rem_1fr] gap-3">
        <Field label="Emoji" htmlFor="emoji">
          <Input id="emoji" value={draft.emoji} maxLength={4} onChange={(e) => onChange({ ...draft, emoji: e.target.value })} className="px-0 text-center text-xl" />
        </Field>
        <Field label="Name" htmlFor="name">
          <Input id="name" value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} placeholder="Transport" autoFocus />
        </Field>
      </div>
      <Field label="Slug" htmlFor="slug">
        <Input id="slug" value={slug} readOnly disabled className="font-mono" />
      </Field>
      <Field label="Colour" htmlFor="hue">
        <HueSlider id="hue" value={draft.hue} onChange={(hue) => onChange({ ...draft, hue })} />
      </Field>
      <Field label="Preview">
        <div className="flex items-center gap-3">
          <Badge style={{ background: hueColor(draft.hue) }}>{label}</Badge>
          <Badge className="h-5 px-1.5 text-[10px]" style={{ background: hueColor(draft.hue) }}>
            {label}
          </Badge>
          <span className="font-mono text-xs text-grey-ink">list · card tag</span>
        </div>
      </Field>
    </>
  )
}

export function AddCategoryPage() {
  const navigate = useNavigate()
  const create = useCreateCategory()
  const [draft, setDraft] = useState<Draft>({ type: "expense", emoji: "", name: "", hue: 200 })
  const slug = slugify(draft.name)
  const submit = () =>
    create.mutate(
      { type: draft.type, name: draft.name.trim(), emoji: draft.emoji.trim() || null, hue: draft.hue as Hue },
      { onSuccess: () => navigate("/settings") }
    )
  return (
    <FormPage title="Add category" backTo="/settings" submitLabel="Create category" onSubmit={submit} busy={create.isPending} canSubmit={slug.length > 0} error={create.error?.message ?? null}>
      <CategoryFields draft={draft} onChange={setDraft} slug={slug} typeLocked={false} />
    </FormPage>
  )
}

export function EditCategoryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const categories = useCategories()
  const update = useUpdateCategory()
  const remove = useDeleteCategory()
  const category = categories.data?.find((c) => c.id === id)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (category && draft === null) setDraft({ type: category.type, emoji: category.emoji ?? "", name: category.name, hue: category.hue })
  }, [category, draft])

  if (!category || draft === null) {
    return (
      <FormPage title="Edit category" backTo="/settings">
        <Loading />
      </FormPage>
    )
  }
  const submit = () =>
    update.mutate(
      {
        id: category.id as CategoryId,
        payload: { name: draft.name.trim(), emoji: draft.emoji.trim() || null, hue: draft.hue as Hue, slug: category.slug as Slug }
      },
      { onSuccess: () => navigate("/settings") }
    )
  return (
    <FormPage
      title="Edit category"
      backTo="/settings"
      submitLabel="Save category"
      onSubmit={submit}
      busy={update.isPending}
      canSubmit={draft.name.trim().length > 0}
      error={update.error?.message ?? remove.error?.message ?? null}
      menu={[{ label: "Delete", icon: Trash, danger: true, onSelect: () => setConfirm(true) }]}
    >
      <CategoryFields draft={draft} onChange={setDraft} slug={category.slug} typeLocked />
      <Dialog
        open={confirm}
        title={`Delete ${category.name}?`}
        body="Its transactions stay and become Uncategorised. A Shortcut still sending this slug records Uncategorised too."
        confirmLabel="Delete"
        danger
        busy={remove.isPending}
        onConfirm={() => remove.mutate(category.id as CategoryId, { onSuccess: () => navigate("/settings") })}
        onCancel={() => setConfirm(false)}
      />
    </FormPage>
  )
}
