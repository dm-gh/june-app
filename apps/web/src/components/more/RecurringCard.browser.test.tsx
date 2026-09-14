import { page } from "vitest/browser"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { LocalDate } from "@june/shared"
import { categories, recurring } from "../../test/fixtures"
import { RecurringCard, type RecurringCardProps } from "./RecurringCard"

/** dueState and the short date read today's date, so every screenshot is taken on the same day. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-09-14T12:00:00"))
})
afterEach(() => vi.useRealTimers())

const card = (props: Partial<RecurringCardProps> = {}) =>
  render(
    <MemoryRouter>
      <div className="p-4">
        <RecurringCard recurring={recurring()} category={categories.groceries} walletName="Card" {...props} />
      </div>
    </MemoryRouter>
  )

const article = () => page.getByRole("article")

test("an auto Recurring shows its name, Category, amount, Tags, Wallet and Schedule with the Auto badge", async () => {
  await card()
  await expect.element(page.getByText("Rent")).toBeVisible()
  await expect.element(article()).toMatchScreenshot("auto")
})

test("a manual Recurring carries Submit beside the amount and no Auto badge", async () => {
  await card({ recurring: recurring({ auto: false }), onSubmit: () => undefined })
  await expect.element(page.getByRole("button", { name: "Submit" })).toBeVisible()
  await expect.element(article()).toMatchScreenshot("manual")
})

test("a Recurring whose Wallet was deleted reads Needs a wallet in coral", async () => {
  await card({ walletName: null })
  await expect.element(page.getByText("Needs a wallet")).toBeVisible()
  await expect.element(article()).toMatchScreenshot("needs-wallet")
})

test("an Overdue Recurring says Due and, quietly in coral, how many days ago", async () => {
  await card({ recurring: recurring({ nextOn: LocalDate.make("2026-09-10") }) })
  await expect.element(page.getByText("4 days ago")).toBeVisible()
  await expect.element(article()).toMatchScreenshot("overdue")
})

test("a manual Recurring without a Schedule says No schedule", async () => {
  await card({ recurring: recurring({ auto: false, cron: null, nextOn: null, lastFiredOn: null }), onSubmit: () => undefined })
  await expect.element(page.getByText("No schedule")).toBeVisible()
  await expect.element(article()).toMatchScreenshot("no-schedule")
})

test("a Recurring without Tags keeps the Wallet on its own line", async () => {
  await card({ recurring: recurring({ tags: [] }) })
  await expect.element(page.getByText("Rent")).toBeVisible()
  await expect.element(article()).toMatchScreenshot("no-tags")
})

test("on its own page the card does not lift or point", async () => {
  await card({ interactive: false })
  await expect.element(page.getByText("Rent")).toBeVisible()
  await expect.element(article()).toMatchScreenshot("static")
})

function Probe() {
  return <div data-testid="location">{useLocation().pathname}</div>
}

const routed = (props: Partial<RecurringCardProps> = {}) =>
  render(
    <MemoryRouter initialEntries={["/more"]}>
      <Probe />
      <Routes>
        <Route path="/more" element={<RecurringCard recurring={recurring()} category={categories.groceries} walletName="Card" {...props} />} />
        <Route path="/more/recurrings/:id" element={null} />
      </Routes>
    </MemoryRouter>
  )

test("clicking the card in a list opens the Recurring's page", async () => {
  await routed()
  await article().click()
  await expect.element(page.getByTestId("location")).toHaveTextContent("/more/recurrings/66666666-6666-4666-8666-666666666666")
})

test("Submit fires the Recurring without opening its page", async () => {
  const onSubmit = vi.fn()
  await routed({ recurring: recurring({ auto: false }), onSubmit })
  await page.getByRole("button", { name: "Submit" }).click()
  expect(onSubmit).toHaveBeenCalledTimes(1)
  await expect.element(page.getByTestId("location")).toHaveTextContent("/more")
})

test("a static card ignores clicks", async () => {
  await routed({ interactive: false })
  await article().click()
  await expect.element(page.getByTestId("location")).toHaveTextContent("/more")
})
