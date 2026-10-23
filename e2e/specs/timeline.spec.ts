// The package intentionally exposes the builder as both its default and named export.
// eslint-disable-next-line import/no-named-as-default
import AxeBuilder from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'
import { e2eEnvironment, expect, test } from '../fixtures/test'
import seed from '../metadata/timeline-tracker-data.json'
import {
    EventsSchema,
    importTracker,
    NotesSchema,
    SeededEventsSchema,
    SystemInfoSchema,
    type TrackerImport,
} from './timeline.support'

// Seeded by scripts/e2e/seed-metadata.sh from
// e2e/metadata/timeline-{metadata,tracker-data}.json: one water point with
// a completed enrollment (55 completed inspections in 2024) and an active one
// (completed, active, skipped, overdue and two future events). Fixed past and
// far-future dates keep "now" between them without fixing the clock.
const PROGRAM = 'TlE2ePrg001'
const TRACKED_ENTITY = 'TlE2eTei001'
const TRACKED_ENTITY_TYPE = 'TlE2eTet001'
const ORG_UNIT = 'DiszpKrYNg8'
const INSPECTION_STAGE = 'TlE2eStg001'
const ACTIVE_ENROLLMENT = 'TlE2eEnr002'
const COMPLETED_EVENT = 'TlE2eEvt001'
const ACTIVE_EVENT = 'TlE2eEvt003'
const OVERDUE_EVENT = 'TlE2eEvt004'
const FUTURE_EVENT = 'TlE2eEvt005'
// In the maintenance stage, which hides due dates.
const FUTURE_HIDDEN_DUE_EVENT = 'TlE2eEvt006'
const OLDEST_INSPECTION = 'TlE2eF00001'
const WATER_POINT_NAME = 'TlE2eAtr001'
const FLOW_RATE = 'TlE2eDe0001'
const WATER_QUALITY = 'TlE2eDe0002'
// 55 inspections plus 6 events in the active enrollment: more than the case
// history shows at first (50 past entries) and more than one page of the
// updated-today demo (50 events), so both demos offer "Show older entries".
const SEEDED_EVENTS = 61
const username = process.env.E2E_DHIS2_USERNAME ?? 'admin'
const password = process.env.E2E_DHIS2_PASSWORD ?? 'district'

// The server runs in UTC and stores times as server-local; a UTC browser keeps
// "today" the same day for the feed, the server and the test.
test.use({ timezoneId: 'UTC' })

const pad = (value: number) => value.toString().padStart(2, '0')
const isoDay = (date: Date) =>
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
const today = () => isoDay(new Date())
const tomorrow = () => {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() + 1)
    return isoDay(date)
}

/** A stored day as the feed shows it to the suite's English user in the ISO calendar, such as "Feb 3, 2026". */
const shownDay = (day: string) =>
    new Intl.DateTimeFormat('en', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(`${day}T00:00:00Z`))

// No program: the case history covers every program the record is enrolled in.
const caseHistoryUrl = `/#/timeline?${new URLSearchParams({ te: TRACKED_ENTITY }).toString()}`
const updatedTodayUrl = `/#/timeline/updated-today?${new URLSearchParams({ program: PROGRAM, orgUnit: ORG_UNIT }).toString()}`

/**
 * The fixture signs in on the Working List route, which starts loading its
 * programs. Leaving that route mid-request cancels it, and the fixture reports
 * the aborted request, so let the root route settle first.
 */
const openDemo = async (page: Page, url: string) => {
    await page.waitForLoadState('networkidle')
    await page.goto(url)
}

const feed = (page: Page) => page.getByRole('main')

/** A day group (or the Overdue group), named by its heading. */
const group = (page: Page, label: string) =>
    feed(page).getByRole('region', { name: label, exact: true })

/** The entry of one event, found by its "Open in Capture" link. */
const eventEntry = (page: Page, event: string) =>
    feed(page)
        .locator('[data-slot="timeline-event"]')
        .filter({
            has: page.locator(`a[href*="eventId=${event}&"]`),
        })

