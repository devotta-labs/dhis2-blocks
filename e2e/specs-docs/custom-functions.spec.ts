import { expect, test } from '@playwright/test'

test.describe('offline native custom functions playground', () => {
    test('publishes only the offline lab on the default production route', async ({
        page,
    }) => {
        await page.goto('/lab.html')
        await expect(
            page.getByRole('heading', {
                name: 'Custom rule functions',
                exact: true,
            })
        ).toBeVisible()
        await expect(page.getByLabel('Evaluated custom result')).toHaveText(
            '13.4'
        )
    })
    test.beforeEach(async ({ page }) => {
        await page.goto('/lab.html?mode=custom')
        await expect(
            page.getByRole('heading', {
                name: 'Custom rule functions',
                exact: true,
            })
        ).toBeVisible()
    })

    test('runs the native lookup and updates after a live edit, including another enrollment', async ({
        page,
    }) => {
        await expect(page.getByLabel('Evaluated custom result')).toHaveText(
            '13.4'
        )
        await page.screenshot({
            path: 'e2e/artifacts/docs/custom-functions.png',
            fullPage: true,
        })
        const selected = page.getByRole('textbox', {
            name: 'Selected test Current visit',
        })
        await selected.fill('GLUCOSE')
        await selected.press('Enter')
        await expect(
            page.getByRole('textbox', { name: 'Custom result Current visit' })
        ).toHaveValue('6.1')
    })

    test('accepts reordered props and nullable results', async ({ page }) => {
        await page
            .getByRole('combobox', { name: 'Example', exact: true })
            .selectOption('reordered')
        await page.getByRole('button', { name: 'Apply and run' }).click()
        await expect(page.getByLabel('Evaluated custom result')).toHaveText(
            '13.4'
        )
        await page
            .getByLabel('Action expression')
            .fill("custom:number('findResult', {testCode: 'UNKNOWN'})")
        await page.getByRole('button', { name: 'Apply and run' }).click()
        await expect(page.getByLabel('Evaluated custom result')).toHaveText(
            'No match'
        )
        await expect(page.getByRole('table')).toBeVisible()
    })

    test('runs string and boolean dispatchers', async ({ page }) => {
        await page
            .getByRole('combobox', { name: 'Example', exact: true })
            .selectOption('string')
        await page.getByRole('button', { name: 'Apply and run' }).click()
        await expect(page.getByLabel('Evaluated custom result')).toHaveText(
            '13.4'
        )
        await page
            .getByRole('combobox', { name: 'Example', exact: true })
            .selectOption('boolean')
        await page.getByRole('button', { name: 'Apply and run' }).click()
        await expect(page.getByLabel('Evaluated custom result')).toHaveText(
            'true'
        )
    })

    test('surfaces duplicate props and invalid callback props', async ({
        page,
    }) => {
        await page
            .getByRole('combobox', { name: 'Example', exact: true })
            .selectOption('duplicate')
        await page.getByRole('button', { name: 'Apply and run' }).click()
        await expect(
            page.getByRole('alert').filter({ hasText: 'Duplicate' })
        ).toBeVisible()
        await page
            .getByRole('combobox', { name: 'Example', exact: true })
            .selectOption('invalid')
        await page.getByRole('button', { name: 'Apply and run' }).click()
        await expect(
            page.getByRole('textbox', { name: 'Custom result Current visit' })
        ).toHaveValue('')
        await expect(
            page.getByRole('alert').filter({ hasText: 'typo' })
        ).toBeVisible()
    })

    test('reports history failure, then recovers with a fresh run', async ({
        page,
    }) => {
        await page
            .getByRole('combobox', { name: 'History request' })
            .selectOption('error')
        await page.getByRole('button', { name: 'Apply and run' }).click()
        await expect(
            page.getByRole('alert').filter({ hasText: 'history failure' })
        ).toBeVisible()
        await page
            .getByRole('combobox', { name: 'History request' })
            .selectOption('normal')
        await page.getByRole('button', { name: 'Apply and run' }).click()
        await expect(page.getByLabel('Evaluated custom result')).toHaveText(
            '13.4'
        )
    })

    test('edits the sample history and switches theme', async ({ page }) => {
        await page
            .getByText('Edit event history JSON', { exact: false })
            .click()
        const history = page.getByRole('textbox', {
            name: 'Event history',
            exact: true,
        })
        await history.fill((await history.inputValue()).replace('13.4', '20.2'))
        await page.getByRole('button', { name: 'Apply and run' }).click()
        await expect(page.getByLabel('Evaluated custom result')).toHaveText(
            '20.2'
        )
        await page.getByRole('button', { name: 'Dark theme' }).click()
        await expect(
            page.getByRole('button', { name: 'Light theme' })
        ).toBeVisible()
    })

    test('keeps unresolved history loading instead of inventing a result, and can recover', async ({
        page,
    }) => {
        await page
            .getByRole('combobox', { name: 'History request' })
            .selectOption('hang')
        await page.getByRole('button', { name: 'Apply and run' }).click()
        await expect(
            page
                .getByRole('listitem')
                .filter({ hasText: 'tracker/trackedEntities' })
        ).toContainText('pending')
        await expect(page.getByLabel('Evaluated custom result')).toHaveText(
            'Loading'
        )
        await page
            .getByRole('combobox', { name: 'History request' })
            .selectOption('slow')
        await page.getByRole('button', { name: 'Apply and run' }).click()
        await expect(page.getByLabel('Evaluated custom result')).toHaveText(
            'Loading'
        )
        await expect(page.getByLabel('Evaluated custom result')).toHaveText(
            '13.4'
        )
    })
})
