import type { APIRequestContext, Response } from '@playwright/test'
import { z } from 'zod'
import {
    addDays,
    addRow,
    cell,
    DataValueSchema,
    enter,
    expect,
    expectNoAxeViolations,
    found,
    focusedRow,
    gridReady,
    INPATIENT,
    nextInpatientDate,
    openGrid,
    readEvent,
    readEvents,
    settled,
    test,
    valuesOf,
} from './data-entry.support'

/**
 * The data entry gallery against the docs DHIS2 (Sierra Leone demo), whose
 * events are shared test data: see `data-entry.support.ts`.
 */
const EVENT_PROGRAM = 'data-entry/event-program'
const REGISTER = 'data-entry/tracker-register'
const PERSON = 'data-entry/person-events'

const RMNCH = 'WSGAb5XwJ3Y'
const FIRST_VISIT = 'WZbXY0S00lP'
const SIERRA_LEONE = 'ImspTQPwCqd'
const WOMAN = 'PE6abx7Zhn0'

const EVENT_DATE = 'occurredAt'
const GENDER = 'oZg33kd9taw'
const PREGNANT = 'SWfdB5lX0fk'
const AGE = 'qrur9Dvnyt5'
const HEIGHT = 'GieVkTxp4HH'
const WEIGHT = 'vV9UWAZohSf'
const ADMISSION = 'eMyVanycQSC'
const DISCHARGE = 'msodh3rEMJa'
const MODE_OF_DISCHARGE = 'fWIAEtYVEGk'
const DIAGNOSIS = 'K6uUAvq500H'
const LMP = 'w4ky6EkVahL'
const GESTATIONAL_AGE = 'roKuXYfw1BW'
const CHRONIC_CONDITIONS = 'de0FEHSIoxh'
const SMOKING = 'sWoqcoByYmD'
const SMOKING_CESSATION = 'Ok9OQpitjQr'
// The fields "Hide all fields for chronic conitions unless the w" hides.
const CHRONIC_FOLLOW_UPS = [
    'UQ2Zo8CruPB',
    'zzGNbeMnTd6',
    'Q1x1HIhuwFN',
    'VFffa31SKjH',
    'sdchiIXIcCf',
    'xPTngRLQTnu',
]

const HIDDEN = /Hidden by rule/

const PersonEventSchema = z.object({
    occurredAt: z.string(),
    dataValues: z.array(DataValueSchema),
})
const PersonSchema = z.object({
    enrollment: z.string(),
    events: z.array(PersonEventSchema),
})

/** The register's first visits as the grid loads them, each with her other events. */
const registerVisits = async (request: APIRequestContext) => {
    const visits = await readEvents(request, {
        program: RMNCH,
        programStage: FIRST_VISIT,
        orgUnit: SIERRA_LEONE,
        orgUnitMode: 'DESCENDANTS',
        order: 'occurredAt:desc',
        pageSize: '50',
    })
    const ids = visits.flatMap(({ enrollment }) => enrollment ?? [])
    const response = await request.get('/dhis2/api/tracker/enrollments', {
        params: {
            program: RMNCH,
            enrollments: ids.join(','),
            pageSize: String(ids.length),
            fields: 'enrollment,events[occurredAt,dataValues[dataElement,value]]',
        },
    })
    expect(response.ok()).toBe(true)
    const people = new Map(
        z
            .object({ enrollments: z.array(PersonSchema) })
            .parse(await response.json())
            .enrollments.map((person) => [person.enrollment, person.events])
    )
    return visits.map((visit) => ({
        visit,
        events: people.get(visit.enrollment ?? '') ?? [],
    }))
}

/** A field's newest value across a person's events, as a newest-event rule variable reads it. */
const newestValue = (
    events: ReadonlyArray<z.infer<typeof PersonEventSchema>>,
    field: string
) =>
    [...events]
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        .map((event) => valuesOf(event).get(field))
        .find((value) => value !== undefined)

