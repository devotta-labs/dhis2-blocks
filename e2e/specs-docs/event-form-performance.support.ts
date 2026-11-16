import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { Locator, Page, TestInfo } from '@playwright/test'
import { z } from 'zod'
import { expect } from './fixtures'
import type { ProbeName, Stamp } from './event-form-performance.instrument'

/** Shared by the event form performance specs: opening the lab, timing inputs, statistics, budgets and the report. */

export const VIEWPORT = { width: 1366, height: 768 }
export const RATES = (process.env.EVENT_FORM_PERF_RATES ?? '1,4,6')
    .split(',')
    .map(Number)
export const OUTPUT =
    process.env.EVENT_FORM_PERF_JSON ??
    'e2e/artifacts/docs/event-form-performance.json'
export const LONG = 'Long form'
export const CHILD = 'New child visit'
/** The CPU rate the budgets hold at: a slow clinic desktop. */
export const BUDGET_RATE = 4

export const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms))

export interface Stats {
    n: number
    median: number
    p95: number
    max: number
}

export const stats = (values: readonly number[]): Stats => {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
    const at = (q: number) =>
        sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)] ??
        NaN
    const round = (v: number) => Math.round(v * 10) / 10
    return {
        n: sorted.length,
        median: round(at(0.5)),
        p95: round(at(0.95)),
        max: round(sorted.at(-1) ?? NaN),
    }
}

export const statCells = (s: Stats) => [s.n, s.median, s.p95, s.max]

export const throttle = async (page: Page, rate: number) => {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate })
    return cdp
}

/** Opens a lab preset with the CPU slowed `rate`×, once its fields can be edited. `#count` counts renders from the start. */
export const openPreset = async (
    page: Page,
    preset: string,
    rate: number,
    count = false
) => {
    const cdp = await throttle(page, rate)
    await page.goto(
        `/playground/event-form?preset=${encodeURIComponent(preset)}${count ? '#count' : ''}`
    )
    await page.waitForFunction(
        () => window.__efp.milestones.editable !== undefined,
        null,
        { timeout: 60_000 }
    )
    await page.evaluate(() => document.fonts.ready)
    return cdp
}

/** A field's control (or the element focus goes into it through) by data element id. */
export const field = (page: Page, id: string) =>
    page.locator(`form [id$="-${id}"]`).first()

