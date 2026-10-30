/*
 * The relationship viewer lab on a real server: live mode traces the seeded "Contact tracing" hub case.
 * Seeded by scripts/e2e/seed-metadata.sh from e2e/metadata/relationship-viewer-*.json.
 */
import { expect, test } from '../fixtures/test'

test('live mode traces a seeded case', async ({ page }) => {
    await page.goto(
        '/#/relationship-viewer?source=live&te=RvE2eTei010&layout=trace'
    )

    const graph = page.getByRole('img', { name: 'Relationship graph' })
    await expect(graph.locator('[data-trace-card]').first()).toBeAttached()
    await expect(page.locator('tbody tr').first()).toBeVisible()
    await expect(
        page.getByRole('button', { name: 'Trace', exact: true })
    ).toHaveAttribute('aria-pressed', 'true')
})
