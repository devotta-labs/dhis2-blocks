import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test'
import {
    TRACKER_IMPORT,
    bodyRows,
    cell,
    expect,
    found,
    gridReady,
    readEvent,
    scrollUntilDrawn,
    settled,
    test as base,
    valuesOf,
} from './tracker-data-entry.support'

const REGISTER = 'tracker-data-entry/tracker-register'
const COHORT = 'tracker-data-entry/cohort-anc-register'
const DIASTOLIC = 'dyYdfamSY2Z'
const localDhis2 = ['127.0.0.1', 'localhost'].includes(
    new URL(process.env.DOCS_DHIS2_URL ?? 'http://unset').hostname
)

const openSlowed = async (page: Page, example = REGISTER) => {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await page.goto(`/preview/${example}`)
    await gridReady(page)
}

const durations = (page: Page, name: string) =>
    page.evaluate(
        (measure) =>
            performance
                .getEntriesByName(measure)
                .map(({ duration }) => duration),
        name
    )

const withinBudget = (
    testInfo: TestInfo,
    name: string,
    ms: number,
    budget: number
) => {
    const line = `${name}: ${ms.toFixed(1)} ms (budget ${budget} ms)`
    testInfo.annotations.push({ type: 'performance', description: line })
    console.log(`[performance] ${line}`)
    expect.soft(ms, line).toBeLessThanOrEqual(budget)
}

const watchKeys = (page: Page) =>
    page.evaluateHandle(() => {
        const seen: PerformanceEntry[] = []
        const observer = new PerformanceObserver((list) => {
            seen.push(...list.getEntries())
        })
        observer.observe({
            type: 'event',
            durationThreshold: 16,
            buffered: true,
        })
        return { seen, observer }
    })

const slowestKey = async (timing: Awaited<ReturnType<typeof watchKeys>>) => {
    const keys = (
        await timing.evaluate(async ({ seen, observer }) => {
            await new Promise<void>((resolve) =>
                requestAnimationFrame(() => setTimeout(resolve))
            )
            return [...seen, ...observer.takeRecords()].map(
                ({ name, duration }) => ({ name, duration })
            )
        })
    ).filter(({ name }) => name.startsWith('key'))
    expect(keys.length).toBeGreaterThan(0)
    return {
        ...keys.reduce((a, b) => (b.duration > a.duration ? b : a)),
        count: keys.length,
    }
}

const onThreeLoads = async (
    page: Page,
    browser: Browser,
    testInfo: TestInfo,
    name: string,
    example = REGISTER
) => {
    const measureOn = async (on: Page) => {
        await openSlowed(on, example)
        const [ms] = await durations(on, name)
        return ms ?? Infinity
    }
    const loads = [await measureOn(page)]
    for (let load = 2; load <= 3; load += 1) {
        const fresh = await browser.newContext({
            baseURL: testInfo.project.use.baseURL,
            viewport: page.viewportSize(),
        })
        try {
            loads.push(await measureOn(await fresh.newPage()))
        } finally {
            await fresh.close()
        }
    }
    return loads
}

const medianWithinBudget = (
    testInfo: TestInfo,
    name: string,
    loads: ReadonlyArray<number>,
    budget: number
) =>
    withinBudget(
        testInfo,
        `${name}, median of ${loads.map((ms) => ms.toFixed(1)).join(', ')}`,
        [...loads].sort((a, b) => a - b)[1] ?? Infinity,
        budget
    )

const WOMEN = 25

const cohortData = (action: 'seed' | 'cleanup', batch: string) => {
    execFileSync(
        resolve(__dirname, '../metadata/seed-cohort-performance.sh'),
        [process.env.E2E_VERSION_SLUG ?? '42', action, batch],
        { stdio: 'inherit' }
    )
}

const test = base.extend<{ cohortBatch: string }>({
    cohortBatch: async ({ shared: _shared }, use) => {
        test.skip(!localDhis2, 'Requires the disposable docs DHIS2 stack')
        const batch = randomBytes(4).toString('hex').slice(0, 7)
        try {
            cohortData('seed', batch)
            await use(batch)
        } finally {
            cohortData('cleanup', batch)
        }
    },
})

const diastolic = (page: Page) => page.locator(`tbody [id$=".${DIASTOLIC}"]`)

test.describe.configure({ timeout: 120_000 })

test('register of 50 rows by 50 columns shows within 1 s', async ({
    page,
    browser,
}, testInfo) => {
    const loads = await onThreeLoads(
        page,
        browser,
        testInfo,
        'data-entry:ready'
    )
    expect(await bodyRows(page)).toBe(50)
    medianWithinBudget(testInfo, 'data-entry:ready', loads, 1000)
})

