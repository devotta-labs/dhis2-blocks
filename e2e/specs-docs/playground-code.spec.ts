import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from './fixtures'

test.describe('playground Canvas / Code', () => {
    for (const [path, composition, part, prop, value] of [
        [
            'working-list',
            'TableCanvas',
            'WorkingListTable',
            'programId',
            '"labProgram1"',
        ],
        [
            'working-list?display=calendar',
            'CalendarCanvas',
            'CalendarGrid',
            'programId',
            '"labProgram1"',
        ],
        [
            'observation-cards',
            'ObservationsCanvas',
            'ObservationCard',
            'trackedEntity',
            '"labPerson01"',
        ],
        [
            'timeline',
            'TimelineCanvas',
            'TimelineFeed',
            'trackedEntity',
            '"labPerson01"',
        ],
    ]) {
        test(`shows the actual ${composition} source`, async ({ page }) => {
            await page.goto(`/playground/${path}`)
            await page.getByRole('tab', { name: 'Code', exact: true }).click()
            const panel = page.getByRole('tabpanel', { name: 'Code' })
            await expect(panel.getByLabel('Code file')).toHaveCount(0)
            await expect(panel.getByText('Current props.json')).toHaveCount(0)
            await expect(panel.locator('pre')).toContainText(
                `export const ${composition}`
            )
            await expect(panel.locator('pre')).toContainText(`<${part}`)
            await expect(panel.locator('pre')).toContainText(
                'interface Props {'
            )
            const declaration = panel
                .getByRole('button', { name: `Inspect ${prop}`, exact: true })
                .first()
            await declaration.hover()
            await expect(page.getByRole('tooltip').locator('pre')).toHaveText(
                value
            )
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

    test('inspects current props inline and supports keyboard navigation', async ({
        page,
    }, testInfo) => {
        await page.goto('/playground/working-list')
        const canvasTab = page.getByRole('tab', { name: 'Canvas', exact: true })
        await canvasTab.focus()
        await page.keyboard.press('ArrowRight')
        const codeTab = page.getByRole('tab', { name: 'Code', exact: true })
        await expect(codeTab).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(codeTab).toHaveAttribute('aria-selected', 'true')
        const panel = page.getByRole('tabpanel', { name: 'Code' })
        await page.getByLabel('Rows per page').selectOption('25')
        const pageSize = panel
            .getByRole('button', { name: 'Inspect view.pageSize', exact: true })
            .first()
        await pageSize.hover()
        await expect(page.getByRole('tooltip').locator('pre')).toHaveText('25')
        await codeTab.hover()
        await page.getByLabel('Rows per page').selectOption('50')
        await pageSize.focus()
        await expect(page.getByRole('tooltip').locator('pre')).toHaveText('50')
        const programId = panel.getByRole('button', {
            name: 'Inspect programId',
            exact: true,
        })
        await expect(programId).toHaveCount(2)
        await programId.first().focus()
        await expect(page.getByRole('tooltip').locator('pre')).toHaveText(
            '"labProgram1"'
        )
        const view = panel.getByRole('button', {
            name: 'Inspect view',
            exact: true,
        })
        await view.focus()
        await expect(page.getByRole('tooltip').locator('pre')).toContainText(
            '"pageSize": 50'
        )
        await page.screenshot({
            path: testInfo.outputPath('inline-props.png'),
            fullPage: true,
        })
        await page.keyboard.press('Escape')
        await expect(page.getByRole('tooltip')).toBeHidden()
    })

    test('keeps code and prop tooltips usable at phone width in dark mode', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 375, height: 812 })
        await page.emulateMedia({ colorScheme: 'dark' })
        await page.goto('/playground/working-list')
        await expect(page.locator('html')).toHaveClass(/dark/)
        await page.getByRole('tab', { name: 'Code', exact: true }).click()
        await page.keyboard.press('Tab')
        await page
            .getByRole('button', { name: 'Inspect programId', exact: true })
            .first()
            .focus()
        const tooltip = page.getByRole('tooltip')
        await expect(tooltip.locator('pre')).toHaveText('"labProgram1"')
        const bounds = await tooltip.boundingBox()
        expect(bounds).not.toBeNull()
        expect(bounds!.x).toBeGreaterThanOrEqual(0)
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375)
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth)
        ).toBe(375)
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
