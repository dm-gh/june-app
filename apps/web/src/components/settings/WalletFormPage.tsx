import { type CurrencyCode, type MinorAmount, toMajorFixed, type Wallet, type WalletId } from "@june/shared"
import { Either } from "effect"
import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import { useCreateWallet, useDeleteWallet, useMe, useUpdateWallet, useWallets } from "../../api/queries"
import { FormPage } from "../../layout/FormPage"
import { useDeleteConfirm } from "../../layout/useDeleteConfirm"
import { routes } from "../../routes"
import { CurrencySelect, Field, Input, Loading, useDraft } from "../../ui"
import { AmountInput } from "../../ui/AmountInput"
import { readAmount, type Sign } from "../transactions/changeDraft"

/** What the Wallet form edits: the opening balance as unsigned text and a sign, like every amount. */
export interface WalletDraft {
  name: string
  currency: string
  sign: Sign
  opening: string
}

export const draftFromWallet = (w: Wallet): WalletDraft => ({
  name: w.name,
  currency: w.currency,
  sign: w.initMinor < 0 ? "-" : "+",
  opening: toMajorFixed(w.initMinor, w.currency)
})

/** The name and the opening balance, or the one message to show. Zero is fine, and a blank reads as zero. */
export const readWalletDraft = (draft: WalletDraft): Either.Either<{ name: string; currency: CurrencyCode; initMinor: MinorAmount }, string> => {
  if (draft.name.trim() === "") return Either.left("Give the wallet a name")
  return Either.map(readAmount(draft.sign, draft.opening || "0", draft.currency, { allowZero: true }), (initMinor) => ({
    name: draft.name.trim(),
    currency: draft.currency as CurrencyCode,
    initMinor
  }))
}

/** Name, currency and opening balance. Once created, a Wallet's currency is fixed for its lifetime. */
export function WalletFields({ draft, onChange, mode }: { draft: WalletDraft; onChange: (d: WalletDraft) => void; mode: "add" | "edit" }) {
  const set = <K extends keyof WalletDraft>(key: K, value: WalletDraft[K]) => onChange({ ...draft, [key]: value })
  const adding = mode === "add"
  return (
    <>
      <Field label="Name" htmlFor="name">
        <Input id="name" value={draft.name} onChange={(e) => set("name", e.target.value)} {...(adding ? { placeholder: "Cash", autoFocus: true } : {})} />
      </Field>
      <Field label="Currency" htmlFor="currency" hint={adding ? undefined : "Fixed for the wallet's lifetime"}>
        <CurrencySelect id="currency" value={draft.currency} disabled={!adding} onChange={(currency) => set("currency", currency)} />
      </Field>
      <Field label="Opening balance" htmlFor="opening" hint={adding ? "Tap the sign for a balance below zero" : "The wallet's Init transaction. Tap the sign for a balance below zero"}>
        <AmountInput id="opening" value={draft.opening} onChange={(opening) => set("opening", opening)} sign={draft.sign} onSignChange={(sign) => set("sign", sign)} />
      </Field>
    </>
  )
}

export function AddWalletPage() {
  const navigate = useNavigate()
  const me = useMe()
  const create = useCreateWallet()
  const [draft, setDraft] = useState<WalletDraft>({ name: "", currency: "", sign: "+", opening: "0" })
  const [error, setError] = useState<string | null>(null)
  const effective = { ...draft, currency: draft.currency || me.data?.defaultCurrency || "USD" }

  const submit = () => {
    const read = readWalletDraft(effective)
    if (Either.isLeft(read)) return setError(read.left)
    setError(null)
    create.mutate(read.right, { onSuccess: () => navigate(routes.settings) })
  }

  return (
    <FormPage title="Add wallet" backTo={routes.settings} submitLabel="Create wallet" onSubmit={submit} busy={create.isPending} error={error ?? create.error?.message ?? null}>
      <WalletFields draft={effective} onChange={setDraft} mode="add" />
    </FormPage>
  )
}

export function EditWalletPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const wallets = useWallets()
  const update = useUpdateWallet()
  const remove = useDeleteWallet()
  const wallet = wallets.data?.wallets.find((w) => w.id === id)
  const [draft, setDraft] = useDraft(wallet, draftFromWallet)
  const [error, setError] = useState<string | null>(null)
  const confirmDelete = useDeleteConfirm({
    remove,
    id: wallet ? (wallet.id as WalletId) : undefined,
    title: `Delete ${wallet?.name ?? "this wallet"}?`,
    body: "Its transactions stay but lose their wallet; exchanges with other wallets become plain transactions there. The opening balance goes.",
    after: () => navigate(routes.settings)
  })

  if (!wallet || draft === null) {
    return (
      <FormPage title="Edit wallet" backTo={routes.settings}>
        <Loading />
      </FormPage>
    )
  }

  const submit = () => {
    const read = readWalletDraft(draft)
    if (Either.isLeft(read)) return setError(read.left)
    setError(null)
    const { name, initMinor } = read.right
    update.mutate({ id: wallet.id as WalletId, payload: { name, initMinor } }, { onSuccess: () => navigate(routes.settings) })
  }

  return (
    <FormPage
      title="Edit wallet"
      backTo={routes.settings}
      submitLabel="Save wallet"
      onSubmit={submit}
      busy={update.isPending}
      error={error ?? update.error?.message ?? remove.error?.message ?? null}
      menu={[confirmDelete.menuItem]}
    >
      <WalletFields draft={draft} onChange={setDraft} mode="edit" />
      {confirmDelete.dialog}
    </FormPage>
  )
}
