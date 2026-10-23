import axe from 'axe-core'
import React from 'react'
import { renderEntries } from '../__fixtures__/renderEntries'
import { TrackedEntitySchema } from '../schemas'
import { milestoneEntries } from '../useEnrollmentSources'
import { TimelineMilestoneEntry } from './TimelineMilestoneEntry'

/** As the server stores them: enrollment and incident dates at midnight. */
const ENTITY = TrackedEntitySchema.parse({
    trackedEntity: 'TlE2eTei001',
    enrollments: [
        {
            enrollment: 'TlE2eEnr001',
            program: 'WSGAb5XwJ3Y',
            status: 'COMPLETED',
            enrolledAt: '2026-01-10T00:00:00.000',
            occurredAt: '2026-01-05T00:00:00.000',
            completedAt: '2026-03-01T10:15:00.000',
        },
        {
            enrollment: 'TlE2eEnr002',
            program: 'WSGAb5XwJ3Y',
            status: 'CANCELLED',
            enrolledAt: '2026-04-10T00:00:00.000',
            updatedAt: '2026-05-02T16:40:00.000',
        },
    ],
})

const milestone = (id: string) => {
    const found = milestoneEntries(ENTITY).find((entry) => entry.id === id)
    if (found === undefined) {
        throw new Error(`no milestone ${id}`)
    }
    return found
}

describe('TimelineMilestoneEntry', () => {
    it.each([
        ['milestones:TlE2eEnr001:enrolled', 'Enrolled'],
        ['milestones:TlE2eEnr001:incident', 'Incident'],
        ['milestones:TlE2eEnr001:completed', 'Enrollment completed10:15'],
        ['milestones:TlE2eEnr002:cancelled', 'Enrollment cancelled16:40'],
    ] as const)(
        'labels %s, with a time only where one was recorded',
        async (id, text) => {
            const { container } = await renderEntries(
                <TimelineMilestoneEntry entry={milestone(id)} />
            )

            expect(container.textContent).toBe(text)
            expect(container.textContent).not.toContain('00:00')
        }
    )

    it('has no axe violations', async () => {
        const { container } = await renderEntries(
            <>
                {milestoneEntries(ENTITY).map((entry) => (
                    <TimelineMilestoneEntry key={entry.id} entry={entry} />
                ))}
            </>
        )

        const results = await axe.run(container)
        expect(results.violations).toEqual([])
    })
})
