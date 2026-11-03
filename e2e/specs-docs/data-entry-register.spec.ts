import { request as apiRequest } from '@playwright/test'
import type { APIRequestContext, Page, Request } from '@playwright/test'
import { z } from 'zod'
import {
    focusedRow,
    gridReady,
    keepOffline,
    settled,
    TRACKER_IMPORT,
} from './data-entry.support'
import { expect, test as base } from './fixtures'

/**
 * The immunisation register example typed for real against a local DHIS2: each person a test makes is deleted
 * afterwards, with their enrolment and events.
 */
const IMMUNISATION = 'data-entry/immunisation-register'
const PROGRAM = 'ImmReg00001'
const NGELEHUN = 'DiszpKrYNg8'
const STAGE = 'ImmVaccin01'
const VACCINE = 'ImmVaccine1'
const DOSE = 'ImmDose0001'
const FIRST_NAME = 'w75KJ2mc4zz'
const LAST_NAME = 'zDhUuAYrxNC'
const BIRTH_DATE = 'gHGyrwKPzej'

const local = ['127.0.0.1', 'localhost'].includes(
    new URL(process.env.DOCS_DHIS2_URL ?? 'http://unset').hostname
)

const EnrollmentSchema = z.object({
    enrollment: z.string(),
    trackedEntity: z.string(),
    enrolledAt: z.string(),
    attributes: z.array(z.object({ attribute: z.string(), value: z.string() })),
    events: z.array(
        z.object({
            programStage: z.string(),
            occurredAt: z.string(),
            dataValues: z.array(
                z.object({ dataElement: z.string(), value: z.string() })
            ),
        })
    ),
})

/** The register's enrolments in October 2026, as DHIS2 holds them. */
const octoberEnrollments = async (request: APIRequestContext) => {
    const response = await request.get('/dhis2/api/tracker/enrollments', {
        params: {
            program: PROGRAM,
            orgUnits: NGELEHUN,
            orgUnitMode: 'SELECTED',
            enrolledAfter: '2026-10-01',
            enrolledBefore: '2026-10-31',
            fields: 'enrollment,trackedEntity,enrolledAt,attributes[attribute,value],events[programStage,occurredAt,dataValues[dataElement,value]]',
        },
    })
    expect(response.ok()).toBe(true)
    return z
        .object({ enrollments: z.array(EnrollmentSchema) })
        .parse(await response.json()).enrollments
}

const personExists = async (request: APIRequestContext, id: string) =>
    (await request.get(`/dhis2/api/tracker/trackedEntities/${id}`)).status() !==
    404

const ImportSchema = z.object({
    trackedEntities: z
        .array(z.object({ trackedEntity: z.string() }))
        .default([]),
})

/**
 * `sent`: the people the page sends DHIS2. Afterwards, timed out or not, further sends are stopped, the ones on their
 * way finish, and each person is deleted, so a failed test leaves nothing behind; what went wrong is reported together.
 */
const test = base.extend<{ sent: ReadonlySet<string> }>({
    sent: [
        async ({ page }, use, testInfo) => {
            const people = new Set<string>()
            const sending = new Set<Request>()
            page.on('request', (sent) => {
                if (
                    sent.method() === 'POST' &&
                    TRACKER_IMPORT.test(new URL(sent.url()).pathname)
                ) {
                    sending.add(sent)
                    ImportSchema.parse(
                        sent.postDataJSON()
                    ).trackedEntities.forEach(({ trackedEntity }) =>
                        people.add(trackedEntity)
                    )
                }
            })
            page.on('requestfinished', (done) => sending.delete(done))
            page.on('requestfailed', (done) => sending.delete(done))

            await use(people)

            const problems: string[] = []
            try {
                if (!page.isClosed()) {
                    await page.route(
                        (url) => TRACKER_IMPORT.test(url.pathname),
                        (route) => route.abort()
                    )
                    await expect
                        .poll(() => sending.size, { timeout: 30_000 })
                        .toBe(0)
                }
            } catch (error) {
                problems.push(
                    `waiting for saves on their way: ${String(error)}`
                )
            }
            // A context of its own, through the docs server as the test's: one the test disposed cannot stop it.
            const docs = await apiRequest.newContext({
                baseURL: testInfo.project.use.baseURL,
            })
            try {
                // Even when an import never finished: one that lands later still made its person.
                for (const trackedEntity of people) {
                    try {
                        if (await personExists(docs, trackedEntity)) {
                            const response = await docs.post(
                                '/dhis2/api/tracker',
                                {
                                    params: {
                                        async: 'false',
                                        importStrategy: 'DELETE',
                                    },
                                    data: {
                                        trackedEntities: [{ trackedEntity }],
                                    },
                                }
                            )
                            expect(response.ok(), await response.text()).toBe(
                                true
                            )
                        }
                        expect(await personExists(docs, trackedEntity)).toBe(
                            false
                        )
                    } catch (error) {
                        problems.push(
                            `person ${trackedEntity}: ${String(error)}`
                        )
                    }
                }
            } finally {
                await docs.dispose()
            }
            if (problems.length > 0) {
                throw new Error(
                    `DHIS2 was not left as found:\n${problems.join('\n')}`
                )
            }
        },
        { auto: true },
    ],
})

