import { page } from "vitest/browser"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"
import { mockQueries } from "../../test/queries.mock"
import { MorePage } from "./MorePage"

/** Due dates and short dates read today's clock, so the page is always rendered on the same day. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-09-14T12:00:00"))
})
afterEach(() => vi.useRealTimers())

test("More lists the Recurrings with their Category and Wallet, then the live Loans", async () => {
  const { wrap } = mockQueries()
  await render(wrap(<MorePage />, ["/more"]))
  await expect.element(page.getByText("Rent")).toBeVisible()
  await expect.element(page.getByText("Alex · laptop")).toBeVisible()
  await expect.element(page.elementLocator(document.body)).toMatchScreenshot("more-page")
})
