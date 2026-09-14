import { page } from "vitest/browser"
import { expect, test } from "vitest"
import { render } from "vitest-browser-react"

import { MemoryRouter } from "react-router"
import { useState } from "react"
import { Either } from "effect"
import { wallets } from "../../test/fixtures"
import { draftFromWallet, type WalletDraft, WalletFields, readWalletDraft } from "./WalletFormPage"

function Harness({ initial, mode }: { initial: WalletDraft; mode: "add" | "edit" }) {
  const [draft, setDraft] = useState(initial)
  return (
    <MemoryRouter>
      <div data-testid="form" className="flex flex-col gap-5 p-4">
        <WalletFields draft={draft} onChange={setDraft} mode={mode} />
      </div>
    </MemoryRouter>
  )
}

const card = draftFromWallet(wallets.card)

test("draftFromWallet reads the opening balance as unsigned text with its sign", () => {
  expect(card).toEqual({ name: "Card", currency: "USD", sign: "+", opening: "1000.00" })
  expect(draftFromWallet({ ...wallets.cash, initMinor: -250 as never })).toMatchObject({ sign: "-", opening: "2.50", currency: "EUR" })
})

test("readWalletDraft yields the create payload, the name trimmed, a blank balance as zero", () => {
  expect(readWalletDraft({ ...card, name: " Card " })).toEqual(Either.right({ name: "Card", currency: "USD", initMinor: 100000 }))
  expect(readWalletDraft({ ...card, opening: "" })).toMatchObject(Either.right({ initMinor: 0 }))
  expect(readWalletDraft({ ...card, sign: "-", opening: "12.5" })).toMatchObject(Either.right({ initMinor: -1250 }))
})

test("readWalletDraft asks for a name first, then passes toMinor's message through", () => {
  expect(readWalletDraft({ ...card, name: "  " })).toEqual(Either.left("Give the wallet a name"))
  expect(readWalletDraft({ ...card, opening: "1.005" })).toEqual(Either.left("USD allows at most 2 decimals"))
})

test("adding: a placeholder name, a free currency and the balance hint", async () => {
  await render(<Harness initial={{ name: "", currency: "USD", sign: "+", opening: "0" }} mode="add" />)
  await expect.element(page.getByLabelText("Currency")).toBeEnabled()
  await expect.element(page.getByTestId("form")).toMatchScreenshot("add")
})

test("editing: the currency is fixed and the balance is named as the Init", async () => {
  await render(<Harness initial={card} mode="edit" />)
  await expect.element(page.getByLabelText("Currency")).toBeDisabled()
  await expect.element(page.getByTestId("form")).toMatchScreenshot("edit")
})
