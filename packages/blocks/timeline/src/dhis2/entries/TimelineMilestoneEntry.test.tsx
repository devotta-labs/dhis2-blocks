import axe from 'axe-core'
import React from 'react'
import type { TimelineEntry } from '../../core/types'
import { renderEntries } from '../__fixtures__/renderEntries'
import { TrackedEntitySchema } from '../schemas'
import type { MilestoneEntryData, MilestoneKind } from '../useEnrollmentSources'
import { TimelineMilestoneEntry } from './TimelineMilestoneEntry'

const ENROLLMENT = TrackedEntitySchema.parse({
    trackedEntity: 'TlE2eTei001',
    enrollments: [
        { enrollment: 'TlE2eEnr002', program: 'WSGAb5XwJ3Y', status: 'ACTIVE' },
    ],
}).enrollments[0]

const milestone = (kind: MilestoneKind): TimelineEntry<MilestoneEntryData> => ({
    id: `milestones:TlE2eEnr002:${kind}`,
    at: '2026-01-10',
    precision: 'day',
    sourceKey: 'milestones',
    data: {
        kind,
        enrollment: ENROLLMENT,
    },
})

describe('TimelineMilestoneEntry', () => {
    it.each([
        ['enrolled', 'Enrolled'],
        ['incident', 'Incident'],
        ['completed', 'Enrollment completed'],
        ['cancelled', 'Enrollment cancelled'],
    ] as const)('labels the %s milestone', async (kind, label) => {
        const { container } = await renderEntries(
            <TimelineMilestoneEntry entry={milestone(kind)} />
        )

        expect(container.textContent).toBe(label)
    })

    it('has no axe violations', async () => {
        const { container } = await renderEntries(
            <>
                {(
                    ['enrolled', 'incident', 'completed', 'cancelled'] as const
                ).map((kind) => (
                    <TimelineMilestoneEntry
                        key={kind}
                        entry={milestone(kind)}
                    />
                ))}
            </>
        )

        const results = await axe.run(container)
        expect(results.violations).toEqual([])
    })
})
