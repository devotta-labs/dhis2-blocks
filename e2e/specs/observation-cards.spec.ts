// The package intentionally exposes the builder as both its default and named export.
// eslint-disable-next-line import/no-named-as-default
import AxeBuilder from '@axe-core/playwright'
import type { APIRequestContext, Page } from '@playwright/test'
import { z } from 'zod'
import { expect, test } from '../fixtures/test'

// Seeded by scripts/e2e/seed-metadata.sh from
// e2e/metadata/observation-cards-{metadata,tracker-data}.json.
const SEEDED_PERSON = 'ObE2eTei001'
const SCHEDULED_EVENT = 'ObE2eEvt006'
const SYSTOLIC = 'Systolic blood pressure'
const EXTREME_PALLOR = 'Extreme pallor'
const SMOKING_STATUS = 'Smoking status'
const LATEST_VISIT = '2025-08-12'
// How the cards show the visit dates for the suite's English user.
const LATEST_VISIT_SHOWN = 'Aug 12, 2025'
const PREVIOUS_VISIT_SHOWN = 'May 20, 2025'
const FIRST_VISIT_SHOWN = 'Mar 4, 2024'
const INTAKE_STAGE = 'Observation cards E2E intake'
const FOLLOW_UP_STAGE = 'Observation cards E2E follow-up'
// Fixed so staleness (the seeded preset sets 180 days) never drifts with the
// real date: smoking (2024-03-04) is stale, the latest visit (2025-08-12) not.
const DEMO_NOW = new Date('2025-09-01T00:00:00Z')

const RMNCH_PROGRAM = 'WSGAb5XwJ3Y'
const RMNCH_HAEMOGLOBIN = 'vANAXwtLwcT'
const EVENTS_PAGE_SIZE = 500
const MAX_EVENT_PAGES = 20

const demoUrl = (preset: 'rmnch' | 'seeded', trackedEntityId: string) =>
    `/#/observation-cards?${new URLSearchParams({ preset, te: trackedEntityId }).toString()}`

/** The card a data element renders, named by its label through aria-labelledby. */
const card = (page: Page, label: string) =>
    page.getByRole('group', { name: label, exact: true })

/**
 * The fixture signs in on the Working List route, which starts loading its
 * programs. Leaving that route mid-request cancels it, and the fixture reports
 * the aborted request, so let the root route settle first.
 */
const openDemo = async (
    page: Page,
    preset: 'rmnch' | 'seeded',
    trackedEntityId: string
) => {
    await page.waitForLoadState('networkidle')
    await page.goto(demoUrl(preset, trackedEntityId))
}

const openSeededPerson = async (page: Page) => {
    await page.clock.setFixedTime(DEMO_NOW)
    await openDemo(page, 'seeded', SEEDED_PERSON)
    await expect(card(page, SYSTOLIC)).toBeVisible({ timeout: 30_000 })
}

const TrackerEventSchema = z
    .object({
        trackedEntity: z.string().optional(),
        status: z.string(),
        occurredAt: z.string().nullish(),
        dataValues: z
            .array(
                z
                    .object({ dataElement: z.string(), value: z.string() })
                    .passthrough()
            )
            .default([]),
    })
    .passthrough()

// DHIS2 2.41 answers with `instances`; later versions with `events`.
const TrackerEventsPageSchema = z
    .object({
        events: z.array(TrackerEventSchema).optional(),
        instances: z.array(TrackerEventSchema).optional(),
    })
    .passthrough()
    .transform((page) => page.events ?? page.instances ?? [])

const ScheduledEventSchema = TrackerEventSchema.extend({
    scheduledAt: z.string(),
})

const DataElementLabelSchema = z
    .object({
        displayName: z.string(),
        displayFormName: z.string().nullish(),
    })
    .passthrough()
    .transform(
        // `||` as the hook does: an empty form name falls back too.
        (dataElement) => dataElement.displayFormName || dataElement.displayName
    )

const isNumeric = (value: string) =>
    value.trim() !== '' && Number.isFinite(Number(value))

/**
 * A tracked entity in the RMNCH programme with at least two plottable
 * haemoglobin readings, counted the way the trend card counts them.
 */
const findRmnchPersonWithHaemoglobinTrend = async (
    dhis2: APIRequestContext
): Promise<string> => {
    const readings = new Map<string, number>()
    for (let page = 1; page <= MAX_EVENT_PAGES; page++) {
        const response = await dhis2.get('/api/tracker/events', {
            params: {
                program: RMNCH_PROGRAM,
                orgUnitMode: 'ACCESSIBLE',
                fields: 'trackedEntity,status,occurredAt,dataValues[dataElement,value]',
                page: String(page),
                pageSize: String(EVENTS_PAGE_SIZE),
            },
        })
        expect(response.ok()).toBe(true)
        const events = TrackerEventsPageSchema.parse(await response.json())

        for (const event of events) {
            const haemoglobin = event.dataValues.find(
                (dataValue) => dataValue.dataElement === RMNCH_HAEMOGLOBIN
            )
            if (
                event.trackedEntity === undefined ||
                !['ACTIVE', 'COMPLETED'].includes(event.status) ||
                !event.occurredAt ||
                haemoglobin === undefined ||
                !isNumeric(haemoglobin.value)
            ) {
                continue
            }
            const count = (readings.get(event.trackedEntity) ?? 0) + 1
            if (count >= 2) {
                return event.trackedEntity
            }
            readings.set(event.trackedEntity, count)
        }
        if (events.length < EVENTS_PAGE_SIZE) {
            break
        }
    }
    throw new Error(
        `No tracked entity in ${RMNCH_PROGRAM} has two ${RMNCH_HAEMOGLOBIN} readings.`
    )
}