/** An active first visit whose person has no LMP anywhere, so the LMP typed is the one rules read. */
const visitWithoutLmp = async (request: APIRequestContext) => {
    return found(
        (await registerVisits(request)).find(
            ({ visit, events }) =>
                visit.status === 'ACTIVE' &&
                newestValue(events, LMP) === undefined
        ),
        'active first visit whose person has no LMP'
    ).visit
}

/** The grid's request for many people at once: `tracker/enrollments?enrollments=<id>,<id>,…`. */
const isBatchedEnrollments = (response: Response) => {
    const url = new URL(response.url())
    return (
        url.pathname.endsWith('/tracker/enrollments') &&
        (url.searchParams.get('enrollments') ?? '').includes(',')
    )
}

test.describe.configure({ timeout: 120_000 })

test.describe('each example', () => {
    test('event program: no page errors and no axe violations', async ({
        page,
        shared,
    }) => {
        await openGrid(page, EVENT_PROGRAM)
        await expectNoAxeViolations(page)
        // A new row's option list open: nothing is saved without an event date.
        shared.adds(await addRow(page))
        await page.keyboard.press('Tab')
        await page.keyboard.type('M')
        await expect(page.getByRole('listbox')).toBeVisible()
        await expectNoAxeViolations(page)
    })

    test('tracker register: no page errors and no axe violations', async ({
        page,
    }) => {
        await openGrid(page, REGISTER)
        await expectNoAxeViolations(page)
    })

    test('one person: no page errors and no axe violations', async ({
        page,
    }) => {
        await openGrid(page, PERSON)
        await expectNoAxeViolations(page)
        // A hidden cell with its note shown.
        const [firstVisit] = await readEvents(page.request, {
            program: RMNCH,
            enrollments: WOMAN,
            programStage: FIRST_VISIT,
        })
        await cell(
            page,
            found(firstVisit, 'first visit of the woman').event,
            CHRONIC_FOLLOW_UPS[0]
        ).focus()
        await expectNoAxeViolations(page)
    })
})

test('inpatient: Male hides Pregnant in that row only', async ({
    page,
    request,
    shared,
}) => {
    const female = found(
        (
            await readEvents(request, {
                ...INPATIENT,
                orgUnitMode: 'SELECTED',
                order: 'occurredAt:desc',
                pageSize: '20',
            })
        ).find((event) => valuesOf(event).get(GENDER) === 'Female'),
        'inpatient event of a woman'
    )
    await openGrid(page, EVENT_PROGRAM)
    const rowId = await addRow(page)
    shared.adds(rowId)

    await expect(cell(page, rowId, PREGNANT)).not.toHaveAccessibleDescription(
        HIDDEN
    )
    await enter(page, cell(page, rowId, GENDER), 'Male')
    await expect(cell(page, rowId, GENDER)).toHaveValue('Male')
    await expect(cell(page, rowId, PREGNANT)).toHaveAccessibleDescription(
        /Hidden by rule: Hide pregnant if gender is male/
    )
    await expect(cell(page, rowId, AGE)).not.toHaveAccessibleDescription(HIDDEN)
    await expect(
        cell(page, female.event, PREGNANT)
    ).not.toHaveAccessibleDescription(HIDDEN)
})

