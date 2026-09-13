// Renders the PWA icons and favicons from icons.html with the real Syne face, via headless Chrome.
// Usage: node tools/icons/render.mjs tools/icons apps/web/public
import { spawn } from "node:child_process"
import { writeFileSync } from "node:fs"
const dir = process.argv[2]; const out = process.argv[3]
const port = 9334
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", `--remote-debugging-port=${port}`, "--no-first-run", `--user-data-dir=${dir}/profile`, "--window-size=1100,800", "--hide-scrollbars", "about:blank"], { stdio: "ignore" })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let info; for (let i = 0; i < 40; i++) { try { info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break } catch { await sleep(250) } }
const ws = new WebSocket(info.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pending = new Map()
ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) } }
const send = (method, params = {}, sessionId) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params, sessionId })) })
const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" })
const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true })
const s = (method, params) => send(method, params, sessionId)
await s("Page.enable"); await s("Runtime.enable")
await s("Emulation.setDeviceMetricsOverride", { width: 1100, height: 800, deviceScaleFactor: 1, mobile: false })
await s("Page.navigate", { url: `file://${dir}/icons.html` })
await sleep(1500)
await s("Runtime.evaluate", { expression: "document.fonts.ready.then(()=>document.fonts.check('800 20px Syne'))", awaitPromise: true, returnByValue: true }).then((r) => console.log("font loaded:", r.result?.result?.value))
await sleep(500)
const tiles = [["i512","icon-512.png"],["m512","icon-maskable-512.png"],["i192","icon-192.png"],["a180","apple-touch-icon.png"],["f64","favicon-64.png"],["f32","favicon-32.png"],["f16","favicon-16.png"]]
for (const [el, name] of tiles) {
  const { result: { result: { value: r } } } = await s("Runtime.evaluate", { expression: `(()=>{const r=document.getElementById('${el}').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()`, returnByValue: true })
  const { result: { data } } = await s("Page.captureScreenshot", { format: "png", clip: { ...r, scale: 1 } })
  writeFileSync(`${out}/${name}`, Buffer.from(data, "base64")); console.log(name, r.width)
}
const { result: { data } } = await s("Page.captureScreenshot", { format: "png" }); writeFileSync(`${dir}/sheet.png`, Buffer.from(data, "base64"))
ws.close(); chrome.kill()
