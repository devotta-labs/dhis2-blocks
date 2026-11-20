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
    keepOffline,
    nextInpatientDate,
    openGrid,
    readEvent,
    readEvents,
    scrollUntilDrawn,
    settled,
    test,
    valuesOf,
} from './tracker-data-entry.support'

const EVENT_PROGRAM = 'tracker-data-entry/event-program'
const REGISTER = 'tracker-data-entry/tracker-register'
const PERSON = 'tracker-data-entry/person-events'

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
    occurredAt: z.string().optional(),
    dataValues: z.array(DataValueSchema),
})
const PersonSchema = z.object({
    enrollment: z.string(),
    events: z.array(PersonEventSchema),
})

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

const newestValue = (
    events: ReadonlyArray<z.infer<typeof PersonEventSchema>>,
    field: string
) =>
    [...events]
        .sort((a, b) => (b.occurredAt ?? '').localeCompare(a.occurredAt ?? ''))
        .map((event) => valuesOf(event).get(field))
        .find((value) => value !== undefined)

const visitWithoutLmp = async (request: APIRequestContext) => {
    const { visit } = found(
        (await registerVisits(request)).find(
            ({ visit: own, events }) =>
                own.status === 'ACTIVE' &&
                newestValue(events, LMP) === undefined
        ),
        'active first visit whose person has no LMP'
    )
    return {
        ...visit,
        occurredAt: found(visit.occurredAt, `date of the visit ${visit.event}`),
    }
}

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
    await scrollUntilDrawn(page, cell(page, female.event, PREGNANT))
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
    await settled(page)
})

test('register: a person whose enrollment DHIS2 leaves out has no rules run, and her row says why', async ({
    page,
    request,
}) => {
    const { visit } = found(
        (await registerVisits(request)).find(
            ({ visit: own }) =>
                own.status === 'ACTIVE' &&
                valuesOf(own).get(CHRONIC_CONDITIONS) !== 'true'
        ),
        'active first visit of a woman without chronic conditions'
    )
    const followUp = cell(page, visit.event, CHRONIC_FOLLOW_UPS[0])

    await openGrid(page, REGISTER)
    await expect(followUp).toHaveAccessibleDescription(HIDDEN)

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
    const herRow = page.getByRole('row').filter({ has: followUp })
    await expect(herRow.getByRole('listitem')).toHaveText([
        /The enrollment of this event could not be read/,
    ])
    await expect(followUp).not.toHaveAccessibleDescription(HIDDEN)
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
    await expect(chronic).toHaveValue('Yes')
    await allFollowUps(false)

    await page.keyboard.press('n')
    await expect(chronic).toHaveValue('No')
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

    await page.evaluate(() =>
        sessionStorage.setItem('data-entry-e2e', 'offline')
    )
    await context.setOffline(false)
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

    await press('Tab')
    await press('Enter')
    await press('Shift+Tab')
    await expect(page.getByRole('button', { name: 'Add event' })).toBeFocused()
    await press('Enter')
    const rowId = await focusedRow(page)
    shared.adds(rowId)

    for (const text of [
        date,
        'F',
        'n',
        '34',
        '160',
        '60',
        addDays(date, -7),
        addDays(date, -1),
        '',
        'Dis',
        'A00',
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
