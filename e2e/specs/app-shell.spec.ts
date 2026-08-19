import { test, expect } from '../fixtures/test'

test('the application shell boots against the selected real server', async ({
    page,
}) => {
    await expect(page.locator('body')).toBeVisible()
})