test('inpatient: a new event waits for its required fields, then saves and survives a reload', async ({
    page,
    request,
    shared,
}) => {
    const date = await nextInpatientDate(request)
    await openGrid(page, EVENT_PROGRAM)
    const rowId = await addRow(page)
    shared.adds(rowId)

    await enter(page, cell(page, rowId, EVENT_DATE), date)
    await expect(cell(page, rowId, EVENT_DATE)).toHaveAccessibleDescription(
        /Waiting for required fields: Date of admission, Date of discharge, Mode of Discharge, Diagnosis \(ICD-10\)/
    )
    expect(await readEvent(request, rowId)).toBeUndefined()

    await enter(page, cell(page, rowId, ADMISSION), addDays(date, -7))
    await enter(page, cell(page, rowId, DISCHARGE), addDays(date, -1))
    await enter(page, cell(page, rowId, MODE_OF_DISCHARGE), 'Dis')
    await page.keyboard.press('Enter')
    await enter(page, cell(page, rowId, DIAGNOSIS), 'A00')
    await page.keyboard.press('Enter')

    await settled(page)
    await expect
        .poll(async () =>
            Object.fromEntries(valuesOf(await readEvent(request, rowId)))
        )
        .toEqual(
            Object.fromEntries([
                [ADMISSION, addDays(date, -7)],
                [DISCHARGE, addDays(date, -1)],
                [MODE_OF_DISCHARGE, 'MODDISCH'],
                [DIAGNOSIS, expect.stringMatching(/^A00/)],
            ])
        )

    await page.reload()
    await gridReady(page)
    await expect(page.getByRole('rowheader').first()).toHaveText(date)
    await expect(cell(page, rowId, EVENT_DATE)).toHaveValue(date)
    await expect(cell(page, rowId, ADMISSION)).toHaveValue(addDays(date, -7))
    await expect(cell(page, rowId, MODE_OF_DISCHARGE)).toHaveValue('Discharged')
    await expect(cell(page, rowId, DIAGNOSIS)).not.toHaveAccessibleDescription(
        /Saved on this device/
    )
})

test('register: an LMP 70 days before the visit assigns gestational age 10, read-only, and saves', async ({
    page,
    request,
    shared,
}) => {
    const visit = await visitWithoutLmp(request)
    shared.keep([visit])
    // Every person in one request: the rules read each woman's other events.
    const batched = page.waitForResponse(isBatchedEnrollments)
    await openGrid(page, REGISTER)
    expect((await batched).ok()).toBe(true)

    const lmp = addDays(visit.occurredAt, -70)
    await enter(page, cell(page, visit.event, LMP), lmp)
    const age = cell(page, visit.event, GESTATIONAL_AGE)
    await expect(age).toHaveValue('10')
    await expect(age).not.toBeEditable()
    await expect(age).toHaveAccessibleDescription(
        /Assigned by rule: Calculate gestational age from LMP/
    )

    await settled(page)
    await expect
        .poll(async () => {
            const values = valuesOf(await readEvent(request, visit.event))
            return [values.get(LMP), values.get(GESTATIONAL_AGE)]
        })
        .toEqual([lmp, '10'])
})

test('register: an LMP after the visit is an error described on the cell', async ({
    page,
    request,
    shared,
}) => {
    const visit = await visitWithoutLmp(request)
    shared.keep([visit])
    await openGrid(page, REGISTER)

    const lmp = cell(page, visit.event, LMP)
    await enter(page, lmp, addDays(visit.occurredAt, 1))
    await expect(lmp).toHaveAttribute('aria-invalid', 'true')
    await expect(lmp).toHaveAccessibleDescription(
        /LMP date entered is after the date of the antenatal care visit\./
    )
    // DHIS2 takes or refuses the change; either way the event is restored afterwards.
    await settled(page)
})

