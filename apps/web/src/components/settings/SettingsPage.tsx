import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { allCurrencies, type Category, type CurrencyCode, type Wallet, type WalletId } from "@june/shared"
import { DotsSixVertical } from "@phosphor-icons/react"
import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"
import { signOut } from "../../api/auth"
import { useCategories, useMe, useRegenerateCaptureToken, useReorderWallets, useSetDefaultCurrency, useWallets } from "../../api/queries"
import { AppShell } from "../../layout/AppShell"
import { hueColor, moneyCode } from "../../lib/format"
import { Button, Card, Dialog, Display, ErrorNotice, Field, Heading, Input, Label, Loading, Select, Text } from "../../ui"

const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" })

function WalletRow({ wallet, index }: { wallet: Wallet; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: wallet.id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? "z-10 opacity-90" : undefined}>
      <Card className="flex items-center gap-3 p-3">
        <span className="w-4 font-mono text-sm text-grey-ink">{index + 1}</span>
        <Link to={`/settings/wallets/${wallet.id}`} className="min-w-0 flex-1">
          <div className="truncate font-heading font-bold">{wallet.name}</div>
          <div className="font-mono text-xs text-grey-ink">{wallet.currency}</div>
        </Link>
        <span className="font-mono text-sm font-bold tabular-nums">{moneyCode(wallet.balanceMinor, wallet.currency)}</span>
        <button type="button" aria-label="Drag to reorder" className="cursor-grab touch-none p-1 active:cursor-grabbing" {...attributes} {...listeners}>
          <DotsSixVertical size={22} weight="bold" />
        </button>
      </Card>
    </div>
  )
}

function CategoryRow({ category }: { category: Category }) {
  return (
    <Link to={`/settings/categories/${category.id}`} className="block">
      <Card className="flex items-center gap-3 p-3 lift">
        <span className="flex size-8 items-center justify-center border-2 border-ink text-lg" style={{ background: hueColor(category.hue) }}>
          {category.emoji ?? ""}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-heading font-bold">{category.name}</div>
          <div className="font-mono text-xs text-grey-ink">{category.slug}</div>
        </div>
      </Card>
    </Link>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const me = useMe()
  const wallets = useWallets()
  const categories = useCategories()
  const reorder = useReorderWallets()
  const setCurrency = useSetDefaultCurrency()
  const regenerate = useRegenerateCaptureToken()
  const [order, setOrder] = useState<Array<Wallet>>([])
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
  const [issued, setIssued] = useState<{ token: string; captureUrl: string } | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  useEffect(() => {
    if (wallets.data) setOrder([...wallets.data.wallets])
  }, [wallets.data])

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = order.findIndex((w) => w.id === active.id)
    const to = order.findIndex((w) => w.id === over.id)
    const next = arrayMove(order, from, to)
    setOrder(next)
    reorder.mutate(next.map((w) => w.id as WalletId))
  }

  const expense = (categories.data ?? []).filter((c) => c.type === "expense")
  const income = (categories.data ?? []).filter((c) => c.type === "income")

  return (
    <AppShell>
      <Display size="sm" className="mb-5">
        Settings
      </Display>

      <div className="flex items-center justify-between">
        <Heading as="h2">Wallets</Heading>
        <Button variant="secondary" size="sm" onClick={() => navigate("/settings/wallets/new")}>
          + Add
        </Button>
      </div>
      <Text className="mt-1 mb-3 text-sm text-grey-ink">Order matters: a Shortcut capture lands in the first wallet whose currency matches.</Text>
      {wallets.isPending ? <Loading /> : null}
      {reorder.isError ? <ErrorNotice message={reorder.error.message} /> : null}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order.map((w) => w.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3">
            {order.map((w, i) => (
              <WalletRow key={w.id} wallet={w} index={i} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="mt-8 flex items-center justify-between">
        <Heading as="h2">Categories</Heading>
        <Button variant="secondary" size="sm" onClick={() => navigate("/settings/categories/new")}>
          + Add
        </Button>
      </div>
      {categories.isPending ? <Loading /> : null}
      <Label as="h3" className="mt-3 mb-2 block text-grey-ink">
        Expense
      </Label>
      <div className="flex flex-col gap-3">
        {expense.map((c) => (
          <CategoryRow key={c.id} category={c} />
        ))}
      </div>
      <Label as="h3" className="mt-4 mb-2 block text-grey-ink">
        Income
      </Label>
      <div className="flex flex-col gap-3">
        {income.map((c) => (
          <CategoryRow key={c.id} category={c} />
        ))}
      </div>

      <Field label="Default currency" htmlFor="default-currency" className="mt-8" hint="Everything in analysis is converted into this currency" error={setCurrency.error?.message}>
        <Select
          id="default-currency"
          value={me.data?.defaultCurrency ?? "USD"}
          disabled={me.isPending || setCurrency.isPending}
          onChange={(e) => setCurrency.mutate(e.target.value as CurrencyCode)}
        >
          {allCurrencies.map((c) => (
            <option key={c} value={c}>
              {c} · {currencyNames.of(c) ?? c}
            </option>
          ))}
        </Select>
      </Field>

      <Heading as="h2" className="mt-8 mb-3">
        Shortcut
      </Heading>
      <Card accent="sky">
        <Text className="text-sm">Generates an Apple Shortcut with your categories baked in. Run it from the home screen to capture a transaction in one tap.</Text>
        <Label as="div" className="mt-4 mb-1.5">
          Capture token
        </Label>
        {issued ? (
          <>
            <Input readOnly value={issued.captureUrl} onFocus={(e) => e.target.select()} className="font-mono text-sm" />
            <Text className="mt-2 font-mono text-xs">Shown once. Copy the URL into your Shortcut now.</Text>
          </>
        ) : (
          <div className="flex gap-2">
            <Input readOnly value={me.data?.hasCaptureToken ? "jn_••••••••••••••••" : "No token yet"} className="font-mono" />
            <Button variant="danger" onClick={() => setConfirmRegenerate(true)} disabled={regenerate.isPending}>
              Regenerate
            </Button>
          </div>
        )}
        <Button className="mt-3 w-full" disabled title="Shortcut file generation is not built yet">
          Download Shortcut
        </Button>
        <Text className="mt-2 font-mono text-xs text-coral-ink">Regenerating invalidates every installed Shortcut.</Text>
        {regenerate.isError ? <ErrorNotice message={regenerate.error.message} /> : null}
      </Card>

      <div className="mt-8 mb-8">
        <div className="font-mono text-xs text-grey-ink">Signed in as {me.data?.email ?? "…"}</div>
        <button type="button" onClick={() => signOut().then(() => navigate("/sign-in"))} className="mt-2 font-heading font-bold hover:underline">
          Sign out
        </button>
      </div>

      <Dialog
        open={confirmRegenerate}
        title="Regenerate the capture token?"
        body="Every Shortcut already installed stops working until it is generated again with the new token."
        confirmLabel="Regenerate"
        danger
        busy={regenerate.isPending}
        onConfirm={() =>
          regenerate.mutate(undefined, {
            onSuccess: (result) => {
              setIssued(result)
              setConfirmRegenerate(false)
            }
          })
        }
        onCancel={() => setConfirmRegenerate(false)}
      />
    </AppShell>
  )
}
