import { readFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import type { Browser, CDPSession, Page } from 'playwright'
import { install } from './page.mts'
import { pin } from './processor.mts'
import type { Clock } from './processor.mts'

/** The machine the grid runs on: how much slower its processor is than this one, and its connection. */
export type Profile = {
    name: string
    cpuSlowdown: number
    network?: { downloadKbps: number; uploadKbps: number; latencyMs: number }
}

const VIEWPORT = { width: 1366, height: 768 }
const WINDOW_MS = 250
const QUIET_WINDOWS = 2
const SETTLE_TIMEOUT_MS = 300_000

/** One page under measurement, and what the browser has told about its requests. */
export type Session = {
    page: Page
    cdp: CDPSession
    browser: Browser
    inFlight: Set<string>
    transfers: Map<string, { url: string; type: string; bytes: number }>
    clock: Clock
    /** When the page's own clock started, in milliseconds since 1970. */
    origin: number
    /** The renderers whose main thread has the kept processor. */
    pinned: Set<number>
}

/** The main thread's time in milliseconds: in all, running script, and working out style and layout. */
export type MainThread = { task: number; script: number; layout: number }

/** The main thread's running totals. */
export const totals = async ({ cdp }: Session): Promise<MainThread> => {
    const { metrics } = await cdp.send('Performance.getMetrics')
    const of = (name: string) =>
        (metrics.find((metric) => metric.name === name)?.value ?? 0) * 1000
    return {
        task: of('TaskDuration'),
        script: of('ScriptDuration'),
        layout: of('LayoutDuration') + of('RecalcStyleDuration'),
    }
}

/**
 * Waits until nothing is on its way and the main thread has been idle for two windows, then answers when, on the
 * page's clock, the quiet began. It asks the browser, not the page, so waiting adds no work to what is measured.
 */
export const settle = async (session: Session) => {
    const started = Date.now()
    let last = await totals(session)
    let lastAt = Date.now()
    let quietSince = lastAt
    let quiet = 0
    while (Date.now() - started < SETTLE_TIMEOUT_MS) {
        await sleep(WINDOW_MS)
        const now = await totals(session)
        const at = Date.now()
        const busy = (now.task - last.task) / (at - lastAt)
        if (busy < 0.1 && session.inFlight.size === 0) {
            quiet += 1
        } else {
            quiet = 0
            quietSince = at
        }
        last = now
        lastAt = at
        if (quiet >= QUIET_WINDOWS) {
            const pageNow = await session.page.evaluate(() => performance.now())
            return pageNow - (Date.now() - quietSince)
        }
    }
    throw new Error('The page never became idle')
}

const renderers = async (browser: Browser) => {
    const session = await browser.newBrowserCDPSession()
    const { processInfo } = await session.send('SystemInfo.getProcessInfo')
    await session.detach()
    return processInfo
        .filter(({ type }) => type === 'renderer')
        .toSorted((one, other) => other.cpuTime - one.cpuTime)
}

/** Whether the renderer that did the page's work is one whose main thread was given the kept processor. */
export const kept = async ({ browser, pinned }: Session) => {
    const [renderer] = await renderers(browser)
    return (
        pinned.size === 0 || (renderer !== undefined && pinned.has(renderer.id))
    )
}

/** The renderer's memory as the kernel counts it (Linux only): all it has mapped in, and its share of shared pages. */
const processMemory = async (browser: Browser) => {
    const [renderer] = await renderers(browser)
    try {
        const rollup = readFileSync(
            `/proc/${renderer?.id}/smaps_rollup`,
            'utf8'
        )
        const mb = (field: string) =>
            Number(
                new RegExp(`^${field}:\\s+(\\d+) kB`, 'm').exec(rollup)?.[1]
            ) / 1024
        return { rssMb: mb('Rss'), pssMb: mb('Pss') }
    } catch {
        return { rssMb: Number.NaN, pssMb: Number.NaN }
    }
}

export const memory = async (session: Session) => {
    await session.cdp.send('HeapProfiler.collectGarbage')
    const heap = await session.cdp.send('Runtime.getHeapUsage')
    const counters = await session.cdp.send('Memory.getDOMCounters')
    return {
        heapMb: heap.usedSize / 1024 / 1024,
        ...(await processMemory(session.browser)),
        domNodes: counters.nodes,
        listeners: counters.jsEventListeners,
    }
}
export const open = async (
    browser: Browser,
    profile: Profile,
    address: string,
    sampling: boolean,
    clock: Clock
): Promise<Session> => {
    const context = await browser.newContext({ viewport: VIEWPORT })
    const page = await context.newPage()
    await page.addInitScript(install)
    const cdp = await context.newCDPSession(page)
    await cdp.send('Performance.enable')
    await cdp.send('Network.enable')
    await cdp.send('Emulation.setCPUThrottlingRate', {
        rate: profile.cpuSlowdown,
    })
    if (profile.network !== undefined) {
        await cdp.send('Network.emulateNetworkConditions', {
            offline: false,
            latency: profile.network.latencyMs,
            downloadThroughput: (profile.network.downloadKbps * 1000) / 8,
            uploadThroughput: (profile.network.uploadKbps * 1000) / 8,
        })
    }
    const session: Session = {
        page,
        cdp,
        browser,
        inFlight: new Set(),
        transfers: new Map(),
        clock,
        origin: 0,
        pinned: new Set(),
    }
    cdp.on('Network.requestWillBeSent', ({ requestId, request }) => {
        session.inFlight.add(requestId)
        session.transfers.set(requestId, {
            url: request.url,
            type: 'other',
            bytes: 0,
        })
    })
    cdp.on('Network.responseReceived', ({ requestId, type }) => {
        const transfer = session.transfers.get(requestId)
        if (transfer !== undefined) {
            transfer.type = type
        }
    })
    cdp.on('Network.loadingFinished', ({ requestId, encodedDataLength }) => {
        session.inFlight.delete(requestId)
        const transfer = session.transfers.get(requestId)
        if (transfer !== undefined) {
            transfer.bytes = encodedDataLength
        }
    })
    cdp.on('Network.loadingFailed', ({ requestId }) => {
        session.inFlight.delete(requestId)
    })
    if (sampling) {
        await cdp.send('Profiler.enable')
        await cdp.send('Profiler.setSamplingInterval', { interval: 250 })
        await cdp.send('Profiler.start')
    }
    await page.goto(address, { waitUntil: 'commit' })
    for (const { id } of await renderers(browser)) {
        if (pin(id)) {
            session.pinned.add(id)
        }
    }
    session.origin = await page.evaluate(() => performance.timeOrigin)
    return session
}

/** What the page loaded, in kilobytes as sent (compressed), by kind. */
export const transferred = ({ transfers }: Session) => {
    const kb = { script: 0, style: 0, font: 0, api: 0, other: 0, total: 0 }
    let apiRequests = 0
    for (const { url, type, bytes } of transfers.values()) {
        const size = bytes / 1024
        kb.total += size
        if (url.includes('/api/')) {
            kb.api += size
            apiRequests += 1
        } else if (type === 'Script') {
            kb.script += size
        } else if (type === 'Stylesheet') {
            kb.style += size
        } else if (type === 'Font') {
            kb.font += size
        } else {
            kb.other += size
        }
    }
    return { kb, requests: transfers.size, apiRequests }
}

/** Where a sampled function is in the built scripts. */
export type Frame = {
    functionName: string
    scriptId: string
    url: string
    lineNumber: number
    columnNumber: number
}

/** What the browser's sampling profiler saw of the main thread: the call tree, and which node each sample hit. */
export type Sampled = {
    nodes: Array<{ id: number; callFrame: Frame }>
    samples?: number[]
    timeDeltas?: number[]
}
