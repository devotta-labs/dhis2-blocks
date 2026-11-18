import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

/**
 * The Data Table examples list the 48 made-up facilities in
 * apps/docs/src/examples/data-table/facilities.ts, so they need no DHIS2.
 */
const FACILITIES = 48

const table = (page: Page) => page.locator('[data-slot="data-table"]')

const rows = (page: Page) => table(page).locator('[data-slot="data-table-row"]')

const tablePart = (page: Page, slot: string) =>
    table(page).locator(`[data-slot="data-table-${slot}"]`)

const columnHeader = (page: Page, columnId: string) =>
    table(page).locator(
        `th[data-slot="data-table-head"][data-column-id="${columnId}"]`
    )

const cells = (page: Page, columnId: string) =>
    rows(page).locator(
        `[data-slot="data-table-cell"][data-column-id="${columnId}"]`
    )

const openExample = async (page: Page, name: string) => {
    await page.goto(`/preview/data-table/${name}`)
    await expect(rows(page).first()).toBeVisible({ timeout: 30_000 })
}

const pageInfo = (page: Page) => tablePart(page, 'page-info')

test.describe('Data Table', () => {
    test('the page shows every example', async ({ page }) => {
        await page.goto('/blocks/data-table')

        await expect(
            page.getByRole('heading', { name: 'Data Table', level: 1 })
        ).toBeVisible()
        await expect(page.locator('.docs-preview-surface')).toHaveCount(7)
        await expect(
            page.getByRole('table', { name: 'Facilities', exact: true }).first()
        ).toBeVisible({ timeout: 30_000 })
        await expect(
            page.getByRole('link', { name: 'Open full screen' }).first()
        ).toHaveAttribute('href', '/preview/data-table/basic')
    })

    test('basic: a header sorts the rows, and the pages go forward and back', async ({
        page,
    }) => {
        await openExample(page, 'basic')
        await expect(rows(page)).toHaveCount(10)
        await expect(pageInfo(page)).toHaveText(`1–10 of ${FACILITIES}`)

        const beds = columnHeader(page, 'beds')
        const bedCounts = async () =>
            (await cells(page, 'beds').allInnerTexts()).map(Number)
        await expect(beds).toHaveAttribute('aria-sort', 'none')

        await beds.locator('[data-slot="data-table-sort"]').click()
        await expect(beds).toHaveAttribute('aria-sort', 'ascending')
        const ascending = await bedCounts()
        expect(ascending).toEqual([...ascending].sort((a, b) => a - b))

        await beds.locator('[data-slot="data-table-sort"]').click()
        await expect(beds).toHaveAttribute('aria-sort', 'descending')
        const descending = await bedCounts()
        expect(descending).toEqual([...descending].sort((a, b) => b - a))
        expect(descending).not.toEqual(ascending)

        const previous = tablePart(page, 'page-previous')
        const next = tablePart(page, 'page-next')
        await expect(previous).toHaveAttribute('aria-disabled', 'true')
        await next.click()
        await expect(pageInfo(page)).toHaveText(`11–20 of ${FACILITIES}`)
        await expect(previous).not.toHaveAttribute('aria-disabled', 'true')
        for (const shown of ['21–30', '31–40', '41–48']) {
            await next.click()
            await expect(pageInfo(page)).toHaveText(`${shown} of ${FACILITIES}`)
        }
        await expect(rows(page)).toHaveCount(8)
        await expect(next).toHaveAttribute('aria-disabled', 'true')

        await previous.click()
        await expect(pageInfo(page)).toHaveText(`31–40 of ${FACILITIES}`)
        await expect(rows(page)).toHaveCount(10)
    })

    test('filtering: a text filter and the search narrow the rows, and clearing them brings the rows back', async ({
        page,
    }) => {
        await openExample(page, 'filtering')
        await expect(pageInfo(page)).toHaveText(`1–10 of ${FACILITIES}`)

        const chip = table(page).locator(
            '[data-slot="data-table-filter-chip"][data-filter-id="name"]'
        )
        await chip.getByRole('combobox', { name: 'Name' }).click()
        const editor = page.getByRole('dialog', { name: 'Name' })
        await expect(
            editor.getByRole('combobox', { name: 'Match' })
        ).toHaveText('Contains')
        await editor.getByRole('textbox', { name: 'Value' }).fill('Hospital')
        await editor.getByRole('button', { name: 'Apply' }).click()
        await expect(editor).toHaveCount(0)
        await expect(chip).toHaveAttribute('data-active', 'true')
        await expect(
            chip.getByRole('combobox', { name: 'Name: Hospital' })
        ).toBeVisible()
        await expect(pageInfo(page)).toHaveText('1–10 of 15')
        for (const name of await cells(page, 'name').allInnerTexts()) {
            expect(name).toContain('Hospital')
        }

        const search = page.getByRole('searchbox', {
            name: 'Search facilities',
        })
        await search.fill('Bo')
        await expect(pageInfo(page)).toHaveText('1–4 of 4')
        await expect(cells(page, 'name')).toHaveText([
            'Bo Government Hospital',
            'Mercy Hospital',
            'Makeni Government Hospital',
            'Holy Spirit Hospital',
        ])

        // Clear filters removes the column filters; the search stays.
        await tablePart(page, 'clear-filters').click()
        await expect(chip).not.toHaveAttribute('data-active', 'true')
        await expect(tablePart(page, 'clear-filters')).toHaveCount(0)
        await expect(search).toHaveValue('Bo')
        await expect(pageInfo(page)).toHaveText('1–10 of 16')

        await search.fill('')
        await expect(pageInfo(page)).toHaveText(`1–10 of ${FACILITIES}`)
    })

    test('selection: select all counts the page, and column settings hide a column', async ({
        page,
    }) => {
        await openExample(page, 'selection')

        await page
            .getByRole('checkbox', { name: 'Select all rows on this page' })
            .click()
        const bar = page.getByRole('region', { name: 'Selection' })
        await expect(bar).toContainText('10 selected')
        await expect(
            rows(page).getByRole('checkbox', { name: /^Select row \d+$/ })
        ).toHaveCount(10)
        for (const checkbox of await rows(page)
            .getByRole('checkbox', { name: /^Select row \d+$/ })
            .all()) {
            await expect(checkbox).toBeChecked()
        }
        await bar.getByRole('button', { name: 'Clear selection' }).click()
        await expect(bar).toHaveCount(0)

        const district = columnHeader(page, 'district')
        await expect(district).toHaveText('District')
        await page.getByRole('button', { name: 'Columns', exact: true }).click()
        const settings = page.getByRole('dialog', { name: 'Columns' })
        const districtSetting = settings.getByRole('checkbox', {
            name: 'District',
            exact: true,
        })
        await expect(districtSetting).toBeChecked()
        await districtSetting.click()
        await expect(districtSetting).not.toBeChecked()
        await expect(district).toHaveCount(0)
        await expect(cells(page, 'district')).toHaveCount(0)

        await settings
            .getByRole('button', { name: 'Reset', exact: true })
            .click()
        await expect(districtSetting).toBeChecked()
        await expect(district).toHaveText('District')
    })

    test('grouping: a district group opens to its facilities', async ({
        page,
    }) => {
        await page.goto('/preview/data-table/grouping')
        const groups = table(page).locator(
            '[data-slot="data-table-group-toggle"]'
        )
        await expect(groups).toHaveCount(6, { timeout: 30_000 })
        await expect(rows(page)).toHaveCount(6)

        const bo = groups.filter({ hasText: /^Bo \(8\)$/ })
        await expect(bo).toHaveAttribute('aria-expanded', 'false')
        await bo.click()
        await expect(bo).toHaveAttribute('aria-expanded', 'true')
        await expect(rows(page)).toHaveCount(6 + 8)
        await expect(
            rows(page).filter({ hasText: 'Bo Government Hospital' })
        ).toBeVisible()

        await bo.click()
        await expect(bo).toHaveAttribute('aria-expanded', 'false')
        await expect(rows(page)).toHaveCount(6)
    })

    test('row detail: a row expands to its details, and a click opens it', async ({
        page,
    }) => {
        await openExample(page, 'row-detail')
        const details = table(page).locator(
            '[data-slot="data-table-row-detail"]'
        )
        await expect(details).toHaveCount(0)

        const expand = table(page).getByRole('button', {
            name: 'Expand row 1',
            exact: true,
        })
        await expect(expand).toHaveAttribute('aria-expanded', 'false')
        await expand.click()
        const collapse = table(page).getByRole('button', {
            name: 'Collapse row 1',
            exact: true,
        })
        await expect(collapse).toHaveAttribute('aria-expanded', 'true')
        await expect(details).toHaveCount(1)
        await expect(details.locator('dl')).toContainText('Ownership')
        await expect(details.locator('dl')).toContainText('Public')

        await rows(page)
            .first()
            .locator('[data-slot="data-table-cell"][data-column-id="district"]')
            .click()
        await expect(page.locator('p[role="status"]')).toHaveText(
            'Opened Bo Government Hospital'
        )

        await collapse.click()
        await expect(details).toHaveCount(0)
    })

    test('server: the next page loads, and a failed request offers Retry', async ({
        page,
    }) => {
        await openExample(page, 'server')
        await expect(table(page)).toHaveAttribute('data-status', 'ready')
        await expect(pageInfo(page)).toHaveText(`1–10 of ${FACILITIES}`)
        const firstRowId = await rows(page).first().getAttribute('data-row-id')

        await tablePart(page, 'page-next').click()
        await expect(pageInfo(page)).toHaveText(`11–20 of ${FACILITIES}`)
        await expect(table(page)).toHaveAttribute('data-status', 'ready')
        await expect(rows(page)).toHaveCount(10)
        await expect(rows(page).first()).not.toHaveAttribute(
            'data-row-id',
            firstRowId ?? ''
        )

        const failNext = page.getByRole('checkbox', {
            name: 'Fail the next request',
        })
        await failNext.click()
        await expect(failNext).toBeChecked()
        await tablePart(page, 'page-next').click()
        const failure = tablePart(page, 'error')
        await expect(failure).toContainText('The list could not be loaded.')
        await expect(table(page)).toHaveAttribute('data-status', 'error')
        await expect(rows(page)).toHaveCount(0)
        await expect(failNext).not.toBeChecked()

        await failure.getByRole('button', { name: 'Retry' }).click()
        await expect(table(page)).toHaveAttribute('data-status', 'ready')
        await expect(failure).toHaveCount(0)
        await expect(rows(page)).toHaveCount(10)
        await expect(pageInfo(page)).toHaveText(`21–30 of ${FACILITIES}`)
    })

    test('virtual: only the rows in view are drawn, and scrolling draws the later ones', async ({
        page,
    }) => {
        await openExample(page, 'virtual')
        await expect(table(page).getByRole('table')).toHaveAttribute(
            'aria-rowcount',
            '10001'
        )
        const drawn = await rows(page).count()
        expect(drawn).toBeGreaterThan(0)
        expect(drawn).toBeLessThan(100)
        const firstFacility = /Bo Government Hospital 1(?!\d)/
        await expect(rows(page).first()).toContainText(firstFacility)

        await tablePart(page, 'row')
            .first()
            .evaluate((row) => {
                const scroller = row.closest('[data-slot="table-container"]')
                if (scroller === null) {
                    throw new Error('The virtual table has no scroll container')
                }
                scroller.scrollTop = scroller.scrollHeight
            })
        // The last of the 10,000 rows comes after the header row.
        await expect(rows(page).last()).toHaveAttribute(
            'aria-rowindex',
            '10001'
        )
        await expect(rows(page).last()).toContainText(' 10000')
        await expect(rows(page).filter({ hasText: firstFacility })).toHaveCount(
            0
        )
        expect(await rows(page).count()).toBeLessThan(100)
    })
})
