import { page } from "vitest/browser"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"
import { Route, Routes } from "react-router"
import { endpoint } from "../../test/client.mock"
import { loan, recurring } from "../../test/fixtures"
import { mockQueries, Where } from "../../test/queries.mock"
import { AddTransactionPage, addTransactionFor, prefillFrom } from "./AddTransactionPage"

vi.mock("../../api/client", async () => (await import("../../test/client.mock")).clientMock())

/** Settling is dated today, so the page is always rendered on the same day. */
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-09-14T12:00:00"))
})
afterEach(() => vi.useRealTimers())

const lent = loan()
const rent = recurring()

test("addTransactionFor writes the query string that prefillFrom reads back; plain Add carries nothing", () => {
  expect(addTransactionFor({ loan: lent.id })).toBe(`/transactions/new?loan=${lent.id}`)
  expect(addTransactionFor({ recurring: rent.id })).toBe(`/transactions/new?recurring=${rent.id}`)
  expect(prefillFrom(new URLSearchParams(addTransactionFor({ loan: lent.id }).split("?")[1]))).toEqual({ loan: lent.id })
  expect(prefillFrom(new URLSearchParams(addTransactionFor({ recurring: rent.id }).split("?")[1]))).toEqual({ recurring: rent.id })
  expect(prefillFrom(new URLSearchParams("type=exchange"))).toBeNull()
})
const open = (search: string) => {
  const { wrap } = mockQueries()
  return render(
    wrap(
      <Routes>
        <Route path="/transactions/new" element={<AddTransactionPage />} />
        <Route path="*" element={<Where />} />
      </Routes>,
      [`/transactions/new${search}`]
    )
  )
}

test("reached from a Loan: titled Settle, the remaining amount signed toward zero, Hidden on, no type toggle, and a Settle button", async () => {
  await open(`?loan=${lent.id}`)
  await expect.element(page.getByRole("heading", { name: "Settle Alex · laptop" })).toBeVisible()
  await expect.element(page.getByLabelText("Amount")).toHaveValue("500.00")
  await expect.element(page.getByRole("checkbox", { name: "Hide from analysis" })).toBeChecked()
  await expect.element(page.getByRole("button", { name: "Settle" })).toBeVisible()
  expect(page.getByRole("radio", { name: "Exchange" }).elements()).toHaveLength(0)
  await expect.element(page.elementLocator(document.body)).toMatchScreenshot("settle-loan")
})

test("reached from a Recurring: titled Submit, the Recurring's fields dated its due date, and a Submit button", async () => {
  await open(`?recurring=${rent.id}`)
  await expect.element(page.getByRole("heading", { name: "Submit Rent" })).toBeVisible()
  await expect.element(page.getByLabelText("Amount")).toHaveValue("1200.00")
  await expect.element(page.getByLabelText("Date")).toHaveTextContent("1 Oct 2026")
  await expect.element(page.getByLabelText("Description")).toHaveValue("Flat on Elm street")
  await expect.element(page.getByRole("button", { name: "Submit" })).toBeVisible()
  await expect.element(page.elementLocator(document.body)).toMatchScreenshot("submit-recurring")
})

test("saving from a Loan settles it with the Change and returns to the Loan's page", async () => {
  await open(`?loan=${lent.id}`)
  await page.getByRole("button", { name: "Settle" }).click()
  await expect.element(page.getByTestId("where")).toHaveTextContent(`/more/loans/${lent.id}`)
  expect(endpoint("loans", "settle")).toHaveBeenCalledWith({
    path: { id: lent.id },
    payload: { change: expect.objectContaining({ amountMinor: 50000, currency: "USD", occurredOn: "2026-09-14", hiddenFromAnalysis: true, description: "Alex · laptop" }) }
  })
  expect(endpoint("transactions", "createChange")).not.toHaveBeenCalled()
  expect(endpoint("recurrings", "fire")).not.toHaveBeenCalled()
})
