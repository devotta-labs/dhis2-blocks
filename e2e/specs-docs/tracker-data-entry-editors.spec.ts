import { Buffer } from 'node:buffer'
import type { Locator, Page, Response } from '@playwright/test'
import { z } from 'zod'
import {
    addDays,
    addRow,
    bodyRows,
    cell,
    enter,
    expect,
    expectNoAxeViolations,
    found,
    focusedRow,
    formReady,
    gridReady,
    INPATIENT,
    nextInpatientDate,
    openGrid,
    readEvent,
    settled,
    test,
    TRACKER_IMPORT,
    valuesOf,
} from './tracker-data-entry.support'

const EVENT_PROGRAM = 'tracker-data-entry/event-program'
const REGISTER = 'tracker-data-entry/tracker-register'
const PERSON = 'tracker-data-entry/person-events'
const VALUE_TYPES = 'tracker-data-entry/value-types'

const EVENT_DATE = 'occurredAt'
const ADMISSION = 'eMyVanycQSC'
const DISCHARGE = 'msodh3rEMJa'
const MODE_OF_DISCHARGE = 'fWIAEtYVEGk'
const DIAGNOSIS = 'K6uUAvq500H'
const PLACE_OF_INFECTION = 'S33cRBsnXPo'
const HOUSEHOLD_LOCATION = 'F3ogKBuviRA'
const DOCUMENTATION = 'ulD2zW0TIy2'
const DIASTOLIC = 'dyYdfamSY2Z'

const CHILD_PROGRAMME = {
    program: 'IpHINAT79UW',
    trackedEntityType: 'nEenWmSyUEp',
    orgUnit: INPATIENT.orgUnit,
}
const BIRTH = 'A03MvHHogjR'
const APGAR_COMMENT = 'H6uSAMO5WLD'

const WORKING_LIST_E2E = {
    program: 'WlE2ePrg001',
    trackedEntityType: 'WlE2eTet001',
    orgUnit: INPATIENT.orgUnit,
}
const WORKING_LIST_E2E_STAGE = 'WlE2eStg001'
const MULTI_SELECT = 'WlDeMult001'

const editor = (page: Page, column: string) =>
    page.getByRole('dialog', { name: new RegExp(`^Edit ${column}\\b`) })

const announced = (page: Page, text: string | RegExp) =>
    expect(page.getByRole('status').filter({ hasText: text })).toHaveCount(1)

const openPerson = async (
    page: Page,
    person: { program: string; orgUnit: string; enrollment: string },
    stage: string,
    ready: typeof formReady
) => {
    const ids = [
        ['WSGAb5XwJ3Y', person.program],
        ['m7fBMpmVpSM', person.orgUnit],
        ['PE6abx7Zhn0', person.enrollment],
        ['edqlbukwRfQ', stage],
    ]
    const replaced = new Set<string>()
    await page.route('**/assets/PersonEventsGrid-*.js', async (route) => {
        const response = await route.fetch()
        let code = await response.text()
        for (const [from, to] of ids) {
            if (code.includes(from)) {
                replaced.add(from)
                code = code.replaceAll(from, to)
            }
        }
        await route.fulfill({ response, body: code })
    })
    await page.goto(`/preview/${PERSON}`)
    await ready(page)
    expect([...replaced]).toEqual(ids.map(([from]) => from))
}

const fillRequired = async (page: Page, rowId: string, date: string) => {
    await enter(page, cell(page, rowId, EVENT_DATE), date)
    await enter(page, cell(page, rowId, ADMISSION), addDays(date, -7))
    await enter(page, cell(page, rowId, DISCHARGE), addDays(date, -1))
    await enter(page, cell(page, rowId, MODE_OF_DISCHARGE), 'Dis')
    await page.keyboard.press('Enter')
    await enter(page, cell(page, rowId, DIAGNOSIS), 'A00')
    await page.keyboard.press('Enter')
}

const isPost = (pattern: RegExp) => (response: Response) =>
    response.request().method() === 'POST' &&
    pattern.test(new URL(response.url()).pathname)

test.describe.configure({ timeout: 120_000 })

