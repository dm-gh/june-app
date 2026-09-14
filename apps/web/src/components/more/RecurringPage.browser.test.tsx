import { page } from "vitest/browser"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"
import { Route, Routes } from "react-router"
import { endpoint } from "../../test/client.mock"
import { recurring } from "../../test/fixtures"
import { mockQueries, Where } from "../../test/queries.mock"
import { RecurringPage } from "./RecurringPage"

vi.mock("../../api/client", async () => (await import("../../test/client.mock")).clientMock())

/** The due state reads today's clock, so the page is always rendered on the same day. */
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-09-14T12:00:00"))
})
afterEach(() => vi.useRealTimers())

const rent = recurring()
const open = () => {
  const { wrap } = mockQueries()
  return render(
    wrap(
      <Routes>
        <Route path="/more/recurrings/:id" element={<RecurringPage />} />
        <Route path="*" element={<Where />} />
      </Routes>,
      [`/more/recurrings/${rent.id}`]
    )
  )
}
const openMenuAndDelete = async () => {
  await page.getByRole("button", { name: "Options" }).click()
  await page.getByRole("menuitem", { name: "Delete" }).click()
  await expect.element(page.getByRole("heading", { name: "Delete Rent?" })).toBeVisible()
}

test("an auto Recurring's page: its card, the Schedule with next and last dates, and Submit", async () => {
  await open()
  await expect.element(page.getByRole("button", { name: "Submit" })).toBeVisible()
  await expect.element(page.elementLocator(document.body)).toMatchScreenshot("recurring-page")
})

test("Delete from the menu asks first, naming the Recurring; Cancel keeps it", async () => {
  await open()
  await openMenuAndDelete()
  await page.getByRole("button", { name: "Cancel" }).click()
  await expect.element(page.getByText("Delete Rent?")).not.toBeVisible()
  expect(endpoint("recurrings", "delete")).not.toHaveBeenCalled()
})

test("confirming deletes the Recurring and returns to More", async () => {
  await open()
  await openMenuAndDelete()
  await page.getByRole("button", { name: "Delete" }).click()
  await expect.element(page.getByTestId("where")).toHaveTextContent("/more")
  expect(endpoint("recurrings", "delete")).toHaveBeenCalledWith({ path: { id: rent.id } })
})
