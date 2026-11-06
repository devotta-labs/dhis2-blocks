import i18n from '@dhis2/d2-i18n'
import React, { useState, type ReactNode } from 'react'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkingList } from '@/components/working-list'
import type { ResourceRequest } from '@/components/working-list/api/client'
import {
    CalendarGrid,
    CalendarNavigation,
    CalendarDayRecords,
    useCalendar,
    useCalendarDay,
} from '@/components/calendar'
import { LabServerScope } from '../../../playground/LabServer'
import { ListCalendar } from '../ListCalendar'

i18n.addResources('nb', 'translation', {
    Calendar: 'Kalender',
    'Loading the working list…': 'Laster arbeidslisten…',
    'Unnamed record': 'Navnløs post',
})
afterEach(async () => {
    await i18n.changeLanguage('en')
})

const program = {
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

interface HarnessOptions {
    respond?: (request: ResourceRequest) => object | Promise<object>
    enrollmentDates?: { startDate: string; endDate: string }
    metadataReady?: Promise<void>
    viewId?: string
    calendar?: 'gregorian' | 'coptic'
}

const renderInList = (
    ui: ReactNode,
    {
        respond = () => ({ trackedEntities: [] }),
        enrollmentDates,
        metadataReady,
        viewId = 'SavedList01',
        calendar = 'gregorian',
    }: HarnessOptions = {}
) => {
    const requests: ResourceRequest[] = []
    const answer = async (request: ResourceRequest, type: string) => {
        if (type !== 'read') throw new Error('The calendar never writes')
        requests.push(request)
        switch (request.resource) {
            case 'system/info':
                return {
                    calendar,
                    dateFormat: 'YYYY-MM-DD',
                    serverTimeZoneId: 'UTC',
                }
            case 'programs':
                await metadataReady
                return program
            case 'trackedEntityInstanceFilters':
                return {
                    trackedEntityInstanceFilters: [
                        {
                            id: 'SavedList01',
                            displayName: 'Child enrolments',
                            program: { id: program.id },
                            access: { read: true },
                            entityQueryCriteria: {
                                displayColumnOrder: [
                                    'programOwner',
                                    'Attribute01',
                                ],
                                order: 'createdAt:desc',
                                enrollmentCreatedDate: enrollmentDates && {
                                    type: 'ABSOLUTE',
                                    ...enrollmentDates,
                                },
                            },
                        },
                    ],
                }
            case 'programStageWorkingLists':
                return { programStageWorkingLists: [] }
            case 'organisationUnits':
                return {
                    organisationUnits: [
                        { id: 'OrgUnit0001', displayName: 'Ngelehun CHC' },
                    ],
                }
            case 'tracker/trackedEntities':
                return respond(request)
            default:
                throw new Error(`Unexpected request ${request.resource}`)
        }
    }
    return {
        requests,
        screen: render(
            <LabServerScope
                network={{ delay: 0, endpoints: {} }}
                resources={[
                    'system/info',
                    'programs',
                    'trackedEntityInstanceFilters',
                    'programStageWorkingLists',
                    'organisationUnits',
                    'tracker/trackedEntities',
                ]}
                respond={answer}
                log={() => {}}
            >
                <WorkingList
                    programId={program.id}
                    orgUnitId="OrgUnit0001"
                    defaultViewId={viewId}
                >
                    {ui}
                </WorkingList>
            </LabServerScope>
        ),
    }
}

describe('working list calendar in a list', () => {
    it('waits for the active working list before reading its state', async () => {
        await i18n.changeLanguage('nb')
        let releaseMetadata!: () => void
        const metadataReady = new Promise<void>((resolve) => {
            releaseMetadata = resolve
        })
        const { screen, requests } = renderInList(
            <ListCalendar>
                <CalendarGrid />
            </ListCalendar>,
            {
                metadataReady,
            }
        )
        const view = await screen
        await expect
            .element(
                view
                    .getByRole('region', { name: 'Kalender', exact: true })
                    .getByText('Laster arbeidslisten…')
            )
            .toBeVisible()
        await expect
            .element(
                view.getByRole('region', { name: 'Kalender', exact: true })
            )
            .toBeVisible()
        expect(
            requests.some(
                ({ resource }) => resource === 'tracker/trackedEntities'
            )
        ).toBe(false)
        releaseMetadata()
        await expect
            .element(view.getByText('No records this month.'))
            .toBeVisible()
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
        await expect
            .element(
                view.getByRole('button', {
                    name: /14.*november.*2026.*1 record/i,
                })
            )
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
                ({ resource, params }) =>
                    resource === 'tracker/trackedEntities' &&
                    params?.enrollmentEnrolledAfter
            )?.params
        ).toMatchObject({
            enrollmentEnrolledAfter: '2026-10-26',
            enrollmentEnrolledBefore: '2026-12-06',
        })
    })

    it('opens inside the saved filter dates and stops at their edges', async () => {
        const { screen } = renderInList(
            <ListCalendar>
                <CalendarNavigation />
            </ListCalendar>,
            {
                enrollmentDates: {
                    startDate: '2025-03-01',
                    endDate: '2025-03-31',
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
        const view = await renderInList(
            <ListCalendar>
                <CalendarGrid />
            </ListCalendar>,
            { viewId: 'MissingList' }
        ).screen
        await expect
            .element(view.getByRole('alert'))
            .toHaveTextContent('This working list is unavailable')
        await view
            .getByRole('button', { name: 'Use the default working list' })
            .click()
        await expect
            .element(view.getByText('No records this month.'))
            .toBeVisible()
        await expect
            .element(
                view.getByRole('button', {
                    name: 'Use the default working list',
                })
            )
            .not.toBeInTheDocument()
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
})
