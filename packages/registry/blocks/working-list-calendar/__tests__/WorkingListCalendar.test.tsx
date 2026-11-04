import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Result } from 'better-result'
import React, { useState, type ReactNode } from 'react'
import { render } from 'vitest-browser-react'
import { useWorkingListDateRange } from '@/components/working-list'
import { resolveWorkingListCapabilities } from '@/components/working-list/api/capabilities'
import type {
    DataEngineValue,
    ResourceRequest,
    WorkingListClient,
} from '@/components/working-list/api/client'
import { buildProgramFieldCatalog } from '@/components/working-list/api/metadata'
import type { TrackerProgram } from '@/components/working-list/api/schemas'
import type {
    AppliedFilter,
    WorkingListConfiguration,
} from '@/components/working-list/domain/model'
import type {
    WorkingListActions,
    WorkingListConfiguration as PublicConfiguration,
    WorkingListMeta,
} from '@/components/working-list/provider/contracts'
import { WorkingListPublicContext } from '@/components/working-list/provider/WorkingListContext'
import {
    WorkingListPrivateUiContext,
    type WorkingListPrivateUiContextValue,
} from '@/components/working-list/provider/WorkingListPrivateContext'
import { SavedListNotFoundError } from '@/components/working-list/provider/errors'
import { createWorkingListProviderStore } from '@/components/working-list/provider/store'
import { createWorkingListValueTransformers } from '@/components/working-list/registry/transformers'
import {
    WorkingListCalendar,
    WorkingListCalendarGrid,
    WorkingListCalendarNavigation,
    WorkingListCalendarDayRecords,
    useWorkingListCalendar,
    useWorkingListCalendarDay,
} from '..'

const program: TrackerProgram = {
    id: 'Program0001',
    displayName: 'Child programme',
    programType: 'WITH_REGISTRATION',
    programTrackedEntityAttributes: [
        {
            displayInList: true,
            trackedEntityAttribute: {
                id: 'Attribute01',
                displayName: 'First name',
                valueType: 'TEXT',
            },
        },
    ],
    programStages: [],
}
const capabilities = resolveWorkingListCapabilities({ apiVersion: 43 })
const metadata = buildProgramFieldCatalog({
    program,
    capabilities,
    hasSelectedOrgUnit: true,
})
const systemInfo = {
    calendar: 'gregorian',
    dateFormat: 'YYYY-MM-DD',
    serverTimeZoneId: 'UTC',
} as const
const transformers = createWorkingListValueTransformers({
    systemInfo,
    locale: 'en',
})

const configuration = (
    filters: AppliedFilter[] = []
): WorkingListConfiguration => ({
    mode: 'trackedEntity',
    programId: 'Program0001',
    columns: ['programOwnerId', 'Attribute01'],
    sort: { fieldId: 'createdAt', direction: 'desc' },
    filters,
})

const publicConfiguration = (
    filters: AppliedFilter[] = []
): PublicConfiguration => ({
    mode: 'trackedEntity',
    columns: ['programOwnerId', 'Attribute01'],
    sort: { fieldId: 'createdAt', direction: 'desc' },
    filters: filters.map(({ field, operator, value }) => ({
        fieldId: field.id,
        operator,
        value,
    })),
})

const entity = (id: string, name: string, enrolledAt: string) => ({
    trackedEntity: id,
    attributes: [{ attribute: 'Attribute01', value: name }],
    programOwners: [{ orgUnit: 'OrgUnit0001', program: 'Program0001' }],
    enrollments: [
        {
            enrollment: `${id.slice(0, 10)}E`,
            program: 'Program0001',
            status: 'ACTIVE',
            enrolledAt,
        },
    ],
})

const actions: WorkingListActions = {
    setFilter: () => Result.ok(),
    removeFilter: () => Result.ok(),
    setColumns: () => Result.ok(),
    setSort: () => Result.ok(),
    setProgramStage: () => Result.ok(),
    setPage: () => Result.ok(),
    setPageSize: () => Result.ok(),
    selectView: () => Result.ok(),
    clearViewSelection: vi.fn(() => Result.ok()),
    createView: async () => Result.ok({ viewId: 'new-view' }),
    updateSelectedView: async () => Result.ok(),
    deleteView: async () => Result.ok(),
    downloadVisibleRows: () => Result.ok(),
}

const meta = (selection: WorkingListMeta['selection']): WorkingListMeta => ({
    lifecycle: { status: 'ready' },
    selection,
    activeConfiguration: {
        status: selection.status === 'ready' ? 'ready' : 'unavailable',
    },
    savedViews: { status: 'pending', views: [] },
    mutations: {
        create: { status: 'idle' },
        update: { status: 'idle' },
        delete: { status: 'idle' },
    },
    results: { status: 'pending' },
    dirty: false,
    online: true,
    pagination: { page: 1, pageSize: 15 },
    fields: [],
})

