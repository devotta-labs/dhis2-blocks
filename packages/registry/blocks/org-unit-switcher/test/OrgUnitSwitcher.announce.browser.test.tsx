import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { useState } from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { OrgUnitProvider, OrgUnitSwitcher } from '..'
import { createServer, OCEAN, unit } from './orgUnitServerSupport'

const Host = ({ value: first }: { value: string }) => {
    const [value, setValue] = useState(first)
    const [server] = useState(() => createServer({ known: [] }))
    return (
        <QueryClientProvider client={new QueryClient()}>
            <OrgUnitProvider
                client={server.client}
                value={value}
                onValueChange={(orgUnit) => setValue(orgUnit.id)}
            >
                <div className="w-60">
                    <OrgUnitSwitcher />
                </div>
            </OrgUnitProvider>
        </QueryClientProvider>
    )
}

const politeRegion = () =>
    document.querySelector('body > [role="status"][aria-live="polite"]')

describe('OrgUnitSwitcher announcements', () => {
    beforeEach(() => localStorage.clear())

    it('announces the first unit picked when none was chosen', async () => {
        const screen = await render(<Host value={unit('Gone').id} />)
        const trigger = screen.getByRole('button', {
            name: 'Organisation unit: Choose an organisation unit',
        })
        await trigger.click()
        await page
            .getByRole('menuitemradio', { name: OCEAN.displayName })
            .click()

        await expect
            .element(
                screen.getByRole('button', {
                    name: `Organisation unit: ${OCEAN.displayName}`,
                })
            )
            .toBeVisible()
        await expect
            .poll(() => politeRegion()?.textContent)
            .toBe(`Organisation unit changed to ${OCEAN.displayName}`)
    })
})
