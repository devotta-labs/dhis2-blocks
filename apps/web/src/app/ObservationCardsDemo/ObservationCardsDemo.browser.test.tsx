import { CustomDataProvider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ComponentProps } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { render } from 'vitest-browser-react'
import { ObservationCardsDemo } from './ObservationCardsDemo'

type CustomData = ComponentProps<typeof CustomDataProvider>['data']
type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue }
type Resolver = (request: { forTrackedEntity: boolean }) => JsonValue

const HAEMOGLOBIN = 'vANAXwtLwcT'
const SMOKING = 'sWoqcoByYmD'
const EXTREME_PALLOR = 'EyfTU3ibMmJ'

const stagesResponse = {
    programStages: [
        {
            id: 'stage1',
            displayName: 'Antenatal care visit',
            access: { data: { read: true } },
            programStageDataElements: [
                { dataElement: { id: HAEMOGLOBIN } },
                { dataElement: { id: SMOKING } },
                { dataElement: { id: EXTREME_PALLOR } },
            ],
        },
    ],
}

const dataElementsResponse = {
    dataElements: [
        { id: HAEMOGLOBIN, displayName: 'Haemoglobin', valueType: 'NUMBER' },
        { id: SMOKING, displayName: 'WHOMCH Smoking', valueType: 'BOOLEAN' },
        {
            id: EXTREME_PALLOR,
            displayName: 'WHOMCH Extreme pallor',
            valueType: 'BOOLEAN',
        },
    ],
}

const eventsResponse = {
    events: [
        {
            event: 'ev1',
            programStage: 'stage1',
            status: 'COMPLETED',
            occurredAt: '2026-03-01T00:00:00.000',
            dataValues: [
                { dataElement: HAEMOGLOBIN, value: '10.5' },
                { dataElement: SMOKING, value: 'true' },
            ],
        },
        {
            event: 'ev2',
            programStage: 'stage1',
            status: 'COMPLETED',
            occurredAt: '2026-03-12T00:00:00.000',
            dataValues: [
                { dataElement: HAEMOGLOBIN, value: '11.2' },
                { dataElement: EXTREME_PALLOR, value: 'false' },
            ],
        },
    ],
}

const enrollmentsResponse = { enrollments: [{ enrollment: 'enr1' }] }

const LocationProbe = () => {
    const location = useLocation()
    return <output data-testid="location">{location.search}</output>
}

const renderDemo = async (
    url: string,
    resolvers: Partial<
        Record<
            | 'programs'
            | 'dataElements'
            | 'tracker/events'
            | 'tracker/enrollments',
            Resolver
        >
    > = {}
) => {
    const calls: Array<{ resource: string; id?: string }> = []
    const all = {
        programs: () => stagesResponse,
        dataElements: () => dataElementsResponse,
        'tracker/events': () => eventsResponse,
        'tracker/enrollments': () => enrollmentsResponse,
        ...resolvers,
    }
    const data: CustomData = {}
    for (const [resource, resolve] of Object.entries(all)) {
        data[resource] = async (_type, query) => {
            calls.push({ resource: query.resource, id: query.id })
            return resolve({
                forTrackedEntity: query.params?.trackedEntity !== undefined,
            })
        }
    }
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const screen = await render(
        <CustomDataProvider data={data}>
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={[url]}>
                    <ObservationCardsDemo />
                    <LocationProbe />
                </MemoryRouter>
            </QueryClientProvider>
        </CustomDataProvider>
    )
    return { calls, screen }
}