const showMore = (page: Page) =>
    feed(page).getByRole('button', { name: 'Show older entries', exact: true })

/**
 * Presses "Show older entries" until everything is on show. Each run of the "after an
 * update" tests adds saves to the record, so a stack reused between runs has
 * more entries than one press reveals.
 */
const showAll = async (page: Page) => {
    while ((await showMore(page).count()) > 0) {
        const shown = await feed(page)
            .locator('li[data-timeline-entry]')
            .count()
        await showMore(page).click()
        await expect
            .poll(() => feed(page).locator('li[data-timeline-entry]').count())
            .toBeGreaterThan(shown)
    }
}

const openCaseHistory = async (page: Page) => {
    await openDemo(page, caseHistoryUrl)
    await expect(eventEntry(page, COMPLETED_EVENT)).toBeVisible({
        timeout: 30_000,
    })
    // Every request has answered once the page offers older entries.
    await expect(showMore(page)).toBeVisible()
}

/** The feed's top level in order: day headings, "Overdue" and "Now". */
const feedOutline = (page: Page) =>
    feed(page)
        .locator('ol')
        .first()
        .evaluate((list) =>
            [...list.children].map((item) =>
                item.querySelector('[data-slot="timeline-now"]') !== null
                    ? 'Now'
                    : (item.querySelector('h3')?.textContent ?? '')
            )
        )

/**
 * A stable key per entry in DOM order: an event's Capture link (its uid), else
 * the entry's stored times and its label or note text, none of which wait on
 * metadata or org unit names.
 */
const entryKeys = (page: Page) =>
    feed(page)
        .locator('li[data-timeline-entry]')
        .evaluateAll((items) =>
            items.map((item) => {
                const capture = item
                    .querySelector('a[href*="eventId="]')
                    ?.getAttribute('href')
                if (capture != null) {
                    return capture
                }
                const times = [...item.querySelectorAll('time')].map((time) =>
                    time.getAttribute('datetime')
                )
                const label =
                    item.querySelector('[data-slot="timeline-note-text"]')
                        ?.textContent ??
                    item.querySelector('.font-medium')?.textContent ??
                    ''
                return `${times.join('|')}|${label}`
            })
        )

/** A heading such as "May 14, 2026" as a time, to compare headings by date. */
const headingTime = (heading: string) => Date.parse(`${heading} 00:00 UTC`)

const value = (entry: Locator, name: string) =>
    entry
        .locator('dt', { hasText: name })
        .locator('xpath=following-sibling::dd[1]')

const renameWaterPoint = (value: string): TrackerImport => ({
    trackedEntities: [
        {
            trackedEntity: TRACKED_ENTITY,
            trackedEntityType: TRACKED_ENTITY_TYPE,
            orgUnit: ORG_UNIT,
            attributes: [{ attribute: WATER_POINT_NAME, value }],
        },
    ],
})

const inspectActiveEvent = (
    flowRate: string,
    quality: string
): TrackerImport => ({
    events: [
        {
            event: ACTIVE_EVENT,
            program: PROGRAM,
            programStage: INSPECTION_STAGE,
            enrollment: ACTIVE_ENROLLMENT,
            trackedEntity: TRACKED_ENTITY,
            orgUnit: ORG_UNIT,
            status: 'ACTIVE',
            occurredAt: '2026-05-14T00:00:00.000',
            scheduledAt: '2026-05-14T00:00:00.000',
            dataValues: [
                { dataElement: FLOW_RATE, value: flowRate },
                { dataElement: WATER_QUALITY, value: quality },
            ],
        },
    ],
})

