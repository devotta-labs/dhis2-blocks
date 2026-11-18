import { expect, test } from '../fixtures/test'
import {
    INTEGER_ATTRIBUTE,
    INTEGER_ATTRIBUTE_NAME,
    ORG_UNIT,
    ORG_UNIT_NAME,
    PROGRAM,
    TEXT_ATTRIBUTE,
    applyTextFilter,
    chooseProgram,
    columnHeader,
    fetchOrganisationUnit,
    filterChip,
    hashParameter,
    listHash,
    listViolations,
    openPatientList,
    patientList,
    recordRowsRequests,
    rows,
    selectOrganisationUnitFromTree,
    statusParameter,
    tabTo,
    tablePart,
    waitForRows,
} from './patient-list.support'

// 20 tracked entities in Ngelehun CHC: 001–008 active, 009–014 completed and
// 015–020 cancelled. All but 005, 010, 015 and 020 have a text value
// ("Alpha person 01", "Bravo person 02", …). The list shows 15 per page.

test.describe('Patient list in the app', () => {
    test('choosing the program and organisation unit loads the first page', async ({
        dhis2,
        page,
    }) => {
        const organisationUnit = await fetchOrganisationUnit(dhis2)
        await expect(page.getByTestId('program-empty-state')).toBeVisible({
            timeout: 30_000,
        })
        const requests = recordRowsRequests(page)

        await chooseProgram(page)
        await expect(page.getByTestId('org-unit-empty-state')).toBeVisible({
            timeout: 30_000,
        })
        expect(requests).toEqual([])

        const request = await waitForRows(page, async () => {
            await page.locator('[data-test="choose-org-unit"]').click()
            await selectOrganisationUnitFromTree(
                page,
                organisationUnit.ancestors,
                organisationUnit
            )
        })
        expect(request.searchParams.get('program')).toBe(PROGRAM)
        expect(request.searchParams.get('orgUnits')).toBe(ORG_UNIT)
        expect(request.searchParams.get('orgUnitMode')).toBe('SELECTED')
        expect(request.searchParams.get('page')).toBe('1')
        expect(request.searchParams.get('pageSize')).toBe('15')

        await expect(rows(page)).toHaveCount(15)
        await expect(page.getByTestId('patient-list-layout')).toBeVisible()
        await expect(page.getByTestId('patient-list-heading')).toHaveText(
            'Patient list'
        )
        await expect(
            page.getByRole('table', { name: 'Patient list' })
        ).toBeVisible()
        await expect(
            page.locator('[data-test="org-unit-selector-container"]')
        ).toContainText(ORG_UNIT_NAME)
        expect(hashParameter(page, 'orgUnitId')).toBe(ORG_UNIT)
    })

    test('a deep link to page 2 requests that page first, and Previous goes back', async ({
        page,
    }) => {
        const requests = recordRowsRequests(page)
        await openPatientList(page, listHash(2, 15))

        expect(requests[0]?.searchParams.get('page')).toBe('2')
        expect(
            requests.some((url) => url.searchParams.get('page') === '1')
        ).toBe(false)
        await expect(rows(page)).toHaveCount(5)
        await expect(tablePart(page, 'page-info')).toHaveText('Page 2')
        await expect(tablePart(page, 'page-next')).toHaveAttribute(
            'aria-disabled',
            'true'
        )

        const previous = await waitForRows(
            page,
            () => tablePart(page, 'page-previous').click(),
            (url) => url.searchParams.get('page') === '1'
        )
        expect(previous.searchParams.get('pageSize')).toBe('15')
        await expect(rows(page)).toHaveCount(15)
        await expect(tablePart(page, 'page-info')).toHaveText('Page 1')
        await expect.poll(() => hashParameter(page, 'page')).toBe('1')
        await expect(tablePart(page, 'page-next')).not.toHaveAttribute(
            'aria-disabled',
            'true'
        )
    })

    test('a new page size returns to page 1 and goes into the URL', async ({
        page,
    }) => {
        await openPatientList(page)

        const resized = await waitForRows(
            page,
            async () => {
                await patientList(page)
                    .getByRole('combobox', { name: 'Rows per page' })
                    .click()
                await page
                    .getByRole('option', { name: '25', exact: true })
                    .click()
            },
            (url) => url.searchParams.get('pageSize') === '25'
        )
        expect(resized.searchParams.get('page')).toBe('1')
        await expect(rows(page)).toHaveCount(20)
        await expect.poll(() => hashParameter(page, 'pageSize')).toBe('25')
        expect(hashParameter(page, 'page')).toBe('1')
    })

    test('the text attribute header sorts ascending, then descending', async ({
        page,
    }) => {
        await openPatientList(page)
        const header = columnHeader(page, TEXT_ATTRIBUTE)
        const sort = header.locator('[data-slot="data-table-sort"]')
        await expect(header).toHaveAttribute('aria-sort', 'none')

        const ascending = await waitForRows(
            page,
            () => sort.click(),
            (url) => url.searchParams.get('order') === `${TEXT_ATTRIBUTE}:asc`
        )
        expect(ascending.searchParams.get('page')).toBe('1')
        await expect(header).toHaveAttribute('aria-sort', 'ascending')

        await waitForRows(
            page,
            () => sort.click(),
            (url) => url.searchParams.get('order') === `${TEXT_ATTRIBUTE}:desc`
        )
        await expect(header).toHaveAttribute('aria-sort', 'descending')
    })

    test('the pinned text filter narrows the rows, and Clear filters restores them', async ({
        page,
    }) => {
        await openPatientList(page)
        const chip = filterChip(page, TEXT_ATTRIBUTE)
        await expect(chip).not.toHaveAttribute('data-active')

        const filtered = await applyTextFilter(page, 'Alpha person 01')
        expect(filtered.searchParams.get('page')).toBe('1')
        await expect(rows(page)).toHaveCount(1)
        await expect(rows(page)).toHaveAttribute('data-row-id', 'WlE2eTei001')
        await expect(chip).toHaveAttribute('data-active', 'true')

        await tablePart(page, 'clear-filters').click()
        await expect(rows(page)).toHaveCount(15)
        await expect(chip).not.toHaveAttribute('data-active')
        await expect(tablePart(page, 'clear-filters')).toHaveCount(0)
    })

    test(`the enrollment status filter sends ${statusParameter}`, async ({
        page,
    }) => {
        await openPatientList(page)
        await filterChip(page, 'enrollmentStatus')
            .getByRole('combobox', { name: 'Enrollment status' })
            .click()
        const editor = page.getByRole('dialog', { name: 'Enrollment status' })
        await editor.getByRole('radio', { name: 'Completed' }).click()

        const completed = await waitForRows(
            page,
            () => editor.getByRole('button', { name: 'Apply' }).click(),
            (url) => url.searchParams.get(statusParameter) === 'COMPLETED'
        )
        expect(completed.searchParams.get('page')).toBe('1')
        await expect(rows(page)).toHaveCount(6)
    })

    test('column settings hide a column, and Reset brings it back', async ({
        page,
    }) => {
        await openPatientList(page)
        const header = columnHeader(page, INTEGER_ATTRIBUTE)
        await expect(header).toHaveText(INTEGER_ATTRIBUTE_NAME)

        await patientList(page)
            .getByRole('button', { name: 'Columns', exact: true })
            .click()
        const settings = page.getByRole('dialog', { name: 'Columns' })
        const column = settings.getByRole('checkbox', {
            name: INTEGER_ATTRIBUTE_NAME,
            exact: true,
        })
        await expect(column).toBeChecked()
        await column.click()
        await expect(column).not.toBeChecked()
        await expect(header).toHaveCount(0)

        await settings
            .getByRole('button', { name: 'Reset', exact: true })
            .click()
        await expect(column).toBeChecked()
        await expect(header).toHaveText(INTEGER_ATTRIBUTE_NAME)
    })

    test('opening a row shows its id, and Close returns focus to the row', async ({
        page,
    }) => {
        await openPatientList(page)
        const row = rows(page).first()
        const id = (await row.getAttribute('data-row-id')) ?? ''
        expect(id).toMatch(/^WlE2eTei\d{3}$/)
        const open = row.locator('[data-slot="data-table-row-open"]')

        await open.focus()
        await page.keyboard.press('Enter')
        const dialog = page.getByRole('dialog', {
            name: 'Tracked entity selected',
        })
        await expect(dialog).toBeVisible()
        await expect(dialog.locator('dd')).toHaveText(id)

        await dialog
            .locator('[data-slot="dialog-footer"]')
            .getByRole('button', { name: 'Close' })
            .click()
        await expect(dialog).toHaveCount(0)
        await expect(open).toBeFocused()
    })

    test.describe('when the rows request fails', () => {
        test.use({
            expectedHttpFailures: [
                { status: 500, path: /\/tracker\/trackedEntities$/ },
            ],
        })

        test('shows the server message with Retry, and Retry loads the rows', async ({
            page,
        }) => {
            let failing = true
            let failures = 0
            await page.route(
                (url) => url.pathname.endsWith('/tracker/trackedEntities'),
                async (route) => {
                    if (!failing) {
                        await route.fallback()
                        return
                    }
                    failures += 1
                    await route.fulfill({
                        status: 500,
                        json: {
                            httpStatus: 'Internal Server Error',
                            httpStatusCode: 500,
                            status: 'ERROR',
                            message: 'E2E: the rows request failed',
                        },
                    })
                }
            )

            await page.goto(listHash())
            const error = tablePart(page, 'error')
            await expect(error).toContainText('E2E: the rows request failed', {
                timeout: 30_000,
            })
            await expect(patientList(page)).toHaveAttribute(
                'data-status',
                'error'
            )
            // Server errors are tried three times before the list gives up.
            expect(failures).toBe(3)

            failing = false
            await waitForRows(page, () =>
                error.getByRole('button', { name: 'Retry' }).click()
            )
            await expect(rows(page)).toHaveCount(15)
            await expect(error).toHaveCount(0)
            await expect(patientList(page)).toHaveAttribute(
                'data-status',
                'ready'
            )
        })
    })

    test('changing the organisation unit returns to page 1 and clears the filters', async ({
        dhis2,
        page,
    }) => {
        const organisationUnit = await fetchOrganisationUnit(dhis2)
        const ancestors = organisationUnit.ancestors
        const parent = ancestors.at(-1)
        if (parent === undefined) {
            throw new Error(`${ORG_UNIT_NAME} has no parent to switch to.`)
        }

        // Start on page 2, so the first page this test returns to is not cached.
        await openPatientList(page, listHash(2, 10))
        await expect(rows(page)).toHaveCount(10)
        await applyTextFilter(page, 'person')
        await expect(rows(page)).toHaveCount(10)
        await waitForRows(
            page,
            () => tablePart(page, 'page-next').click(),
            (url) =>
                url.searchParams.get('page') === '2' &&
                url.searchParams.getAll('filter').length === 1
        )
        await expect(rows(page)).toHaveCount(6)
        await expect.poll(() => hashParameter(page, 'page')).toBe('2')

        // The program is assigned to Ngelehun CHC only: its parent is out of
        // the program's scope, so the list goes away until the user returns.
        // Near its start: the clear icon sits at the end of the selector.
        await page
            .locator('[data-test="org-unit-selector-container"]')
            .click({ position: { x: 12, y: 12 } })
        await selectOrganisationUnitFromTree(
            page,
            ancestors.slice(0, -1),
            parent
        )
        await expect(page.getByTestId('invalid-program-context')).toBeVisible({
            timeout: 30_000,
        })
        await expect(patientList(page)).toHaveCount(0)
        await expect
            .poll(() => hashParameter(page, 'orgUnitId'))
            .toBe(parent.id)
        expect(hashParameter(page, 'page')).toBe('1')

        const returned = await waitForRows(
            page,
            async () => {
                await page
                    .locator('[data-test="replace-invalid-org-unit"]')
                    .click()
                await selectOrganisationUnitFromTree(
                    page,
                    ancestors,
                    organisationUnit
                )
            },
            (url) => url.searchParams.get('orgUnits') === ORG_UNIT
        )
        expect(returned.searchParams.get('page')).toBe('1')
        expect(returned.searchParams.get('pageSize')).toBe('10')
        expect(returned.searchParams.getAll('filter')).toEqual([])
        await expect(rows(page)).toHaveCount(10)
        await expect(tablePart(page, 'page-info')).toHaveText('Page 1')
        await expect(filterChip(page, TEXT_ATTRIBUTE)).not.toHaveAttribute(
            'data-active'
        )
        await expect(tablePart(page, 'clear-filters')).toHaveCount(0)
    })

    test('passes axe at desktop and phone widths, and works by keyboard', async ({
        page,
    }) => {
        await openPatientList(page)
        await expect(rows(page)).toHaveCount(15)
        expect(await listViolations(page)).toEqual([])

        await page.setViewportSize({ width: 375, height: 812 })
        await expect(rows(page)).toHaveCount(15)
        expect(await listViolations(page)).toEqual([])
        await page.setViewportSize({ width: 1280, height: 720 })

        // The text attribute is the first column, right after the toolbar.
        await patientList(page)
            .getByRole('button', { name: 'Columns', exact: true })
            .focus()
        const header = columnHeader(page, TEXT_ATTRIBUTE)
        await tabTo(page, header.locator('[data-slot="data-table-sort"]'))
        await waitForRows(
            page,
            () => page.keyboard.press('Enter'),
            (url) => url.searchParams.get('order') === `${TEXT_ATTRIBUTE}:asc`
        )
        await expect(header).toHaveAttribute('aria-sort', 'ascending')

        await tabTo(page, tablePart(page, 'page-next'))
        await waitForRows(
            page,
            () => page.keyboard.press('Enter'),
            (url) =>
                url.searchParams.get('page') === '2' &&
                url.searchParams.get('order') === `${TEXT_ATTRIBUTE}:asc`
        )
        await expect(tablePart(page, 'page-info')).toHaveText('Page 2')

        await page.keyboard.press('Shift+Tab')
        await expect(tablePart(page, 'page-previous')).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(tablePart(page, 'page-info')).toHaveText('Page 1')
        await expect.poll(() => hashParameter(page, 'page')).toBe('1')
    })
})