test('every value type: each editor opens by its name, passes axe and closes with Escape; a long text saved from its editor settles', async ({
    page,
}) => {
    await page.goto(`/preview/${VALUE_TYPES}`)
    await formReady(page)
    await expectNoAxeViolations(page)

    for (const [column, name] of [
        ['longText', 'Long text'],
        ['symptoms', 'Multi-select'],
        ['age', 'Age'],
        ['coordinate', 'Coordinate'],
        ['file', 'File'],
        ['image', 'Image'],
    ]) {
        const target = cell(page, 'row1', column)
        await target.focus()
        await page.keyboard.press('Enter')
        const dialog = editor(page, name)
        await expect(dialog).toBeVisible()
        await expect
            .poll(() =>
                dialog.evaluate((box) => box.contains(document.activeElement))
            )
            .toBe(true)
        await expectNoAxeViolations(page)
        await page.keyboard.press('Escape')
        await expect(dialog).toBeHidden()
        await expect(target).toBeFocused()
    }

    const empty = cell(page, 'row3', 'longText')
    await empty.focus()
    await page.keyboard.press('Enter')
    await page.keyboard.type('Kept in memory')
    await page.keyboard.press('Control+Enter')
    await expect(empty).toHaveValue('Kept in memory')
    await settled(page)
})

test('inpatient: an org unit and a coordinate picked in their editors save', async ({
    page,
    request,
    shared,
}) => {
    const date = await nextInpatientDate(request)
    await openGrid(page, EVENT_PROGRAM)
    const rowId = await addRow(page)
    shared.adds(rowId)

    const place = cell(page, rowId, PLACE_OF_INFECTION)
    await place.click()
    await page.keyboard.type('Ngelehun')
    const matches = page.getByRole('option')
    await expect(matches).toHaveCount(2)
    await announced(page, 'Results: 2')
    await expectNoAxeViolations(page)
    await matches.filter({ hasText: 'Ngelehun CHC' }).click()
    await expect(matches).toHaveCount(0)
    await expect(place).toBeFocused()
    await expect(place).toHaveValue('Ngelehun CHC')

    const location = cell(page, rowId, HOUSEHOLD_LOCATION)
    await location.focus()
    await page.keyboard.press('Enter')
    const coordinate = editor(page, 'Household location')
    await coordinate.getByLabel('Latitude').fill('8.45')
    await coordinate.getByLabel('Longitude').fill('-11.2')
    await expectNoAxeViolations(page)
    await page.keyboard.press('Control+Enter')
    await expect(coordinate).toBeHidden()
    await expect(location).toBeFocused()

    await fillRequired(page, rowId, date)
    await settled(page)
    await expect
        .poll(async () => {
            const values = valuesOf(await readEvent(request, rowId))
            return [
                values.get(PLACE_OF_INFECTION),
                values.get(HOUSEHOLD_LOCATION),
            ]
        })
        .toEqual([INPATIENT.orgUnit, '[-11.2,8.45]'])
})

test('inpatient: a file chosen for Documentation uploads and the cell shows its name', async ({
    page,
    request,
    shared,
}, testInfo) => {
    await openGrid(page, EVENT_PROGRAM)
    const rowId = await addRow(page)
    shared.adds(rowId)
    const documentation = cell(page, rowId, DOCUMENTATION)
    await documentation.focus()
    await page.keyboard.press('Enter')
    const dialog = editor(page, 'Documentation')
    const chooser = page.waitForEvent('filechooser')
    const uploaded = page.waitForResponse(
        isPost(/\/api\/(?:\d+\/)?fileResources$/)
    )
    await dialog.getByRole('button', { name: 'Choose a file' }).click()
    await (
        await chooser
    ).setFiles({
        name: 'data-entry-e2e.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('A small file from the data entry e2e.\n'),
    })
    const answer = await uploaded
    expect(answer.ok()).toBe(true)
    const { id } = z
        .object({
            response: z.object({ fileResource: z.object({ id: z.string() }) }),
        })
        .parse(await answer.json()).response.fileResource
    console.log(
        `[shared DHIS2] ${testInfo.title}: file resource ${id} uploaded, held by no event`
    )

    await expect(dialog).toBeHidden()
    await expect(documentation).toHaveValue('data-entry-e2e.txt')
    expect(await readEvent(request, rowId)).toBeUndefined()
})

test('one child: a long text Apgar comment saves with its line break', async ({
    page,
    request,
    shared,
}) => {
    const child = await shared.newPerson(CHILD_PROGRAMME)
    await openPerson(
        page,
        { ...CHILD_PROGRAMME, enrollment: child.enrollment },
        BIRTH,
        gridReady
    )
    const rowId = await addRow(page)
    shared.adds(rowId)
    await enter(page, cell(page, rowId, EVENT_DATE), child.enrolledAt)

    const comment = cell(page, rowId, APGAR_COMMENT)
    await comment.click()
    await page.keyboard.type('A')
    const dialog = editor(page, 'Apgar comment')
    await expect(dialog).toBeVisible()
    await page.keyboard.type('pgar 9 at five minutes')
    await page.keyboard.press('Enter')
    await page.keyboard.type('No concerns')
    await expectNoAxeViolations(page)
    await page.keyboard.press('Control+Enter')
    await expect(dialog).toBeHidden()
    await expect(comment).toBeFocused()
    await expect(comment).toHaveValue('Apgar 9 at five minutes No concerns')

    await settled(page)
    await expect
        .poll(async () =>
            valuesOf(await readEvent(request, rowId)).get(APGAR_COMMENT)
        )
        .toBe('Apgar 9 at five minutes\nNo concerns')
})

