import { test, expect } from '../fixtures/test'
import { authenticatedShellReady } from '../fixtures/app-readiness'

test('the application shell boots against the selected real server', async ({
    page,
}) => {
    await authenticatedShellReady(page)
    await expect(page.getByTestId('program-empty-state')).toBeVisible()
    await expect(page.getByTestId('working-list-table')).toHaveCount(0)
    await page.locator('[data-test="program-selector-container"]').click()
    await expect(
        page.getByText('Working list E2E tracker program', { exact: true })
    ).toBeVisible()
})
