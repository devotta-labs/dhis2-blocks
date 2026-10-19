// Times the built spike in headless Chromium, unthrottled and with CDP CPU
// throttling. Usage: node scripts/measure.mjs [rates...]  (default 1 4)
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { gzipSync, brotliCompressSync } from 'node:zlib'

const rates = process.argv.slice(2).map(Number).filter(Boolean)
if (!rates.length) rates.push(1, 4)
const PORT = 4174
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 1500))

const chunks = readdirSync('dist/assets').map((f) => {
    const buf = readFileSync(`dist/assets/${f}`)
    return { file: f, raw: buf.length, gzip: gzipSync(buf, { level: 9 }).length, brotli: brotliCompressSync(buf).length }
})
const entryHtml = readFileSync('dist/index.html', 'utf8')
const report = { chunks, entryReferencesEngine: /rule-engine/.test(entryHtml), runs: [] }

const browser = await chromium.launch()
try {
    for (const rate of rates) {
        for (let rep = 0; rep < 3; rep++) {
            const context = await browser.newContext()
            const page = await context.newPage()
            let consoleErrors = 0
            page.on('console', (m) => { if (m.type() === 'error') consoleErrors++ })
            const cdp = await context.newCDPSession(page)
            await cdp.send('Emulation.setCPUThrottlingRate', { rate })
            const loadedEngine = []
            page.on('request', (r) => { if (r.url().includes('rule-engine')) loadedEngine.push(r.url()) })
            // visit 1: nothing cached
            await page.goto(`http://localhost:${PORT}/`)
            await page.waitForFunction(() => window.__ready)
            const engineBeforeClick = loadedEngine.length
            await page.click('#run')
            await page.waitForFunction(() => window.__results, null, { timeout: 300000 })
            const cold = await page.evaluate(() => window.__results)
            // visit 2: same context, HTTP cache warm
            await page.reload()
            await page.waitForFunction(() => window.__ready)
            await page.click('#run')
            await page.waitForFunction(() => window.__results, null, { timeout: 300000 })
            const cached = await page.evaluate(() => window.__results)
            report.runs.push({ rate, rep, engineRequestedBeforeClick: engineBeforeClick > 0, consoleErrors, cold, cachedLoad: { moduleLoadMs: cached.moduleLoadMs, engineInitMs: cached.engineInitMs }, cachedRmnch: cached.rmnch, cachedLarge: cached.large })
            const r = cold
            console.log(`rate ${rate}x rep ${rep}: load cold ${r.moduleLoadMs} ms, cached ${cached.moduleLoadMs} ms | RMNCH median ${r.rmnch.evalOnly.median} p95 ${r.rmnch.evalOnly.p95} | large median ${r.large.evalOnly.median} p95 ${r.large.evalOnly.p95} | patched RMNCH median ${r.rmnchPatched.evalOnly.median} p95 ${r.rmnchPatched.evalOnly.p95} | subsets ${r.largeSubsets.map((x) => `${x.rules}:${x.median}`).join(' ')} | scenarios ${r.scenarios.every((s) => s.pass) ? 'pass' : 'FAIL'}`)
            await context.close()
        }
    }
} finally {
    await browser.close()
    server.kill()
}
writeFileSync('results.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(chunks))