test('working list E2E program: a multi-select saves its codes in the option set order', async ({
    page,
    request,
    shared,
}) => {
    const person = await shared.newPerson(WORKING_LIST_E2E)
    await openPerson(
        page,
        { ...WORKING_LIST_E2E, enrollment: person.enrollment },
        WORKING_LIST_E2E_STAGE,
        formReady
    )
    const rowId = await addRow(page)
    shared.adds(rowId)

    const choices = cell(page, rowId, MULTI_SELECT)
    await choices.focus()
    await page.keyboard.press('Enter')
    const dialog = editor(page, 'E2E multi-text data element')
    await dialog.getByRole('checkbox', { name: 'Beta' }).click()
    await dialog.getByRole('checkbox', { name: 'Alpha' }).click()
    await announced(page, 'Selected options: Alpha, Beta')
    await expectNoAxeViolations(page)
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden()
    await expect(choices).toBeFocused()
    await expect(choices).toHaveValue('Alpha, Beta')

    await enter(page, cell(page, rowId, EVENT_DATE), person.enrolledAt)
    await settled(page)
    await expect
        .poll(async () =>
            valuesOf(await readEvent(request, rowId)).get(MULTI_SELECT)
        )
        .toBe('ALPHA,BETA')
})

test('register: "Show more events" appends 50 rows, and a value typed on page 2 saves', async ({
    page,
    request,
    shared,
}) => {
    await openGrid(page, REGISTER)
    expect(await bodyRows(page)).toBe(50)
    const more = page.getByRole('button', { name: 'Show more events' })
    await more.click()
    await expect.poll(() => bodyRows(page)).toBe(100)
    await expect(more).toBeFocused()
    await announced(page, 'Events shown: 100')

    await page
        .locator('tbody')
        .first()
        .evaluate((body) => {
            const region = body.closest('[role="region"]')
            region?.scrollTo({ top: region.scrollHeight })
        })
    const pageTwo = (row: string | undefined) => Number(row) >= 50
    const column = page.locator(`tbody [id$=".${DIASTOLIC}"]`)
    const rowOf = (control: Locator) =>
        control.evaluate((element) => element.closest('tr')?.dataset.index)
    await expect
        .poll(
            async () =>
                (await Promise.all((await column.all()).map(rowOf))).filter(
                    pageTwo
                ).length
        )
        .toBeGreaterThan(1)
    let target: Locator | undefined
    for (const control of await column.all()) {
        if (pageTwo(await rowOf(control)) && (await control.isEditable())) {
            target = control
            break
        }
    }
    if (target === undefined) {
        throw new Error('No editable row on page 2')
    }
    await target.focus()
    const rowId = await focusedRow(page)
    const before = found(await readEvent(request, rowId), `event ${rowId}`)
    shared.keep([before])
    const value = valuesOf(before).get(DIASTOLIC) === '85' ? '86' : '85'

    await page.route(
        (url) => TRACKER_IMPORT.test(url.pathname),
        (route) => {
            const url = new URL(route.request().url())
            url.searchParams.set('importMode', 'VALIDATE')
            return route.continue({ url: url.toString() })
        }
    )
    const imported = page.waitForResponse(isPost(TRACKER_IMPORT))
    await page.keyboard.type(value)
    await page.keyboard.press('Enter')
    const answer = await imported
    expect(answer.ok(), await answer.text()).toBe(true)
    expect(new URL(answer.url()).searchParams.get('importMode')).toBe(
        'VALIDATE'
    )
    const sent = z
        .object({
            events: z.array(
                z.looseObject({
                    event: z.string(),
                    dataValues: z.array(
                        z.object({
                            dataElement: z.string(),
                            value: z.string().nullable(),
                        })
                    ),
                })
            ),
        })
        .parse(answer.request().postDataJSON())
    expect(
        sent.events
            .find(({ event }) => event === rowId)
            ?.dataValues.find(({ dataElement }) => dataElement === DIASTOLIC)
            ?.value
    ).toBe(value)

    await settled(page)
    await expect(target).not.toHaveAccessibleDescription(/Not saved/)
    expect(valuesOf(await readEvent(request, rowId))).toEqual(valuesOf(before))
})
