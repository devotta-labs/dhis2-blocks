import { CustomDataProvider } from '@dhis2/app-runtime'
import React, { useEffect, useState } from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useTrackedEntityFinderClient } from '../api/runtimeClient'
import { FinderField } from '../form/FinderField'
import { FinderForm } from '../form/FinderForm'
import { FinderProvider } from '../provider/FinderProvider'
import { createFakeServer, renderWithQueries } from './finderTestSupport'

it('loads metadata with a supplied client without a DHIS2 runtime provider', async () => {
    const server = createFakeServer()
    await renderWithQueries(
        <FinderProvider
            program="hivProgram"
            client={server.client}
            onSelect={vi.fn()}
        >
            <FinderForm>
                <FinderField attribute="artNumber" />
            </FinderForm>
        </FinderProvider>
    )
    await expect
        .element(page.getByRole('textbox', { name: 'ART number' }))
        .toBeEnabled()
    expect(server.requests).toEqual(
        expect.arrayContaining([
            expect.objectContaining({ resource: 'programs', id: 'hivProgram' }),
            expect.objectContaining({ resource: 'system/info' }),
        ])
    )
})

it('keeps the runtime client stable across finder remounts', async () => {
    const observed = vi.fn()
    const Probe = () => {
        const client = useTrackedEntityFinderClient()
        useEffect(() => {
            observed(client)
        }, [client])
        return null
    }
    const Toggle = () => {
        const [mounted, setMounted] = useState(true)
        return (
            <>
                <button type="button" onClick={() => setMounted(!mounted)}>
                    Toggle finder
                </button>
                {mounted && <Probe />}
            </>
        )
    }
    await render(
        <CustomDataProvider data={{}}>
            <Toggle />
        </CustomDataProvider>
    )
    await expect.poll(() => observed.mock.calls.length).toBe(1)
    await page.getByRole('button', { name: 'Toggle finder' }).click()
    await page.getByRole('button', { name: 'Toggle finder' }).click()
    await expect.poll(() => observed.mock.calls.length).toBe(2)
    expect(observed.mock.calls[1][0]).toBe(observed.mock.calls[0][0])
})
