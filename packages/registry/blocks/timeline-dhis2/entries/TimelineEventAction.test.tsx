import React from 'react'
import { formatCalendarDate } from '@/components/dhis2-value-display/calendar'
import {
    elementIn,
    eventEntryOf,
    recordedEvent,
    recordedProgram,
    renderEntries,
    stageOf,
} from '../__tests__/fixtures/renderEntries'
import { TimelineEventAction } from './TimelineEventAction'
import { TimelineEventEntry } from './TimelineEventEntry'

const AT_BIRTH = 'PFDfvmGpsR3'

const renderWithOpen = async (
    entry: ReturnType<typeof eventEntryOf>,
    open = <TimelineEventAction href="#open">Open</TimelineEventAction>
) => {
    const { container } = await renderEntries(
        <TimelineEventEntry entry={entry} actions={open} />
    )
    await expect.poll(() => container.querySelector('a')).not.toBeNull()
    return container
}

describe('TimelineEventAction', () => {
    it('names each action after its event, so repeated ones tell apart', async () => {
        const entry = eventEntryOf(recordedEvent('TlE2eEvt002'))
        const container = await renderWithOpen(entry)

        const event = `First antenatal care visit, ${formatCalendarDate(entry.at.slice(0, 10), 'gregorian')}`
        expect(elementIn(container, 'a').getAttribute('aria-label')).toBe(
            `Open, ${event}`
        )
        expect(
            elementIn(
                container,
                '[data-slot=timeline-event-changes] button'
            ).getAttribute('aria-label')
        ).toBe(`Show changes, ${event}`)
    })

    it("keeps a host's own aria-label", async () => {
        const container = await renderWithOpen(
            eventEntryOf(recordedEvent('TlE2eEvt002')),
            <TimelineEventAction href="#open" aria-label="Open the visit">
                Open
            </TimelineEventAction>
        )

        expect(elementIn(container, 'a').getAttribute('aria-label')).toBe(
            'Open the visit'
        )
    })

    it('leaves out the due date of a stage that hides it', async () => {
        const program = recordedProgram((metadata) => {
            stageOf(metadata, AT_BIRTH).hideDueDate = true
        })
        const container = await renderWithOpen(
            eventEntryOf(recordedEvent('TlE2eEvt006'), { program })
        )

        expect(elementIn(container, 'a').getAttribute('aria-label')).toBe(
            'Open, Care at birth'
        )
    })
})
