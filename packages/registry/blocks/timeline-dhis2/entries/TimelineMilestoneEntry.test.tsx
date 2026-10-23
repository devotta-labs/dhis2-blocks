import axe from 'axe-core'
import React from 'react'
import {
    recordedProgram,
    renderEntries,
} from '../__tests__/fixtures/renderEntries'
import { TrackedEntitySchema } from '../schemas'
import { milestoneEntries } from '../toEntries'
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

const PROGRAM = recordedProgram()

const allMilestones = () =>
    ENTITY.enrollments.flatMap((enrollment) =>
        milestoneEntries(enrollment, PROGRAM)
    )

const milestone = (id: string) => {
    const found = allMilestones().find((entry) => entry.id === id)
    if (found === undefined) {
        throw new Error(`no milestone ${id}`)
    }
    return found
}

describe('TimelineMilestoneEntry', () => {
    it.each([
        ['milestone:TlE2eEnr001:enrolled', 'Enrolled'],
        ['milestone:TlE2eEnr001:incident', 'Incident'],
        ['milestone:TlE2eEnr001:completed', 'Enrollment completed10:15'],
        ['milestone:TlE2eEnr002:cancelled', 'Enrollment cancelled16:40'],
    ] as const)(
        'labels %s, with a time only where one was recorded',
        async (id, text) => {
            const { container } = await renderEntries(
                <TimelineMilestoneEntry entry={milestone(id)} />
            )

            const [label, time = ''] = text.split(/(?=\d\d:)/)
            expect(container.textContent).toBe(`${label}${PROGRAM.name}${time}`)
            expect(container.textContent).not.toContain('00:00')
        }
    )

    it('names the program by id when its metadata could not be read', async () => {
        const [entry] = milestoneEntries(ENTITY.enrollments[0])
        const { container } = await renderEntries(
            <TimelineMilestoneEntry entry={entry} className="custom" />
        )

        expect(container.textContent).toBe('EnrolledWSGAb5XwJ3Y')
        expect(container.firstElementChild?.className).toContain('custom')
    })

    it('has no axe violations', async () => {
        const { container } = await renderEntries(
            <>
                {allMilestones().map((entry) => (
                    <TimelineMilestoneEntry key={entry.id} entry={entry} />
                ))}
            </>
        )

        const results = await axe.run(container)
        expect(results.violations).toEqual([])
    })
})
