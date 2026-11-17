import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { elementId, eventId, ORG_UNIT, scenarioId } from './scenario.mts'
import type { Scenario } from './scenario.mts'
import { watch } from './processor.mts'
import { kept, memory, open, settle, totals, transferred } from './session.mts'
import type { MainThread, Profile, Sampled, Session } from './session.mts'

/** One grid to measure: a generated program and how many of its events a page holds. */
export type Case = Scenario & { name: string; pageSize: number }
/** What one run measured, by name: `load.gridReadyMs`, `edit.rulesMs`, … Times are in milliseconds. */
export type Metrics = Map<string, number>
// A frame at 60 a second, with room for the timer's jitter.
const SLOW_FRAME_MS = 20
const LONG_TASK_MS = 50
const NOTHING: MainThread = { task: 0, script: 0, layout: 0 }

/** A share to a thousandth; anything else to a tenth. */
export const round = (name: string, value: number) => {
    const steps = name.endsWith('Share') ? 1000 : 10
    return Math.round(value * steps) / steps
}

const FRAME_MS = 1000 / 60

// The times that are all main thread work; the others end on a frame.
const WORK = new Set(['taskMs', 'rulesMs'])

// The parts whose times span waiting on the network: they take out what was stolen stretch by stretch.
const OWN = new Set(['load', 'showMore', 'scrollDown', 'scrollAcross'])

const median = (values: number[]) => {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    if (sorted.length === 0) {
        return Number.NaN
    }
    return sorted.length % 2 === 1
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2
}

const percentile = (values: number[], share: number) => {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
    return sorted.length === 0
        ? Number.NaN
        : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))]
}

export { median }
type Mark = {
    at: number
    inputs: number
    ruleRuns: number
    longTasks: number
    totals: Awaited<ReturnType<typeof totals>>
}

const mark = async (session: Session): Promise<Mark> => ({
    ...(await session.page.evaluate(() => ({
        at: performance.now(),
        inputs: window.__perf.inputs.length,
        ruleRuns: window.__perf.ruleRuns.length,
        longTasks: window.__perf.longTasks.length,
    }))),
    totals: await totals(session),
})

/** Runs `act`, waits for the page to go quiet, and answers what the page recorded meanwhile. */
const during = async (session: Session, act: () => Promise<void>) => {
    const before = await mark(session)
    await act()
    const settled = await settle(session)
    const after = await totals(session)
    const seen = await session.page.evaluate(
        ({ inputs, ruleRuns, longTasks }) => ({
            inputs: window.__perf.inputs.slice(inputs),
            ruleRuns: window.__perf.ruleRuns.slice(ruleRuns),
            longTasks: window.__perf.longTasks.slice(longTasks),
        }),
        before
    )
    return {
        ...seen,
        settled,
        taskMs: after.task - before.totals.task,
        scriptMs: after.script - before.totals.script,
        layoutMs: after.layout - before.totals.layout,
    }
}

type Seen = Awaited<ReturnType<typeof during>>

/** From each event to the frame drawn after it, for the events of one kind. */
const latencies = (seen: Seen, type: string, key?: string) =>
    seen.inputs
        .filter(
            (input) =>
                input.type === type && (key === undefined || input.key === key)
        )
        .map(({ at, painted }) => painted - at)

const frame = (page: Page) => page.evaluate(() => window.__perf.nextFrame())

const press = async (page: Page, key: string, times = 1) => {
    for (let count = 0; count < times; count += 1) {
        await page.keyboard.press(key)
        await frame(page)
    }
}

const cell = (page: Page, row: number, column: number) =>
    page.locator(`[id$="-cell-${eventId(row)}.${elementId(column)}"]`)

/** What the hypervisor stole from the main thread in a stretch of the page's time. */
const stolen = ({ clock, origin }: Session, start: number, duration: number) =>
    clock.between(origin + start, origin + start + duration)

/**
 * How long something the display paces (a frame, or from a key to the frame after it) would have taken with
 * `share` of the main thread's time not stolen. Only the work shrinks, not the wait for the display, so a time
 * does not shrink below a frame, and one shorter than a frame stays as it is.
 */
const paced = (ms: number, share: number) =>
    Math.max(ms * (1 - share), Math.min(ms, FRAME_MS))

/** How long a stretch of the page's time would have been with nothing stolen. */
const calm = (session: Session, start: number, duration: number) =>
    duration - stolen(session, start, duration).stolenMs

