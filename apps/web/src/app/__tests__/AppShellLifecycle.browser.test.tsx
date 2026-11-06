import { CustomDataProvider, Provider } from '@dhis2/app-runtime'
import {
    notifyManager,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'
import React, { act } from 'react'
import type { ComponentProps } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { AppShell } from '../AppShell'

const units = [
    {
        id: 'OrgUnit0001',
        displayName: 'Clinic A',
        path: '/OrgUnit0001',
        children: 0,
    },
    {
        id: 'OrgUnit0002',
        displayName: 'Clinic B',
        path: '/OrgUnit0002',
        children: 0,
    },
]
const programs = ['Program0001', 'Program0002'].map((id, index) => ({
    id,
    displayName: `Program ${index === 0 ? 'A' : 'B'}`,
    programType: 'WITH_REGISTRATION',
    access: { data: { read: true } },
    organisationUnits: units,
    programTrackedEntityAttributes: [
        {
            displayInList: true,
            trackedEntityAttribute: {
                id: 'Attribute01',
                displayName: 'Name',
                valueType: 'TEXT',
            },
        },
    ],
    programStages: [],
}))

const setup = async () => {
    const records: Array<{ orgUnit: string; program: string }> = []
    const data: ComponentProps<typeof CustomDataProvider>['data'] = {
        me: { organisationUnits: units },
        programs: async (_type, query) =>
            query.id
                ? programs.find(({ id }) => id === query.id)!
                : { programs },
        organisationUnits: async (_type, query) =>
            query.id
                ? units.find(({ id }) => id === query.id)!
                : { organisationUnits: units },
        'system/info': {
            calendar: 'gregorian',
            dateFormat: 'YYYY-MM-DD',
            serverTimeZoneId: 'UTC',
        },
        trackedEntityInstanceFilters: { trackedEntityInstanceFilters: [] },
        programStageWorkingLists: { programStageWorkingLists: [] },
        'tracker/trackedEntities': async (_type, query) => {
            records.push({
                orgUnit: String(query.params?.orgUnits),
                program: String(query.params?.program),
            })
            return {
                trackedEntities: [
                    {
                        trackedEntity: 'Entity00001',
                        createdAt: '2026-01-01T00:00:00',
                        attributes: [
                            { attribute: 'Attribute01', value: 'Ada' },
                        ],
                        programOwners: [
                            {
                                orgUnit: String(query.params?.orgUnits),
                                program: String(query.params?.program),
                            },
                        ],
                    },
                ],
            }
        },
    }
    const client = new QueryClient()
    const router = createMemoryRouter([{ path: '/', element: <AppShell /> }], {
        initialEntries: ['/?programId=Program0001'],
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
                <QueryClientProvider client={client}>
                    <RouterProvider router={router} />
                </QueryClientProvider>
            </CustomDataProvider>
        </Provider>
    )
    const settle = async () => {
        await act(async () => {
            await new Promise<void>((done) => notifyManager.schedule(done))
            await Promise.all(
                client
                    .getQueryCache()
                    .getAll()
                    .filter((query) => query.state.fetchStatus === 'fetching')
                    .map((query) => query.promise)
            )
            await new Promise<void>((done) => notifyManager.schedule(done))
        })
        expect(
            client
                .getQueryCache()
                .getAll()
                .filter((query) => query.state.status === 'error')
                .map((query) => query.state.error)
        ).toEqual([])
    }
    const chooseUnit = async (name: string) => {
        await screen.getByRole('button', { name: /Organisation unit/ }).click()
        await screen.getByText(name, { exact: true }).click()
    }
    const makeDirty = async (value = 'Ada') => {
        await screen
            .getByRole('button', { name: 'Filter', exact: true })
            .click()
        await screen
            .getByRole('menuitem', { name: 'Name', exact: true })
            .click()
        await screen
            .getByRole('textbox', { name: 'Value', exact: true })
            .fill(value)
        await screen
            .getByRole('button', { name: 'Update', exact: true })
            .click()
        await settle()
    }
    const dispose = async () => {
        await screen.unmount()
        router.dispose()
        client.clear()
    }
    return { screen, router, records, settle, chooseUnit, makeDirty, dispose }
}

describe('AppShell context and record-request lifecycle', () => {
    it('does not mount or request records without an OU, then queries the chosen OU and unmounts on clear', async () => {
        const h = await setup()
        try {
            await expect
                .element(h.screen.getByTestId('org-unit-empty-state'))
                .toBeVisible()
            await h.settle()
            await expect
                .element(h.screen.getByTestId('working-list-layout'))
                .not.toBeInTheDocument()
            expect(h.records).toEqual([])

            await h.chooseUnit('Clinic A')
            await expect
                .element(h.screen.getByRole('cell', { name: /Ada$/ }))
                .toBeVisible()
            await h.settle()
            expect(h.records).toEqual([
                { orgUnit: 'OrgUnit0001', program: 'Program0001' },
            ])
            expect(h.router.state.location.search).toContain(
                'orgUnitId=OrgUnit0001'
            )

            const clearUnit = h.screen.container.querySelector(
                '[data-test="org-unit-selector-container-clear-icon"]'
            )
            expect(clearUnit).not.toBeNull()
            await page.elementLocator(clearUnit!).click()
            await expect
                .element(h.screen.getByTestId('org-unit-empty-state'))
                .toBeVisible()
            await h.settle()
            await expect
                .element(h.screen.getByTestId('working-list-layout'))
                .not.toBeInTheDocument()
            expect(h.records).toHaveLength(1)
            expect(h.router.state.location.search).not.toContain('orgUnitId=')

            await h.chooseUnit('Clinic B')
            await expect
                .element(h.screen.getByRole('cell', { name: /Ada$/ }))
                .toBeVisible()
            await h.settle()
            expect(h.records).toEqual([
                { orgUnit: 'OrgUnit0001', program: 'Program0001' },
                { orgUnit: 'OrgUnit0002', program: 'Program0001' },
            ])
        } finally {
            await h.dispose()
        }
    })

    it.each(['No, cancel', 'Yes, discard changes'])(
        'handles %s for a dirty OU change after closing the real picker',
        async (choice) => {
            const h = await setup()
            try {
                await expect
                    .element(h.screen.getByTestId('org-unit-empty-state'))
                    .toBeVisible()
                await h.chooseUnit('Clinic A')
                await expect
                    .element(h.screen.getByRole('cell', { name: /Ada$/ }))
                    .toBeVisible()
                await h.makeDirty()
                const committed = h.router.state.location.search
                const requests = h.records.length
                await h.chooseUnit('Clinic B')
                await expect
                    .element(page.getByRole('alertdialog'))
                    .toBeVisible()
                await expect
                    .element(h.screen.getByPlaceholder('Search'))
                    .not.toBeInTheDocument()
                expect(h.router.state.location.search).toBe(committed)
                await page.getByRole('button', { name: choice }).click()
                await h.settle()
                await expect
                    .element(page.getByRole('alertdialog'))
                    .not.toBeInTheDocument()
                if (choice === 'No, cancel') {
                    expect(h.router.state.location.search).toBe(committed)
                    expect(h.records).toHaveLength(requests)
                    await expect
                        .element(
                            h.screen.getByRole('button', {
                                name: /Organisation unit.*Clinic A/,
                            })
                        )
                        .toBeVisible()

                    await h.chooseUnit('Clinic B')
                    await expect
                        .element(page.getByRole('alertdialog'))
                        .toBeVisible()
                    expect(h.records).toHaveLength(requests)
                } else {
                    await expect
                        .element(
                            h.screen.getByRole('button', {
                                name: /Organisation unit.*Clinic B/,
                            })
                        )
                        .toBeVisible()
                    expect(h.records.at(-1)?.orgUnit).toBe('OrgUnit0002')
                    expect(h.router.state.location.search).toContain(
                        'orgUnitId=OrgUnit0002'
                    )
                }
                expect(h.router.state.location.search).toContain(
                    'programId=Program0001'
                )
            } finally {
                await h.dispose()
            }
        }
    )

    it.each(['No, cancel', 'Yes, discard changes'])(
        'handles %s for a dirty program change without changing the OU',
        async (choice) => {
            const h = await setup()
            try {
                await expect
                    .element(h.screen.getByTestId('org-unit-empty-state'))
                    .toBeVisible()
                await h.chooseUnit('Clinic B')
                await expect
                    .element(h.screen.getByRole('cell', { name: /Ada$/ }))
                    .toBeVisible()
                await h.makeDirty('Grace')
                const committed = h.router.state.location.search
                const requests = h.records.length
                await h.screen
                    .getByRole('button', { name: /Program.*Program A/ })
                    .click()
                await h.screen.getByText('Program B', { exact: true }).click()
                await expect
                    .element(page.getByRole('alertdialog'))
                    .toBeVisible()
                expect(h.router.state.location.search).toBe(committed)
                await page.getByRole('button', { name: choice }).click()
                await h.settle()
                await expect
                    .element(page.getByRole('alertdialog'))
                    .not.toBeInTheDocument()
                if (choice === 'No, cancel') {
                    expect(h.router.state.location.search).toBe(committed)
                    expect(h.records).toHaveLength(requests)
                    await h.screen
                        .getByRole('button', { name: /Program.*Program A/ })
                        .click()
                    await h.screen
                        .getByText('Program B', { exact: true })
                        .click()
                    await expect
                        .element(page.getByRole('alertdialog'))
                        .toBeVisible()
                    expect(h.records).toHaveLength(requests)
                } else {
                    await expect
                        .element(
                            h.screen.getByRole('button', {
                                name: /Program.*Program B/,
                            })
                        )
                        .toBeVisible()
                    await expect
                        .poll(() => h.records.at(-1))
                        .toEqual({
                            orgUnit: 'OrgUnit0002',
                            program: 'Program0002',
                        })
                }
                expect(h.router.state.location.search).toContain(
                    'orgUnitId=OrgUnit0002'
                )
            } finally {
                await h.dispose()
            }
        }
    )
})
