import axe from 'axe-core'
import React from 'react'
import { userEvent } from 'vitest/browser'
import { formatCalendarDate } from '@/components/dhis2-value-display/calendar'
import eventChangelog from '../__tests__/fixtures/v43/event-changelog.json'
import {
    buttonIn,
    ChangeLogsSchema,
    elementIn,
    eventEntryOf,
    notFound,
    recordedEvent,
    recordedProgram,
    renderEntries,
    stageOf,
    type ProgramMetadata,
    type RenderOptions,
} from '../__tests__/fixtures/renderEntries'
import { TimelineEventAction } from './TimelineEventAction'
import {
    TimelineEventChanges,
    TimelineEventCompletedBy,
    TimelineEventEntry,
    TimelineEventNotes,
    TimelineEventOrgUnit,
    TimelineEventProgram,
    TimelineEventStage,
    TimelineEventStatus,
    TimelineEventValues,
} from './TimelineEventEntry'
import { useTimelineEventEntry } from './hooks/useTimelineEventEntry'

const AT_BIRTH = 'PFDfvmGpsR3'

const AllParts = () => (
    <>
        <TimelineEventStage />
        <TimelineEventStatus />
        <TimelineEventOrgUnit />
        <TimelineEventCompletedBy />
        <TimelineEventValues />
        <TimelineEventNotes />
        <TimelineEventChanges />
    </>
)

const renderEvent = (
    event: ReturnType<typeof recordedEvent>,
    parts: React.ReactNode = <AllParts />,
    options: RenderOptions & {
        /** Edits the program metadata the entry is resolved with. */
        metadata?: (metadata: ProgramMetadata) => void
        /** The program's metadata couldn't be read. */
        withoutMetadata?: boolean
    } = {}
) => {
    const entry = eventEntryOf(event, {
        program: options.withoutMetadata
            ? null
            : recordedProgram(options.metadata),
    })
    return renderEntries(
        <TimelineEventEntry entry={entry}>{parts}</TimelineEventEntry>,
        options
    )
}

