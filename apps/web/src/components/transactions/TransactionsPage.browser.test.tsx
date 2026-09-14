import { page } from "vitest/browser"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"
import { CurrencyCode, ExchangeId, MinorAmount, TransactionId } from "@june/shared"
import { transaction, wallets } from "../../test/fixtures"
import { mockQueries } from "../../test/queries.mock"
import { TransactionsPage } from "./TransactionsPage"

/** Day headings say Today and Yesterday relative to the clock, so the page is always rendered on the same day. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-09-14T12:00:00"))
})
afterEach(() => vi.useRealTimers())

const exchangeId = ExchangeId.make("99999999-9999-4999-8999-999999999999")
const leg = { type: "exchange" as const, exchangeId, categoryId: null, tags: [], description: "Top up cash" }
const legs = [
  transaction({ ...leg, id: TransactionId.make("88888888-8888-4888-8888-888888888881"), amountMinor: MinorAmount.make(-10000), currency: CurrencyCode.make("USD") }),
  transaction({ ...leg, id: TransactionId.make("88888888-8888-4888-8888-888888888882"), walletId: wallets.cash.id, amountMinor: MinorAmount.make(9200), currency: CurrencyCode.make("EUR") })
]

test("Transactions groups a Change and an Exchange under one day heading with the period and Filter row above", async () => {
  const { wrap } = mockQueries({ transactions: [transaction(), ...legs] })
  await render(wrap(<TransactionsPage />, ["/transactions"]))
  await expect.element(page.getByText("10 SEP")).toBeVisible()
  await expect.element(page.getByText("Weekly shop")).toBeVisible()
  await expect.element(page.getByText("Top up cash")).toBeVisible()
  await expect.element(page.elementLocator(document.body)).toMatchScreenshot("transactions-page")
})
