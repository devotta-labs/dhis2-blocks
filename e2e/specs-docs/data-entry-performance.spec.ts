import type { Browser, Page, TestInfo } from '@playwright/test'
import { gridReady, TRACKER_IMPORT } from './data-entry.support'
import { expect, test } from './fixtures'

/**
 * Budgets for the register example (50 first visits by 50 columns) on the
 * production preview, with the CPU slowed 4×. The edit is made offline, so it
 * stays on the device; the keypresses are made online, their imports answered
 * by the test. The shared docs DHIS2 is never changed.
 */
const REGISTER = 'data-entry/tracker-register'
const DIASTOLIC = 'dyYdfamSY2Z'

const openSlowed = async (page: Page) => {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await page.goto(`/preview/${REGISTER}`)
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

/** Records the number for the run's report, then holds it to its budget. */
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

/**
 * A measure on three first loads, each in its own browser context: the test's page, then two fresh ones. A reload
 * would reuse the compiled code and run about 2.5× faster, so it is not a first load.
 */
const onThreeLoads = async (
    page: Page,
    browser: Browser,
    testInfo: TestInfo,
    name: string
) => {
    const measureOn = async (on: Page) => {
        await openSlowed(on)
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

/** The median of the loads within the budget, so one noisy load neither passes nor fails it; records all three. */
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

/** The diastolic blood pressure column, top row first. */
const diastolic = (page: Page) => page.locator(`tbody [id$=".${DIASTOLIC}"]`)

test.describe.configure({ timeout: 120_000 })

test('register shows its 2,500 cells within 1 s', async ({
    page,
    browser,
}, testInfo) => {
    const loads = await onThreeLoads(
        page,
        browser,
        testInfo,
        'data-entry:ready'
    )
    await expect(page.locator('tbody td')).toHaveCount(2500)
    medianWithinBudget(testInfo, 'data-entry:ready', loads, 1000)
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

test('no keypress slower than 150 ms', async ({ page }, testInfo) => {
    await openSlowed(page)
    // Online, so sending and its outcome happen as they would; the test answers the import in DHIS2's place.
    await page.route(
        (url) => TRACKER_IMPORT.test(url.pathname),
        (route) =>
            route.fulfill({
                json: { status: 'OK', validationReport: { errorReports: [] } },
            })
    )
    const timing = await page.evaluateHandle(() => {
        const seen: PerformanceEntry[] = []
        // Every event of 16 ms or more, the shortest Event Timing reports.
        const options = { type: 'event', durationThreshold: 16, buffered: true }
        const observer = new PerformanceObserver((list) => {
            seen.push(...list.getEntries())
        })
        observer.observe(options)
        return { seen, observer }
    })

    // Down the column: a value, then Enter, in each of the first ten rows.
    await diastolic(page).first().click()
    for (let row = 0; row < 10; row += 1) {
        await page.keyboard.type(String(80 + row))
        await page.keyboard.press('Enter')
    }
    await expect(diastolic(page).nth(9)).toHaveValue('89')
    // An event's entry is reported after the frame that follows it; what the callback has not seen yet is taken.
    await page.evaluate(
        () =>
            new Promise<void>((resolve) =>
                requestAnimationFrame(() => setTimeout(resolve))
            )
    )
    const keys = (
        await timing.evaluate(({ seen, observer }) =>
            [...seen, ...observer.takeRecords()].map(({ name, duration }) => ({
                name,
                duration,
            }))
        )
    ).filter(({ name }) => name.startsWith('key'))
    expect(keys.length).toBeGreaterThan(0)
    const slowest = keys.reduce((a, b) => (b.duration > a.duration ? b : a))
    withinBudget(
        testInfo,
        `slowest keypress (${slowest.name}; ${keys.length} key events of 16 ms or more)`,
        slowest.duration,
        150
    )
})
