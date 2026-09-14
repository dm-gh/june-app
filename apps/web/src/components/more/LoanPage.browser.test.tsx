import { page } from "vitest/browser"
import { beforeEach, expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"
import { Route, Routes } from "react-router"
import { endpoint } from "../../test/client.mock"
import { loan } from "../../test/fixtures"
import { mockQueries, Where } from "../../test/queries.mock"
import { LoanPage } from "./LoanPage"

vi.mock("../../api/client", async () => (await import("../../test/client.mock")).clientMock())

beforeEach(() => vi.clearAllMocks())

const lent = loan()
const open = () => {
  const { wrap } = mockQueries()
  return render(
    wrap(
      <Routes>
        <Route path="/more/loans/:id" element={<LoanPage />} />
        <Route path="*" element={<Where />} />
      </Routes>,
      [`/more/loans/${lent.id}`]
    )
  )
}
const openMenuAndDelete = async () => {
  await page.getByRole("button", { name: "Options" }).click()
  await page.getByRole("menuitem", { name: "Delete" }).click()
  await expect.element(page.getByRole("heading", { name: "Delete Alex · laptop?" })).toBeVisible()
}

test("a Lent Loan's page: its card, Settle, and the options menu behind a sticky Back bar", async () => {
  await open()
  await expect.element(page.getByRole("button", { name: "Settle" })).toBeVisible()
  await expect.element(page.elementLocator(document.body)).toMatchScreenshot("loan-page")
})

test("Delete from the menu asks first, naming the other party; Cancel keeps the Loan", async () => {
  await open()
  await openMenuAndDelete()
  await expect.element(page.elementLocator(document.body)).toMatchScreenshot("delete-dialog")
  await page.getByRole("button", { name: "Cancel" }).click()
  await expect.element(page.getByText("Delete Alex · laptop?")).not.toBeVisible()
  expect(endpoint("loans", "delete")).not.toHaveBeenCalled()
})

test("confirming deletes the Loan and returns to More", async () => {
  await open()
  await openMenuAndDelete()
  await page.getByRole("button", { name: "Delete" }).click()
  await expect.element(page.getByTestId("where")).toHaveTextContent("/more")
  expect(endpoint("loans", "delete")).toHaveBeenCalledWith({ path: { id: lent.id } })
})
