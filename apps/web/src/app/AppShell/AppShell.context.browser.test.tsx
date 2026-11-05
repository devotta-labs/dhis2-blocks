import { CustomDataProvider, Provider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import type { ComponentProps } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { render } from 'vitest-browser-react'
import { AppShell } from './AppShell'

const unit = {
    id: 'url-ou',
    displayName: 'URL clinic',
    path: '/capture/url-ou',
}
const setup = async (readAccess = true) => {
    const details: string[] = []
    const resolvedUnits: string[] = []
    const data: ComponentProps<typeof CustomDataProvider>['data'] = {
        me: {
            organisationUnits: [
                { id: 'capture', displayName: 'Capture', path: '/capture' },
            ],
        },
        programs: async (_type, query) => {
            if (query.id) details.push(query.id)
            return {
                programs: [
                    {
                        id: 'program',
                        displayName: 'Selected program',
                        programType: 'WITH_REGISTRATION',
                        access: { data: { read: readAccess } },
                        organisationUnits: [],
                    },
                ],
            }
        },
        organisationUnits: async (_type, query) => {
            if (query.id) resolvedUnits.push(query.id)
            return unit
        },
    }
    const router = createMemoryRouter([{ path: '/', element: <AppShell /> }], {
        initialEntries: ['/?programId=program&orgUnitId=url-ou'],
    })
    const screen = await render(
        <Provider
            config={{ baseUrl: '/dhis2', apiVersion: 43 }}
            userInfo={undefined}
            plugin={false}
            parentAlertsAdd={undefined}
            showAlertsInPlugin={false}
        >
            <CustomDataProvider data={data}>
                <QueryClientProvider client={new QueryClient()}>
                    <RouterProvider router={router} />
                </QueryClientProvider>
            </CustomDataProvider>
        </Provider>
    )
    return { router, screen, details, resolvedUnits }
}

describe('app-owned context integration', () => {
    it('resolves URL-provided OU IDs and keeps an incompatible committed program visible but out of its menu', async () => {
        const { router, screen, details, resolvedUnits } = await setup()
        await expect
            .element(screen.getByTestId('invalid-program-context'))
            .toBeVisible()
        await expect
            .element(
                screen.getByRole('button', {
                    name: /Organisation unit.*URL clinic/,
                })
            )
            .toBeVisible()
        await screen
            .getByRole('button', { name: /Program.*Selected program/ })
            .click()
        await expect
            .element(screen.getByText('No programs available.'))
            .toBeVisible()
        expect(resolvedUnits).toEqual(['url-ou'])
        expect(details).toEqual([])
        expect(router.state.location.search).toContain('programId=program')
        router.dispose()
    })

    it('retains the existing inaccessible-program clearing policy without discarding the URL OU', async () => {
        const { router, screen, details, resolvedUnits } = await setup(false)
        await expect
            .element(screen.getByTestId('program-empty-state'))
            .toBeVisible()
        expect(router.state.location.search).toBe('?orgUnitId=url-ou')
        expect(resolvedUnits).toEqual(['url-ou'])
        expect(details).toEqual([])
        router.dispose()
    })
})
