import { CustomDataProvider, FetchError } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ComponentProps } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render } from 'vitest-browser-react'
import { CaseHistoryDemo } from './CaseHistoryDemo'

type CustomData = ComponentProps<typeof CustomDataProvider>['data']

const user = {
    uid: 'userUid00001',
    username: 'amina',
    firstName: 'Amina',
    surname: 'Bello',
}

interface EventFields {
    event: string
    programStage: string
    status: string
    scheduledAt?: string
    occurredAt?: string
    completedAt?: string
}

const event = (fields: EventFields) => ({
    program: 'TlE2ePrg001',
    trackedEntity: 'TlE2eTei001',
    enrollment: 'enr1',
    orgUnit: 'ou1',
    dataValues: [],
    notes: [],
    ...fields,
})

const futureEvent = event({
    event: 'evFuture0001',
    programStage: 'stFuture',
    status: 'SCHEDULE',
    scheduledAt: '2999-01-15T00:00:00.000',
})
const overdueEvent = event({
    event: 'evOverdue001',
    programStage: 'stOverdue',
    status: 'SCHEDULE',
    scheduledAt: '2020-02-01T00:00:00.000',
})
const pastEvent = event({
    event: 'evPast000001',
    programStage: 'stPast',
    status: 'COMPLETED',
    occurredAt: '2026-03-01T00:00:00.000',
    completedAt: '2026-03-01T00:00:00.000',
})

const stage = (id: string, displayName: string) => ({
    id,
    displayName,
    sortOrder: 1,
    hideDueDate: false,
    repeatable: true,
    programStageDataElements: [],
})

const metadata = {
    id: 'TlE2ePrg001',
    displayName: 'Demo program',
    programStages: [
        stage('stFuture', 'Future visit'),
        stage('stOverdue', 'Overdue visit'),
        stage('stPast', 'Past visit'),
    ],
    programTrackedEntityAttributes: [
        {
            trackedEntityAttribute: {
                id: 'attrName001',
                displayName: 'First name',
                valueType: 'TEXT',
            },
        },
    ],
}

const trackedEntity = {
    trackedEntity: 'TlE2eTei001',
    enrollments: [
        {
            enrollment: 'enr1',
            program: 'TlE2ePrg001',
            status: 'ACTIVE',
            enrolledAt: '2025-01-10T00:00:00.000',
            notes: [
                {
                    note: 'note1',
                    value: 'Referred to the district hospital',
                    storedAt: '2025-02-01T10:00:00.000',
                    storedBy: 'amina',
                },
            ],
        },
    ],
}

const changeLogs = {
    changeLogs: [
        {
            type: 'UPDATE',
            createdAt: '2025-06-01T09:30:00.000',
            createdBy: user,
            change: {
                attributeValue: {
                    attribute: 'attrName001',
                    previousValue: 'Amina',
                    currentValue: 'Aminata',
                },
            },
        },
    ],
}

const notFound = () =>
    new FetchError({
        type: 'unknown',
        message: 'An unknown error occurred - Not Found (404)',
        details: { httpStatusCode: 404 },
    })

interface Answers {
    /** Makes the tracked entity changelog request fail with this error. */
    changelogError?: Error
}

const renderDemo = async (url = '/timeline', answers: Answers = {}) => {
    const requests: Array<{ resource: string; params?: object }> = []
    const data: CustomData = {
        'tracker/events': async (_type, query) => {
            requests.push(query)
            const status = query.params?.status
            return {
                events:
                    status === 'SCHEDULE'
                        ? [futureEvent, overdueEvent]
                        : status === 'SKIPPED'
                          ? []
                          : [pastEvent],
            }
        },
        'tracker/trackedEntities': async () => trackedEntity,
        'tracker/trackedEntities/TlE2eTei001/changeLogs': async () => {
            if (answers.changelogError !== undefined) {
                throw answers.changelogError
            }
            return changeLogs
        },
        programs: async () => metadata,
        organisationUnits: async () => ({
            organisationUnits: [{ id: 'ou1', displayName: 'Ngelehun CHC' }],
        }),
    }
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const screen = await render(
        <CustomDataProvider data={data}>
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={[url]}>
                    <CaseHistoryDemo />
                </MemoryRouter>
            </QueryClientProvider>
        </CustomDataProvider>
    )
    return { requests, screen }
}

describe('CaseHistoryDemo', () => {
    it('renders future, now, overdue and past in order with all four sources', async () => {
        const { screen } = await renderDemo(
            '/timeline?te=TlE2eTei001&program=TlE2ePrg001'
        )

        await expect.element(screen.getByText('Past visit')).toBeVisible()
        await expect
            .element(screen.getByText('Referred to the district hospital'))
            .toBeVisible()
        await expect.element(screen.getByText('Enrolled')).toBeVisible()
        await expect
            .element(screen.getByText('Amina Bello changed 1 field'))
            .toBeVisible()

        const feed = document.body.innerText
        const order = [
            'Future visit',
            'Now',
            'Overdue',
            'Overdue visit',
            'Past visit',
        ].map((text) => feed.indexOf(text, feed.indexOf('Future visit')))
        expect(order.every((at) => at >= 0)).toBe(true)
        expect(order).toEqual([...order].sort((a, b) => a - b))
        // The host's own action, built from the entry's event and org unit.
        const links = screen
            .getByRole('link', { name: 'Open in Capture' })
            .elements()
        expect(links).toHaveLength(3)
        expect(links[0]?.getAttribute('href')).toContain('eventId=evFuture0001')
        expect(links[0]?.getAttribute('href')).toContain('orgUnitId=ou1')
    })

    it('shows a notice, not "No history yet", when the changelog source is unsupported', async () => {
        const { screen } = await renderDemo(
            '/timeline?te=TlE2eTei001&program=TlE2ePrg001',
            { changelogError: notFound() }
        )

        await expect
            .element(
                screen.getByText(
                    "Changes isn't available on this DHIS2 version."
                )
            )
            .toBeVisible()
        await expect.element(screen.getByText('Past visit')).toBeVisible()
        expect(screen.getByText('No history yet').elements()).toHaveLength(0)
    })

    it('asks for the entity and program in the URL, defaulting to the seeded ones', async () => {
        const { requests, screen } = await renderDemo('/timeline')

        await expect.element(screen.getByText('Past visit')).toBeVisible()
        expect(requests.length).toBeGreaterThan(0)
        for (const request of requests) {
            expect(request.params).toMatchObject({
                trackedEntity: 'TlE2eTei001',
                program: 'TlE2ePrg001',
            })
        }
        await expect
            .element(screen.getByRole('textbox', { name: 'Tracked entity ID' }))
            .toHaveValue('TlE2eTei001')
    })
})
