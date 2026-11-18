import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'

/**
 * The Patient List playground in "Lab data" mode: the block runs against the
 * lab's own fake `tracker/trackedEntities`, 230 generated people at the lab's
 * program and organisation unit, so it needs no DHIS2.
 */
const FIRST_NAME = 'w75KJ2mc4zz'

const patientList = (page: Page) => page.locator('[data-block="patient-list"]')

const rows = (page: Page) =>
    patientList(page).locator('[data-slot="data-table-row"]')

const tablePart = (page: Page, slot: string) =>
    patientList(page).locator(`[data-slot="data-table-${slot}"]`)

const openLab = async (page: Page) => {
    await page.goto('/playground/patient-list')
    await expect(page).toHaveURL(/[?&]preset=Default(?:&|$)/)
    await expect(
        page.getByRole('button', { name: 'Lab data', exact: true })
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(patientList(page)).toHaveAttribute('data-status', 'ready')
    await expect(rows(page)).toHaveCount(15)
}

const pickPreset = async (page: Page, name: string) => {
    const preset = page
        .getByRole('group', { name: 'Examples' })
        .getByRole('button', { name, exact: true })
    await preset.click()
    await expect(preset).toHaveAttribute('aria-pressed', 'true')
    await expect
        .poll(() => new URL(page.url()).searchParams.get('preset'))
        .toBe(name)
}

/** Opens the folded log panel under the canvas. */
const openLogs = async (page: Page) => {
    const logs = page.getByRole('region', { name: 'Logs' })
    const toggle = logs.locator('button[aria-expanded]')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    return logs
}

/** A logged request, named by its query parameters. */
const loggedRequest = (logs: Locator, query: string) =>
    logs.getByRole('listitem', { name: query, exact: true })

test.describe('Patient List playground with lab data', () => {
    test('Large page shows 50 rows a page', async ({ page }) => {
        await openLab(page)
        await pickPreset(page, 'Large page')
        await expect(patientList(page)).toHaveAttribute('data-status', 'ready')
        await expect(rows(page)).toHaveCount(50)
    })

    test('Bulk selection adds the selection column and bar', async ({
        page,
    }) => {
        await openLab(page)
        await pickPreset(page, 'Bulk selection')
        await expect(rows(page)).toHaveCount(15)
        await patientList(page)
            .getByRole('checkbox', { name: 'Select all rows on this page' })
            .click()
        await expect(
            patientList(page).getByRole('region', { name: 'Selection' })
        ).toContainText('15 selected')
    })

    test('Bare table has no tools', async ({ page }) => {
        await openLab(page)
        await pickPreset(page, 'Bare table')
        await expect(rows(page)).toHaveCount(15)
        await expect(
            patientList(page).getByRole('toolbar', { name: 'Table tools' })
        ).toHaveCount(0)
    })

    test('Empty list shows the empty state', async ({ page }) => {
        await openLab(page)
        await pickPreset(page, 'Empty list')
        await expect(patientList(page)).toHaveAttribute('data-status', 'ready')
        await expect(tablePart(page, 'empty')).toHaveText('No items to display')
        await expect(rows(page)).toHaveCount(0)
    })

    test('Slow server loads, then shows the rows', async ({ page }) => {
        await openLab(page)
        await pickPreset(page, 'Slow server')
        await expect(patientList(page)).toHaveAttribute(
            'data-status',
            'loading'
        )
        await expect(rows(page)).toHaveCount(0)
        await expect(patientList(page)).toHaveAttribute('data-status', 'ready')
        await expect(rows(page)).toHaveCount(15)
    })

    test('Server error shows the error and Retry', async ({ page }) => {
        await openLab(page)
        await pickPreset(page, 'Server error')
        const failure = tablePart(page, 'error')
        // The list retries a server error twice before it gives up.
        await expect(failure).toContainText('Internal server error')
        await expect(patientList(page)).toHaveAttribute('data-status', 'error')
        await expect(
            failure.getByRole('button', { name: 'Retry', exact: true })
        ).toBeVisible()
        await expect(rows(page)).toHaveCount(0)
    })

    test('Malformed response shows the error and Retry', async ({ page }) => {
        await openLab(page)
        await pickPreset(page, 'Malformed response')
        const failure = tablePart(page, 'error')
        await expect(failure).toContainText('The list could not be loaded.')
        await expect(patientList(page)).toHaveAttribute('data-status', 'error')
        await expect(
            failure.getByRole('button', { name: 'Retry', exact: true })
        ).toBeVisible()
    })

    test('logs each request in the waterfall, and each callback', async ({
        page,
    }) => {
        await openLab(page)
        const logs = await openLogs(page)
        const base =
            'program=IpHINAT79UW orgUnits=DiszpKrYNg8 orgUnitMode=SELECTED'

        await expect(
            logs.getByText('Requests · 1', { exact: true })
        ).toBeVisible()
        await expect(
            loggedRequest(
                logs,
                `${base} page=1 pageSize=15 order=createdAt:desc`
            )
        ).toContainText('tracker/trackedEntities')
        await expect(
            logs.getByRole('listitem', {
                name: 'tracker/trackedEntities',
                exact: true,
            })
        ).toHaveCount(1)
        await expect(
            logs.getByText('Callbacks · 0', { exact: true })
        ).toBeVisible()

        const firstName = patientList(page).locator(
            `th[data-slot="data-table-head"][data-column-id="${FIRST_NAME}"]`
        )
        await firstName.locator('[data-slot="data-table-sort"]').click()
        await expect(firstName).toHaveAttribute('aria-sort', 'ascending')
        await expect(
            logs.getByText('Requests · 2', { exact: true })
        ).toBeVisible()
        await expect(
            loggedRequest(
                logs,
                `${base} page=1 pageSize=15 order=${FIRST_NAME}:asc`
            )
        ).toContainText('OK')

        await tablePart(page, 'page-next').click()
        await expect(tablePart(page, 'page-info')).toHaveText('Page 2')
        await expect(
            logs.getByText('Requests · 3', { exact: true })
        ).toBeVisible()
        await expect(
            loggedRequest(
                logs,
                `${base} page=2 pageSize=15 order=${FIRST_NAME}:asc`
            )
        ).toContainText('OK')
        await expect(
            logs.getByRole('listitem', {
                name: 'tracker/trackedEntities',
                exact: true,
            })
        ).toHaveCount(3)
        await expect(logs).toContainText(
            'onPaginationChange({"pageIndex":1,"pageSize":15})'
        )

        const row = rows(page).first()
        const id = await row.getAttribute('data-row-id')
        expect(id).toMatch(/^labTe\d+$/)
        await row.locator('[data-slot="data-table-cell"]').nth(1).click()
        await expect(logs).toContainText(`onRowOpen("${id}")`)
    })
})
