import { page } from "vitest/browser"
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"
import { MemoryRouter } from "react-router"
import { useState } from "react"
import { Either } from "effect"
import { categories, recurring, wallets } from "../../test/fixtures"
import { draftFromRecurring, type RecurringDraft, type RecurringErrors, RecurringFields, readRecurringDraft } from "./RecurringFormPage"

/** The Schedule preview names the next due date, so every screenshot is taken on the same day; the form is taller than a phone, so the viewport grows to hold it. */
beforeAll(() => page.viewport(390, 1400))
afterAll(() => page.viewport(390, 844))
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-09-14T12:00:00"))
})
afterEach(() => vi.useRealTimers())

function Harness({ initial, errors = {} }: { initial: RecurringDraft; errors?: RecurringErrors }) {
  const [draft, setDraft] = useState(initial)
  return (
    <MemoryRouter>
      <div data-testid="form" className="flex flex-col gap-5 p-4">
        <RecurringFields draft={draft} onChange={setDraft} wallets={[wallets.card, wallets.cash]} categories={[categories.groceries, categories.salary]} tagSuggestions={["home"]} errors={errors} />
      </div>
    </MemoryRouter>
  )
}

const rent = draftFromRecurring(recurring())
const form = (initial: RecurringDraft = rent, errors?: RecurringErrors) => render(<Harness initial={initial} {...(errors ? { errors } : {})} />)

test("draftFromRecurring reads the amount as unsigned text with its sign and the Schedule as a picker draft", () => {
  expect(rent).toMatchObject({ name: "Rent", sign: "-", amount: "1200.00", currency: "USD", walletId: wallets.card.id, categoryId: categories.groceries.id, description: "Flat on Elm street", tags: ["home"], auto: true })
  expect(rent.schedule).toMatchObject({ kind: "monthly", days: [1] })
})

test("readRecurringDraft yields the create payload, trimmed", () => {
  expect(readRecurringDraft({ ...rent, name: " Rent ", description: " Flat " })).toEqual(
    Either.right({ name: "Rent", walletId: wallets.card.id, amountMinor: -120000, categoryId: categories.groceries.id, description: "Flat", tags: ["home"], auto: true, cron: "0 0 1 * *", nextOn: null })
  )
})

test("readRecurringDraft names every missing piece by field", () => {
  expect(readRecurringDraft({ ...rent, name: " ", amount: "", currency: "EUR", walletId: "" })).toEqual(
    Either.left({ name: "Give it a name", amount: "Enter an amount", wallet: "Create a EUR wallet first" })
  )
  expect(readRecurringDraft({ ...rent, amount: "1.005" })).toEqual(Either.left({ amount: "USD allows at most 2 decimals" }))
  expect(readRecurringDraft({ ...rent, auto: true, schedule: { ...rent.schedule, kind: "none" } })).toEqual(Either.left({ schedule: "Auto needs a schedule" }))
  expect(readRecurringDraft({ ...rent, auto: false, schedule: { ...rent.schedule, kind: "none" } })).toMatchObject(Either.right({ auto: false, cron: null, nextOn: null }))
})

test("the fields of a Recurring: name first, then every Change field but the date, then Auto and the Schedule", async () => {
  await form()
  await expect.element(page.getByLabelText("Name")).toHaveValue("Rent")
  await expect.element(page.getByTestId("form")).toMatchScreenshot("fields")
})

test("errors sit under their fields", async () => {
  await form({ ...rent, name: "", amount: "", currency: "GBP", walletId: "" }, { name: "Give it a name", amount: "Enter an amount", wallet: "Create a GBP wallet first" })
  await expect.element(page.getByRole("option", { name: "No wallet in GBP" })).toBeInTheDocument()
  await expect.element(page.getByTestId("form")).toMatchScreenshot("errors")
})

test("flipping the sign clears the Category and swaps the list", async () => {
  await form()
  await page.getByRole("button", { name: "Expense, tap for income" }).click()
  await expect.element(page.getByLabelText("Category")).toHaveValue("")
  await expect.element(page.getByRole("option", { name: "Salary" })).toBeInTheDocument()
  expect(page.getByRole("option", { name: "🥕 Groceries" }).elements()).toHaveLength(0)
})

test("changing the currency moves the Wallet to the first one in that currency", async () => {
  await form()
  await page.getByLabelText("Currency").selectOptions("EUR")
  await expect.element(page.getByLabelText("Wallet")).toHaveValue(wallets.cash.id)
})