interface HarnessOptions {
    respond?: (
        request: ResourceRequest
    ) => DataEngineValue | Promise<DataEngineValue>
    filters?: AppliedFilter[]
    selection?: WorkingListMeta['selection']
    calendar?: 'gregorian' | 'coptic'
}

const renderInList = (
    ui: ReactNode,
    {
        respond = () => ({ trackedEntities: [] }),
        filters,
        selection = { status: 'ready', selectedSavedListId: 'SavedList01' },
        calendar = 'gregorian',
    }: HarnessOptions = {}
) => {
    const requests: ResourceRequest[] = []
    const client: WorkingListClient = {
        async query(request, schema) {
            requests.push(request)
            if (request.resource === 'organisationUnits') {
                return schema.parse({
                    organisationUnits: [
                        { id: 'OrgUnit0001', displayName: 'Ngelehun CHC' },
                    ],
                })
            }
            return schema.parse(await respond(request))
        },
        async mutate() {
            throw new Error('The calendar never writes')
        },
    }
    const store = createWorkingListProviderStore(meta(selection))
    if (selection.status === 'ready') {
        store.setState({
            activeState: {
                selectedSavedListId: selection.selectedSavedListId,
                configuration: publicConfiguration(filters),
            },
            resolvedConfiguration: configuration(filters),
        })
    }
    const privateUi: WorkingListPrivateUiContextValue = {
        store,
        actions,
        privateActions: {
            retrySavedViews: async () => undefined,
            retryResults: async () => undefined,
            sharingSaved: async () => undefined,
            repairSelectedSavedList: async () => Result.ok(),
        },
        online: true,
        displayedLists: [],
        selectedIsGenerated: false,
        mutationBusy: false,
        resultTargets: new Map(),
        client,
        programId: 'Program0001',
        orgUnitId: 'OrgUnit0001',
        capabilities,
        metadata,
        resolvedConfiguration: configuration(filters),
        serializationContext: transformers.serializationContext,
        parsingContext: transformers.parsingContext,
        calendarContext: {
            calendar,
            dateFormat: 'YYYY-MM-DD',
            locale: 'en',
            timeZone: 'UTC',
        },
        systemInfo,
        locale: 'en',
        translate: (message: string) => message,
    }
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return {
        requests,
        screen: render(
            <QueryClientProvider client={queryClient}>
                <WorkingListPublicContext.Provider value={{ store, actions }}>
                    <WorkingListPrivateUiContext.Provider value={privateUi}>
                        {ui}
                    </WorkingListPrivateUiContext.Provider>
                </WorkingListPublicContext.Provider>
            </QueryClientProvider>
        ),
    }
}