test.describe('observation cards', () => {
    test('seeded person shows systolic 142 High with ▲ 6 and five readings', async ({
        page,
    }) => {
        await openSeededPerson(page)
        const systolic = card(page, SYSTOLIC)

        await expect(systolic.getByText('142', { exact: true })).toBeVisible()
        await expect(systolic.getByText('mmHg', { exact: true })).toBeVisible()
        await expect(systolic.getByText('High', { exact: true })).toBeVisible()
        // The glyph is hidden from screen readers, which hear "up" instead.
        const change = systolic.getByText(
            `▲ up 6 mmHg from previous (${PREVIOUS_VISIT_SHOWN})`,
            {
                exact: true,
            }
        )
        await expect(change).toBeVisible()
        await expect(change.locator('[aria-hidden="true"]')).toHaveText('▲')
        await expect(
            systolic.getByText(
                `5 readings from ${FIRST_VISIT_SHOWN} to ${LATEST_VISIT_SHOWN}, latest 142`,
                { exact: true }
            )
        ).toHaveCount(1)
    })

    test('the scheduled event adds no reading', async ({ dhis2, page }) => {
        // Guard against a vacuous pass: the seed must hold a later, empty
        // SCHEDULE event for the person.
        const response = await dhis2.get(
            `/api/tracker/events/${SCHEDULED_EVENT}`,
            { params: { fields: 'status,scheduledAt,occurredAt,dataValues' } }
        )
        expect(response.ok()).toBe(true)
        const scheduled = ScheduledEventSchema.parse(await response.json())
        expect(scheduled.status).toBe('SCHEDULE')
        expect(scheduled.dataValues).toEqual([])
        expect(scheduled.scheduledAt.slice(0, 10) > LATEST_VISIT).toBe(true)

        await openSeededPerson(page)
        const systolic = card(page, SYSTOLIC)

        await expect(
            systolic.getByText(
                `Recorded ${LATEST_VISIT_SHOWN} · ${FOLLOW_UP_STAGE}`,
                {
                    exact: true,
                }
            )
        ).toBeVisible()
        await expect(
            systolic.getByText(
                `5 readings from ${FIRST_VISIT_SHOWN} to ${LATEST_VISIT_SHOWN}, latest 142`,
                { exact: true }
            )
        ).toHaveCount(1)
        await expect(
            card(page, EXTREME_PALLOR).getByText(
                `Recorded ${LATEST_VISIT_SHOWN} · ${FOLLOW_UP_STAGE}`,
                { exact: true }
            )
        ).toBeVisible()
    })

    test('extreme pallor reads No', async ({ page }) => {
        await openSeededPerson(page)
        const pallor = card(page, EXTREME_PALLOR)

        await expect(pallor.getByText('No', { exact: true })).toBeVisible()
        await expect(pallor.getByText('Yes', { exact: true })).toHaveCount(0)
    })

    test('extreme pallor, recorded at the latest visit, is not stale', async ({
        page,
    }) => {
        await openSeededPerson(page)
        const pallor = card(page, EXTREME_PALLOR)

        await expect(pallor).toHaveAttribute('data-tone', 'default')
        await expect(pallor.getByText(/^Out of date/)).toHaveCount(0)
    })

    test('smoking status is stale', async ({ page }) => {
        await openSeededPerson(page)
        const smoking = card(page, SMOKING_STATUS)

        await expect(smoking).toHaveAttribute('data-tone', 'stale')
        await expect(
            smoking.getByText('Former smoker', { exact: true })
        ).toBeVisible()
        await expect(
            smoking.getByText(
                `Recorded ${FIRST_VISIT_SHOWN} · ${INTAKE_STAGE}`,
                {
                    exact: true,
                }
            )
        ).toBeVisible()
        await expect(
            smoking.getByText('Out of date: last recorded over 180 days ago', {
                exact: true,
            })
        ).toBeVisible()
    })

    test('RMNCH haemoglobin renders a number', async ({ dhis2, page }) => {
        const trackedEntityId = await findRmnchPersonWithHaemoglobinTrend(dhis2)
        const labelResponse = await dhis2.get(
            `/api/dataElements/${RMNCH_HAEMOGLOBIN}`,
            { params: { fields: 'displayName,displayFormName' } }
        )
        expect(labelResponse.ok()).toBe(true)
        const label = DataElementLabelSchema.parse(await labelResponse.json())

        await openDemo(page, 'rmnch', trackedEntityId)
        const haemoglobin = card(page, label)
        await expect(haemoglobin).toBeVisible({ timeout: 30_000 })

        await expect(
            haemoglobin.getByText(/^\d+(?:\.\d+)?$/).first()
        ).toBeVisible()
        await expect(
            haemoglobin.getByText('g/dL', { exact: true })
        ).toBeVisible()
        await expect(
            haemoglobin.getByText(
                /^\d+ readings from \d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}, latest \d+(?:\.\d+)?$/
            )
        ).toHaveCount(1)
    })

    test('the seeded page has no serious accessibility violations', async ({
        page,
    }) => {
        await openSeededPerson(page)
        await expect(card(page, SMOKING_STATUS)).toBeVisible()

        const accessibility = await new AxeBuilder({ page })
            .include('[data-testid="observation-cards-demo"]')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze()
        expect(
            accessibility.violations.filter((violation) =>
                ['serious', 'critical'].includes(violation.impact ?? '')
            )
        ).toEqual([])
    })
})
