import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { OrgUnitProvider, OrgUnitSwitcher } from '..'
import type { AssignedOrgUnit } from '../api/schemas'
import { createServer, facility } from './orgUnitServerSupport'

const BRISTOL = facility('Bristol Clinic')
const LONG = 'Ocean Beach Community Health Centre and Maternity Unit '
    .repeat(3)
    .slice(0, 120)

const renderSelector = (assigned: AssignedOrgUnit[], value?: string) => {
    const server = createServer({ assigned })
    return render(
        <QueryClientProvider client={new QueryClient()}>
            <OrgUnitProvider client={server.client} value={value}>
                <div className="w-60 bg-dhis2-background px-3 py-4 text-dhis2-foreground">
                    <OrgUnitSwitcher />
                </div>
            </OrgUnitProvider>
        </QueryClientProvider>
    )
}

const tooltipText = () =>
    document.querySelector('[data-slot="tooltip-content"]')?.textContent

describe('OrgUnitSwitcher with long names', () => {
    beforeEach(() => localStorage.clear())

    it('shows the short name in the trigger, and the full name in its label and tooltip', async () => {
        const named = { ...facility(LONG), displayShortName: 'Ocean Beach CHC' }
        const screen = await renderSelector([named, BRISTOL], named.id)

        const trigger = screen.getByRole('button', {
            name: `Organisation unit: ${LONG}`,
        })
        await expect.element(trigger).toBeVisible()
        await expect
            .element(screen.getByText('Ocean Beach CHC', { exact: true }))
            .toBeVisible()
        await trigger.hover()
        await expect.poll(tooltipText, { timeout: 2000 }).toBe(LONG)
    })

    it('cuts off a long name with no short name, and shows it whole on hover', async () => {
        const screen = await renderSelector(
            [facility(LONG), BRISTOL],
            facility(LONG).id
        )

        const name = screen.getByText(LONG, { exact: true })
        await expect.element(name).toBeVisible()
        expect(name.element().scrollWidth).toBeGreaterThan(
            name.element().clientWidth
        )
        await screen
            .getByRole('button', { name: `Organisation unit: ${LONG}` })
            .hover()
        await expect.poll(tooltipText, { timeout: 2000 }).toBe(LONG)
    })

    it('wraps a long name over two lines in the menu', async () => {
        const screen = await renderSelector([facility(LONG), BRISTOL])
        await screen
            .getByRole('button', { name: 'Organisation unit: Bristol Clinic' })
            .click()

        const row = page.getByRole('menuitemradio', { name: LONG })
        await expect.element(row).toBeVisible()
        const name = row.getByText(LONG, { exact: true }).element()
        const lineHeight = Number.parseFloat(getComputedStyle(name).lineHeight)
        expect(name.getBoundingClientRect().height).toBe(lineHeight * 2)
        expect(name.closest('[title]')?.getAttribute('title')).toBe(LONG)
    })
})