const loaded = async (session: Session, rules: boolean) => {
    let settled = await settle(session)
    const ready = () =>
        session.page.evaluate(
            (name) => performance.getEntriesByName(name).length > 0,
            rules ? 'data-entry:rules-visible' : 'data-entry:ready'
        )
    // A page that goes quiet between two requests is not loaded yet.
    for (let tries = 0; !(await ready()); tries += 1) {
        if (tries > 20) {
            throw new Error('The grid never became ready')
        }
        settled = await settle(session)
    }
    const seen = await session.page.evaluate(() => {
        const end = (name: string) => {
            const [entry] = performance.getEntriesByName(name)
            return entry === undefined
                ? Number.NaN
                : entry.startTime + entry.duration
        }
        return {
            firstPaintMs: end('first-contentful-paint'),
            largestPaintMs: window.__perf.largestPaint,
            layoutShift: window.__perf.layoutShift,
            // When the app's own code first ran: the DHIS2 shell is up and signed in.
            gridMountedMs:
                performance.getEntriesByName('data-entry:ready')[0]
                    ?.startTime ?? Number.NaN,
            gridReadyMs: end('data-entry:ready'),
            rulesFirstSliceMs:
                performance.getEntriesByName('data-entry:rules')[0]?.duration ??
                Number.NaN,
            rulesVisibleMs: end('data-entry:rules-visible'),
            longTasks: window.__perf.longTasks,
        }
    })
    const main = await totals(session)
    const { kb, requests, apiRequests } = transferred(session)
    const { share } = stolen(session, 0, settled)
    const longTasks = seen.longTasks.map(({ start, duration }) =>
        calm(session, start, duration)
    )
    return {
        firstPaintMs: calm(session, 0, seen.firstPaintMs),
        largestPaintMs: calm(session, 0, seen.largestPaintMs),
        layoutShift: seen.layoutShift,
        gridMountedMs: calm(session, 0, seen.gridMountedMs),
        gridReadyMs: calm(session, 0, seen.gridReadyMs),
        rulesFirstSliceMs: seen.rulesFirstSliceMs * (1 - share),
        rulesVisibleMs: calm(session, 0, seen.rulesVisibleMs),
        settledMs: calm(session, 0, settled),
        blockedMs: longTasks.reduce(
            (sum, duration) => sum + Math.max(0, duration - LONG_TASK_MS),
            0
        ),
        longestTaskMs: Math.max(0, ...longTasks),
        longTasks: longTasks.filter((duration) => duration > LONG_TASK_MS)
            .length,
        taskMs: main.task * (1 - share),
        scriptMs: main.script * (1 - share),
        layoutMs: main.layout * (1 - share),
        stolenShare: share,
        requests,
        apiRequests,
        scriptKb: kb.script,
        styleKb: kb.style,
        fontKb: kb.font,
        apiKb: kb.api,
        totalKb: kb.total,
    }
}

/** Types a number into five rows' first field, which the rules read, and saves each with Enter. */
const edit = async (session: Session) => {
    const { page } = session
    const rounds: Seen[] = []
    for (let row = 2; row < 7; row += 1) {
        rounds.push(
            await during(session, async () => {
                await cell(page, row, 0).click()
                await frame(page)
                await page.keyboard.type(String(90 + row), { delay: 60 })
                await frame(page)
                await press(page, 'Enter')
            })
        )
    }
    const rulesAfterEnter = rounds.map((seen) => {
        const enter = seen.inputs.find(({ key }) => key === 'Enter')
        const run = seen.ruleRuns.find(({ start }) => start >= (enter?.at ?? 0))
        return { enter, run }
    })
    return {
        selectMs: median(rounds.flatMap((seen) => latencies(seen, 'click'))),
        keyMs: median(
            rounds.flatMap((seen) =>
                seen.inputs
                    .filter(
                        ({ type, key }) => type === 'keydown' && key !== 'Enter'
                    )
                    .map(({ at, painted }) => painted - at)
            )
        ),
        commitMs: median(
            rounds.flatMap((seen) => latencies(seen, 'keydown', 'Enter'))
        ),
        rulesMs: median(
            rulesAfterEnter.map(({ run }) => run?.duration ?? Number.NaN)
        ),
        rulesShownMs: median(
            rulesAfterEnter.map(({ enter, run }) =>
                enter === undefined || run === undefined
                    ? Number.NaN
                    : run.painted - enter.at
            )
        ),
        taskMs: median(rounds.map(({ taskMs }) => taskMs)),
    }
}

