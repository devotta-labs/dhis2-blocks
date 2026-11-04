import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from './fixtures'

test.describe('playground Canvas / Code', () => {
    for (const [path, composition, part] of [
        ['working-list', 'TableCanvas', 'WorkingListTable'],
        [
            'working-list?display=calendar',
            'CalendarCanvas',
            'WorkingListCalendarGrid',
        ],
        ['observation-cards', 'ObservationsCanvas', 'ObservationCard'],
        ['timeline', 'TimelineCanvas', 'TimelineFeed'],
    ]) {
        test(`shows the actual ${composition} source`, async ({ page }) => {
            await page.goto(`/playground/${path}`)
            await page.getByRole('tab', { name: 'Code', exact: true }).click()
            const panel = page.getByRole('tabpanel', { name: 'Code' })
            await expect(panel.getByLabel('Code file')).toHaveValue(
                'composition'
            )
            await expect(panel.locator('pre')).toContainText(
                `export const ${composition}`
            )
            await expect(panel.locator('pre')).toContainText(`<${part}`)
            await expect(
                page.getByRole('tabpanel', { name: 'Canvas' })
            ).toBeHidden()
            await page.getByRole('tab', { name: 'Canvas', exact: true }).click()
            await expect(
                page.getByRole('tabpanel', { name: 'Canvas' })
            ).toBeVisible()
        })
    }

    test('keeps the block mounted when switching views', async ({ page }) => {
        await page.goto('/playground/working-list')
        const table = page.getByTestId('working-list-table')
        await expect(table.locator('tbody')).toHaveAttribute(
            'aria-busy',
            'false'
        )
        const original = await table.elementHandle()
        expect(original).not.toBeNull()

        await page.getByRole('tab', { name: 'Code', exact: true }).click()
        expect(await original!.evaluate((element) => element.isConnected)).toBe(
            true
        )
        await page.getByRole('tab', { name: 'Canvas', exact: true }).click()
        expect(await original!.evaluate((element) => element.isConnected)).toBe(
            true
        )
        await expect(table.locator('tbody')).toHaveAttribute(
            'aria-busy',
            'false'
        )
    })

    test('updates current props from settings and supports keyboard navigation', async ({
        page,
    }) => {
        await page.goto('/playground/working-list')
        const canvasTab = page.getByRole('tab', { name: 'Canvas', exact: true })
        await canvasTab.focus()
        await page.keyboard.press('ArrowRight')
        const codeTab = page.getByRole('tab', { name: 'Code', exact: true })
        await expect(codeTab).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(codeTab).toHaveAttribute('aria-selected', 'true')
        const panel = page.getByRole('tabpanel', { name: 'Code' })
        await panel.getByLabel('Code file').selectOption('props')
        await page.getByLabel('Rows per page').selectOption('25')
        await expect(panel.locator('pre')).toContainText('"pageSize": 25')
        await expect(panel.locator('pre')).toContainText(
            '"programId": "labProgram1"'
        )
    })

    test('copies the complete composition source', async ({
        page,
        context,
    }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write'])
        await page.goto('/playground/working-list')
        await page.getByRole('tab', { name: 'Code', exact: true }).click()
        const panel = page.getByRole('tabpanel', { name: 'Code' })
        await panel.getByRole('button', { name: 'Copy', exact: true }).click()
        await expect(
            panel.getByRole('button', { name: 'Copied', exact: true })
        ).toBeVisible()
        const expected = await readFile(
            resolve(
                __dirname,
                '../../apps/docs/src/playground/working-list/table/TableCanvas.tsx'
            ),
            'utf8'
        )
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
            expected.replace(/\n$/, '')
        )
    })
})
