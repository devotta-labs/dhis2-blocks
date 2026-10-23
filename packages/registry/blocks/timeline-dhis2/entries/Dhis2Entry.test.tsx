import axe from 'axe-core'
import React from 'react'
import { Timeline } from '@/components/timeline/ui/Timeline'
import { TimelineFeed } from '@/components/timeline/ui/TimelineFeed'
import {
    eventEntryOf,
    NOW,
    recordedEvent,
    recordedProgram,
    renderEntries,
} from '../__tests__/fixtures/renderEntries'
import { groupChangelogRows } from '../changelog'
import { TrackedEntitySchema } from '../schemas'
import { changeEntries, milestoneEntries, noteEntries } from '../toEntries'
import type { Dhis2EntryData } from '../types'
import { Dhis2Entry } from './Dhis2Entry'
import { useTimelineEventEntry } from './TimelineEventEntry'

const PROGRAM = recordedProgram()

const [ENROLLMENT] = TrackedEntitySchema.parse({
    trackedEntity: 'TlE2eTei001',
    enrollments: [
        {
            enrollment: 'TlE2eEnr002',
            program: PROGRAM.id,
            status: 'ACTIVE',
            enrolledAt: '2026-01-10T00:00:00.000',
            notes: [
                {
                    note: 'TlE2eNot002',
                    value: 'Referred from outreach.',
                    storedAt: '2026-02-01T09:00:00.000',
                    storedBy: 'admin',
                },
            ],
        },
    ],
}).enrollments

const ENTRIES = [
    eventEntryOf(recordedEvent('TlE2eEvt002')),
    ...milestoneEntries(ENROLLMENT, PROGRAM),
    ...noteEntries(ENROLLMENT, PROGRAM),
    ...changeEntries(
        groupChangelogRows([
            {
                createdAt: '2026-03-01T10:00:00.000',
                createdBy: {
                    uid: undefined,
                    username: 'admin',
                    firstName: 'John',
                    surname: 'Traore',
                    displayName: undefined,
                },
                type: 'UPDATE',
                change: {
                    kind: 'attribute',
                    id: 'w75KJ2mc4zz',
                    previousValue: 'Amina',
                    currentValue: 'Aminata',
                },
            },
        ])
    ),
]

const EventId = () => <span>id {useTimelineEventEntry().data.event.event}</span>

describe('Dhis2Entry', () => {
    it('renders every kind in one feed, with host actions on events', async () => {
        const { container } = await renderEntries(
            <Timeline<Dhis2EntryData>
                entries={ENTRIES}
                calendar="gregorian"
                now={NOW}
            >
                <TimelineFeed<Dhis2EntryData>>
                    {(entry) => (
                        <Dhis2Entry entry={entry} eventActions={<EventId />} />
                    )}
                </TimelineFeed>
            </Timeline>
        )

        const slots = [
            ...container.querySelectorAll(
                '[data-slot=timeline-item] > [data-slot]:not([data-slot=timeline-marker]):not([data-slot=timeline-connector])'
            ),
        ].map((node) => node.getAttribute('data-slot'))
        expect(new Set(slots)).toEqual(
            new Set([
                'timeline-event',
                'timeline-milestone',
                'timeline-note',
                'timeline-change',
            ])
        )
        expect(container.textContent).toContain('id TlE2eEvt002')
        expect(container.textContent).toContain('Referred from outreach.')
        expect(container.textContent).toContain('John Traore changed 1 field')

        const results = await axe.run(container)
        expect(results.violations).toEqual([])
    })
})