test('register: a person whose enrollment DHIS2 leaves out is evaluated without it, with no error', async ({
    page,
    request,
}) => {
    // A woman whose newest smoking answer differs from her first visit's: her other events decide the rule. With no
    // chronic conditions, which only her first visit asks, its follow-ups are hidden either way: her row was evaluated.
    const { visit, events } = found(
        (await registerVisits(request)).find(
            ({ visit: own, events: all }) =>
                (valuesOf(own).get(SMOKING) === 'true') !==
                    (newestValue(all, SMOKING) === 'true') &&
                valuesOf(own).get(CHRONIC_CONDITIONS) !== 'true'
        ),
        'woman whose smoking answer changed'
    )
    const cessation = cell(page, visit.event, SMOKING_CESSATION)
    const hiddenUnless = async (smokes: boolean) => {
        await expect(
            cell(page, visit.event, CHRONIC_FOLLOW_UPS[0])
        ).toHaveAccessibleDescription(HIDDEN)
        await (smokes
            ? expect(cessation).not.toHaveAccessibleDescription(HIDDEN)
            : expect(cessation).toHaveAccessibleDescription(
                  /Hidden by rule: Hide smoking cessation if not smoking/
              ))
    }

    await openGrid(page, REGISTER)
    await hiddenUnless(newestValue(events, SMOKING) === 'true')

    // As for a woman the user may not read: DHIS2 leaves her out of the batch, no sharing is changed.
    await page.route('**/tracker/enrollments?*', async (route) => {
        const response = await route.fetch()
        const body = z
            .object({
                enrollments: z.array(z.looseObject({ enrollment: z.string() })),
            })
            .loose()
            .parse(await response.json())
        await route.fulfill({
            response,
            json: {
                ...body,
                enrollments: body.enrollments.filter(
                    ({ enrollment }) => enrollment !== visit.enrollment
                ),
            },
        })
    })
    const batched = page.waitForResponse(isBatchedEnrollments)
    await page.reload()
    await gridReady(page)
    expect((await batched).ok()).toBe(true)
    await hiddenUnless(valuesOf(visit).get(SMOKING) === 'true')
    // Her row says nothing: no message of its own, such as its rules failing, and no cell in error.
    const herRow = page.getByRole('row').filter({ has: cessation })
    await expect(herRow.getByRole('listitem')).toHaveCount(0)
    await expect(herRow.locator('[aria-invalid="true"]')).toHaveCount(0)
})

test('one woman: chronic conditions Yes and No show and hide the follow-ups in all her rows', async ({
    page,
    request,
    shared,
}) => {
    const events = await readEvents(request, {
        program: RMNCH,
        enrollments: WOMAN,
    })
    shared.keep(events)
    const firstVisit = found(
        events.find(({ programStage }) => programStage === FIRST_VISIT),
        'first visit of the woman'
    )
    await openGrid(page, PERSON)

    // Her rows of other stages have no control for these fields ("Not in this stage").
    const followUps = page.locator(
        events
            .flatMap(({ event }) =>
                CHRONIC_FOLLOW_UPS.map(
                    (field) => `[id$="-cell-${event}.${field}"]`
                )
            )
            .join(', ')
    )
    const allFollowUps = async (hidden: boolean) => {
        await expect(followUps).not.toHaveCount(0)
        for (const followUp of await followUps.all()) {
            await (hidden
                ? expect(followUp).toHaveAccessibleDescription(HIDDEN)
                : expect(followUp).not.toHaveAccessibleDescription(HIDDEN))
        }
    }
    const chronic = cell(page, firstVisit.event, CHRONIC_CONDITIONS)
    await allFollowUps(valuesOf(firstVisit).get(CHRONIC_CONDITIONS) !== 'true')

    await chronic.focus()
    await page.keyboard.press('y')
    await expect(chronic).toHaveValue('true')
    await allFollowUps(false)

    await page.keyboard.press('n')
    await expect(chronic).toHaveValue('false')
    await allFollowUps(true)

    await settled(page)
    await expect
        .poll(async () =>
            valuesOf(await readEvent(request, firstVisit.event)).get(
                CHRONIC_CONDITIONS
            )
        )
        .toBe('false')
})

// Reported offline whatever the network is, so the page can reload from the server while its outbox waits.
const keepOffline = () => {
    const native = Object.getOwnPropertyDescriptor(
        Navigator.prototype,
        'onLine'
    )
    Object.defineProperty(Navigator.prototype, 'onLine', {
        configurable: true,
        get(this: Navigator) {
            return sessionStorage.getItem('data-entry-e2e') === 'offline'
                ? false
                : native?.get?.call(this)
        },
    })
}

