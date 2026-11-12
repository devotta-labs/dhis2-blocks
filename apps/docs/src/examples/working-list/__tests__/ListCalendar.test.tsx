import i18n from '@dhis2/d2-i18n'
import React, { useState, type ReactNode } from 'react'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkingList, useWorkingListDateRange } from '@/components/working-list'
import {
    createFakeServer,
    FakeServerRuntime,
    savedTrackedEntityList,
    silent,
} from '@/components/working-list/__tests__/fakeServer'
import {
    CalendarGrid,
    CalendarNavigation,
    CalendarDayRecords,
    useCalendar,
    useCalendarDay,
} from '@/components/calendar'
import { ListCalendar } from '../ListCalendar'

i18n.addResources('nb', 'translation', {
    Calendar: 'Kalender',
    'Loading the working list…': 'Laster arbeidslisten…',
    'Unnamed record': 'Navnløs post',
})
afterEach(async () => {
    await i18n.changeLanguage('en')
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

type ServerOptions = NonNullable<Parameters<typeof createFakeServer>[0]>

interface HarnessOptions {
    /** Answers the record requests; the saved list and its program are fixed. */
    respond?: ServerOptions['records']
    /** Saved filters of the selected list, as DHIS2 stores them. */
    criteria?: Parameters<typeof savedTrackedEntityList>[2]
    calendar?: 'gregorian' | 'coptic'
    /** The list to select; `SavedList01` is the one the server has. */
    viewId?: string
    resources?: ServerOptions['resources']
}

/** `ui` inside a working list that has selected a saved list from the server. */
const renderInList = (
    ui: ReactNode,
    {
        respond = () => ({ trackedEntities: [] }),
        criteria,
        calendar = 'gregorian',
        viewId = 'SavedList01',
        resources,
    }: HarnessOptions = {}
) => {
    const server = createFakeServer({
        systemInfo: {
            calendar,
            dateFormat: 'YYYY-MM-DD',
            serverTimeZoneId: 'UTC',
        },
        trackedEntityLists: [
            savedTrackedEntityList('SavedList01', 'My list', {
                displayColumnOrder: ['programOwnerId', 'Attribute01'],
                order: 'createdAt:desc',
                ...criteria,
            }),
        ],
        records: respond,
        resources: {
            organisationUnits: {
                organisationUnits: [
                    { id: 'OrgUnit0001', displayName: 'Ngelehun CHC' },
                ],
            },
            ...resources,
        },
    })
    const onViewChange = vi.fn()
    return {
        server,
        onViewChange,
        screen: render(
            <FakeServerRuntime server={server}>
                <WorkingList
                    programId="Program0001"
                    orgUnitId="OrgUnit0001"
                    defaultViewId={viewId}
                    onViewChange={onViewChange}
                >
                    {ui}
                </WorkingList>
            </FakeServerRuntime>
        ),
    }
}

describe('working list calendar in a list', () => {
    it('waits for the active working list before reading its state', async () => {
        await i18n.changeLanguage('nb')
        const { screen, server } = renderInList(
            <ListCalendar>
                <CalendarGrid />
            </ListCalendar>,
            { resources: { trackedEntityInstanceFilters: silent } }
        )
        const view = await screen
        await expect
            .element(view.getByText('Laster arbeidslisten…'))
            .toBeVisible()
        await expect
            .element(
                view.getByRole('region', { name: 'Kalender', exact: true })
            )
            .toBeVisible()
        expect(
            server.reads.filter(({ resource }) =>
                resource.startsWith('tracker/')
            )
        ).toEqual([])
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
        await i18n.changeLanguage('nb')
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
        // The day is named in the language of the list, the count is not.
        await expect
            .element(view.getByRole('button', { name: /2026, 1 record$/ }))
            .toBeVisible()
        await view.getByRole('button', { name: 'Navnløs post' }).click()
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
        const { screen, server } = renderInList(
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
        expect(server.reads).toContainEqual(
            expect.objectContaining({
                resource: 'tracker/trackedEntities',
                params: expect.objectContaining({
                    enrollmentEnrolledAfter: '2026-10-26',
                    enrollmentEnrolledBefore: '2026-12-06',
                }),
            })
        )
    })

    it('opens inside the saved filter dates and stops at their edges', async () => {
        const { screen } = renderInList(
            <ListCalendar>
                <CalendarNavigation />
            </ListCalendar>,
            {
                criteria: {
                    enrollmentCreatedDate: {
                        type: 'ABSOLUTE',
                        startDate: '2025-03-01',
                        endDate: '2025-03-31',
                    },
                },
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
                        : new Promise<never>(() => undefined),
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
        const { screen, onViewChange } = renderInList(<ListCalendar />, {
            viewId: 'DeletedList1',
        })

        await (
            await screen
        )
            .getByRole('button', { name: 'Use the default working list' })
            .click()
        expect(onViewChange).toHaveBeenLastCalledWith('Program0001-default')
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
