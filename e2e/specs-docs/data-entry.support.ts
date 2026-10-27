// The package exposes the builder as both its default and named export.
// eslint-disable-next-line import/no-named-as-default
import AxeBuilder from '@axe-core/playwright'
import { isDeepStrictEqual } from 'node:util'
import type {
    APIRequestContext,
    Locator,
    Page,
    Request,
} from '@playwright/test'
import { z } from 'zod'
import { expect, test as base } from './fixtures'

/**
 * Helpers for the data entry gallery on the docs DHIS2. That database is shared
 * test data: `test`'s `shared` fixture deletes every event a test makes and puts
 * back every existing event the grid saves, as the API read it before the test.
 */

export const DataValueSchema = z.object({
    dataElement: z.string(),
    value: z.string(),
})
const EventSchema = z.object({
    event: z.string(),
    program: z.string(),
    programStage: z.string(),
    orgUnit: z.string(),
    enrollment: z.string().optional(),
    status: z.string(),
    occurredAt: z.string(),
    scheduledAt: z.string().optional(),
    completedAt: z.string().optional(),
    geometry: z.json().optional(),
    assignedUser: z.json().optional(),
    attributeOptionCombo: z.string().optional(),
    dataValues: z.array(DataValueSchema),
})
type ApiEvent = z.infer<typeof EventSchema>
// Every field, so an event put back after a test is put back whole.
const EVENT_FIELDS = '*'
// The event's own fields an update sets: one it is not sent is erased.
const OWN_FIELDS = [
    'occurredAt',
    'scheduledAt',
    'status',
    'completedAt',
    'geometry',
    'assignedUser',
    'attributeOptionCombo',
] as const
const ownFields = (event?: ApiEvent) =>
    Object.fromEntries(OWN_FIELDS.map((field) => [field, event?.[field]]))

export const readEvents = async (
    request: APIRequestContext,
    params: Record<string, string>
) => {
    const response = await request.get('/dhis2/api/tracker/events', {
        params: { ...params, fields: EVENT_FIELDS },
    })
    expect(response.ok()).toBe(true)
    return z
        .object({ events: z.array(EventSchema) })
        .parse(await response.json()).events
}

/** The event as DHIS2 holds it, or `undefined` when it does not. */
export const readEvent = async (request: APIRequestContext, id: string) => {
    const response = await request.get(`/dhis2/api/tracker/events/${id}`, {
        params: { fields: EVENT_FIELDS },
    })
    return response.status() === 404
        ? undefined
        : EventSchema.parse(await response.json())
}

type EventPayload = Omit<Partial<ApiEvent>, 'dataValues'> & {
    event: string
    dataValues?: Array<{ dataElement: string; value: string | null }>
}

const importEvents = async (
    request: APIRequestContext,
    importStrategy: 'UPDATE' | 'DELETE',
    events: ReadonlyArray<EventPayload>
) => {
    const response = await request.post('/dhis2/api/tracker', {
        params: { async: 'false', importStrategy },
        data: { events },
    })
    expect(response.ok(), await response.text()).toBe(true)
}

export const valuesOf = (event?: Pick<ApiEvent, 'dataValues'>) =>
    new Map(
        (event?.dataValues ?? []).map(({ dataElement, value }) => [
            dataElement,
            value,
        ])
    )

/**
 * Puts back the values and the own fields (dates, status, place, assignee, category options) an existing event had
 * before the test, sending every own field DHIS2 held, since an update erases those it is not sent; returns how many
 * values changed.
 */
const restore = async (request: APIRequestContext, original: ApiEvent) => {
    const now = await readEvent(request, original.event)
    expect(now, `event ${original.event} still exists`).toBeDefined()
    const was = valuesOf(original)
    const is = valuesOf(now)
    const dataValues = [...new Set([...was.keys(), ...is.keys()])]
        .filter((dataElement) => was.get(dataElement) !== is.get(dataElement))
        .map((dataElement) => ({
            dataElement,
            value: was.get(dataElement) ?? null,
        }))
    if (
        dataValues.length > 0 ||
        !isDeepStrictEqual(ownFields(now), ownFields(original))
    ) {
        await importEvents(request, 'UPDATE', [{ ...original, dataValues }])
    }
    const after = await readEvent(request, original.event)
    expect(valuesOf(after)).toEqual(was)
    expect(ownFields(after)).toEqual(ownFields(original))
    return dataValues.length
}

export const TRACKER_IMPORT = /\/api\/(?:\d+\/)?tracker$/
const ImportSchema = z.object({
    events: z.array(z.object({ event: z.string() })).default([]),
})

interface SharedData {
    /** Events as the API read them before the test: each one the grid saves is restored afterwards. */
    keep(events: ReadonlyArray<ApiEvent>): void
    /** A row the test added: its event is deleted afterwards if the grid created it. */
    adds(eventId: string): void
}

