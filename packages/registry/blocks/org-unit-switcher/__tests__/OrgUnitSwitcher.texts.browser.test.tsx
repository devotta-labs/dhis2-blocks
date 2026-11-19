import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { OrgUnitProvider, OrgUnitSwitcher, type OrgUnitSwitcherTexts } from '..'
import { createServer, district, facility } from './orgUnitServerSupport'

const SCHOOLS: OrgUnitSwitcherTexts = {
    label: 'School',
    searchPlaceholder: 'Search schools',
    choose: 'Choose a school',
    noneAssigned: 'No school assigned',
    loadFailed: 'Schools could not be loaded',
    allUnits: 'All schools',
    noResults: 'No schools found',
    loadingMore: 'Loading more schools',
    moreFailed: 'More schools could not be loaded. Try again',
    changed: (name) => `School changed to ${name}`,
}

const renderSwitcher = (server: ReturnType<typeof createServer>) =>
    render(
        <QueryClientProvider
            client={
                new QueryClient({
                    defaultOptions: { queries: { retryDelay: 0 } },
                })
            }
        >
            <OrgUnitProvider client={server.client}>
                <div className="w-60">
                    <OrgUnitSwitcher texts={SCHOOLS} />
                </div>
            </OrgUnitProvider>
        </QueryClientProvider>
    )

const politeRegion = () =>
    document.querySelector('body > [role="status"][aria-live="polite"]')

describe('OrgUnitSwitcher texts', () => {
    // An earlier test's remembered unit must not decide the current one.
    beforeEach(() => localStorage.clear())

    it('names the units as the app does, in the trigger, the menu and the announcement', async () => {
        const bo = district('Bo District')
        const screen = await renderSwitcher(
            createServer({ assigned: [bo, facility('Kakua Primary', bo.path)] })
        )

        await screen
            .getByRole('combobox', { name: 'School: Bo District' })
            .click()
        await expect
            .element(page.getByPlaceholder('Search schools'))
            .toBeVisible()
        await page.getByPlaceholder('Search schools').fill('zzz')
        await expect.element(page.getByText('No schools found')).toBeVisible()
        await page.getByPlaceholder('Search schools').fill('')
        await page.getByRole('option', { name: 'Kakua Primary' }).click()

        await expect
            .poll(() => politeRegion()?.textContent)
            .toBe('School changed to Kakua Primary')
    })

    it('says so in its own words when nothing is assigned, or the units fail', async () => {
        const none = await renderSwitcher(createServer({ assigned: [] }))
        await expect.element(none.getByText('No school assigned')).toBeVisible()
        await none.unmount()

        const server = createServer()
        server.fail.me = 500
        const failed = await renderSwitcher(server)
        await expect
            .element(failed.getByText('Schools could not be loaded'))
            .toBeVisible()
    })
})
