import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { OrgUnitProvider, OrgUnitSwitcher } from '..'
import { createServer, district, unit } from './orgUnitServerSupport'

const BO = district('Bo District')

describe('OrgUnitSwitcher paging', () => {
    // An earlier test's remembered unit must not decide the current one.
    beforeEach(() => localStorage.clear())

    it('browses every unit a page at a time, by keyboard and by mouse', async () => {
        const all = Array.from({ length: 41 }, (_, i) =>
            unit(`Unit${String(i).padStart(2, '0')}`, BO.path)
        )
        const server = createServer({ assigned: [BO], all })
        const screen = await render(
            <QueryClientProvider client={new QueryClient()}>
                <OrgUnitProvider client={server.client}>
                    <OrgUnitSwitcher />
                </OrgUnitProvider>
            </QueryClientProvider>
        )
        const trigger = screen.getByRole('combobox', {
            name: 'Organisation unit: Bo District',
        })
        await expect.element(trigger).toBeVisible()
        // Nothing is asked for until the menu opens.
        expect(server.searchRequests()).toHaveLength(0)

        await trigger.click()
        const rows = () =>
            page
                .getByRole('group', { name: 'All organisation units' })
                .getByRole('option')
                .elements()
        await expect.poll(() => rows()).toHaveLength(20)

        // The district is highlighted on opening; past the twenty units is the row that loads the next page.
        await userEvent.keyboard('{ArrowDown>21/}{Enter}')
        await expect.poll(() => rows()).toHaveLength(40)
        await expect
            .element(page.getByPlaceholder('Search organisation units'))
            .toBeVisible()

        await page.getByRole('option', { name: 'Show more' }).click()
        await expect.poll(() => rows()).toHaveLength(41)
        // One request a page, however the row was pressed.
        expect(server.searchRequests()).toHaveLength(3)
        expect(server.searchRequests()[0]?.params).not.toHaveProperty('query')
        expect(server.searchRequests()[2]?.params?.page).toBe(3)
        expect(
            page.getByRole('option', { name: 'Show more' }).elements()
        ).toHaveLength(0)
    })
})
