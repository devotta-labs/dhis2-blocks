import React from 'react'
import { formatCalendarDate } from '@/components/dhis2-value-display/calendar'
import { Timeline } from '@/components/timeline/ui/Timeline'
import { TimelineFeed } from '@/components/timeline/ui/TimelineFeed'
import {
    elementIn,
    eventEntryOf,
    NOW,
    recordedEvent,
    recordedProgram,
    renderEntries,
} from '../__tests__/fixtures/renderEntries'
import type { EventEntryData } from '../types'
import { TimelineEventEntry } from './TimelineEventEntry'

/** Events in the default composition, laid out in a feed around NOW. */
const renderFeed = (entries: ReturnType<typeof eventEntryOf>[]) =>
    renderEntries(
        <Timeline entries={entries} calendar="gregorian" now={NOW}>
            <TimelineFeed<EventEntryData>>
                {(entry) => <TimelineEventEntry entry={entry} />}
            </TimelineFeed>
        </Timeline>
    )

/** The rendered event frame for one event id. */
const frameOf = (container: HTMLElement, id: string) => {
    const frame = [
        ...container.querySelectorAll<HTMLElement>(
            '[data-slot=timeline-event]'
        ),
    ].find((candidate) =>
        candidate.closest(`[data-timeline-entry="event:${id}"]`)
    )
    if (frame === undefined) {
        throw new Error(`no frame for ${id}`)
    }
    return frame
}

describe('TimelineEventEntry in a feed', () => {
    it('in a feed, leaves out the badge and due date its place already states', async () => {
        const { container } = await renderFeed(
            ['TlE2eEvt006', 'TlE2eEvt005', 'TlE2eEvt004'].map((id) =>
                eventEntryOf(recordedEvent(id))
            )
        )
        const badge = (id: string) =>
            frameOf(container, id).querySelector('[data-slot=badge]')
                ?.textContent

        // Scheduled above now, under its own due day: nothing to add.
        expect(badge('TlE2eEvt006')).toBeUndefined()
        expect(frameOf(container, 'TlE2eEvt006').textContent).not.toContain(
            'Due'
        )
        // Overdue in the Overdue group: the heading has no date, so it stays.
        expect(badge('TlE2eEvt005')).toBeUndefined()
        expect(frameOf(container, 'TlE2eEvt005').textContent).toContain(
            `Due ${formatCalendarDate('2026-08-01', 'gregorian', 'en')}`
        )
        expect(badge('TlE2eEvt004')).toBe('Active')
    })

    it('in a feed, names the program only when the feed spans programs', async () => {
        const name = recordedProgram().name
        const one = await renderFeed([
            eventEntryOf(recordedEvent('TlE2eEvt004')),
            eventEntryOf(recordedEvent('TlE2eEvt002')),
        ])
        const two = await renderFeed([
            eventEntryOf(recordedEvent('TlE2eEvt004')),
            eventEntryOf(
                { ...recordedEvent('TlE2eEvt002'), program: 'OtherPrg001' },
                { program: null }
            ),
        ])

        expect(
            one.container.querySelector('[data-slot=timeline-event-program]')
        ).toBeNull()
        expect(two.container.textContent).toContain(name)
        expect(two.container.textContent).toContain('OtherPrg001')
    })

    it('shows the time of an event that has one, and none for a date at midnight', async () => {
        const { container } = await renderFeed([
            eventEntryOf(recordedEvent('TlE2eEvt002')),
            eventEntryOf(recordedEvent('TlE2eEvt004')),
        ])
        const meta = (id: string) =>
            elementIn(frameOf(container, id), '[data-slot=timeline-event-meta]')

        expect(meta('TlE2eEvt002').textContent).toBe(
            '10:30Ngelehun CHCCompleted by admin'
        )
        expect(meta('TlE2eEvt004').querySelector('time')).toBeNull()
    })

    it('tells the line marker the status it shows', async () => {
        const markerOf = async (id: string) => {
            const { container } = await renderEntries(
                <TimelineEventEntry entry={eventEntryOf(recordedEvent(id))} />
            )
            return elementIn(container, '[data-slot=timeline-event]').dataset
                .marker
        }

        expect(await markerOf('TlE2eEvt002')).toBe('filled')
        expect(await markerOf('TlE2eEvt003')).toBe('muted')
        expect(await markerOf('TlE2eEvt004')).toBeUndefined()
    })
})