export const test = base.extend<{ shared: SharedData }>({
    // Every test, using it or not, fails on a save it did not expect.
    shared: [
        async ({ page, request }, use, testInfo) => {
            const kept = new Map<string, ApiEvent>()
            const added = new Set<string>()
            const saved = new Set<string>()
            const sending = new Set<Request>()
            const onRequest = (sent: Request) => {
                if (
                    sent.method() === 'POST' &&
                    TRACKER_IMPORT.test(new URL(sent.url()).pathname)
                ) {
                    sending.add(sent)
                    for (const { event } of ImportSchema.parse(
                        sent.postDataJSON()
                    ).events) {
                        saved.add(event)
                    }
                }
            }
            const onDone = (done: Request) => sending.delete(done)
            page.on('request', onRequest)
            page.on('requestfinished', onDone)
            page.on('requestfailed', onDone)

            await use({
                keep: (events) =>
                    events.forEach((event) => kept.set(event.event, event)),
                adds: (eventId) => added.add(eventId),
            })

            // Every event is put back or deleted even when another one fails; the failures are reported together.
            const problems: string[] = []
            try {
                // A failed test may still hold unsent changes: no new save reaches DHIS2, one on its way finishes first.
                await page.route(
                    (url) => TRACKER_IMPORT.test(url.pathname),
                    (route) => route.abort()
                )
                await expect
                    .poll(() => sending.size, { timeout: 30_000 })
                    .toBe(0)
            } catch (error) {
                problems.push(
                    `waiting for saves on their way: ${String(error)}`
                )
            }
            await page.close()
            const done: string[] = []
            for (const id of new Set([...saved, ...added])) {
                const original = kept.get(id)
                try {
                    if (original !== undefined) {
                        const changed = await restore(request, original)
                        done.push(`${id}: ${changed} values restored`)
                    } else if (!added.has(id)) {
                        problems.push(
                            `${id}: the grid saved it, but the test did not read it first`
                        )
                    } else if ((await readEvent(request, id)) !== undefined) {
                        await importEvents(request, 'DELETE', [{ event: id }])
                        expect(await readEvent(request, id)).toBeUndefined()
                        done.push(`${id}: created, deleted`)
                    }
                } catch (error) {
                    problems.push(`${id}: ${String(error)}`)
                }
            }
            // The report lists what each test did to the shared database.
            console.log(
                `[shared DHIS2] ${testInfo.title}: ${done.join('; ') || 'no event changed'}`
            )
            if (problems.length > 0) {
                throw new Error(
                    `The shared DHIS2 was not left as found:\n${problems.join('\n')}`
                )
            }
        },
        { auto: true },
    ],
})

export { expect }

/** The value, or the test fails naming what the shared data lacks. */
export const found = <T>(value: T | undefined, what: string): T => {
    if (value === undefined) {
        throw new Error(`The docs DHIS2 has no ${what}`)
    }
    return value
}

/** Ready once the rules of the rows in view have run, so the rule engine is loaded. */
export const gridReady = (page: Page) =>
    page.waitForFunction(
        () =>
            performance.getEntriesByName('data-entry:rules-visible').length > 0,
        undefined,
        { timeout: 60_000 }
    )

export const openGrid = async (page: Page, slug: string) => {
    await page.goto(`/preview/${slug}`)
    await gridReady(page)
}

/** A cell's control: its id ends in the cell's key, after the form's own prefix. */
export const cell = (page: Page, eventId: string, field: string) =>
    page.locator(`[id$="-cell-${eventId}.${field}"]`)

export const enter = async (page: Page, target: Locator, text: string) => {
    await target.click()
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')
}

/** The event id of the row whose cell has focus. */
export const focusedRow = async (page: Page) =>
    found(
        /-cell-(\w+)\./.exec(
            await page.evaluate(() => document.activeElement?.id ?? '')
        )?.[1],
        'cell with focus'
    )

/** Adds a row, which takes focus, and returns its event id. */
export const addRow = async (page: Page) => {
    await page.getByRole('button', { name: 'Add event' }).click()
    return focusedRow(page)
}

/** Nothing waits to be sent: every change is saved or refused. */
export const settled = (page: Page) =>
    expect(
        page.getByRole('main').getByText(/Not yet sent to DHIS2/)
    ).toHaveCount(0, { timeout: 30_000 })

export const addDays = (date: string, days: number) => {
    const day = new Date(`${date.slice(0, 10)}T00:00:00Z`)
    day.setUTCDate(day.getUTCDate() + days)
    return day.toISOString().slice(0, 10)
}

export const expectNoAxeViolations = async (page: Page) => {
    const { violations } = await new AxeBuilder({ page })
        .withTags([
            'wcag2a',
            'wcag2aa',
            'wcag21a',
            'wcag21aa',
            'wcag22aa',
            'best-practice',
        ])
        .analyze()
    // Soft: every state a test checks is reported, not only the first with a violation.
    expect
        .soft(
            violations.map(({ id, impact, help, nodes }) => ({
                id,
                impact,
                help,
                targets: nodes.map(({ target }) => target.join(' ')),
            }))
        )
        .toEqual([])
}
