import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Result } from 'better-result'
import React, { useState, type ReactNode } from 'react'
import { render } from 'vitest-browser-react'
import { describe, expect, it, vi } from 'vitest'
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
    CalendarGrid,
    CalendarNavigation,
    CalendarDayRecords,
    useCalendar,
    useCalendarDay,
} from '@/components/calendar'
import { ListCalendar } from '../ListCalendar'

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
    it('waits for the active working list before reading its state', async () => {
        const { screen, requests } = renderInList(
            <ListCalendar>
                <CalendarGrid />
            </ListCalendar>,
            {
                selection: { status: 'pending' },
            }
        )
        const view = await screen
        await expect
            .element(view.getByText('Loading the working list…'))
            .toBeVisible()
        expect(requests).toEqual([])
    })

    it('forwards a failed query and retries it from Calendar', async () => {
        let fail = true
        const view = await renderInList(
            <ListCalendar defaultSelectedDay="2026-11-14">
                <CalendarGrid />
            </ListCalendar>,
            {
                respond: () => {
                    if (fail) throw new Error('Request failed')
                    return { trackedEntities: [] }
                },
            }
        ).screen
        await expect
            .element(view.getByText('Records could not be loaded'))
            .toBeVisible()
        fail = false
        await view.getByRole('button', { name: 'Try again' }).click()
        await expect
            .element(view.getByText('No records this month.'))
            .toBeVisible()
    })

    it('preserves truncation instead of presenting a limited query as a complete month', async () => {
        const view = await renderInList(
            <ListCalendar defaultSelectedDay="2026-11-14" limit={1}>
                <CalendarGrid />
            </ListCalendar>,
            {
                respond: () => ({
                    trackedEntities: [
                        entity('EntityAaaa1', 'Amina', '2026-11-14T00:00:00'),
                        entity('EntityBbbb1', 'Bo', '2026-11-14T00:00:00'),
                    ],
                }),
            }
        ).screen
        await expect
            .element(view.getByText(/Showing the first 1 records/))
            .toBeVisible()
    })

    it('falls back from a blank custom label and deduplicates repeated records', async () => {
        const record = entity('EntityAaaa1', 'Amina', '2026-11-14T00:00:00')
        const open = vi.fn()
        const view = await renderInList(
            <ListCalendar
                defaultSelectedDay="2026-11-14"
                recordLabel={() => '  '}
                onRecordClick={open}
            >
                <CalendarGrid />
                <CalendarDayRecords />
            </ListCalendar>,
            { respond: () => ({ trackedEntities: [record, record] }) }
        ).screen
        await expect
            .element(
                view.getByRole('button', { name: '14 November 2026, 1 record' })
            )
            .toBeVisible()
        await view.getByRole('button', { name: 'Unnamed record' }).click()
        expect(open).toHaveBeenCalledWith(
            expect.objectContaining({ trackedEntityId: 'EntityAaaa1' })
        )
    })

    it('composes plain records and forwards tracker targets on click', async () => {
        const open = vi.fn()
        const Probe = () => {
            const {
                state: { selectedDay, results },
            } = useCalendar()
            return (
                <output aria-label="Composition state">
                    {results.status} / {selectedDay?.records[0]?.id}
                </output>
            )
        }
        const Cell = () => {
            const { day } = useCalendarDay()
            return <span>{day.records[0]?.label}</span>
        }
        const view = await renderInList(
            <ListCalendar
                defaultSelectedDay="2026-11-14"
                onRecordClick={open}
                recordLabel={(_row, text) => `Visit: ${text('Attribute01')}`}
                recordStatus={() => ({
                    id: 'custom',
                    label: 'Needs review',
                    tone: 'warning',
                })}
            >
                <CalendarGrid>
                    <Cell />
                </CalendarGrid>
                <CalendarDayRecords />
                <Probe />
            </ListCalendar>,
            {
                respond: () => ({
                    trackedEntities: [
                        entity('EntityAaaa1', 'Amina', '2026-11-14T00:00:00'),
                    ],
                }),
            }
        ).screen
        await expect
            .element(view.getByLabelText('Composition state'))
            .toHaveTextContent('ready / EntityAaaa1')
        await expect
            .element(
                view.getByRole('button', { name: '14 November 2026, 1 record' })
            )
            .toHaveTextContent('Visit: Amina')
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
            <ListCalendar
                defaultSelectedDay="2026-11-14"
                defaultDisplay="records"
            >
                <CalendarGrid />
            </ListCalendar>,
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
            <ListCalendar>
                <CalendarNavigation />
            </ListCalendar>,
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
                    <ListCalendar
                        selectedDay={day}
                        onSelectedDayChange={setDay}
                    >
                        <CalendarNavigation />
                    </ListCalendar>
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
            <ListCalendar defaultSelectedDay="2026-11-14">
                <CalendarNavigation />
                <CalendarGrid />
            </ListCalendar>,
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
        const view = await renderInList(<ListCalendar />, {
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
            <ListCalendar>
                <CalendarGrid />
            </ListCalendar>,
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