const navigate = async (session: Session) => {
    const { page } = session
    await cell(page, 0, 0).click()
    const down = await during(session, () => press(page, 'ArrowDown', 20))
    const right = await during(session, () => press(page, 'ArrowRight', 8))
    return {
        downMs: median(latencies(down, 'keydown')),
        downWorstMs: Math.max(...latencies(down, 'keydown')),
        rightMs: median(latencies(right, 'keydown')),
        rightWorstMs: Math.max(...latencies(right, 'keydown')),
    }
}

/** Opens an option cell's list, moves in it and picks. */
const pickOption = async (session: Session) => {
    const { page } = session
    await cell(page, 1, 2).click()
    let drawn = 0
    const seen = await during(session, async () => {
        await press(page, 'Alt+ArrowDown')
        drawn = await page.locator('[role="option"]').count()
        await press(page, 'ArrowDown')
        await press(page, 'Enter')
    })
    // Alt+↓ opens the list, ↓ moves in it, Enter picks.
    const [opened, moved] = latencies(seen, 'keydown', 'ArrowDown')
    return {
        openMs: opened ?? Number.NaN,
        moveMs: moved ?? Number.NaN,
        pickMs: latencies(seen, 'keydown', 'Enter').at(0) ?? Number.NaN,
        optionsDrawn: drawn,
    }
}

const PASTED = [
    '50',
    'Pasted',
    'Option 1 of the set',
    'Yes',
    '2024-05-05',
    '12.5',
    'Option 2 of the set',
    'Yes',
    'A pasted note',
    '7',
]
const PASTED_ROWS = 10

/** Pastes a block ten rows tall and ten columns wide, a value of each column's type. */
const paste = async (session: Session, pageSize: number) => {
    const { page } = session
    // Below the rows edited so far, where the page is long enough to hold the whole block there.
    const top = Math.max(0, Math.min(8, pageSize - PASTED_ROWS))
    await cell(page, top, 0).click()
    const text = Array.from({ length: PASTED_ROWS }, () =>
        PASTED.join('\t')
    ).join('\n')
    const seen = await during(session, async () => {
        await page.evaluate((block) => window.__perf.paste(block), text)
        await frame(page)
    })
    const [pasted] = seen.inputs.filter(({ type }) => type === 'paste')
    const lastRun = seen.ruleRuns.at(-1)
    return {
        paintMs: pasted.painted - pasted.at,
        rulesMs: seen.ruleRuns.reduce((sum, run) => sum + run.duration, 0),
        rulesShownMs:
            lastRun === undefined ? Number.NaN : lastRun.painted - pasted.at,
        taskMs: seen.taskMs,
    }
}

const addRow = async (session: Session) => {
    const { page } = session
    await cell(page, 0, 0).click()
    const seen = await during(session, () => press(page, 'Control+Enter'))
    return {
        paintMs: latencies(seen, 'keydown', 'Enter').at(-1) ?? Number.NaN,
        taskMs: seen.taskMs,
    }
}

const scroll = async ({ page, clock }: Session, axis: 'x' | 'y') => {
    const room = await page.evaluate((along) => {
        const region = document.querySelector('table')?.parentElement
        if (region === null || region === undefined) {
            return 0
        }
        region.scrollTop = 0
        region.scrollLeft = 0
        return along === 'y'
            ? region.scrollHeight - region.clientHeight
            : region.scrollWidth - region.clientWidth
    }, axis)
    const step = axis === 'y' ? 18 : 40
    const frames = Math.min(90, Math.floor(room / step))
    if (frames < 10) {
        return {
            frameMs: Number.NaN,
            worstFrameMs: Number.NaN,
            slowShare: Number.NaN,
            stolenShare: Number.NaN,
        }
    }
    await frame(page)
    const from = clock.now()
    const frameTimes = await page.evaluate(
        ([along, by, count]) => window.__perf.scroll(along, by, count),
        [axis, step, frames] as const
    )
    const { share } = clock.between(from, clock.now())
    const took = frameTimes.map((ms) => paced(ms, share))
    return {
        stolenShare: share,
        frameMs: median(took),
        worstFrameMs: percentile(took, 0.95),
        slowShare: took.filter((ms) => ms > SLOW_FRAME_MS).length / took.length,
    }
}

