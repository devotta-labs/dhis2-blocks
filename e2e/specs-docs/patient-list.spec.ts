import type { Page, Request, Response } from '@playwright/test'
import { z } from 'zod'
import { expect, openLivePreview, resultRows, test } from './fixtures'

/**
 * The Patient List examples on the docs DHIS2 (the Sierra Leone demo
 * database): the Child Programme at Ngelehun CHC.
 */
const CHILD_PROGRAMME = 'IpHINAT79UW'
const NGELEHUN = 'DiszpKrYNg8'
const FIRST_NAME = 'w75KJ2mc4zz'

const patientList = (page: Page) => page.locator('[data-block="patient-list"]')

const columnNames = (page: Page) =>
    patientList(page).locator('th[data-slot="data-table-head"]')

const requestUrl = (message: Request | Response) => new URL(message.url())

const isRowsRequest = (request: Request) =>
    request.method() === 'GET' &&
    requestUrl(request).pathname.endsWith('/tracker/trackedEntities')

/** Runs `action` and returns the URL of the first rows response that `matches`. */
const waitForRows = async (
    page: Page,
    action: () => Promise<void>,
    matches: (url: URL) => boolean
) => {
    const pending = page.waitForResponse(
        (response) =>
            isRowsRequest(response.request()) && matches(requestUrl(response))
    )
    await action()
    const response = await pending
    expect(response.ok(), `rows request ${response.url()}`).toBe(true)
    return requestUrl(response)
}

const ProgramsSchema = z.object({
    programs: z.array(
        z.object({
            id: z.string(),
            displayName: z.string(),
            programTrackedEntityAttributes: z
                .array(
                    z.object({
                        displayInList: z.boolean().optional(),
                        trackedEntityAttribute: z.object({
                            displayName: z.string(),
                        }),
                    })
                )
                .optional(),
        })
    ),
})

type Program = z.infer<typeof ProgramsSchema>['programs'][number]

/** The program's attributes marked "Display in list", the example's columns. */
const listColumns = (program: Program) =>
    (program.programTrackedEntityAttributes ?? []).flatMap((entry) =>
        entry.displayInList === true
            ? [entry.trackedEntityAttribute.displayName]
            : []
    )

const PROGRAM_FIELDS =
    'id,displayName,programTrackedEntityAttributes[displayInList,trackedEntityAttribute[displayName]]'

const LatestEnrollmentSchema = z.object({
    trackedEntities: z.array(
        z.object({
            enrollments: z.array(
                z.object({ program: z.string(), enrolledAt: z.string() })
            ),
        })
    ),
})

/** The month of `date`, as `YYYY-MM`. */
const monthOf = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const yearOf = (yearMonth: string) => Number(yearMonth.slice(0, 4))

const monthNumberOf = (yearMonth: string) => Number(yearMonth.slice(5, 7))

const monthIndex = (yearMonth: string) =>
    yearOf(yearMonth) * 12 + monthNumberOf(yearMonth)

/** The last day of `yearMonth`, as `YYYY-MM-DD`. */
const lastDayOf = (yearMonth: string) => {
    const day = new Date(
        Date.UTC(yearOf(yearMonth), monthNumberOf(yearMonth), 0)
    ).getUTCDate()
    return `${yearMonth}-${String(day).padStart(2, '0')}`
}

const MONTHS_LIMIT = 120

