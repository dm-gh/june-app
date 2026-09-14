import "../index.css"

/** The same fonts index.html loads, so screenshots use the real faces rather than a system fallback. */
const link = document.createElement("link")
link.rel = "stylesheet"
link.href =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap"
document.head.appendChild(link)
document.body.className = "bg-paper text-ink font-sans"
await document.fonts.ready