const showMore = async (session: Session) => {
    const { page } = session
    const button = page.getByRole('button', { name: 'Show more events' })
    let drawn = Number.NaN
    const seen = await during(session, async () => {
        const grew = page.evaluate(() => window.__perf.rowsGrew())
        await button.click()
        drawn = await grew
    })
    const click = seen.inputs.findLast(({ type }) => type === 'click')
    const from = click?.at ?? Number.NaN
    const { share } = stolen(session, from, seen.settled - from)
    return {
        drawnMs: calm(session, from, drawn - from),
        settledMs: calm(session, from, seen.settled - from),
        taskMs: seen.taskMs * (1 - share),
        stolenShare: share,
    }
}

/**
 * Loads one grid on one machine and uses it as a person entering data does; every time is in milliseconds.
 * Given `sampled`, it also samples where the main thread spends each part, which slows the page: use those runs
 * for where the time goes, not for how long it takes.
 */
export const measure = async (
    origin: string,
    grid: Case,
    profile: Profile,
    sampled?: (part: string, samples: Sampled, main: MainThread) => void
): Promise<Metrics> => {
    await fetch(`${origin}/__reset`)
    // A browser of its own: nothing cached, and a renderer whose memory is this page's alone.
    const clock = watch()
    const browser = await chromium.launch({ channel: 'chromium' })
    try {
        const started = clock.now()
        const session = await open(
            browser,
            profile,
            `${origin}/apps/blocks-perf/?program=${scenarioId(grid)}&orgUnit=${ORG_UNIT}&pageSize=${grid.pageSize}`,
            sampled !== undefined,
            clock
        )
        /**
         * Runs one part of the use. Its times are then as they would have been had the hypervisor stolen nothing
         * from the main thread; the parts in `OWN` see to that themselves.
         */
        const part = async (
            name: string,
            run: () => Promise<Record<string, number>>
        ) => {
            // Sampling stops between the parts, so that reading the memory, which collects garbage, is in none.
            // The load is sampled from before the page opens.
            if (sampled !== undefined && name !== 'load') {
                await session.cdp.send('Profiler.start')
            }
            const before = name === 'load' ? NOTHING : await totals(session)
            const from = clock.now()
            const numbers = await run()
            const { share } = clock.between(from, clock.now())
            if (sampled !== undefined) {
                const after = await totals(session)
                const { profile: samples } =
                    await session.cdp.send('Profiler.stop')
                sampled(name, samples, {
                    task: (after.task - before.task) * (1 - share),
                    script: (after.script - before.script) * (1 - share),
                    layout: (after.layout - before.layout) * (1 - share),
                })
            }
            if (OWN.has(name)) {
                return numbers
            }
            return {
                ...Object.fromEntries(
                    Object.entries(numbers).map(([key, value]) => {
                        if (!key.endsWith('Ms')) {
                            return [key, value]
                        }
                        return [
                            key,
                            WORK.has(key)
                                ? value * (1 - share)
                                : paced(value, share),
                        ]
                    })
                ),
                stolenShare: share,
            }
        }
        const sections = {
            load: await part('load', () => loaded(session, grid.rules > 0)),
            memoryLoaded: await memory(session),
            edit: await part('edit', () => edit(session)),
            navigate: await part('navigate', () => navigate(session)),
            option: await part('option', () => pickOption(session)),
            paste: await part('paste', () => paste(session, grid.pageSize)),
            addRow: await part('addRow', () => addRow(session)),
            scrollDown: await part('scrollDown', () => scroll(session, 'y')),
            scrollAcross: await part('scrollAcross', () =>
                scroll(session, 'x')
            ),
            showMore: await part('showMore', () => showMore(session)),
            memoryUsed: await memory(session),
            run: { stolenShare: clock.between(started, clock.now()).share },
        }
        if (!(await kept(session))) {
            throw new Error(
                'The page ran in a renderer that was not on the kept processor'
            )
        }
        return new Map(
            Object.entries(sections).flatMap(([section, numbers]) =>
                Object.entries(numbers).map(
                    ([name, value]): [string, number] => [
                        `${section}.${name}`,
                        round(name, value),
                    ]
                )
            )
        )
    } finally {
        clock.stop()
        await browser.close()
    }
}
