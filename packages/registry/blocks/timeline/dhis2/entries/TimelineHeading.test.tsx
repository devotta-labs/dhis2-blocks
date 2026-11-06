import React from 'react'
import { formatCalendarDate } from '@/components/dhis2-value-display/calendar'
import {
    Timeline,
    TimelineFeed,
    TimelineGroupHeading,
    TimelineHeadingProvider,
    useTimeline,
    type GroupBy,
    type TimelineEntry,
} from '../../index'
import { changeEntries } from '../toEntries'
import type { HistoryEntryData } from '../types'
import {
    eventEntryOf,
    NOW,
    recordedEvent,
    recordedProgram,
    renderEntries,
    stageOf,
} from '../__tests__/fixtures/renderEntries'
import { TimelineChangeSummary, TimelineSave } from './TimelineChangeEntry'
import { TimelineHistoryEntry } from './TimelineHistoryEntry'

const scheduled = eventEntryOf(recordedEvent('TlE2eEvt006'))
const changes = changeEntries([
    {
        id: 'save',
        createdAt: '2026-10-22T19:11:40.388',
        user: { username: 'admin', displayName: 'Admin' },
        changes: [
            {
                field: { kind: 'attribute', id: 'name' },
                name: 'Name',
                meta: { valueType: 'TEXT' },
                type: 'UPDATE',
                previousValue: 'Amina',
                currentValue: 'Aminata',
            },
        ],
    },
])
const entries: TimelineEntry<HistoryEntryData>[] = [scheduled, ...changes]
const renderEntry = (entry: TimelineEntry<HistoryEntryData>) => (
    <TimelineHistoryEntry key={entry.id} entry={entry} />
)
const summaryTime = (container: HTMLElement) =>
    container.querySelector('[data-slot=timeline-change-summary] time')
        ?.textContent
const eventStatus = (container: HTMLElement) =>
    container.querySelector('[data-slot=timeline-event-status]')
const due = 'Due Jan 15, 2027'

