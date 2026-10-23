import axe from 'axe-core'
import React from 'react'
import { formatCalendarDate } from '@/components/dhis2-value-display/calendar'
import { Timeline } from '@/components/timeline/ui/Timeline'
import { TimelineFeed } from '@/components/timeline/ui/TimelineFeed'
import { groupChangelogRows } from '../changelog'
import { attributesOf } from '../metadata'
import type { ChangeLogRow } from '../schemas'
import { changeEntries } from '../toEntries'
import type { ChangeSave, ChangeEntryData } from '../types'
import {
    NOW,
    recordedProgram,
    renderEntries,
    type ProgramMetadata,
    type RenderOptions,
} from '../__tests__/fixtures/renderEntries'
import {
    TimelineChangeEntry,
    TimelineChangeList,
    TimelineChangeSummary,
    TimelineSave,
    TimelineSaves,
    useTimelineSave,
} from './TimelineChangeEntry'

const CREATED_AT = '2026-10-22T19:11:40.388'

const row = (
    kind: ChangeLogRow['change']['kind'],
    id: string,
    type: ChangeLogRow['type'],
    previousValue?: string,
    currentValue?: string
): ChangeLogRow => ({
    createdAt: CREATED_AT,
    createdBy: {
        uid: undefined,
        username: 'admin',
        firstName: 'John',
        surname: 'Traore',
        displayName: undefined,
    },
    type,
    change: { kind, id, previousValue, currentValue },
})

/** One save, labelled from the recorded program as the hooks label it. */
const saveOf = (
    rows: ChangeLogRow[],
    edit?: (metadata: ProgramMetadata) => void
): ChangeSave => {
    const program = recordedProgram(edit)
    const attributes = attributesOf([program])
    const [save] = groupChangelogRows(rows, (field) =>
        field.kind === 'attribute'
            ? attributes.get(field.id)
            : [...program.stages.values()]
                  .map((stage) => stage.dataElements.get(field.id))
                  .find((info) => info !== undefined)
    )
    if (save === undefined) {
        throw new Error('no save')
    }
    return save
}

const group = (...rows: ChangeLogRow[]) => saveOf(rows)

const renderGroup = (value: ChangeSave, options: RenderOptions = {}) =>
    renderEntries(
        <TimelineSave save={value}>
            <TimelineChangeSummary />
            <TimelineChangeList />
        </TimelineSave>,
        options
    )

