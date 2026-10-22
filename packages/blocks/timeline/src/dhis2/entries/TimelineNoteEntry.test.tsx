import axe from 'axe-core'
import React from 'react'
import type { TimelineEntry } from '../../core/types'
import {
    buttonIn,
    elementIn,
    renderEntries,
} from '../__fixtures__/renderEntries'
import { TrackedEntitySchema } from '../schemas'
import type { NoteEntryData } from '../useEnrollmentSources'
import { TimelineNoteEntry } from './TimelineNoteEntry'

const noteEntry = (value: string): TimelineEntry<NoteEntryData> => {
    const [enrollment] = TrackedEntitySchema.parse({
        trackedEntity: 'TlE2eTei001',
        enrollments: [
            {
                enrollment: 'TlE2eEnr002',
                program: 'WSGAb5XwJ3Y',
                status: 'ACTIVE',
                notes: [
                    {
                        note: 'TlE2eNot002',
                        value,
                        storedAt: '2026-10-22T19:11:40.197',
                        storedBy: 'admin',
                        createdBy: {
                            username: 'admin',
                            displayName: 'John Traore',
                        },
                    },
                ],
            },
        ],
    }).enrollments
    return {
        id: 'notes:TlE2eNot002',
        at: '2026-10-22T19:11:40.197',
        precision: 'instant',
        sourceKey: 'notes',
        data: { enrollment: enrollment.enrollment, note: enrollment.notes[0] },
    }
}

const LONG = 'The household moved to the next district. '.repeat(30)

describe('TimelineNoteEntry', () => {
    it('shows the note text, its author and the time', async () => {
        const { container } = await renderEntries(
            <TimelineNoteEntry
                entry={noteEntry('Referred from the outreach team.')}
            />
        )

        const text = container.textContent ?? ''
        expect(text).toContain('Referred from the outreach team.')
        expect(text).toContain('John Traore')
        expect(container.querySelector('time')?.textContent).toBe('19:11')
        expect(container.querySelector('button')).toBeNull()
    })

    it('clamps a long note with "Show more"', async () => {
        const { container } = await renderEntries(
            <TimelineNoteEntry entry={noteEntry(LONG)} />
        )
        const text = elementIn(container, '[data-slot=note-text]')

        await expect
            .poll(() => container.querySelector('button')?.textContent)
            .toBe('Show more')
        const clamped = text.getBoundingClientRect().height
        const button = buttonIn(container)
        expect(button.getAttribute('aria-expanded')).toBe('false')

        button.click()

        await expect
            .poll(() => text.getBoundingClientRect().height)
            .toBeGreaterThan(clamped)
        expect(button.getAttribute('aria-expanded')).toBe('true')
        expect(button.textContent).toBe('Show less')
    })

    it('has no axe violations', async () => {
        const { container } = await renderEntries(
            <TimelineNoteEntry entry={noteEntry(LONG)} />
        )
        await expect
            .poll(() => container.querySelector('button'))
            .not.toBeNull()

        const results = await axe.run(container)
        expect(results.violations).toEqual([])
    })
})
