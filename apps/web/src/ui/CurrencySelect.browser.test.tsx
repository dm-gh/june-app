import { page } from "vitest/browser"
import { expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"

/**
 * The setup file appends the Google stylesheet, but the first test of a file can run before it is parsed,
 * when `fonts.load` finds no face at all; so poll until the faces the form shows are really loaded.
 */
const fonts = async () => {
  for (let attempt = 0; attempt < 50; attempt++) {
    const faces = await Promise.all([document.fonts.load('bold 12px "Space Grotesk"'), document.fonts.load('16px Inter'), document.fonts.load('bold 20px "Space Mono"')])
    if (faces.every((f) => f.length > 0)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}
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
  await fonts()
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
  await fonts()
  await expect.element(page.getByLabelText("Currency")).toBeDisabled()
  await expect.element(page.getByTestId("field")).toMatchScreenshot("fixed")
})