test.skip(!local, 'Writes people to DHIS2: only against a local one')
test.describe.configure({ timeout: 120_000 })

/** Opens the register, focuses its first cell and adds a person with Ctrl+Enter; returns the new person's id. */
const addPerson = async (page: Page) => {
    await page.goto(`/preview/${IMMUNISATION}`)
    await gridReady(page)
    await page.locator('tbody [id*="-cell-"]').first().focus()
    await page.keyboard.press('ControlOrMeta+Enter')
    const person = await focusedRow(page)
    await expect(page.locator(':focus')).toHaveAttribute(
        'id',
        new RegExp(`-cell-${person}\\.${FIRST_NAME}$`)
    )
    return person
}

/** Types each text into the focused cell, then Tab to the next. */
const typeAcross = async (page: Page, texts: ReadonlyArray<string>) => {
    for (const text of texts) {
        await page.keyboard.type(text)
        await page.keyboard.press('Tab')
    }
}

const day = (dateTime: string) => dateTime.slice(0, 10)

/** An enrolment as the test checks it: its date, its person's attributes, its events oldest first. */
const summaryOf = ({
    trackedEntity,
    enrolledAt,
    attributes,
    events,
}: z.infer<typeof EnrollmentSchema>) => ({
    trackedEntity,
    enrolledAt: day(enrolledAt),
    attributes: Object.fromEntries(
        attributes.map(({ attribute, value }) => [attribute, value])
    ),
    events: events
        .map(({ programStage, occurredAt, dataValues }) => ({
            programStage,
            date: day(occurredAt),
            ...Object.fromEntries(
                dataValues.map(({ dataElement, value }) => [dataElement, value])
            ),
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
})

test('a new child with three doses, typed with the keyboard, is what DHIS2 holds', async ({
    page,
    request,
    sent,
}) => {
    const before = new Set(
        (await octoberEnrollments(request)).map(({ enrollment }) => enrollment)
    )
    const lastName = `Register${Date.now()}`
    const person = await addPerson(page)
    // The person is first saved once the enrolment date completes them; the reload is after that save.
    const firstSave = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            TRACKER_IMPORT.test(new URL(response.url()).pathname)
    )
    // Gender is left empty.
    await typeAcross(page, ['Isatu', lastName, '2026-10-05', '', '2026-10-19'])
    expect((await firstSave).ok()).toBe(true)
    await settled(page)

    await page.reload()
    await gridReady(page)
    await expect(
        page.locator(`[id$="-cell-${person}.${LAST_NAME}"]`)
    ).toHaveValue(lastName)
    // An empty dose's cell is a new event each load: found by its name.
    await page
        .getByRole('textbox', { name: `BCG Dose 0 Isatu ${lastName}` })
        .focus()
    const dosesSaved = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            TRACKER_IMPORT.test(new URL(response.url()).pathname)
    )
    // BCG 0, OPV 1, then past OPV 2 and 3 to DPT 1.
    await typeAcross(page, ['2026-10-19', '2026-10-26', '', '', '2026-10-27'])
    expect((await dosesSaved).ok()).toBe(true)

    await expect
        .poll(
            async () =>
                (await octoberEnrollments(request))
                    .filter(({ enrollment }) => !before.has(enrollment))
                    .map(summaryOf),
            { timeout: 30_000 }
        )
        .toEqual([
            {
                trackedEntity: person,
                enrolledAt: '2026-10-19',
                attributes: {
                    [FIRST_NAME]: 'Isatu',
                    [LAST_NAME]: lastName,
                    [BIRTH_DATE]: '2026-10-05',
                },
                events: [
                    ['BCG', '0', '2026-10-19'],
                    ['OPV', '1', '2026-10-26'],
                    ['DPT', '1', '2026-10-27'],
                ].map(([vaccine, dose, date]) => ({
                    programStage: STAGE,
                    date,
                    [VACCINE]: vaccine,
                    [DOSE]: dose,
                })),
            },
        ])
    expect([...sent]).toEqual([person])
})

test('a person missing a mandatory attribute waits and says what for', async ({
    page,
    request,
    sent,
}) => {
    const person = await addPerson(page)
    // No last name.
    await typeAcross(page, ['Isatu', '', '2026-10-05', '', '2026-10-19'])
    for (const field of [FIRST_NAME, BIRTH_DATE]) {
        await expect(
            page.locator(`[id$="-cell-${person}.${field}"]`)
        ).toHaveAccessibleDescription(/Waiting for: Last name/)
    }
    await expect(page.getByText(/Not yet sent to DHIS2/)).toBeVisible()
    expect(await personExists(request, person)).toBe(false)
    // Still nothing sent a moment later, when a late save would have gone out.
    await page.waitForTimeout(2_000)
    expect(sent.size).toBe(0)
})

/** The register's people in October whose enrolment is not in `before`, as the test checks them. */
const newEnrollments = async (
    request: APIRequestContext,
    before: ReadonlySet<string>
) =>
    (await octoberEnrollments(request))
        .filter(({ enrollment }) => !before.has(enrollment))
        .map(summaryOf)

const enrollmentsNow = async (request: APIRequestContext) =>
    new Set(
        (await octoberEnrollments(request)).map(({ enrollment }) => enrollment)
    )

/** The next tracker import's response. */
const nextImport = (page: Page) =>
    page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            TRACKER_IMPORT.test(new URL(response.url()).pathname)
    )