/** A click with the mouse at the middle of what `locator` shows, scrolled into view first. */
export const clickAt = async (page: Page, locator: Locator) => {
    await locator.scrollIntoViewIfNeeded()
    const box = await locator.boundingBox()
    if (box === null) {
        throw new Error(`nothing to click: ${locator}`)
    }
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

export interface Probe {
    name: ProbeName
    arg?: string
    /** A selector for the element whose movement on screen is recorded. */
    watch?: string
}

export const ALWAYS: Probe = { name: 'always' }

/** What the next stamps wait to see after a paint, and whose position they watch. */
export const expectNext = (page: Page, { name, arg = '', watch = '' }: Probe) =>
    page.evaluate(
        ([probe, value, selector]) =>
            window.__efp.setProbe(probe, value, selector),
        [name, arg, watch] as const
    )

export const focusOn = (id: string): Probe => ({
    name: 'focusOn',
    arg: id,
    watch: `form [id$="-${id}"]`,
})

const stampCount = (page: Page) =>
    page.evaluate(() => window.__efp.stamps.length)

/** Waits for the stamps from `from` on of inputs of `type` to have settled, then returns them. */
const settledStamps = async (
    page: Page,
    from: number,
    type: string,
    timeout = 30_000
) => {
    await page.waitForFunction(
        ([start, kind]) => {
            const mine = window.__efp.stamps
                .slice(start)
                .filter((s) => s.type === kind)
            return mine.length > 0 && mine.every((s) => s.settled !== undefined)
        },
        [from, type] as const,
        { timeout, polling: 50 }
    )
    return page.evaluate(
        ([start, kind]) =>
            window.__efp.stamps.slice(start).filter((s) => s.type === kind),
        [from, type] as const
    )
}

/** Runs one input, waits for what it shows and its frames to settle, and returns its stamp. */
export const timed = async (
    page: Page,
    rate: number,
    act: () => Promise<void>,
    type: 'keydown' | 'click' = 'keydown'
) => {
    const from = await stampCount(page)
    await act()
    const [stamp] = await settledStamps(page, from, type)
    await sleep(40 * rate)
    if (stamp === undefined) {
        throw new Error('the input left no stamp')
    }
    return stamp
}

/** Sends keys on a fixed schedule, not waiting for the page, and returns their stamps once all have settled. */
export const typeOnSchedule = async (
    page: Page,
    keys: readonly string[],
    gap: number
) => {
    const from = await stampCount(page)
    const pending: Array<Promise<void>> = []
    for (const key of keys) {
        pending.push(page.keyboard.press(key))
        await sleep(gap)
    }
    await Promise.all(pending)
    return settledStamps(page, from, 'keydown', 120_000)
}

export const latency = (s: Stamp) => (s.shown ?? NaN) - s.t

/** What the observers saw from `from` on: long frames, long tasks, layout shifts and slow events. */
export const entriesSince = (page: Page, from: number) =>
    page.evaluate((start) => {
        const { loafs, longtasks, shifts, events } = window.__efp
        return {
            loafs: loafs.filter((e) => e.start >= start),
            longtasks: longtasks.filter((e) => e.start >= start),
            shifts: shifts.filter((e) => e.start >= start),
            events: events.filter((e) => e.start >= start),
        }
    }, from)

/** Latency, Event Timing (only events of 16 ms or more) and where focus went, for a list of stamps. */
export const summary = async (page: Page, stamps: readonly Stamp[]) => {
    const { events } = await entriesSince(page, 0)
    const timings = stamps.flatMap((s) =>
        events
            .filter((e) => Math.abs(e.start - s.t) < 1)
            .filter((e) => ['keydown', 'click'].includes(e.name))
            .map((e) => e.duration)
    )
    return {
        latency: stats(stamps.map(latency)),
        eventTiming: stats(timings),
        focusLost: stamps.flatMap((s) =>
            s.shown === undefined ? [s.activeLater ?? '?'] : []
        ),
        focusedMoved: stats(stamps.map((s) => Math.abs(s.watchDyLater ?? 0))),
    }
}

/** Long frames, long tasks and layout shifts seen during `stamps`. */
export const during = async (page: Page, stamps: readonly Stamp[]) => {
    const first = stamps[0]?.t ?? 0
    const end = Math.max(...stamps.map((s) => s.settled ?? 0))
    const { loafs, longtasks, shifts } = await entriesSince(page, first - 1)
    const inside = <T extends { start: number }>(list: T[]) =>
        list.filter((e) => e.start <= end)
    return {
        longestFrame: Math.max(0, ...inside(loafs).map((l) => l.duration)),
        longTasksOver50: inside(longtasks).length,
        shifts: inside(shifts),
    }
}

export const now = (page: Page) => page.evaluate(() => performance.now())

/** Counts renders from here on; the counter is primed on the last commit, so earlier renders do not count. */
export const startCounting = (page: Page) =>
    page.evaluate(() => {
        window.__efp.prime()
        window.__efp.renders = { on: true, commits: 0, total: 0, byName: {} }
    })

export const stopCounting = (page: Page) =>
    page.evaluate(() => {
        window.__efp.renders.on = false
        return window.__efp.renders
    })

const storedSchema = z.record(z.string(), z.json())

/** Merges one case's results into the JSON report, so a failing case keeps the others'. */
export const record = <T>(key: string, value: T) => {
    const all = existsSync(OUTPUT)
        ? storedSchema.parse(JSON.parse(readFileSync(OUTPUT, 'utf8')))
        : {}
    const meta = {
        updated: new Date().toISOString(),
        viewport: VIEWPORT,
        rates: RATES,
    }
    writeFileSync(
        OUTPUT,
        JSON.stringify({ ...all, [key]: value, meta }, null, 2)
    )
}

export type Row = Array<string | number>

/** Prints rows as an aligned table. */
export const table = (
    title: string,
    rows: readonly Row[],
    header: readonly string[]
) => {
    const widths = header.map((h, at) =>
        Math.max(h.length, ...rows.map((r) => String(r[at] ?? '').length))
    )
    const line = (cells: readonly (string | number)[]) =>
        cells.map((c, at) => String(c).padEnd(widths[at] ?? 0)).join('  ')
    console.log(
        `\n[event-form performance] ${title}\n${line(header)}\n${rows.map(line).join('\n')}`
    )
}

/** Records a timing for the run's report, then holds it to its budget, as the data entry performance spec does. */
export const withinBudget = (
    testInfo: TestInfo,
    name: string,
    ms: number,
    budget: number
) => {
    const line = `${name}: ${ms.toFixed(1)} ms (budget ${budget} ms)`
    testInfo.annotations.push({ type: 'performance', description: line })
    expect.soft(ms, line).toBeLessThanOrEqual(budget)
}