describe('working list calendar in a list', () => {
    it('keeps tracker targets, custom labels and statuses in the adapter', async () => {
        const open = vi.fn()
        const Probe = () => {
            const { dateField, selectedDay, results } = useWorkingListCalendar()
            return (
                <output aria-label="Adapter state">
                    {dateField} / {results.status} /{' '}
                    {selectedDay?.records[0]?.target?.mode}
                </output>
            )
        }
        const Cell = () => {
            const { day } = useWorkingListCalendarDay()
            return <span>{day.records[0]?.target?.mode}</span>
        }
        const view = await renderInList(
            <WorkingListCalendar
                defaultSelectedDay="2026-11-14"
                onRecordClick={open}
                recordLabel={(_row, text) => `Visit: ${text('Attribute01')}`}
                recordStatus={() => ({
                    id: 'custom',
                    label: 'Needs review',
                    tone: 'warning',
                })}
            >
                <WorkingListCalendarGrid>
                    <Cell />
                </WorkingListCalendarGrid>
                <WorkingListCalendarDayRecords />
                <Probe />
            </WorkingListCalendar>,
            {
                respond: () => ({
                    trackedEntities: [
                        entity('EntityAaaa1', 'Amina', '2026-11-14T00:00:00'),
                    ],
                }),
            }
        ).screen
        await expect
            .element(view.getByLabelText('Adapter state'))
            .toHaveTextContent('enrolledAt / ready / trackedEntity')
        await expect
            .element(
                view.getByRole('button', { name: '14 November 2026, 1 record' })
            )
            .toHaveTextContent('trackedEntity')
        await expect
            .element(view.getByText('Needs review', { exact: true }))
            .toBeVisible()
        await view.getByRole('button', { name: 'Visit: Amina' }).click()
        expect(open).toHaveBeenCalledWith({
            mode: 'trackedEntity',
            programId: 'Program0001',
            trackedEntityId: 'EntityAaaa1',
        })
    })

    it('names records with the organisation units it loaded', async () => {
        const { screen, requests } = renderInList(
            <WorkingListCalendar
                defaultSelectedDay="2026-11-14"
                defaultDisplay="records"
            >
                <WorkingListCalendarGrid />
            </WorkingListCalendar>,
            {
                respond: () => ({
                    trackedEntities: [
                        entity('EntityAaaa1', 'Amina', '2026-11-14T00:00:00'),
                    ],
                }),
            }
        )

        await expect
            .element(
                (await screen).getByRole('button', {
                    name: '14 November 2026, 1 record',
                })
            )
            .toHaveTextContent('Ngelehun CHC Amina')
        // November 2026 fills full weeks from Monday 26 October to Sunday 6 December.
        expect(
            requests.find(
                ({ resource }) => resource === 'tracker/trackedEntities'
            )?.params
        ).toMatchObject({
            enrollmentEnrolledAfter: '2026-10-26',
            enrollmentEnrolledBefore: '2026-12-06',
        })
    })

    it('opens inside the saved filter dates and stops at their edges', async () => {
        const enrolledAt = metadata.fields.get('enrolledAt')
        if (!enrolledAt) throw new Error('enrolledAt is missing')
        const { screen } = renderInList(
            <WorkingListCalendar>
                <WorkingListCalendarNavigation />
            </WorkingListCalendar>,
            {
                filters: [
                    {
                        field: enrolledAt,
                        operator: 'range',
                        value: {
                            kind: 'dateRange',
                            mode: 'absolute',
                            start: '2025-03-01',
                            end: '2025-03-31',
                        },
                    },
                ],
            }
        )
        const view = await screen

        await expect
            .element(view.getByRole('combobox', { name: 'Month' }))
            .toHaveTextContent('March')
        await expect
            .element(view.getByRole('combobox', { name: 'Year' }))
            .toHaveTextContent('2025')
        await expect
            .element(view.getByRole('button', { name: 'Next month' }))
            .toBeDisabled()
        await expect
            .element(view.getByRole('button', { name: 'Previous month' }))
            .toBeDisabled()
    })

    it('keeps the month in view when the selection is cleared', async () => {
        const Controlled = () => {
            const [day, setDay] = useState<string | null>('2027-03-10')
            return (
                <>
                    <button type="button" onClick={() => setDay(null)}>
                        Clear
                    </button>
                    <WorkingListCalendar
                        selectedDay={day}
                        onSelectedDayChange={setDay}
                    >
                        <WorkingListCalendarNavigation />
                    </WorkingListCalendar>
                </>
            )
        }
        const view = await renderInList(<Controlled />).screen
        const month = view.getByRole('combobox', { name: 'Month' })

        await expect.element(month).toHaveTextContent('March')
        await view.getByRole('button', { name: 'Clear' }).click()
        await expect.element(month).toHaveTextContent('March')
    })

    it('says it is loading a new month instead of showing the last one', async () => {
        const { screen } = renderInList(
            <WorkingListCalendar defaultSelectedDay="2026-11-14">
                <WorkingListCalendarNavigation />
                <WorkingListCalendarGrid />
            </WorkingListCalendar>,
            {
                respond: (request) =>
                    request.params?.enrollmentEnrolledAfter === '2026-10-26'
                        ? { trackedEntities: [] }
                        : new Promise(() => undefined),
            }
        )
        const view = await screen

        await expect
            .element(view.getByText('No records this month.'))
            .toBeVisible()
        await view.getByRole('button', { name: 'Next month' }).click()
        await expect.element(view.getByText('Loading records…')).toBeVisible()
        await expect
            .element(view.getByText('No records this month.'))
            .not.toBeInTheDocument()
    })

    it('offers the default list when the saved list is unavailable', async () => {
        const view = await renderInList(<WorkingListCalendar />, {
            selection: {
                status: 'error',
                requestedSavedListId: 'SavedList01',
                error: new SavedListNotFoundError({
                    savedListId: 'SavedList01',
                    message: 'Not found',
                }),
            },
        }).screen

        await view
            .getByRole('button', { name: 'Use the default working list' })
            .click()
        expect(actions.clearViewSelection).toHaveBeenCalled()
    })

    it('says the Coptic calendar is not supported yet', async () => {
        const view = await renderInList(
            <WorkingListCalendar>
                <WorkingListCalendarGrid />
            </WorkingListCalendar>,
            { calendar: 'coptic' }
        ).screen

        await expect
            .element(view.getByText(/does not support the Coptic calendar/))
            .toBeVisible()
        expect(view.container.querySelector('table')).toBeNull()
    })

    it('reports an event date on a tracked-entity list as an error', async () => {
        const Probe = () => {
            const results = useWorkingListDateRange({
                fieldId: 'eventScheduledAt',
                start: '2026-11-01',
                end: '2026-11-30',
            })
            return <p>{results.status}</p>
        }
        const view = await renderInList(<Probe />).screen

        await expect.element(view.getByText('error')).toBeVisible()
    })
})