test('a new person still waiting at a reload comes back once, and finishing them saves one person', async ({
    page,
    request,
    sent,
}) => {
    const before = await enrollmentsNow(request)
    const lastName = `Waiting${Date.now()}`
    const person = await addPerson(page)
    // No enrolment date: nothing can be sent. Each cell saying so shows the outbox holds it.
    await typeAcross(page, ['Isatu', lastName, '2026-10-05'])
    for (const field of [FIRST_NAME, LAST_NAME, BIRTH_DATE]) {
        await expect(
            page.locator(`[id$="-cell-${person}.${field}"]`)
        ).toHaveAccessibleDescription(/Waiting for: /)
    }

    page.once('dialog', (dialog) => dialog.accept())
    await page.reload()
    await gridReady(page)
    const name = `Isatu ${lastName}`
    await expect(page.getByRole('rowheader', { name })).toHaveCount(1)
    await expect(
        page.locator(`[id$="-cell-${person}.${LAST_NAME}"]`)
    ).toHaveValue(lastName)
    await expect(
        page.locator(`[id$="-cell-${person}.${BIRTH_DATE}"]`)
    ).toHaveValue('2026-10-05')

    const saved = nextImport(page)
    await page.getByRole('textbox', { name: `Registered Date ${name}` }).focus()
    await typeAcross(page, ['2026-10-19'])
    expect((await saved).ok()).toBe(true)
    await settled(page)
    await expect
        .poll(() => newEnrollments(request, before), { timeout: 30_000 })
        .toEqual([
            {
                trackedEntity: person,
                enrolledAt: '2026-10-19',
                attributes: {
                    [FIRST_NAME]: 'Isatu',
                    [LAST_NAME]: lastName,
                    [BIRTH_DATE]: '2026-10-05',
                },
                events: [],
            },
        ])
    expect([...sent]).toEqual([person])
})

test('a saved person’s dose unsent at a reload comes back on their row and is saved once', async ({
    page,
    context,
    request,
    sent,
}) => {
    const before = await enrollmentsNow(request)
    await page.addInitScript(keepOffline)
    const lastName = `Unsent${Date.now()}`
    const person = await addPerson(page)
    const firstSave = nextImport(page)
    await typeAcross(page, ['Isatu', lastName, '2026-10-05', '', '2026-10-19'])
    expect((await firstSave).ok()).toBe(true)
    await settled(page)

    // Offline, the dose waits on the device.
    await context.setOffline(true)
    const name = `Isatu ${lastName}`
    const dose = page.getByRole('textbox', { name: `BCG Dose 0 ${name}` })
    await dose.focus()
    await typeAcross(page, ['2026-10-20'])
    await expect(dose).toHaveAccessibleDescription(/Saved on this device/)

    // The browser cannot load the page while offline; the page keeps reporting offline across the reload instead.
    await page.evaluate(() =>
        sessionStorage.setItem('data-entry-e2e', 'offline')
    )
    await context.setOffline(false)
    page.once('dialog', (dialog) => dialog.accept())
    await page.reload()
    await gridReady(page)
    await expect(page.getByRole('rowheader', { name })).toHaveCount(1)
    await expect(dose).toHaveValue('2026-10-20')
    await expect(dose).toHaveAccessibleDescription(/Saved on this device/)
    await page.evaluate(() => {
        sessionStorage.removeItem('data-entry-e2e')
        window.dispatchEvent(new Event('online'))
    })
    await settled(page)
    await expect
        .poll(() => newEnrollments(request, before), { timeout: 30_000 })
        .toEqual([
            expect.objectContaining({
                trackedEntity: person,
                events: [
                    {
                        programStage: STAGE,
                        date: '2026-10-20',
                        [VACCINE]: 'BCG',
                        [DOSE]: '0',
                    },
                ],
            }),
        ])
    expect([...sent]).toEqual([person])
})