test.describe('timeline', () => {
    // The tests share one seeded record, and two of them save to it (the
    // update below, and re-saving the seed for "updated today"), so they run
    // one after another even under fullyParallel.
    test.describe.configure({ mode: 'serial' })

    test('shows future, now, overdue and past in order', async ({
        dhis2,
        page,
    }) => {
        // Notes keep the time they were imported, so their day is read, not assumed.
        const response = await dhis2.get(
            `/api/tracker/trackedEntities/${TRACKED_ENTITY}`,
            {
                params: {
                    program: PROGRAM,
                    fields: 'enrollments[notes[value,storedAt]]',
                },
            }
        )
        expect(response.ok()).toBe(true)
        const notes = NotesSchema.parse(await response.json())
        expect(notes).toHaveLength(2)

        await openCaseHistory(page)
        await showAll(page)

        const outline = await feedOutline(page)
        expect(outline.slice(0, 4)).toEqual([
            shownDay('2090-09-01'),
            shownDay('2090-06-15'),
            'Now',
            'Overdue',
        ])
        // The past runs newest first, one group per day.
        const past = outline.slice(4)
        const times = past.map(headingTime)
        expect(times.every((time) => Number.isFinite(time))).toBe(true)
        expect(times).toEqual([...times].sort((a, b) => b - a))
        expect(new Set(past).size).toBe(past.length)
        for (const day of [
            '2026-05-14',
            '2026-03-20',
            '2026-02-03',
            ...notes.map((note) => note.storedAt.slice(0, 10)),
        ]) {
            expect(past).toContain(shownDay(day))
        }

        const overdue = group(page, 'Overdue')
        await expect(
            overdue.locator('[data-slot="timeline-event"]')
        ).toHaveCount(1)
        await expect(eventEntry(page, OVERDUE_EVENT)).toBeVisible()
        await expect(
            overdue.getByText(`Due ${shownDay('2026-07-01')}`, { exact: true })
        ).toBeVisible()

        // Above "now" and under its due day, its place says it is scheduled
        // and when: no badge, no due date.
        const future = group(page, shownDay('2090-06-15'))
        await expect(eventEntry(page, FUTURE_EVENT)).toBeVisible()
        await expect(
            future.getByText('Scheduled', { exact: true })
        ).toHaveCount(0)
        await expect(future.getByText(/^Due /)).toHaveCount(0)

        // The maintenance stage hides due dates.
        const hidden = eventEntry(page, FUTURE_HIDDEN_DUE_EVENT)
        await expect(hidden).toBeVisible()
        await expect(
            hidden.getByText('Scheduled', { exact: true })
        ).toHaveCount(0)
        await expect(hidden.getByText(/^Due /)).toHaveCount(0)

        await expect(
            group(page, shownDay('2026-03-20')).getByText('Skipped', {
                exact: true,
            })
        ).toBeVisible()
        await expect(
            group(page, shownDay('2026-05-14')).getByText('Active', {
                exact: true,
            })
        ).toBeVisible()
        await expect(
            group(page, shownDay('2026-02-03')).getByText('Completed', {
                exact: true,
            })
        ).toBeVisible()
        await expect(
            group(page, shownDay('2026-01-10')).getByText('Enrolled', {
                exact: true,
            })
        ).toBeVisible()
        // Each enrollment note sits in the group of the day it was stored.
        for (const note of notes) {
            await expect(
                group(page, shownDay(note.storedAt.slice(0, 10))).getByText(
                    note.value,
                    { exact: true }
                )
            ).toBeVisible()
        }
    })

    test('renders option names and dates in the system calendar', async ({
        dhis2,
        page,
    }) => {
        const response = await dhis2.get('/api/system/info', {
            params: { fields: 'calendar' },
        })
        expect(response.ok()).toBe(true)
        // The demo databases use the ISO calendar, which shownDay formats.
        expect(SystemInfoSchema.parse(await response.json()).calendar).toBe(
            'iso8601'
        )

        await openCaseHistory(page)

        const completed = eventEntry(page, COMPLETED_EVENT)
        await expect(
            group(page, shownDay('2026-02-03')).locator(
                '[data-slot="timeline-event"]'
            )
        ).toHaveCount(1)
        await expect(
            completed.getByText('Timeline E2E inspection')
        ).toBeVisible()
        await expect(completed.getByText('Ngelehun CHC')).toBeVisible()
        await expect(value(completed, 'Flow rate')).toHaveText('12.5')
        await expect(value(completed, 'Water quality')).toHaveText(
            'Safe to drink'
        )
        // Not shown in reports, so not a key value.
        await expect(completed.getByText('Inspector remarks')).toHaveCount(0)
        await expect(completed.getByText('SAFE', { exact: true })).toHaveCount(
            0
        )

        // A single note shows as it is.
        await expect(
            completed.getByText('Sample sent to the district laboratory.')
        ).toBeVisible()
    })

    test('shows more without moving entries already shown', async ({
        page,
    }) => {
        await openCaseHistory(page)
        // Entries appear with their names resolved: no ids first.
        await expect(
            eventEntry(page, COMPLETED_EVENT).getByText('Ngelehun CHC', {
                exact: true,
            })
        ).toBeVisible()
        await expect(
            eventEntry(page, COMPLETED_EVENT).getByText(
                'Timeline E2E inspection',
                { exact: true }
            )
        ).toBeVisible()
        await expect(
            feed(page).getByText(ORG_UNIT, { exact: true })
        ).toHaveCount(0)

        const before = await entryKeys(page)
        expect(before.length).toBeGreaterThan(0)
        await expect(eventEntry(page, OLDEST_INSPECTION)).toHaveCount(0)

        await showMore(page).click()

        await expect
            .poll(async () => (await entryKeys(page)).length)
            .toBeGreaterThan(before.length)
        const after = await entryKeys(page)
        expect(after.slice(0, before.length)).toEqual(before)
        // Focus moves to the first entry that arrived.
        await expect(
            feed(page).locator('li[data-timeline-entry]').nth(before.length)
        ).toBeFocused()

        await showAll(page)
        await expect(eventEntry(page, OLDEST_INSPECTION)).toBeVisible()
        await expect(
            eventEntry(page, OLDEST_INSPECTION).getByText('Ngelehun CHC', {
                exact: true,
            })
        ).toBeVisible()
        await expect(
            group(page, shownDay('2024-03-04')).locator(
                '[data-slot="timeline-event"]'
            )
        ).toHaveCount(1)
    })

    test.describe('after an update', () => {
        test.beforeAll(async ({ playwright }) => {
            const api = await playwright.request.newContext({
                baseURL: e2eEnvironment.dhis2Url,
                extraHTTPHeaders: {
                    Accept: 'application/json',
                    // DHIS2 redirects to its login page instead of answering 401,
                    // so the credentials go with the first request.
                    Authorization: `Basic ${globalThis.btoa(`${username}:${password}`)}`,
                },
            })
            // Back to the seeded values first, so the latest save on any run is
            // the one asserted below.
            await importTracker(api, renameWaterPoint('Mile 91 borehole'))
            await importTracker(api, inspectActiveEvent('9.8', 'TREAT'))
            await importTracker(
                api,
                renameWaterPoint('Mile 91 borehole (rehabilitated)')
            )
            await importTracker(api, inspectActiveEvent('11.2', 'SAFE'))
            await api.dispose()
        })

        test("shows an attribute change and an event's changes after an update", async ({
            page,
        }) => {
            await openCaseHistory(page)

            const rename = group(page, shownDay(today()))
                .locator('[data-slot="timeline-change"]')
                .filter({
                    has: page.locator('[data-slot="timeline-change-field"]', {
                        hasText: 'Water point name',
                    }),
                })
                .first()
            await expect(rename).toBeVisible()
            await expect(rename.getByText(/ changed 1 field$/)).toBeVisible()
            await expect(
                rename.getByText(
                    'Mile 91 borehole → Mile 91 borehole (rehabilitated)',
                    { exact: true }
                )
            ).toBeVisible()

            const active = eventEntry(page, ACTIVE_EVENT)
            await expect(value(active, 'Flow rate')).toHaveText('11.2')
            await expect(value(active, 'Water quality')).toHaveText(
                'Safe to drink'
            )
            await active.getByRole('button', { name: 'Show changes' }).click()
            const latestSave = active
                .locator('[data-slot="timeline-change"]')
                .first()
            await expect(
                latestSave.getByText(/ changed 2 fields$/)
            ).toBeVisible()
            await expect(
                latestSave
                    .locator('li')
                    .filter({ hasText: 'Flow rate' })
                    .getByText('9.8 → 11.2', { exact: true })
            ).toBeVisible()
            await expect(
                latestSave
                    .locator('li')
                    .filter({ hasText: 'Water quality' })
                    .getByText('Needs treatment → Safe to drink', {
                        exact: true,
                    })
            ).toBeVisible()
            await expect(
                active.getByRole('button', { name: 'Hide changes' })
            ).toBeVisible()
        })
    })

    test('has no axe violations', async ({ page }) => {
        await openCaseHistory(page)
        await eventEntry(page, ACTIVE_EVENT)
            .getByRole('button', { name: 'Show changes' })
            .click()
        await expect(
            eventEntry(page, ACTIVE_EVENT).getByRole('button', {
                name: 'Hide changes',
            })
        ).toBeVisible()
        await expect(feed(page).getByText('Loading changes')).toHaveCount(0)

        const accessibility = await new AxeBuilder({ page })
            .include('main')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze()
        expect(accessibility.violations).toEqual([])
    })

    test('lists the events updated today, newest update first', async ({
        dhis2,
        page,
    }) => {
        // Saving the seeded events again (same values) moves their updatedAt
        // to now, whatever day the stack was seeded.
        const { events } = SeededEventsSchema.parse(seed)
        expect(events).toHaveLength(SEEDED_EVENTS)
        await importTracker(dhis2, { events })

        const request = page.waitForRequest(
            (candidate) =>
                new URL(candidate.url()).pathname.endsWith('/tracker/events') &&
                new URL(candidate.url()).searchParams.get('orgUnit') ===
                    ORG_UNIT
        )
        await openDemo(page, updatedTodayUrl)
        const params = new URL((await request).url()).searchParams
        expect(Object.fromEntries(params)).toMatchObject({
            program: PROGRAM,
            orgUnit: ORG_UNIT,
            updatedAfter: `${today()}T00:00:00`,
            updatedBefore: `${tomorrow()}T00:00:00`,
            order: 'updatedAt:desc,event:asc',
            page: '1',
            pageSize: '50',
        })

        // The server honours the window: the same request returns the events
        // just saved, all updated today, newest first, and none of them for a
        // window that starts tomorrow or ends at today's start.
        const replay = async (overrides: Record<string, string>) => {
            const response = await dhis2.get('/api/tracker/events', {
                params: {
                    ...Object.fromEntries(params),
                    fields: 'event,updatedAt',
                    pageSize: String(SEEDED_EVENTS + 10),
                    ...overrides,
                },
            })
            expect(response.ok()).toBe(true)
            return EventsSchema.parse(await response.json())
        }
        const updated = await replay({})
        expect(updated).toHaveLength(SEEDED_EVENTS)
        for (const event of updated) {
            expect(event.updatedAt.slice(0, 10)).toBe(today())
        }
        const times = updated.map((event) => event.updatedAt)
        expect(times).toEqual([...times].sort().reverse())
        expect(
            await replay({ updatedAfter: `${tomorrow()}T00:00:00` })
        ).toEqual([])
        expect(await replay({ updatedBefore: `${today()}T00:00:00` })).toEqual(
            []
        )

        await expect(
            group(page, shownDay(today())).locator(
                '[data-slot="timeline-event"]'
            )
        ).not.toHaveCount(0, { timeout: 30_000 })
        await expect(eventEntry(page, OVERDUE_EVENT)).toBeVisible()
        await expect(showMore(page)).toBeVisible()

        const link = eventEntry(page, COMPLETED_EVENT).getByRole('link', {
            name: 'Open in Capture',
        })
        await expect(link).toHaveAttribute(
            'href',
            `${e2eEnvironment.proxyUrl ?? e2eEnvironment.dhis2Url}/dhis-web-capture/index.html#/enrollmentEventEdit?eventId=${COMPLETED_EVENT}&orgUnitId=${ORG_UNIT}`
        )
    })
})
