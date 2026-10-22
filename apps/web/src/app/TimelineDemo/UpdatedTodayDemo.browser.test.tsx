import { CustomDataProvider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ComponentProps } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render } from 'vitest-browser-react'
import { UpdatedTodayDemo } from './UpdatedTodayDemo'

type CustomData = ComponentProps<typeof CustomDataProvider>['data']

const pad = (value: number) => value.toString().padStart(2, '0')

describe('UpdatedTodayDemo', () => {
    it('lists the events updated today in the org unit with the case-history event composition', async () => {
        const now = new Date()
        const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
        const requests: Array<{ params?: object }> = []
        const data: CustomData = {
            'tracker/events': async (_type, query) => {
                requests.push(query)
                return {
                    events: [
                        {
                            event: 'evToday00001',
                            programStage: 'stage1',
                            status: 'COMPLETED',
                            program: 'TlE2ePrg001',
                            orgUnit: 'ou1',
                            occurredAt: `${today}T08:00:00.000`,
                            updatedAt: `${today}T09:15:00.000`,
                            dataValues: [],
                            notes: [],
                        },
                    ],
                }
            },
            programs: async () => ({
                id: 'TlE2ePrg001',
                displayName: 'Demo program',
                programStages: [
                    {
                        id: 'stage1',
                        displayName: 'Antenatal visit',
                        hideDueDate: false,
                        repeatable: true,
                        programStageDataElements: [],
                    },
                ],
                programTrackedEntityAttributes: [],
            }),
            organisationUnits: async () => ({
                organisationUnits: [{ id: 'ou1', displayName: 'Ngelehun CHC' }],
            }),
        }
        const screen = await render(
            <CustomDataProvider data={data}>
                <QueryClientProvider
                    client={
                        new QueryClient({
                            defaultOptions: { queries: { retry: false } },
                        })
                    }
                >
                    <MemoryRouter
                        initialEntries={[
                            '/timeline/updated-today?program=TlE2ePrg001&orgUnit=ou1',
                        ]}
                    >
                        <UpdatedTodayDemo />
                    </MemoryRouter>
                </QueryClientProvider>
            </CustomDataProvider>
        )

        await expect.element(screen.getByText('Antenatal visit')).toBeVisible()
        await expect.element(screen.getByText('Ngelehun CHC')).toBeVisible()
        await expect
            .element(screen.getByRole('link', { name: 'Open in Capture' }))
            .toBeVisible()
        expect(requests[0]?.params).toMatchObject({
            program: 'TlE2ePrg001',
            orgUnit: 'ou1',
            updatedAfter: `${today}T00:00:00`,
        })
    })
})