test('keeps a new row through offline and reload', async ({
    page,
    context,
    request,
    shared,
}) => {
    const date = await nextInpatientDate(request)
    await page.addInitScript(keepOffline)
    await openGrid(page, EVENT_PROGRAM)

    await context.setOffline(true)
    const rowId = await addRow(page)
    shared.adds(rowId)
    await enter(page, cell(page, rowId, EVENT_DATE), date)
    await enter(page, cell(page, rowId, ADMISSION), addDays(date, -3))
    await enter(page, cell(page, rowId, DISCHARGE), date)
    await enter(page, cell(page, rowId, MODE_OF_DISCHARGE), 'Dis')
    await page.keyboard.press('Enter')
    await enter(page, cell(page, rowId, DIAGNOSIS), 'A00')
    await page.keyboard.press('Enter')
    const unsent = page.getByRole('main').getByText('Not yet sent to DHIS2: 5')
    await expect(unsent).toBeVisible()
    await expect(cell(page, rowId, ADMISSION)).toHaveAccessibleDescription(
        /Saved on this device/
    )
    expect(await readEvent(request, rowId)).toBeUndefined()

    // The browser cannot load the page while offline; the page keeps reporting offline across the reload instead.
    await page.evaluate(() =>
        sessionStorage.setItem('data-entry-e2e', 'offline')
    )
    await context.setOffline(false)
    // Leaving with unsent changes asks first.
    page.once('dialog', (dialog) => dialog.accept())
    await page.reload()
    await gridReady(page)
    await expect(cell(page, rowId, EVENT_DATE)).toHaveValue(date)
    await expect(cell(page, rowId, ADMISSION)).toHaveValue(addDays(date, -3))
    await expect(cell(page, rowId, DIAGNOSIS)).toHaveValue(/^A00/)
    await expect(cell(page, rowId, ADMISSION)).toHaveAccessibleDescription(
        /Saved on this device/
    )
    await expect(unsent).toBeVisible()
    expect(await readEvent(request, rowId)).toBeUndefined()

    await page.evaluate(() => {
        sessionStorage.removeItem('data-entry-e2e')
        window.dispatchEvent(new Event('online'))
    })
    await settled(page)
    await expect
        .poll(async () =>
            valuesOf(await readEvent(request, rowId)).get(ADMISSION)
        )
        .toBe(addDays(date, -3))
    await expect(cell(page, rowId, ADMISSION)).not.toHaveAccessibleDescription(
        /Saved on this device/
    )
})

test('fills the inpatient form by keyboard alone within 60 keystrokes per row', async ({
    page,
    request,
    shared,
}) => {
    const date = await nextInpatientDate(request)
    await openGrid(page, EVENT_PROGRAM)
    let keystrokes = 0
    const press = async (key: string) => {
        keystrokes += 1
        await page.keyboard.press(key)
    }
    const type = async (text: string) => {
        keystrokes += text.length
        await page.keyboard.type(text)
    }

    // Past the grid by its skip link, back to "Add event".
    await press('Tab')
    await press('Enter')
    await press('Shift+Tab')
    await expect(page.getByRole('button', { name: 'Add event' })).toBeFocused()
    await press('Enter')
    const rowId = await focusedRow(page)
    shared.adds(rowId)

    // Each field typed, then Tab: an option cell takes its top match.
    for (const text of [
        date, // Event date
        'F', // Gender: Female
        'n', // Pregnant: No
        '34', // Age (years)
        '160', // Height in cm
        '60', // Weight in kg
        addDays(date, -7), // Date of admission
        addDays(date, -1), // Date of discharge
        '', // Place of Infection: an org unit, left empty
        'Dis', // Mode of Discharge: Discharged
        'A00', // Diagnosis (ICD-10)
    ]) {
        await type(text)
        await press('Tab')
    }
    expect(keystrokes).toBeLessThanOrEqual(60)

    await settled(page)
    await expect
        .poll(async () =>
            Object.fromEntries(valuesOf(await readEvent(request, rowId)))
        )
        .toEqual(
            Object.fromEntries([
                [GENDER, 'Female'],
                [PREGNANT, 'false'],
                [AGE, '34'],
                [HEIGHT, '160'],
                [WEIGHT, '60'],
                [ADMISSION, addDays(date, -7)],
                [DISCHARGE, addDays(date, -1)],
                [MODE_OF_DISCHARGE, 'MODDISCH'],
                [DIAGNOSIS, expect.stringMatching(/^A00/)],
            ])
        )
})