test('cohort register shows 25 women by 41 columns within 1 s', async ({
    page,
    browser,
    cohortBatch: _cohortBatch,
}, testInfo) => {
    const loads = await onThreeLoads(
        page,
        browser,
        testInfo,
        'data-entry:ready',
        COHORT
    )
    expect(await bodyRows(page)).toBe(WOMEN)
    medianWithinBudget(
        testInfo,
        'data-entry:ready (cohort register)',
        loads,
        1000
    )
})

test('rules for the first rows within 300 ms, an edit within 100 ms', async ({
    page,
    context,
    browser,
}, testInfo) => {
    medianWithinBudget(
        testInfo,
        'data-entry:rules-visible',
        await onThreeLoads(page, browser, testInfo, 'data-entry:rules-visible'),
        300
    )

    await context.setOffline(true)
    await diastolic(page).first().click()
    await page.keyboard.type('95')
    await page.keyboard.press('Enter')
    await expect
        .poll(
            async () => (await durations(page, 'data-entry:rules-edit')).length
        )
        .toBe(1)
    const [edit] = await durations(page, 'data-entry:rules-edit')
    withinBudget(testInfo, 'data-entry:rules-edit', edit ?? Infinity, 100)
})

test('no keypress slower than 150 ms while saving online', async ({
    page,
    request,
    shared,
}, testInfo) => {
    test.skip(!localDhis2, 'Changes existing events; requires local DHIS2')
    await openSlowed(page)
    const ids = (
        await diastolic(page).evaluateAll((cells) =>
            cells.slice(0, 10).map(({ id }) => id)
        )
    ).map((id) => found(/-cell-(\w+)\./.exec(id)?.[1], 'event in the register'))
    expect(ids).toHaveLength(10)
    const originals = await Promise.all(
        ids.map(async (id) =>
            found(await readEvent(request, id), `event ${id}`)
        )
    )
    shared.keep(originals)
    const values = originals.map((event, index) => {
        const value = String(80 + index)
        return valuesOf(event).get(DIASTOLIC) === value
            ? String(90 + index)
            : value
    })
    const saved = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            TRACKER_IMPORT.test(new URL(response.url()).pathname)
    )
    const timing = await watchKeys(page)

    await diastolic(page).first().click()
    for (const value of values) {
        await page.keyboard.type(value)
        await page.keyboard.press('Enter')
    }
    await expect(diastolic(page).nth(9)).toHaveValue(values[9])
    const slowest = await slowestKey(timing)
    expect((await saved).ok()).toBe(true)
    await settled(page)
    const last = await readEvent(request, ids[9])
    expect(valuesOf(last).get(DIASTOLIC)).toBe(values[9])
    withinBudget(
        testInfo,
        `slowest keypress (${slowest.name}; ${slowest.count} key events of 16 ms or more)`,
        slowest.duration,
        150
    )
})

const editAfterTenPages = async (
    page: Page,
    context: BrowserContext,
    cohortBatch: string
) => {
    await openSlowed(page, COHORT)
    const more = page.getByRole('button', { name: /show more/i })
    const rulesVisible = 'data-entry:rules-visible'
    for (let loaded = 1; loaded < 10; loaded += 1) {
        const before = (await durations(page, rulesVisible)).length
        await more.click()
        await expect.poll(() => bodyRows(page)).toBe((loaded + 1) * WOMEN)
        await expect
            .poll(async () => (await durations(page, rulesVisible)).length)
            .toBeGreaterThan(before)
    }

    await context.setOffline(true)
    const pressure = cell(page, `F${cohortBatch}000`, DIASTOLIC)
    await scrollUntilDrawn(page, pressure)
    await expect(pressure).toHaveValue('70')
    const timing = await watchKeys(page)
    const before = (await durations(page, 'data-entry:rules-edit')).length
    await pressure.click()
    await page.keyboard.type('95')
    await page.keyboard.press('Enter')
    await expect(pressure).toHaveValue('95')
    await expect
        .poll(
            async () => (await durations(page, 'data-entry:rules-edit')).length
        )
        .toBe(before + 1)
    const edits = await durations(page, 'data-entry:rules-edit')
    return { timing, edit: edits.at(-1) ?? Infinity }
}

test('after 10 pages, rules for an edit within 100 ms', async ({
    page,
    context,
    cohortBatch,
}, testInfo) => {
    const { edit } = await editAfterTenPages(page, context, cohortBatch)
    withinBudget(testInfo, 'data-entry:rules-edit (after 10 pages)', edit, 100)
})

test('after 10 pages, no keypress over 150 ms', async ({
    page,
    context,
    cohortBatch,
}, testInfo) => {
    const { timing } = await editAfterTenPages(page, context, cohortBatch)
    const slowest = await slowestKey(timing)
    withinBudget(
        testInfo,
        `slowest keypress after 10 pages (${slowest.name}; ${slowest.count} key events of 16 ms or more)`,
        slowest.duration,
        150
    )
})