test.describe('Patient List previews with live DHIS2', () => {
    test('default: lists live rows, and the first name filter narrows them', async ({
        page,
    }) => {
        await openLivePreview(page, 'patient-list/default')
        await expect(resultRows(page)).toHaveCount(10)

        const firstNames = resultRows(page).locator(
            `[data-slot="data-table-cell"][data-column-id="${FIRST_NAME}"]`
        )
        const name = (await firstNames.allInnerTexts())
            .map((text) => text.trim())
            .find((text) => text !== '')
        if (name === undefined) {
            throw new Error('No row on the first page has a first name')
        }

        const chip = patientList(page).locator(
            `[data-slot="data-table-filter-chip"][data-filter-id="${FIRST_NAME}"]`
        )
        await chip.getByRole('combobox', { name: 'First name' }).click()
        const editor = page.getByRole('dialog', { name: 'First name' })
        await editor.getByRole('textbox', { name: 'Value' }).fill(name)
        const request = await waitForRows(
            page,
            () => editor.getByRole('button', { name: 'Apply' }).click(),
            (url) =>
                url.searchParams
                    .getAll('filter')
                    .some((filter) => filter.startsWith(`${FIRST_NAME}:like:`))
        )
        expect(request.searchParams.get('program')).toBe(CHILD_PROGRAMME)
        expect(request.searchParams.get('orgUnits')).toBe(NGELEHUN)
        expect(request.searchParams.get('page')).toBe('1')

        await expect(chip).toHaveAttribute('data-active', 'true')
        await expect(patientList(page)).toHaveAttribute('data-status', 'ready')
        await expect(resultRows(page).first()).toBeVisible()
        for (const cell of await firstNames.all()) {
            await expect(cell).toContainText(name, { ignoreCase: true })
        }
    })

    test("from metadata: lists the tracker programs, and shows the chosen program's columns", async ({
        page,
        request,
    }) => {
        // Each filter is its own parameter, and DHIS2 joins them with "and".
        const readPrograms = async (filters: string[]) => {
            const query = new URLSearchParams([
                ['fields', PROGRAM_FIELDS],
                ['paging', 'false'],
                ...filters.map((filter) => ['filter', filter]),
            ])
            const response = await request.get(`/dhis2/api/programs?${query}`)
            expect(response.ok()).toBe(true)
            return ProgramsSchema.parse(await response.json()).programs
        }
        const trackerPrograms = await readPrograms([
            'programType:eq:WITH_REGISTRATION',
        ])
        const atNgelehun = await readPrograms([
            'programType:eq:WITH_REGISTRATION',
            `organisationUnits.id:eq:${NGELEHUN}`,
        ])
        const childProgramme = trackerPrograms.find(
            ({ id }) => id === CHILD_PROGRAMME
        )
        if (childProgramme === undefined) {
            throw new Error('The docs DHIS2 has no Child Programme')
        }
        const childColumns = listColumns(childProgramme)
        const other = atNgelehun.find((program) => {
            const columns = listColumns(program)
            return (
                program.id !== CHILD_PROGRAMME &&
                columns.length > 0 &&
                columns.join('\n') !== childColumns.join('\n')
            )
        })
        if (other === undefined) {
            throw new Error(
                'No other tracker program at Ngelehun CHC has its own list columns'
            )
        }

        await openLivePreview(page, 'patient-list/from-metadata')
        const program = page.getByRole('combobox', { name: 'Program' })
        await expect(program).toHaveText('Child Programme')
        await expect(columnNames(page)).toHaveText(childColumns)

        await program.click()
        const options = page.getByRole('option')
        await expect(options).toHaveCount(trackerPrograms.length)
        expect(await options.allInnerTexts()).toEqual(
            expect.arrayContaining(
                trackerPrograms.map(({ displayName }) => displayName)
            )
        )

        const rowsRequest = await waitForRows(
            page,
            () =>
                page
                    .getByRole('option', {
                        name: other.displayName,
                        exact: true,
                    })
                    .click(),
            (url) => url.searchParams.get('program') === other.id
        )
        expect(rowsRequest.searchParams.get('orgUnits')).toBe(NGELEHUN)
        await expect(program).toHaveText(other.displayName)
        await expect(columnNames(page)).toHaveText(listColumns(other))
        await expect(patientList(page)).toHaveAttribute('data-status', 'ready')
    })

    test('calendar: requests the visible weeks, and shows the records in them', async ({
        page,
        request,
    }) => {
        const latest = await request.get('/dhis2/api/tracker/trackedEntities', {
            params: {
                program: CHILD_PROGRAMME,
                orgUnits: NGELEHUN,
                orgUnitMode: 'SELECTED',
                order: 'enrolledAt:desc',
                pageSize: '1',
                fields: 'enrollments[program,enrolledAt]',
            },
        })
        expect(latest.ok()).toBe(true)
        const enrolledAt = LatestEnrollmentSchema.parse(
            await latest.json()
        ).trackedEntities[0]?.enrollments.find(
            ({ program }) => program === CHILD_PROGRAMME
        )?.enrolledAt
        if (enrolledAt === undefined) {
            throw new Error('Nobody is enrolled in the Child Programme here')
        }
        const target = enrolledAt.slice(0, 10)

        const thisMonth = monthOf(new Date())
        const firstRequest = await waitForRows(
            page,
            () =>
                openLivePreview(page, 'patient-list/calendar', async () => {
                    await expect(
                        page.getByRole('navigation', { name: 'Month' })
                    ).toBeVisible({ timeout: 30_000 })
                }),
            (url) => url.searchParams.has('enrollmentEnrolledAfter')
        )
        const params = firstRequest.searchParams
        expect(params.get('program')).toBe(CHILD_PROGRAMME)
        expect(params.get('orgUnits')).toBe(NGELEHUN)
        expect(params.get('pageSize')).toBe('1000')
        expect(params.get('order')).toBe('enrolledAt:asc')
        // ISO dates compare as text.
        const after = params.get('enrollmentEnrolledAfter') ?? ''
        const before = params.get('enrollmentEnrolledBefore') ?? ''
        expect(after <= `${thisMonth}-01`, `starts by ${after}`).toBe(true)
        expect(
            before.slice(0, 10) >= lastDayOf(thisMonth),
            `ends by ${before}`
        ).toBe(true)

        // Go to the month of the latest enrollment.
        const months = monthIndex(target.slice(0, 7)) - monthIndex(thisMonth)
        expect(Math.abs(months)).toBeLessThanOrEqual(MONTHS_LIMIT)
        const step = page.getByRole('button', {
            name: months < 0 ? 'Previous month' : 'Next month',
            exact: true,
        })
        if (months !== 0) {
            await waitForRows(
                page,
                async () => {
                    for (let moved = 0; moved < Math.abs(months); moved++) {
                        await step.click()
                    }
                },
                (url) =>
                    (url.searchParams.get('enrollmentEnrolledAfter') ?? '') <=
                        target &&
                    (url.searchParams.get('enrollmentEnrolledBefore') ?? '') >=
                        target
            )
        }

        const day = page.locator(`button[data-date="${target}"]`)
        await expect(day).toHaveAttribute('aria-label', /, \d+ records?$/)
        await expect(page.getByText('No records this month.')).toHaveCount(0)
    })
})