describe('TimelineChangeEntry', () => {
    it('shows rendered before → after values, with option names and calendar dates', async () => {
        const date = (day: string) => formatCalendarDate(day, 'gregorian', 'en')
        const { container } = await renderGroup(
            saveOf(
                [
                    row(
                        'dataElement',
                        'mrVkW9h2Rdp',
                        'UPDATE',
                        'Live born',
                        'Antepartum stillbirth'
                    ),
                    row(
                        'attribute',
                        'gHGyrwKPzej',
                        'UPDATE',
                        '2026-03-05',
                        '2026-03-12'
                    ),
                    row('dataElement', 'roKuXYfw1BW', 'UPDATE', '24', '26'),
                ],
                (metadata) => {
                    const element = metadata.programStages
                        .flatMap((stage) => stage.programStageDataElements)
                        .find((e) => e.dataElement.id === 'mrVkW9h2Rdp')
                    const option = element?.dataElement.optionSet?.options[0]
                    if (option) option.displayName = 'Live birth'
                }
            )
        )

        await expect
            .poll(() => container.textContent)
            .toContain('Live birth → Antepartum stillbirth')
        expect(container.textContent).toContain(
            `${date('2026-03-05')} → ${date('2026-03-12')}`
        )
        expect(container.textContent).not.toContain('2026-03-05')
        expect(container.textContent).toContain('24 → 26')
    })

    it('shows (empty) for created and deleted values', async () => {
        const { container } = await renderGroup(
            group(
                row('dataElement', 'roKuXYfw1BW', 'CREATE', undefined, '24'),
                row('dataElement', 'dyYdfamSY2Z', 'DELETE', '13')
            )
        )

        await expect.poll(() => container.textContent).toContain('(empty) → 24')
        expect(container.textContent).toContain('13 → (empty)')
    })

    it('labels attributes and data elements by name, and unknown fields by id', async () => {
        const { container } = await renderGroup(
            group(
                row('attribute', 'w75KJ2mc4zz', 'UPDATE', 'Amina', 'Aminata'),
                row('dataElement', 'roKuXYfw1BW', 'UPDATE', '24', '26'),
                row('dataElement', 'unknownEl01', 'CREATE', undefined, 'x'),
                row('eventField', 'scheduledAt', 'UPDATE', 'a', 'b'),
                row('eventField', 'unknownField', 'UPDATE', 'a', 'b')
            )
        )

        await expect.poll(() => container.textContent).toContain('First name')
        const labels = [
            ...container.querySelectorAll('[data-slot=timeline-change-field]'),
        ].map((field) => field.textContent)
        expect(labels).toEqual([
            'First name',
            'Gestational age at visit',
            'unknownEl01',
            'Due date',
            'unknownField',
        ])
    })

    it.each(['gregorian', 'ethiopian'] as const)(
        'shows an event date in the %s system calendar',
        async (calendar) => {
            const { container } = await renderGroup(
                group(
                    row(
                        'eventField',
                        'occurredAt',
                        'CREATE',
                        undefined,
                        '2026-06-12 00:00:00.000'
                    )
                ),
                { calendar }
            )
            const expected = formatCalendarDate('2026-06-12', calendar, 'en')

            await expect
                .poll(() => container.textContent)
                .toContain(`Event date(empty) → ${expected}`)
            expect(container.textContent).not.toContain('00:00')
        }
    )

    it('shows the time of an event date that has one, and labels other event fields', async () => {
        const { container } = await renderGroup(
            group(
                row(
                    'eventField',
                    'completedAt',
                    'UPDATE',
                    '2026-06-12 09:30:00.000',
                    '2026-06-13 00:00:00.000'
                ),
                row('eventField', 'geometry', 'UPDATE', undefined, '[1.5,2.5]')
            )
        )

        const day = (value: string) =>
            formatCalendarDate(value, 'gregorian', 'en')
        await expect
            .poll(() => container.textContent)
            .toContain(
                `Completed date${day('2026-06-12')} 09:30 → ${day('2026-06-13')}`
            )
        expect(container.textContent).toContain('Coordinates')
        expect(container.textContent).toContain('2.5, 1.5')
    })

    it('renders as an entry in a TimelineFeed without axe violations', async () => {
        const entries = changeEntries([
            group(
                row('attribute', 'w75KJ2mc4zz', 'UPDATE', 'Amina', 'Aminata')
            ),
        ])
        const { container } = await renderEntries(
            <Timeline entries={entries} calendar="gregorian" now={NOW}>
                <TimelineFeed<ChangeEntryData>>
                    {(entry) => (
                        <TimelineChangeEntry entry={entry} className="custom" />
                    )}
                </TimelineFeed>
            </Timeline>
        )

        expect(container.textContent).toContain('First name')
        expect(container.textContent).toContain('John Traore changed 1 field')
        expect(
            container.querySelector('li [data-slot=timeline-change]')?.className
        ).toContain('custom')
        const results = await axe.run(container)
        expect(results.violations).toEqual([])
    })

    it('lists several saves with TimelineSaves', async () => {
        const saves = groupChangelogRows([
            {
                ...row('attribute', 'a', 'UPDATE', '1', '2'),
                createdAt: '2026-10-22T10:00',
            },
            {
                ...row('attribute', 'b', 'UPDATE', '1', '2'),
                createdAt: '2026-10-22T11:00',
            },
        ])
        const { container } = await renderEntries(
            <TimelineSaves saves={saves} />
        )

        expect(
            [
                ...container.querySelectorAll(
                    '[data-slot=timeline-change-field]'
                ),
            ].map((field) => field.textContent)
        ).toEqual(['b', 'a'])
    })

    it('summarises one save, singular and plural', async () => {
        const one = await renderGroup(
            group(row('dataElement', 'roKuXYfw1BW', 'UPDATE', '24', '26'))
        )
        const two = await renderGroup(
            group(
                row('dataElement', 'roKuXYfw1BW', 'UPDATE', '24', '26'),
                row('dataElement', 'dyYdfamSY2Z', 'DELETE', '13')
            )
        )

        expect(one.container.textContent).toContain(
            'John Traore changed 1 field'
        )
        expect(one.container.textContent).not.toContain('1 fields')
        expect(two.container.textContent).toContain(
            'John Traore changed 2 fields'
        )
    })

    it('gives a host-composed child the save through useTimelineSave', async () => {
        const Who = () => <b>{useTimelineSave().user.username}</b>
        const { container } = await renderEntries(
            <TimelineSave save={group(row('attribute', 'a', 'UPDATE'))}>
                <Who />
            </TimelineSave>
        )

        expect(container.querySelector('b')?.textContent).toBe('admin')
    })

    it('has no axe violations', async () => {
        const { container } = await renderGroup(
            group(
                row('attribute', 'w75KJ2mc4zz', 'UPDATE', 'Amina', 'Aminata'),
                row('dataElement', 'dyYdfamSY2Z', 'DELETE', '13')
            )
        )
        await expect.poll(() => container.textContent).toContain('First name')

        const results = await axe.run(container)
        expect(results.violations).toEqual([])
    })
})