describe('TimelineEventEntry', () => {
    it('shows stage name, status badge, org unit name and who completed it', async () => {
        const { container } = await renderEvent(recordedEvent('TlE2eEvt002'))

        await expect.poll(() => container.textContent).toContain('Ngelehun CHC')
        expect(container.textContent).toContain('First antenatal care visit')
        expect(container.querySelector('[data-slot=badge]')?.textContent).toBe(
            'Completed'
        )
        expect(container.textContent).toContain('Completed by admin')
    })

    it('shows the due date of a scheduled event', async () => {
        const { container } = await renderEvent(
            recordedEvent('TlE2eEvt006'),
            <>
                <TimelineEventStage />
                <TimelineEventStatus />
            </>
        )

        await expect
            .poll(() => container.textContent)
            .toContain(
                `Due ${formatCalendarDate('2027-01-15', 'gregorian', 'en')}`
            )
        expect(container.querySelector('[data-slot=badge]')?.textContent).toBe(
            'Scheduled'
        )
    })

    it('shows "Scheduled" and no date for a hideDueDate stage', async () => {
        const { container } = await renderEvent(
            recordedEvent('TlE2eEvt006'),
            <>
                <TimelineEventStage />
                <TimelineEventStatus />
            </>,
            {
                metadata: (metadata) => {
                    stageOf(metadata, AT_BIRTH).hideDueDate = true
                },
            }
        )

        await expect
            .poll(() => container.textContent)
            .toContain('Care at birth')
        expect(container.querySelector('[data-slot=badge]')?.textContent).toBe(
            'Scheduled'
        )
        expect(container.textContent).not.toContain('Due')
        expect(container.textContent).not.toContain('2027')
    })

    it("shows the stage id and the due date when the program's metadata couldn't be read", async () => {
        const { container } = await renderEvent(
            recordedEvent('TlE2eEvt006'),
            <>
                <TimelineEventStage />
                <TimelineEventStatus />
            </>,
            { withoutMetadata: true }
        )

        expect(container.textContent).toContain(AT_BIRTH)
        expect(container.textContent).toContain(
            `Due ${formatCalendarDate('2027-01-15', 'gregorian', 'en')}`
        )
    })

    it('shows the program name, for a history across programs', async () => {
        const { container } = await renderEvent(
            recordedEvent('TlE2eEvt002'),
            <TimelineEventProgram />
        )

        expect(container.textContent).toBe(recordedProgram().name)
    })

    it('renders the standard composition and host actions when given no children', async () => {
        const entry = eventEntryOf(recordedEvent('TlE2eEvt002'))
        const { container } = await renderEntries(
            <TimelineEventEntry
                entry={entry}
                actions={
                    <TimelineEventAction href="#open">Open</TimelineEventAction>
                }
                className="custom-event"
            />
        )

        const frame = elementIn(container, '[data-slot=timeline-event]')
        expect(frame.className).toContain('custom-event')
        expect(frame.textContent).toContain('First antenatal care visit')
        expect(frame.textContent).toContain('Ngelehun CHC')
        // Host actions close the action row and look like the part toggles.
        const open = elementIn(
            frame,
            '[data-slot=timeline-event-actions]'
        ).lastElementChild
        expect(open?.tagName).toBe('A')
        const toggle = getComputedStyle(buttonIn(frame))
        expect(toggle.backgroundImage).toBe('none')
        expect(open && getComputedStyle(open).font).toBe(toggle.font)
    })

    it('offers no changes for an event never edited and holding no values', async () => {
        const scheduled = await renderEvent(
            recordedEvent('TlE2eEvt006'),
            <TimelineEventChanges />
        )
        const edited = await renderEvent(
            recordedEvent('TlE2eEvt004'),
            <TimelineEventChanges />
        )

        expect(scheduled.container.querySelector('button')).toBeNull()
        expect(edited.container.querySelector('button')?.textContent).toBe(
            'Show changes'
        )
    })

    it('labels an overdue event', async () => {
        const { container } = await renderEvent(
            recordedEvent('TlE2eEvt005'),
            <TimelineEventStatus />
        )

        expect(container.querySelector('[data-slot=badge]')?.textContent).toBe(
            'Overdue'
        )
    })

    it('renders a skipped event muted', async () => {
        const stage = <TimelineEventStage />
        const skipped = await renderEvent(recordedEvent('TlE2eEvt003'), stage)
        const active = await renderEvent(recordedEvent('TlE2eEvt004'), stage)
        await expect
            .poll(() => skipped.container.querySelector('[data-status] span'))
            .not.toBeNull()
        await expect
            .poll(() => active.container.querySelector('[data-status] span'))
            .not.toBeNull()

        const styleOf = (container: HTMLElement) =>
            getComputedStyle(elementIn(container, '[data-status] span'))
        const frameColor = (container: HTMLElement) =>
            getComputedStyle(elementIn(container, '[data-status]')).color
        // The frame mutes what a host composes without TimelineEventStage.
        expect(frameColor(skipped.container)).not.toBe(
            frameColor(active.container)
        )
        expect(Number(styleOf(skipped.container).fontWeight)).toBeLessThan(
            Number(styleOf(active.container).fontWeight)
        )
        expect(styleOf(skipped.container).color).not.toBe(
            styleOf(active.container).color
        )
    })

    it('labels a skipped event', async () => {
        const { container } = await renderEvent(
            recordedEvent('TlE2eEvt003'),
            <TimelineEventStatus />
        )

        expect(container.querySelector('[data-slot=badge]')?.textContent).toBe(
            'Skipped'
        )
    })

    it('gives a host-composed child the entry through useTimelineEventEntry', async () => {
        const Open = () => (
            <a href={`#/event/${useTimelineEventEntry().data.event.event}`}>
                Open
            </a>
        )
        const { container } = await renderEvent(
            recordedEvent('TlE2eEvt004'),
            <Open />
        )

        expect(container.querySelector('a')?.getAttribute('href')).toBe(
            '#/event/TlE2eEvt004'
        )
    })

    it('renders only the parts the host composes', async () => {
        const { container } = await renderEvent(
            recordedEvent('TlE2eEvt002'),
            <TimelineEventStage />
        )

        await expect
            .poll(() => container.textContent)
            .toContain('First antenatal care visit')
        expect(container.querySelector('[data-slot=badge]')).toBeNull()
        expect(container.querySelector('button')).toBeNull()
        expect(container.textContent).not.toContain('Completed')
    })

    it('fetches changes only when "Show changes" is pressed, and works by keyboard', async () => {
        const { promise: changesGate, resolve: release } =
            Promise.withResolvers<void>()
        const { container, changelogRequests, queryClient } = await renderEvent(
            recordedEvent('TlE2eEvt004'),
            <TimelineEventChanges />,
            {
                changesGate,
                changelogs: {
                    TlE2eEvt004: ChangeLogsSchema.parse(eventChangelog),
                },
            }
        )
        const button = buttonIn(container)

        await queryClient.invalidateQueries()
        expect(changelogRequests).toHaveLength(0)
        expect(button.textContent).toBe('Show changes')
        expect(button.getAttribute('aria-expanded')).toBe('false')

        button.focus()
        await userEvent.keyboard('{Enter}')

        await expect.poll(() => changelogRequests).toEqual(['TlE2eEvt004'])
        await expect
            .poll(() => container.textContent)
            .toContain('Loading changes')
        release()
        await expect
            .poll(() => container.textContent)
            .toContain('John Traore changed')
        expect(changelogRequests).toEqual(['TlE2eEvt004'])
        expect(button.textContent).toBe('Hide changes')
        expect(button.getAttribute('aria-expanded')).toBe('true')
        expect(container.textContent).toContain('Gestational age at visit')
        expect(container.textContent).toContain('24 → 26')

        await userEvent.keyboard('{Enter}')
        expect(container.textContent).not.toContain('John Traore changed')
        expect(button.textContent).toBe('Show changes')
    })

    it('says changes are unavailable when the changelog endpoint is missing', async () => {
        const { container } = await renderEvent(
            recordedEvent('TlE2eEvt004'),
            <TimelineEventChanges />,
            { changelogErrors: { TlE2eEvt004: notFound() } }
        )

        buttonIn(container).click()

        await expect
            .poll(() => container.textContent)
            .toContain("Changes aren't available on this DHIS2 version.")
    })

    it('notes that older changes are not shown when the changelog was cut short', async () => {
        const page = ChangeLogsSchema.parse({
            changeLogs: Array.from({ length: 100 }, (_, index) => ({
                change: {
                    dataValue: { dataElement: `de${index}`, currentValue: '1' },
                },
                createdAt: `2026-10-22T12:00:00.${String(index).padStart(3, '0')}`,
                createdBy: { username: 'admin' },
                type: 'CREATE',
            })),
        })
        const { container } = await renderEvent(
            recordedEvent('TlE2eEvt004'),
            <TimelineEventChanges />,
            { changelogs: { TlE2eEvt004: page } }
        )

        buttonIn(container).click()

        await expect
            .poll(() => container.textContent)
            .toContain("Older changes aren't shown.")
    })

    it('does not say so when every change is shown', async () => {
        const { container } = await renderEvent(
            recordedEvent('TlE2eEvt004'),
            <TimelineEventChanges />,
            {
                changelogs: {
                    TlE2eEvt004: ChangeLogsSchema.parse(eventChangelog),
                },
            }
        )

        buttonIn(container).click()

        await expect
            .poll(() => container.textContent)
            .toContain('John Traore changed')
        expect(container.textContent).not.toContain('Older changes')
    })

    it('shows a single note as it is, dated when written on another day', async () => {
        const { container } = await renderEvent(
            recordedEvent('TlE2eEvt001'),
            <TimelineEventNotes />
        )
        const note = recordedEvent('TlE2eEvt001').notes[0].value

        expect(container.querySelector('button')).toBeNull()
        expect(container.textContent).toContain(note)
        expect(container.textContent).toContain('John Traore')
        // The event is from 15 Jan; the note was written on 22 Oct.
        expect(container.querySelector('time')?.textContent?.trim()).toBe(
            `${formatCalendarDate('2026-10-22', 'gregorian', 'en')} 19:11`
        )
    })

    it('shows only the time of a note written on the event day', async () => {
        const base = recordedEvent('TlE2eEvt001')
        const { container } = await renderEvent(
            {
                ...base,
                notes: [{ ...base.notes[0], storedAt: '2026-01-15T09:05:00' }],
            },
            <TimelineEventNotes />
        )

        expect(container.querySelector('time')?.textContent?.trim()).toBe(
            '09:05'
        )
    })

    it('expands several notes from the count, and shows nothing for none', async () => {
        const base = recordedEvent('TlE2eEvt001')
        const two = await renderEvent(
            {
                ...base,
                notes: [base.notes[0], { ...base.notes[0], note: 'n2' }],
            },
            <TimelineEventNotes />
        )
        const none = await renderEvent(
            recordedEvent('TlE2eEvt004'),
            <TimelineEventNotes />
        )
        const button = buttonIn(two.container)

        expect(button.textContent).toBe('2 notes')
        expect(two.container.textContent).not.toContain(base.notes[0].value)

        button.click()

        await expect
            .poll(() => two.container.textContent)
            .toContain(base.notes[0].value)
        expect(button.textContent).toBe('Hide notes')
        expect(button.getAttribute('aria-expanded')).toBe('true')
        expect(none.container.querySelector('button')).toBeNull()
    })

    it('renders events of one repeatable stage used for every visit kind without special cases', async () => {
        const events = (
            await import('../__tests__/fixtures/ugly/one-stage-every-visit.json')
        ).default.events
        const parsed = events.slice(0, 3).map((raw) => ({
            ...recordedEvent('TlE2eEvt002'),
            ...raw,
            dataValues: [],
            notes: [],
        }))
        const entries = parsed.map((event) => eventEntryOf(event))
        const { container } = await renderEntries(
            <>
                {entries.map((entry) => (
                    <TimelineEventEntry key={entry.id} entry={entry}>
                        <AllParts />
                    </TimelineEventEntry>
                ))}
            </>
        )

        expect(
            container.querySelectorAll('[data-slot=timeline-event]')
        ).toHaveLength(3)
        expect(container.querySelectorAll('[data-slot=badge]')).toHaveLength(3)
    })

    it.each(['TlE2eEvt001', 'TlE2eEvt003', 'TlE2eEvt005', 'TlE2eEvt006'])(
        'has no axe violations for event %s',
        async (id) => {
            const { container } = await renderEvent(
                recordedEvent(id),
                <AllParts />,
                {
                    changelogs: { [id]: { changeLogs: [] } },
                }
            )
            await expect
                .poll(() => container.textContent)
                .toContain('Ngelehun CHC')
            container
                .querySelectorAll('button')
                .forEach((button) => button.click())
            // An event never edited and holding no values offers no changes.
            if (container.querySelector('[data-slot=timeline-event-changes]')) {
                await expect
                    .poll(() => container.textContent)
                    .toContain('No changes')
            }

            const results = await axe.run(container)
            expect(results.violations).toEqual([])
        }
    )
})
