import { page } from "vitest/browser"
import { beforeEach } from "vitest"
import "../index.css"

/**
 * The same fonts index.html loads, so screenshots use the real faces rather than a system fallback.
 * `document.fonts.ready` resolves before an appended stylesheet is parsed, so wait for the sheet
 * itself, then ask for every face a card or form draws, and only then let the tests start.
 */
const link = document.createElement("link")
link.rel = "stylesheet"
link.href =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap"
const parsed = new Promise<void>((resolve) => {
  link.onload = () => resolve()
  link.onerror = () => resolve()
})
document.head.appendChild(link)
document.body.className = "bg-paper text-ink font-sans"
await parsed
await Promise.all(
  ['16px Inter', '500 16px Inter', '600 16px Inter', '500 16px "Space Grotesk"', 'bold 16px "Space Grotesk"', '16px "Space Mono"', 'bold 16px "Space Mono"', 'bold 16px Syne', '800 16px Syne'].map((face) =>
    document.fonts.load(face)
  )
)
await document.fonts.ready

/**
 * Every test file shares one browser pointer, and a click leaves it where it landed: a card or a
 * button under it in the next test would render hovered. Park it in the corner before each test.
 */
beforeEach(() => page.elementLocator(document.body).hover({ position: { x: 1, y: 1 } }))
