import { allCurrencies, type CurrencyCode, currencyExponent, type LocalDate, type MinorAmount, toMinor, type WalletId } from "@june/shared"
import { Trash } from "@phosphor-icons/react"
import { Either } from "effect"
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { useCreateWallet, useDeleteWallet, useMe, useUpdateWallet, useWallets } from "../../api/queries"
import { FormPage } from "../../layout/FormPage"
import { todayLocal } from "../../lib/period"
import { DateInput, Dialog, Field, Input, Loading, Select } from "../../ui"

const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" })

const CurrencyOptions = () => (
  <>
    {allCurrencies.map((c) => (
      <option key={c} value={c}>
        {c} · {currencyNames.of(c) ?? c}
      </option>
    ))}
  </>
)

export function AddWalletPage() {
  const navigate = useNavigate()
  const me = useMe()
  const create = useCreateWallet()
  const [name, setName] = useState("")
  const [currency, setCurrency] = useState<string>("")
  const [opening, setOpening] = useState("0")
  const [openingOn, setOpeningOn] = useState<LocalDate>(todayLocal())
  const [error, setError] = useState<string | null>(null)
  const effectiveCurrency = currency || me.data?.defaultCurrency || "USD"

  const submit = () => {
    if (name.trim() === "") return setError("Give the wallet a name")
    const minor = toMinor(Number(opening || "0"), effectiveCurrency)
    if (Either.isLeft(minor)) return setError(minor.left)
    setError(null)
    create.mutate(
      { name: name.trim(), currency: effectiveCurrency as CurrencyCode, initMinor: minor.right as MinorAmount, initOn: openingOn },
      { onSuccess: () => navigate("/settings") }
    )
  }

  return (
    <FormPage title="Add wallet" backTo="/settings" submitLabel="Create wallet" onSubmit={submit} busy={create.isPending} error={error ?? create.error?.message ?? null}>
      <Field label="Name" htmlFor="name">
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cash" autoFocus />
      </Field>
      <Field label="Currency" htmlFor="currency">
        <Select id="currency" value={effectiveCurrency} onChange={(e) => setCurrency(e.target.value)}>
          <CurrencyOptions />
        </Select>
      </Field>
      <Field label="Opening balance" htmlFor="opening">
        <Input id="opening" inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value.replace(",", "."))} className="font-mono font-bold" />
      </Field>
      <Field label="Balance as of" htmlFor="opening-on">
        <DateInput id="opening-on" value={openingOn} onChange={setOpeningOn} />
      </Field>
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
  const [name, setName] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  const [openingOn, setOpeningOn] = useState<LocalDate | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (wallet && name === null) {
      setName(wallet.name)
      setOpening((wallet.initMinor / 10 ** currencyExponent(wallet.currency)).toFixed(currencyExponent(wallet.currency)))
      setOpeningOn(wallet.initOn)
    }
  }, [wallet, name])

  if (!wallet || name === null || opening === null || openingOn === null) {
    return (
      <FormPage title="Edit wallet" backTo="/settings">
        <Loading />
      </FormPage>
    )
  }

  const submit = () => {
    if (name.trim() === "") return setError("Give the wallet a name")
    const minor = toMinor(Number(opening || "0"), wallet.currency)
    if (Either.isLeft(minor)) return setError(minor.left)
    setError(null)
    update.mutate(
      { id: wallet.id as WalletId, payload: { name: name.trim(), initMinor: minor.right as MinorAmount, initOn: openingOn } },
      { onSuccess: () => navigate("/settings") }
    )
  }

  return (
    <FormPage
      title="Edit wallet"
      backTo="/settings"
      submitLabel="Save wallet"
      onSubmit={submit}
      busy={update.isPending}
      error={error ?? update.error?.message ?? remove.error?.message ?? null}
      menu={[{ label: "Delete", icon: Trash, danger: true, onSelect: () => setConfirm(true) }]}
    >
      <Field label="Name" htmlFor="name">
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Currency" htmlFor="currency" hint="Fixed for the wallet's lifetime">
        <Select id="currency" value={wallet.currency} disabled>
          <CurrencyOptions />
        </Select>
      </Field>
      <Field label="Opening balance" htmlFor="opening" hint="The wallet's Init transaction">
        <Input id="opening" inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value.replace(",", "."))} className="font-mono font-bold" />
      </Field>
      <Field label="Balance as of" htmlFor="opening-on">
        <DateInput id="opening-on" value={openingOn} onChange={setOpeningOn} />
      </Field>
      <Dialog
        open={confirm}
        title={`Delete ${wallet.name}?`}
        body="Its transactions stay but lose their wallet; exchanges with other wallets become plain transactions there. The opening balance goes."
        confirmLabel="Delete"
        danger
        busy={remove.isPending}
        onConfirm={() => remove.mutate(wallet.id as WalletId, { onSuccess: () => navigate("/settings") })}
        onCancel={() => setConfirm(false)}
      />
    </FormPage>
  )
}
