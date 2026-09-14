import { page } from "vitest/browser"
import { expect, test } from "vitest"
import { render } from "vitest-browser-react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { CurrencyCode, MinorAmount } from "@june/shared"
import { loan } from "../../test/fixtures"
import { LoanCard, type LoanCardProps } from "./LoanCard"

const card = (props: Partial<LoanCardProps> = {}) =>
  render(
    <MemoryRouter>
      <div className="p-4">
        <LoanCard loan={loan()} {...props} />
      </div>
    </MemoryRouter>
  )

const article = () => page.getByRole("article")

test("a Lent Loan shows the other party, a green Lent tag and a green amount", async () => {
  await card()
  await expect.element(page.getByText("Lent")).toBeVisible()
  await expect.element(article()).toMatchScreenshot("lent")
})

test("a Borrowed Loan shows a coral Borrowed tag and a coral amount without a sign", async () => {
  await card({ loan: loan({ amountMinor: MinorAmount.make(-12050), currency: CurrencyCode.make("EUR"), description: "Mum · car repair" }) })
  await expect.element(page.getByText("Borrowed")).toBeVisible()
  await expect.element(article()).toMatchScreenshot("borrowed")
})

test("a Loan settled to zero reads Lent with a black amount", async () => {
  await card({ loan: loan({ amountMinor: MinorAmount.make(0) }) })
  await expect.element(page.getByText("USD 0.00")).toBeVisible()
  await expect.element(article()).toMatchScreenshot("zero")
})

test("an Archived Loan is grey", async () => {
  await card({ loan: loan({ archived: true }) })
  await expect.element(page.getByText("Lent")).toBeVisible()
  await expect.element(article()).toMatchScreenshot("archived")
})

test("on its page the card carries a detail line and does not lift", async () => {
  await card({ interactive: false, detail: "Since 10 Sep 2026 · Archived" })
  await expect.element(page.getByText("Since 10 Sep 2026 · Archived")).toBeVisible()
  await expect.element(article()).toMatchScreenshot("detail-static")
})

test("a long other-party line wraps under the corner tag at phone width", async () => {
  await card({ loan: loan({ description: "The neighbours downstairs · deposit for the shared garden tools and the ladder" }) })
  await expect.element(page.getByText("Lent")).toBeVisible()
  await expect.element(article()).toMatchScreenshot("long-phone")
})

function Probe() {
  return <div data-testid="location">{useLocation().pathname}</div>
}

const routed = (props: Partial<LoanCardProps> = {}) =>
  render(
    <MemoryRouter initialEntries={["/more"]}>
      <Probe />
      <Routes>
        <Route path="/more" element={<LoanCard loan={loan()} {...props} />} />
        <Route path="/more/loans/:id" element={null} />
      </Routes>
    </MemoryRouter>
  )

test("clicking the card in a list opens the Loan's page", async () => {
  await routed()
  await article().click()
  await expect.element(page.getByTestId("location")).toHaveTextContent("/more/loans/77777777-7777-4777-8777-777777777777")
})

test("a static card ignores clicks", async () => {
  await routed({ interactive: false })
  await article().click()
  await expect.element(page.getByTestId("location")).toHaveTextContent("/more")
})
