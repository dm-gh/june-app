import { type Category, type CategoryId, type CategoryType, type Hue, type Slug, slugify } from "@june/shared"
import { lazy, Suspense, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from "../../api/queries"
import { FormPage } from "../../layout/FormPage"
import { useDeleteConfirm } from "../../layout/useDeleteConfirm"
import { categoryLabel, hueColor } from "../../lib/format"
import { routes } from "../../routes"
import { Field, HueSlider, Input, Loading, Segmented, Sheet, useDraft } from "../../ui"
import { FitText } from "../../ui/FitText"

const EmojiPicker = lazy(() => import("emoji-picker-react"))

const NAME_MAX = 25

interface Draft {
  type: CategoryType
  emoji: string
  name: string
  hue: number
}

const draftFromCategory = (c: Category): Draft => ({ type: c.type, emoji: c.emoji ?? "", name: c.name, hue: c.hue })

const segmenter = new Intl.Segmenter()
/** Exactly one grapheme, and a pictographic one: "🚌" yes, "ab" or "🚌🚌" no. */
const isSingleEmoji = (s: string): boolean => [...segmenter.segment(s)].length === 1 && /\p{Extended_Pictographic}/u.test(s)

/** The title doubles as the preview: "Add" followed by the very badge a Transaction card will wear. */
function TitlePreview({ verb, draft }: { verb: "Add" | "Edit"; draft: Draft }) {
  const name = draft.name.trim()
  return (
    <FitText max={30} min={16} maxLines={2} className="leading-normal">
      {verb}{" "}
      {name ? (
        <span
          className="inline border-3 border-ink px-2 py-0.5 font-heading text-[0.8em] font-bold tracking-wide uppercase"
          style={{ background: hueColor(draft.hue), boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}
        >
          {categoryLabel({ name, emoji: draft.emoji })}
        </span>
      ) : (
        "category"
      )}
    </FitText>
  )
}

function CategoryFields({ draft, onChange, slug, typeLocked }: { draft: Draft; onChange: (d: Draft) => void; slug: string; typeLocked: boolean }) {
  const [picking, setPicking] = useState(false)
  return (
    <>
      <Field label="Type">
        <Segmented<CategoryType>
          options={[{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }]}
          value={draft.type}
          disabled={typeLocked}
          onChange={(type) => onChange({ ...draft, type })}
        />
      </Field>
      <div className="grid grid-cols-[4rem_1fr] gap-3">
        <Field label="Emoji" htmlFor="emoji">
          <button
            id="emoji"
            type="button"
            aria-label={draft.emoji ? `Emoji ${draft.emoji}, tap to change` : "Pick an emoji"}
            onClick={() => setPicking(true)}
            className="h-11 w-full border-3 border-ink bg-white text-2xl leading-none shadow-hard-sm lift"
          >
            {draft.emoji || <span className="text-base text-grey-ink">?</span>}
          </button>
        </Field>
        <Field label="Name" htmlFor="name" hint={draft.name.length >= NAME_MAX ? `${NAME_MAX} characters at most` : undefined}>
          <Input id="name" value={draft.name} maxLength={NAME_MAX} onChange={(e) => onChange({ ...draft, name: e.target.value })} placeholder="Transport" autoFocus />
        </Field>
      </div>
      <Field label="Slug" htmlFor="slug">
        <Input id="slug" value={slug} readOnly disabled className="font-mono" />
      </Field>
      <Field label="Colour" htmlFor="hue">
        <HueSlider id="hue" value={draft.hue} onChange={(hue) => onChange({ ...draft, hue })} />
      </Field>
      <Sheet open={picking} title="Emoji" onClose={() => setPicking(false)}>
        {picking ? (
          <Suspense fallback={<Loading />}>
            <EmojiPicker
              className="june-emoji"
              width="100%"
              height={420}
              emojiStyle={"native" as never}
              previewConfig={{ showPreview: false }}
              skinTonesDisabled
              onEmojiClick={(e) => {
                if (isSingleEmoji(e.emoji)) onChange({ ...draft, emoji: e.emoji })
                setPicking(false)
              }}
            />
          </Suspense>
        ) : null}
      </Sheet>
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
      { type: draft.type, name: draft.name.trim(), emoji: draft.emoji || null, hue: draft.hue as Hue },
      { onSuccess: () => navigate(routes.settings) }
    )
  return (
    <FormPage
      title={<TitlePreview verb="Add" draft={draft} />}
      backTo={routes.settings}
      submitLabel="Create category"
      onSubmit={submit}
      busy={create.isPending}
      canSubmit={slug.length > 0}
      error={create.error?.message ?? null}
    >
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
  const [draft, setDraft] = useDraft(category, draftFromCategory)
  const confirmDelete = useDeleteConfirm({
    remove,
    id: category ? (category.id as CategoryId) : undefined,
    title: `Delete ${category?.name ?? "this category"}?`,
    body: "Its transactions stay and become Uncategorised. A Shortcut still sending this slug records Uncategorised too.",
    after: () => navigate(routes.settings)
  })

  if (!category || draft === null) {
    return (
      <FormPage title="Edit category" backTo={routes.settings}>
        <Loading />
      </FormPage>
    )
  }
  const submit = () =>
    update.mutate(
      {
        id: category.id as CategoryId,
        payload: { name: draft.name.trim(), emoji: draft.emoji || null, hue: draft.hue as Hue, slug: category.slug as Slug }
      },
      { onSuccess: () => navigate(routes.settings) }
    )
  return (
    <FormPage
      title={<TitlePreview verb="Edit" draft={draft} />}
      backTo={routes.settings}
      submitLabel="Save category"
      onSubmit={submit}
      busy={update.isPending}
      canSubmit={draft.name.trim().length > 0}
      error={update.error?.message ?? remove.error?.message ?? null}
      menu={[confirmDelete.menuItem]}
    >
      <CategoryFields draft={draft} onChange={setDraft} slug={category.slug} typeLocked />
      {confirmDelete.dialog}
    </FormPage>
  )
}
