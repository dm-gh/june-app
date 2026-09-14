import { page } from "vitest/browser"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"
import { LocalDate } from "@june/shared"
import { DateInput } from "./DateInput"

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-09-14T12:00:00"))
})
afterEach(() => vi.useRealTimers())

const control = () => page.getByRole("button", { name: /Sep 2026/ })

test("today reads Today · with the long date", async () => {
  await render(<DateInput value={LocalDate.make("2026-09-14")} onChange={() => undefined} />)
  await expect.element(control()).toHaveTextContent("Today · 14 Sep 2026")
})

test("yesterday reads Yesterday · with the long date", async () => {
  await render(<DateInput value={LocalDate.make("2026-09-13")} onChange={() => undefined} />)
  await expect.element(control()).toHaveTextContent("Yesterday · 13 Sep 2026")
})

test("any other day is the long date alone", async () => {
  await render(<DateInput value={LocalDate.make("2026-09-10")} onChange={() => undefined} />)
  await expect.element(control()).toHaveTextContent("10 Sep 2026")
  await expect.element(control()).not.toHaveTextContent("·")
})

test("picking Yesterday from the sheet hands back yesterday's date", async () => {
  const onChange = vi.fn()
  await render(<DateInput value={LocalDate.make("2026-09-10")} onChange={onChange} />)
  await control().click()
  await page.getByRole("button", { name: "Yesterday" }).click()
  expect(onChange).toHaveBeenCalledWith("2026-09-13")
})
