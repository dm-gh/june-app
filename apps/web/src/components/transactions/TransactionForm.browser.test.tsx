import { page } from "vitest/browser"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"
import { MemoryRouter } from "react-router"
import { useState } from "react"
import { MinorAmount } from "@june/shared"
import { categories, transaction, wallets } from "../../test/fixtures"
import { type ChangeDraft, draftFromTransaction } from "./changeDraft"
import { TransactionForm, type TransactionFormProps } from "./TransactionForm"

/** The Date field reads "Today" against the clock, so every screenshot is taken on the same day. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-09-14T12:00:00"))
})
afterEach(() => vi.useRealTimers())

type Props = Omit<TransactionFormProps, "draft" | "onChange">

function Harness({ initial, ...props }: Props & { initial: ChangeDraft }) {
  const [draft, setDraft] = useState(initial)
  return (
    <MemoryRouter>
      <div data-testid="form" className="flex flex-col gap-5 p-4">
        <TransactionForm draft={draft} onChange={setDraft} {...props} />
      </div>
    </MemoryRouter>
  )
}

const all = [wallets.card, wallets.cash]
const both = [categories.groceries, categories.salary]
const expense = draftFromTransaction(transaction())
const income = draftFromTransaction(transaction({ amountMinor: MinorAmount.make(240000), categoryId: categories.salary.id, description: "September", tags: [] as never }))

const form = (props: Partial<Props> & { initial?: ChangeDraft } = {}) =>
  render(<Harness initial={expense} wallets={all} categories={both} tagSuggestions={["food", "weekly", "home"]} mode="edit" {...props} />)

const subject = () => page.getByTestId("form")

test("an expense Change shows every field, with its Category picked from the expense list", async () => {
  await form()
  await expect.element(page.getByLabelText("Category")).toHaveValue(categories.groceries.id)
  await expect.element(subject()).toMatchScreenshot("expense")
})

test("an income Change flips the sign to green and picks from the income list", async () => {
  await form({ initial: income })
  await expect.element(page.getByLabelText("Category")).toHaveValue(categories.salary.id)
  await expect.element(subject()).toMatchScreenshot("income")
})

test("a currency no Wallet holds reads No wallet in EUR, and the errors sit under their fields", async () => {
  await form({ initial: { ...expense, amount: "", currency: "EUR", walletId: "" }, wallets: [wallets.card], errors: { amount: "Enter an amount", wallet: "Create a EUR wallet first" } })
  await expect.element(page.getByRole("option", { name: "No wallet in EUR" })).toBeInTheDocument()
  await expect.element(subject()).toMatchScreenshot("no-wallet")
})

test("an opening balance keeps its Wallet and currency and has no Category or Hidden flag", async () => {
  await form({ initial: draftFromTransaction(transaction({ type: "init", amountMinor: MinorAmount.make(100000), categoryId: null, description: "", tags: [] as never })), transactionType: "init" })
  await expect.element(page.getByLabelText("Wallet")).toBeDisabled()
  await expect.element(subject()).toMatchScreenshot("init")
})

test("an Exchange leg has a fixed sign", async () => {
  await form({ initial: { ...expense, categoryId: "" }, transactionType: "exchange" })
  await expect.element(page.getByRole("button", { name: "Expense, tap for income" })).toBeDisabled()
  await expect.element(subject()).toMatchScreenshot("exchange-leg")
})

test("flipping the sign clears the Category and swaps the list to the other Category Type", async () => {
  await form()
  await expect.element(page.getByRole("option", { name: "🥕 Groceries" })).toBeInTheDocument()
  await page.getByRole("button", { name: "Expense, tap for income" }).click()
  await expect.element(page.getByLabelText("Category")).toHaveValue("")
  await expect.element(page.getByRole("option", { name: "Salary" })).toBeInTheDocument()
  expect(page.getByRole("option", { name: "🥕 Groceries" }).elements()).toHaveLength(0)
})

test("changing the currency moves the Wallet to the first one in that currency", async () => {
  await form()
  await page.getByLabelText("Currency").selectOptions("EUR")
  await expect.element(page.getByLabelText("Wallet")).toHaveValue(wallets.cash.id)
  await expect.element(page.getByRole("option", { name: "Cash · EUR" })).toBeInTheDocument()
})

test("only currencies a Wallet holds can be chosen, plus the draft's own", async () => {
  await form({ initial: { ...expense, currency: "GBP", walletId: "" }, wallets: all })
  expect(page.getByLabelText("Currency").getByRole("option").elements().map((o) => o.textContent)).toEqual(["EUR", "GBP", "USD"])
})
