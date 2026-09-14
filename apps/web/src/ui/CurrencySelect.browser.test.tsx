import { page } from "vitest/browser"
import { expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"

import { allCurrencies } from "@june/shared"
import { CurrencySelect } from "./CurrencySelect"
import { Field } from "./Field"

test("offers every ISO currency as code and name, the chosen one shown", async () => {
  const onChange = vi.fn()
  await render(
    <div data-testid="field" className="p-4">
      <Field label="Currency" htmlFor="currency">
        <CurrencySelect id="currency" value="USD" onChange={onChange} />
      </Field>
    </div>
  )
  const select = page.getByLabelText("Currency")
  await expect.element(select).toHaveValue("USD")
  expect(select.getByRole("option").elements()).toHaveLength(allCurrencies.length)
  await expect.element(page.getByRole("option", { name: "EUR · Euro" })).toBeInTheDocument()
  await expect.element(page.getByTestId("field")).toMatchScreenshot("usd")
  await select.selectOptions("JPY")
  expect(onChange).toHaveBeenCalledWith("JPY")
})

test("a fixed currency is greyed out but still named", async () => {
  await render(
    <div data-testid="field" className="p-4">
      <Field label="Currency" htmlFor="currency" hint="Fixed for the wallet's lifetime">
        <CurrencySelect id="currency" value="EUR" disabled />
      </Field>
    </div>
  )
  await expect.element(page.getByLabelText("Currency")).toBeDisabled()
  await expect.element(page.getByTestId("field")).toMatchScreenshot("fixed")
})
