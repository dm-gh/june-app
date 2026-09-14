import { page } from "vitest/browser"
import { expect, test } from "vitest"
import { render } from "vitest-browser-react"
import { LoanId, MinorAmount } from "@june/shared"
import { loan } from "../../test/fixtures"
import { mockQueries } from "../../test/queries.mock"
import { LoansArchivePage } from "./LoansArchivePage"

const settled = loan({ archived: true, amountMinor: MinorAmount.make(0) })
const borrowed = loan({ id: LoanId.make("77777777-7777-4777-8777-777777777778"), archived: true, amountMinor: MinorAmount.make(-12050), description: "Mum · car repair" })

test("Archive lists only the archived Loans under a Back bar with the title beside the arrow", async () => {
  const { wrap } = mockQueries({ loans: [loan(), settled, borrowed] })
  await render(wrap(<LoansArchivePage />, ["/more/loans/archive"]))
  await expect.element(page.getByText("Mum · car repair")).toBeVisible()
  expect(page.getByText("Alex · laptop").elements()).toHaveLength(1)
  await expect.element(page.elementLocator(document.body)).toMatchScreenshot("loans-archive")
})