describe('ObservationCardsDemo', () => {
    it('renders a trend card per trend element and a last recorded card per latest element for the chosen preset', async () => {
        const { calls, screen } = await renderDemo(
            '/observation-cards?preset=rmnch&te=teABC123456'
        )

        await expect
            .element(screen.getByRole('heading', { name: 'Trends' }))
            .toBeVisible()
        await expect
            .element(screen.getByRole('heading', { name: 'Last recorded' }))
            .toBeVisible()

        const haemoglobin = screen.getByRole('group', { name: 'Haemoglobin' })
        await expect.element(haemoglobin).toBeVisible()
        await expect.element(haemoglobin).toHaveTextContent('11.2')
        await expect.element(haemoglobin).toHaveTextContent('g/dL')
        await expect
            .element(screen.getByRole('group', { name: 'WHOMCH Smoking' }))
            .toHaveTextContent('Yes')
        await expect
            .element(
                screen.getByRole('group', { name: 'WHOMCH Extreme pallor' })
            )
            .toHaveTextContent('No')
        expect(screen.getByRole('group').elements()).toHaveLength(3)

        // The hook runs once for the union of the preset's ids.
        expect(
            calls.filter((call) => call.resource === 'tracker/events')
        ).toHaveLength(1)
        expect(
            calls.filter((call) => call.resource === 'dataElements')
        ).toHaveLength(1)
    })

    it('shows a prompt when no te is set', async () => {
        const { calls, screen } = await renderDemo(
            '/observation-cards?preset=rmnch'
        )

        await expect
            .element(
                screen.getByText(
                    'Enter a tracked entity ID to see their observations.'
                )
            )
            .toBeVisible()
        expect(screen.getByRole('group').elements()).toHaveLength(0)
        expect(calls).toHaveLength(0)
    })

    it('offers the seeded person as a suggestion for the seeded preset', async () => {
        const { calls, screen } = await renderDemo(
            '/observation-cards?preset=seeded'
        )

        await screen.getByRole('link', { name: 'Use ObE2eTei001' }).click()

        await expect
            .element(screen.getByRole('textbox', { name: 'Tracked entity ID' }))
            .toHaveValue('ObE2eTei001')
        await expect
            .poll(() =>
                calls.some((call) => call.resource === 'tracker/events')
            )
            .toBe(true)
    })

    it('shows the hook error once above the cards', async () => {
        const { screen } = await renderDemo(
            '/observation-cards?preset=rmnch&te=missing00001',
            {
                'tracker/events': () => {
                    throw new Error('Tracked entity not found')
                },
            }
        )

        const alert = screen.getByRole('alert')
        await expect
            .element(alert)
            .toHaveTextContent('Tracked entity not found')
        expect(screen.getByRole('alert').elements()).toHaveLength(1)
    })

    it('writes the typed tracked entity and the chosen preset to the URL state', async () => {
        const { screen } = await renderDemo('/observation-cards?preset=rmnch')

        await screen
            .getByRole('combobox', { name: 'Preset' })
            .selectOptions('seeded')
        await expect
            .element(screen.getByTestId('location'))
            .toHaveTextContent('?preset=seeded')

        await screen
            .getByRole('textbox', { name: 'Tracked entity ID' })
            .fill('teXYZ1234567')
        await screen.getByRole('button', { name: 'Show observations' }).click()

        await expect
            .element(screen.getByTestId('location'))
            .toHaveTextContent('?preset=seeded&te=teXYZ1234567')
    })

    it('loads the best-covered example person from the Load example button', async () => {
        const events = (trackedEntity: string, values: string[]) => ({
            event: `${trackedEntity}-ev`,
            trackedEntity,
            dataValues: values.map((dataElement) => ({ dataElement })),
        })
        const { screen } = await renderDemo('/observation-cards?preset=rmnch', {
            'tracker/events': ({ forTrackedEntity }) =>
                !forTrackedEntity
                    ? {
                          events: [
                              events('teSparse0001', [HAEMOGLOBIN]),
                              events('teRich000001', [
                                  HAEMOGLOBIN,
                                  SMOKING,
                                  EXTREME_PALLOR,
                              ]),
                              events('teMiddle0001', [HAEMOGLOBIN, SMOKING]),
                          ],
                      }
                    : eventsResponse,
        })

        await screen.getByRole('button', { name: 'Load example' }).click()

        await expect
            .element(screen.getByTestId('location'))
            .toHaveTextContent('?preset=rmnch&te=teRich000001')
        await expect
            .element(screen.getByTestId('patient-header'))
            .toHaveTextContent('Tracked entity teRich000001')
        await expect
            .element(screen.getByRole('link', { name: 'teMiddle0001' }))
            .toBeVisible()
    })

    it('says so when no one has values for the demo data elements', async () => {
        const { screen } = await renderDemo('/observation-cards?preset=rmnch', {
            'tracker/events': () => ({ events: [] }),
        })

        await screen.getByRole('button', { name: 'Load example' }).click()

        await expect
            .element(
                screen.getByText(
                    'No one in this program has values for these data elements.'
                )
            )
            .toBeVisible()
        await expect
            .element(screen.getByTestId('location'))
            .toHaveTextContent('?preset=rmnch')
    })

    it('shows every card state on the All demo examples tab without fetching', async () => {
        const { calls, screen } = await renderDemo(
            '/observation-cards?preset=rmnch&te=teABC123456'
        )
        const before = calls.length

        await screen.getByRole('tab', { name: 'All demo examples' }).click()

        await expect
            .element(screen.getByRole('heading', { name: 'All demo examples' }))
            .toBeVisible()
        await expect
            .element(screen.getByRole('group', { name: 'Fundal height' }))
            .toHaveTextContent('Never recorded')
        await expect
            .element(
                screen.getByRole('group', { name: 'Pregnancy risk assessment' })
            )
            .toHaveTextContent('Moderate risk')
        await expect
            .element(screen.getByText('Some visits are hidden by your access'))
            .toBeVisible()
        await expect
            .element(screen.getByTestId('location'))
            .toHaveTextContent('view=examples')
        expect(calls).toHaveLength(before)
    })
})
