import type { Browser, Page, TestInfo } from '@playwright/test'
import { z } from 'zod'
import { gridReady, TRACKER_IMPORT } from './tracker-data-entry.support'
import { expect, test } from './fixtures'

/**
 * Budgets for the register example (50 first visits by 50 columns) on the
 * production preview, with the CPU slowed 4×. The edit is made offline, so it
 * stays on the device; the keypresses are made online, their imports answered
 * by the test. The cohort register's budget is for 25 women by 41 columns, its page of women answered by the test.
 * The shared docs DHIS2 is never changed.
 */
const REGISTER = 'tracker-data-entry/tracker-register'
const COHORT = 'tracker-data-entry/cohort-anc-register'
const DIASTOLIC = 'dyYdfamSY2Z'

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
    name: string,
    example = REGISTER,
    prepare: (on: Page) => Promise<void> = async () => {}
) => {
    const measureOn = async (on: Page) => {
        await prepare(on)
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

const WOMEN = 25

// What the copies rewrite: each record's own id. The rules' batch carries no person id.
const CopiedSchema = z.looseObject({
    enrollment: z.string(),
    trackedEntity: z.string().optional(),
    events: z.array(z.looseObject({ event: z.string() })).optional(),
})
const AnswerSchema = z.looseObject({ enrollments: z.array(CopiedSchema) })

/** Copy `copy` of an id: 11 characters no object on the server has, the same in every answer. */
const copyId = (id: string, copy: number) =>
    `${id.slice(0, 8)}x${String(copy).padStart(2, '0')}`

/** Copy `copy` of an enrolment (0 is the enrolment itself), with its person and events under their copies' ids. */
const copyOf = (enrollment: z.infer<typeof CopiedSchema>, copy: number) => {
    const ids = [
        enrollment.enrollment,
        enrollment.trackedEntity,
        ...(enrollment.events ?? []).map(({ event }) => event),
    ].flatMap((id) => (id === undefined || copy === 0 ? [] : [id]))
    return CopiedSchema.parse(
        JSON.parse(
            ids.reduce(
                (text, id) =>
                    text.replaceAll(`"${id}"`, `"${copyId(id, copy)}"`),
                JSON.stringify(enrollment)
            )
        )
    )
}

/**
 * Answers the cohort register's page of women with 25: the demo's real ones at Ngelehun CHC in January 2027, then
 * copies of them under fresh ids; the rules' batch read of those women gets the same copies.
 */
const twentyFiveWomen = async (page: Page) => {
    // The copy's enrolment id: the real one it copies, and which copy it is.
    const copies = new Map<string, { real: string; copy: number }>()
    await page.route('**/tracker/enrollments?*', async (route) => {
        const url = new URL(route.request().url())
        const asked = url.searchParams.get('enrollments')?.split(',')
        if (asked === undefined) {
            const response = await route.fetch()
            const body = AnswerSchema.parse(await response.json())
            const real = body.enrollments
            expect(real.length, 'women in January 2027').toBeGreaterThan(0)
            const enrollments = Array.from({ length: WOMEN }, (_, at) => {
                const copy = Math.floor(at / real.length)
                const of = real[at % real.length]!
                copies.set(copyId(of.enrollment, copy), {
                    real: of.enrollment,
                    copy,
                })
                return copyOf(of, copy)
            })
            await route.fulfill({ response, json: { ...body, enrollments } })
            return
        }
        const wanted = asked.map(
            (id) => copies.get(id) ?? { real: id, copy: 0 }
        )
        url.searchParams.set(
            'enrollments',
            [...new Set(wanted.map(({ real }) => real))].join(',')
        )
        const response = await route.fetch({ url: url.toString() })
        const body = AnswerSchema.parse(await response.json())
        const byId = new Map(
            body.enrollments.map((one) => [one.enrollment, one])
        )
        await route.fulfill({
            response,
            json: {
                ...body,
                enrollments: wanted.flatMap(({ real, copy }) => {
                    const one = byId.get(real)
                    return one === undefined ? [] : [copyOf(one, copy)]
                }),
            },
        })
    })
}

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

test('cohort register shows 25 women by 41 columns within 1 s', async ({
    page,
    browser,
}, testInfo) => {
    const loads = await onThreeLoads(
        page,
        browser,
        testInfo,
        'data-entry:ready',
        COHORT,
        twentyFiveWomen
    )
    await expect(page.locator('tbody tr')).toHaveCount(WOMEN)
    await expect(page.locator('tbody td')).toHaveCount(WOMEN * 41)
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
