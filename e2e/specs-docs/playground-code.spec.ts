import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from './fixtures'

test.describe('playground Canvas / Code', () => {
    for (const [path, composition, part, prop, value] of [
        [
            'patient-list',
            'PatientListCanvas',
            'PatientList',
            'program',
            '"IpHINAT79UW"',
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
        [
            'tracked-entity-finder',
            'LabFinder',
            'FinderProvider',
            'program',
            '"labProgram1"',
        ],
        [
            'tracked-entity-header',
            'BannerCanvas',
            'TrackedEntityBanner',
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
        await page.goto('/playground/patient-list')
        const list = page.locator('[data-block="patient-list"]')
        await expect(list).toHaveAttribute('data-status', 'ready')
        const original = await list.elementHandle()
        expect(original).not.toBeNull()

        await page.getByRole('tab', { name: 'Code', exact: true }).click()
        expect(await original!.evaluate((element) => element.isConnected)).toBe(
            true
        )
        await page.getByRole('tab', { name: 'Canvas', exact: true }).click()
        expect(await original!.evaluate((element) => element.isConnected)).toBe(
            true
        )
        await expect(list).toHaveAttribute('data-status', 'ready')
    })

    test('inspects current props inline and supports keyboard navigation', async ({
        page,
    }, testInfo) => {
        await page.goto('/playground/patient-list')
        // The table's own page size is labelled "Rows per page" too.
        const pageSizeSetting = page
            .getByRole('complementary')
            .getByRole('combobox', { name: 'Rows per page' })
        const canvasTab = page.getByRole('tab', { name: 'Canvas', exact: true })
        await canvasTab.focus()
        await page.keyboard.press('ArrowRight')
        const codeTab = page.getByRole('tab', { name: 'Code', exact: true })
        await expect(codeTab).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(codeTab).toHaveAttribute('aria-selected', 'true')
        const panel = page.getByRole('tabpanel', { name: 'Code' })
        await pageSizeSetting.selectOption('25')
        const pageSize = panel
            .getByRole('button', { name: 'Inspect view.pageSize', exact: true })
            .first()
        await pageSize.hover()
        await expect(page.getByRole('tooltip').locator('pre')).toHaveText('25')
        await codeTab.hover()
        await pageSizeSetting.selectOption('50')
        await pageSize.focus()
        await expect(page.getByRole('tooltip').locator('pre')).toHaveText('50')
        const program = panel.getByRole('button', {
            name: 'Inspect program',
            exact: true,
        })
        await expect(program).toHaveCount(2)
        await program.first().focus()
        await expect(page.getByRole('tooltip').locator('pre')).toHaveText(
            '"IpHINAT79UW"'
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
        await page.goto('/playground/patient-list')
        await expect(page.locator('html')).toHaveClass(/dark/)
        await page.getByRole('tab', { name: 'Code', exact: true }).click()
        await page.keyboard.press('Tab')
        await page
            .getByRole('button', { name: 'Inspect program', exact: true })
            .first()
            .focus()
        const tooltip = page.getByRole('tooltip')
        await expect(tooltip.locator('pre')).toHaveText('"IpHINAT79UW"')
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
        await page.goto('/playground/patient-list')
        await page.getByRole('tab', { name: 'Code', exact: true }).click()
        const panel = page.getByRole('tabpanel', { name: 'Code' })
        await panel.getByRole('button', { name: 'Copy', exact: true }).click()
        await expect(
            panel.getByRole('button', { name: 'Copied', exact: true })
        ).toBeVisible()
        const expected = await readFile(
            resolve(
                __dirname,
                '../../apps/docs/src/playground/patient-list/PatientListCanvas.tsx'
            ),
            'utf8'
        )
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
            expected.replace(/\n$/, '')
        )
    })
})