describe('rendered heading facts', () => {
    it.each([
        ['none', 'none'],
        [
            'month',
            (entry: TimelineEntry<HistoryEntryData>) => ({
                key: entry.at.slice(0, 7),
                label: 'Month',
            }),
        ],
        ['program', () => ({ key: 'program', label: 'Program' })],
        [
            'date-looking keys',
            (entry: TimelineEntry<HistoryEntryData>) => ({
                key: entry.at.slice(0, 10),
                label: 'Program',
            }),
        ],
    ] satisfies Array<[string, GroupBy<HistoryEntryData>]>)(
        'keeps dates and status under %s groups',
        async (_, groupBy) => {
            const { container } = await renderEntries(
                <Timeline
                    entries={entries}
                    groupBy={groupBy}
                    calendar="gregorian"
                    locale="en"
                    now={NOW}
                >
                    <TimelineFeed<HistoryEntryData>>{renderEntry}</TimelineFeed>
                </Timeline>
            )
            expect(eventStatus(container)?.textContent).toContain('Scheduled')
            expect(eventStatus(container)?.textContent).toContain(due)
            expect(summaryTime(container)).toBe('Oct 22, 2026 19:11')
        }
    )

    it('retains details under a root without a Feed and in standalone cards', async () => {
        for (const children of [
            <Timeline
                key="root"
                entries={entries}
                calendar="gregorian"
                locale="en"
                now={NOW}
            >
                {entries.map(renderEntry)}
            </Timeline>,
            <React.Fragment key="standalone">
                {entries.map(renderEntry)}
            </React.Fragment>,
        ]) {
            const { container } = await renderEntries(children)
            expect(eventStatus(container)?.textContent).toContain('Scheduled')
            expect(eventStatus(container)?.textContent).toContain(due)
            expect(summaryTime(container)).toBe('Oct 22, 2026 19:11')
        }
    })

    it('omits only details represented by default day headings, including other calendars', async () => {
        const { container } = await renderEntries(
            <Timeline
                entries={entries}
                calendar="ethiopian"
                locale="en"
                now={NOW}
            >
                <TimelineFeed<HistoryEntryData>>{renderEntry}</TimelineFeed>
            </Timeline>
        )
        expect(eventStatus(container)).toBeNull()
        expect(summaryTime(container)).toBe('19:11')
        expect(container.textContent).toContain(
            formatCalendarDate('2027-01-15', 'ethiopian', 'en')
        )
    })

    it('lets a custom layout opt into the facts of headings it renders', async () => {
        const Custom = () => {
            const { groups } = useTimeline<HistoryEntryData>().state
            return groups.map((group) => (
                <section key={`${group.phase}:${group.key}`}>
                    <TimelineGroupHeading group={group} />
                    <TimelineHeadingProvider heading={group.heading}>
                        {group.entries.map(renderEntry)}
                    </TimelineHeadingProvider>
                </section>
            ))
        }
        const { container } = await renderEntries(
            <Timeline
                entries={entries}
                calendar="gregorian"
                locale="en"
                now={NOW}
            >
                <Custom />
            </Timeline>
        )
        expect(eventStatus(container)).toBeNull()
        expect(summaryTime(container)).toBe('19:11')
    })

    it('does not mistake an explicit past phase or an unreadable day for scheduled placement', async () => {
        const { container } = await renderEntries(
            <Timeline
                entries={[{ ...scheduled, phase: 'past' }]}
                calendar="gregorian"
                now={NOW}
            >
                <TimelineFeed<HistoryEntryData>>{renderEntry}</TimelineFeed>
            </Timeline>
        )
        expect(eventStatus(container)?.textContent).toBe('Scheduled')
        const undated = await renderEntries(
            <Timeline
                entries={[{ ...scheduled, at: '', phase: 'future' }]}
                calendar="gregorian"
                locale="en"
                now={NOW}
            >
                <TimelineFeed<HistoryEntryData>>{renderEntry}</TimelineFeed>
            </Timeline>
        )
        expect(eventStatus(undated.container)?.textContent).toContain(
            'Scheduled'
        )
        expect(eventStatus(undated.container)?.textContent).toContain(due)
    })

    it('keeps an overdue due date in the selected calendar, unless the stage hides it', async () => {
        for (const hideDueDate of [false, true]) {
            const event = recordedEvent('TlE2eEvt005')
            const entry = eventEntryOf(event, {
                program: recordedProgram((metadata) => {
                    stageOf(metadata, event.programStage).hideDueDate =
                        hideDueDate
                }),
            })
            const { container } = await renderEntries(
                <Timeline
                    entries={[entry]}
                    calendar="ethiopian"
                    locale="en"
                    now={NOW}
                >
                    <TimelineFeed<HistoryEntryData>>{renderEntry}</TimelineFeed>
                </Timeline>
            )
            expect(container.querySelector('[data-slot=badge]')).toBeNull()
            if (hideDueDate) {
                expect(eventStatus(container)).toBeNull()
            } else {
                expect(eventStatus(container)?.textContent).toBe(
                    `Due ${formatCalendarDate('2026-08-01', 'ethiopian', 'en')}`
                )
            }
        }
    })

    it('keeps change dates when the rendered heading represents a different day', async () => {
        const { container } = await renderEntries(
            <TimelineHeadingProvider
                heading={{ day: '2026-10-21', phase: 'past' }}
            >
                {changes.map(renderEntry)}
            </TimelineHeadingProvider>
        )
        expect(summaryTime(container)).toBe('Oct 22, 2026 19:11')
    })

    it.each([true, false])(
        'honors explicit withDay=%s even under heading context',
        async (withDay) => {
            const { container } = await renderEntries(
                <TimelineHeadingProvider
                    heading={{ day: '2026-10-22', phase: 'past' }}
                >
                    <TimelineSave save={changes[0].data.save}>
                        <TimelineChangeSummary withDay={withDay} />
                    </TimelineSave>
                </TimelineHeadingProvider>
            )
            expect(summaryTime(container)).toBe(
                withDay ? 'Oct 22, 2026 19:11' : '19:11'
            )
        }
    )
})
