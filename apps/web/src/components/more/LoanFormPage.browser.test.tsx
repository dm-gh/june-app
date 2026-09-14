import { page } from "vitest/browser"
import { expect, test } from "vitest"
import { render } from "vitest-browser-react"
import { MemoryRouter } from "react-router"
import { useState } from "react"
import { Either } from "effect"
import { MinorAmount } from "@june/shared"
import { loan } from "../../test/fixtures"
import { draftFromLoan, type LoanDraft, LoanFields, readLoanDraft } from "./LoanFormPage"

function Harness({ initial }: { initial: LoanDraft }) {
  const [draft, setDraft] = useState(initial)
  return (
    <MemoryRouter>
      <div data-testid="form" className="flex flex-col gap-5 p-4">
        <LoanFields draft={draft} onChange={setDraft} />
      </div>
    </MemoryRouter>
  )
}

const lent = draftFromLoan(loan())
const form = (initial: LoanDraft = lent) => render(<Harness initial={initial} />)

test("draftFromLoan reads the direction from the sign and the amount as unsigned text", () => {
  expect(lent).toEqual({ direction: "lent", amount: "500.00", currency: "USD", description: "Alex · laptop" })
  expect(draftFromLoan(loan({ amountMinor: MinorAmount.make(-12050) }))).toMatchObject({ direction: "borrowed", amount: "120.50" })
})

test("readLoanDraft signs the amount by direction and trims the description", () => {
  expect(readLoanDraft({ ...lent, description: " Alex " }, false)).toEqual(Either.right({ amountMinor: 50000, currency: "USD", description: "Alex" }))
  expect(readLoanDraft({ ...lent, direction: "borrowed" }, false)).toMatchObject(Either.right({ amountMinor: -50000 }))
})

test("readLoanDraft asks for an amount when creating, allows zero when editing, and passes toMinor's message through", () => {
  expect(readLoanDraft({ ...lent, amount: "" }, false)).toEqual(Either.left("Enter an amount"))
  expect(readLoanDraft({ ...lent, amount: "0" }, false)).toEqual(Either.left("Enter an amount"))
  expect(readLoanDraft({ ...lent, amount: "0.00" }, true)).toMatchObject(Either.right({ amountMinor: 0 }))
  expect(readLoanDraft({ ...lent, amount: "1.005" }, false)).toEqual(Either.left("USD allows at most 2 decimals"))
})

test("a Lent Loan: Lent selected, a green plus on the amount, the currency named", async () => {
  await form()
  await expect.element(page.getByRole("radio", { name: "Lent" })).toBeChecked()
  await expect.element(page.getByTestId("form")).toMatchScreenshot("lent")
})

test("a Borrowed Loan: Borrowed selected and a coral minus", async () => {
  await form(draftFromLoan(loan({ amountMinor: MinorAmount.make(-12050), description: "Mum · car repair" })))
  await expect.element(page.getByRole("radio", { name: "Borrowed" })).toBeChecked()
  await expect.element(page.getByTestId("form")).toMatchScreenshot("borrowed")
})

test("the sign button flips the direction and the segmented control follows, and back", async () => {
  await form()
  await page.getByRole("button", { name: "Income, tap for expense" }).click()
  await expect.element(page.getByRole("radio", { name: "Borrowed" })).toBeChecked()
  await expect.element(page.getByRole("button", { name: "Expense, tap for income" })).toBeVisible()
  await page.getByRole("radio", { name: "Lent" }).click()
  await expect.element(page.getByRole("button", { name: "Income, tap for expense" })).toBeVisible()
})

test("the currency select offers every ISO currency with its name", async () => {
  await form()
  await expect.element(page.getByRole("option", { name: "USD · US Dollar" })).toBeInTheDocument()
  await expect.element(page.getByRole("option", { name: "JPY · Japanese Yen" })).toBeInTheDocument()
})
