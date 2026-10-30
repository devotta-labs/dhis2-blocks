import type { Page } from '@playwright/test'
import { expect, openLivePreview, test } from './fixtures'

/**
 * Live Relationship Viewer previews against the seeded contact-tracing
 * program (e2e/metadata/relationship-viewer-*.json) through the docs app's
 * same-origin `/dhis2` proxy.
 */
const list = (page: Page) =>
    page.getByRole('table', { name: 'Records in the relationship graph' })

const rows = (page: Page) => list(page).locator('tbody tr')

const names = (page: Page) => rows(page).locator('td:nth-child(1)')

const statuses = (page: Page) => rows(page).locator('td:nth-child(2)')

const listReady = async (page: Page) => {
    await expect(list(page)).toBeVisible({ timeout: 30_000 })
}

const row = (page: Page, name: string) =>
    rows(page).filter({
        has: page.locator('td:nth-child(1)', { hasText: name }),
    })

test.describe('live Relationship Viewer previews', () => {
    test('from a case lists the hub and its 9 contacts', async ({ page }) => {
        await openLivePreview(page, 'relationship-viewer/from-case', listReady)

        // One contact is not enrolled in the program; it still loads.
        await expect(rows(page)).toHaveCount(10)
        await expect
            .poll(async () => (await names(page).allTextContents()).sort())
            .toEqual([
                'Hub case',
                'Hub contact 1',
                'Hub contact 2',
                'Hub contact 3',
                'Hub contact 4',
                'Hub contact 5',
                'Hub contact 6',
                'Hub contact 7',
                'Hub contact 8',
                'Hub contact not enrolled',
            ])
        await expect(row(page, 'Hub contact not enrolled')).toContainText(
            'Contact'
        )
    })

    test('contacts marked for follow-up are listed first', async ({ page }) => {
        await openLivePreview(page, 'relationship-viewer/from-case', listReady)

        await expect(statuses(page)).toHaveText([
            'Marked for follow-up',
            'Marked for follow-up',
            'Marked for follow-up',
            'Case',
            'Contact',
            'Contact',
            'Contact',
            'Contact',
            'Contact',
            'Contact',
        ])
        expect(
            (await names(page).allTextContents()).slice(0, 3).sort()
        ).toEqual(['Hub contact 1', 'Hub contact 2', 'Hub contact 3'])
    })

    test('the case example opens on the trace', async ({ page }) => {
        await openLivePreview(page, 'relationship-viewer/from-case', listReady)

        const trace = page.getByRole('button', { name: 'Trace', exact: true })
        const web = page.getByRole('button', { name: 'Web', exact: true })
        const cards = page
            .getByRole('img', { name: 'Relationship graph' })
            .locator('[data-trace-card]')

        await expect(trace).toHaveAttribute('aria-pressed', 'true')
        await expect(cards.first()).toBeAttached()

        await web.click()

        await expect(web).toHaveAttribute('aria-pressed', 'true')
        await expect(trace).toHaveAttribute('aria-pressed', 'false')
        await expect(cards).toHaveCount(0)
    })

    test('expanding a stub adds its neighbours', async ({ page }) => {
        await openLivePreview(page, 'relationship-viewer/overdue', listReady)

        await expect(rows(page)).toHaveCount(3)
        // The seed dates Chain case 2's last follow-up long ago and Chain
        // case 4's far in the future.
        await expect(row(page, 'Chain case 2')).toContainText('Overdue')
        await expect(row(page, 'Chain case 4')).toContainText('Contact')

        await page
            .getByRole('button', { name: 'Show one more for Chain case 4' })
            .click()

        await expect(rows(page)).toHaveCount(4)
        await expect(row(page, 'Chain case 5')).toContainText('Overdue')
    })
})
