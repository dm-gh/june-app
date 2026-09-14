import { page } from "vitest/browser"
import { expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"
import { MemoryRouter } from "react-router"
import type { ReactNode } from "react"
import { CurrencyCode, ExchangeId, MinorAmount, TransactionId } from "@june/shared"
import { categories, transaction, wallets } from "../../test/fixtures"
import { TransactionCard, type TransactionCardProps } from "./TransactionCard"
import type { ListItem } from "./listItems"

const walletName = (id: string | null) => (id === wallets.card.id ? "Card" : id === wallets.cash.id ? "Cash" : null)

const single = (over: Parameters<typeof transaction>[0] = {}): ListItem => ({ kind: "single", transaction: transaction(over) })

const minor = MinorAmount.make
const exchangeId = ExchangeId.make("99999999-9999-4999-8999-999999999999")
const leg = { type: "exchange" as const, exchangeId, categoryId: null, tags: [], description: "Top up cash" }
const exchange: ListItem = {
  kind: "exchange",
  source: transaction({ ...leg, id: TransactionId.make("88888888-8888-4888-8888-888888888881"), amountMinor: minor(-10000), currency: CurrencyCode.make("USD") }),
  target: transaction({ ...leg, id: TransactionId.make("88888888-8888-4888-8888-888888888882"), walletId: wallets.cash.id, amountMinor: minor(9200), currency: CurrencyCode.make("EUR") })
}

async function card(props: Partial<TransactionCardProps> & { item: ListItem }, wrap: (node: ReactNode) => ReactNode = (node) => node) {
  return render(
    <MemoryRouter>
      {wrap(
        <div className="p-4">
          <TransactionCard category={categories.groceries} walletName={walletName} onOpen={() => undefined} {...props} />
        </div>
      )}
    </MemoryRouter>
  )
}

const article = () => page.getByRole("article")

test("a Change shows its Category in the corner, the amount, the Tags and the Wallet", async () => {
  await card({ item: single() })
  await expect.element(page.getByText("Weekly shop")).toBeVisible()
  await expect.element(article()).toMatchScreenshot("change")
})

test("an income Change reads green with its income Category", async () => {
  await card({ item: single({ amountMinor: minor(240000), categoryId: categories.salary.id, description: "September", tags: [] }), category: categories.salary })
  await expect.element(page.getByText("September")).toBeVisible()
  await expect.element(article()).toMatchScreenshot("income")
})

test("a Transaction Hidden from analysis is greyed out but keeps its Category", async () => {
  await card({ item: single({ hiddenFromAnalysis: true }) })
  await expect.element(page.getByText("Weekly shop")).toBeVisible()
  await expect.element(article()).toMatchScreenshot("hidden")
})

test("an Uncategorised Change has no corner tag", async () => {
  await card({ item: single({ categoryId: null }), category: undefined })
  await expect.element(page.getByText("Weekly shop")).toBeVisible()
  await expect.element(article()).toMatchScreenshot("uncategorised")
})

test("an Unassigned Change shows a muted Unassigned where the Wallet would be", async () => {
  await card({ item: single({ walletId: null, currency: CurrencyCode.make("PLN"), amountMinor: minor(-4500) }) })
  await expect.element(page.getByText("Unassigned")).toBeVisible()
  await expect.element(article()).toMatchScreenshot("unassigned")
})

test("an Init reads Opening balance in a muted corner", async () => {
  await card({ item: single({ type: "init", amountMinor: minor(100000), categoryId: null, description: "", tags: [] }), category: undefined })
  await expect.element(page.getByText("Opening balance")).toBeVisible()
  await expect.element(article()).toMatchScreenshot("init")
})

test("an Exchange is one card with both amounts and From → To", async () => {
  await card({ item: exchange, category: undefined })
  await expect.element(page.getByText("Top up cash")).toBeVisible()
  await expect.element(article()).toMatchScreenshot("exchange")
})

test("while selecting, an unselected card shows an empty checkbox in its corner", async () => {
  await card({ item: single(), selectable: { selecting: true, selected: false, onToggle: () => undefined, onLongPress: () => undefined } })
  await expect.element(article()).toHaveAttribute("aria-selected", "false")
  await expect.element(article()).toMatchScreenshot("selecting-unselected")
})

test("while selecting, a selected card shows a ticked accent checkbox", async () => {
  await card({ item: single(), selectable: { selecting: true, selected: true, onToggle: () => undefined, onLongPress: () => undefined } })
  await expect.element(article()).toHaveAttribute("aria-selected", "true")
  await expect.element(article()).toMatchScreenshot("selecting-selected")
})

const long = {
  description: "Monthly subscription for the streaming service that the whole household shares and nobody remembers to cancel",
  category: { ...categories.groceries, name: "Household and personal care supplies", emoji: "🧴" }
}

test("a long description wraps and a long Category name truncates under the corner at phone width", async () => {
  await card({ item: single({ description: long.description }), category: long.category })
  await expect.element(page.getByText(long.description)).toBeVisible()
  await expect.element(article()).toMatchScreenshot("long-phone")
})

test("in a wider container the amount and the long Category share the top line", async () => {
  await page.viewport(640, 844)
  try {
    await card({ item: single({ description: long.description }), category: long.category }, (node) => <div style={{ width: 640 }}>{node}</div>)
    await expect.element(page.getByText(long.description)).toBeVisible()
    await expect.element(article()).toMatchScreenshot("long-wide")
  } finally {
    await page.viewport(390, 844)
  }
})

test("a click opens the Transaction; while selecting it toggles instead", async () => {
  const onOpen = vi.fn()
  const onToggle = vi.fn()
  const idle = { selecting: false, selected: false, onToggle, onLongPress: () => undefined }
  const screen = await card({ item: single(), onOpen, selectable: idle })
  await article().click()
  expect(onOpen).toHaveBeenCalledTimes(1)
  expect(onToggle).not.toHaveBeenCalled()

  await screen.rerender(
    <MemoryRouter>
      <div className="p-4">
        <TransactionCard
          item={single()}
          category={categories.groceries}
          walletName={walletName}
          onOpen={onOpen}
          selectable={{ ...idle, selecting: true }}
        />
      </div>
    </MemoryRouter>
  )
  await article().click()
  expect(onToggle).toHaveBeenCalledTimes(1)
  expect(onOpen).toHaveBeenCalledTimes(1)
})
