import axe from 'axe-core'
import React from 'react'
import { formatCalendarDate } from '@/registry/dhis2/value-display/calendar'
import type { ChangeGroup, ChangeRow } from '../changelog'
import { renderEntries } from '../__fixtures__/renderEntries'
import {
    TimelineChangeEntry,
    TimelineChangeList,
    TimelineChangeSummary,
    useTimelineChangeEntry,
} from './TimelineChangeEntry'

const group = (...changes: ChangeRow[]): ChangeGroup => ({
    id: '2026-10-22T19:11:40.388:admin',
    createdAt: '2026-10-22T19:11:40.388',
    user: { username: 'admin', displayName: 'John Traore' },
    changes,
})

const row = (
    kind: ChangeRow['field']['kind'],
    id: string,
    type: ChangeRow['type'],
    previousValue?: string,
    currentValue?: string
): ChangeRow => ({ field: { kind, id }, type, previousValue, currentValue })

const renderGroup = (
    value: ChangeGroup,
    options: Parameters<typeof renderEntries>[1] = {}
) =>
    renderEntries(
        <li>
            <TimelineChangeEntry group={value}>
                <TimelineChangeSummary />
                <TimelineChangeList />
            </TimelineChangeEntry>
        </li>,
        options
    )

describe('TimelineChangeEntry', () => {
    it('shows rendered before → after values, with option names and calendar dates', async () => {
        const date = (day: string) => formatCalendarDate(day, 'gregorian', 'en')
        const { container } = await renderGroup(
            group(
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
                row('dataElement', 'roKuXYfw1BW', 'UPDATE', '24', '26')
            ),
            {
                metadata: (metadata) => {
                    const element = metadata.programStages
                        .flatMap((stage) => stage.programStageDataElements)
                        .find((e) => e.dataElement.id === 'mrVkW9h2Rdp')
                    const option = element?.dataElement.optionSet?.options[0]
                    if (option) option.displayName = 'Live birth'
                },
            }
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
                row('eventField', 'scheduledAt', 'UPDATE', 'a', 'b')
            )
        )

        await expect.poll(() => container.textContent).toContain('First name')
        const labels = [...container.querySelectorAll('li li')].map(
            (item) =>
                item.querySelector('[data-slot=change-field]')?.textContent
        )
        expect(labels).toEqual([
            'First name',
            'Gestational age at visit',
            'unknownEl01',
            'scheduledAt',
        ])
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

    it('gives a host-composed child the group through useTimelineChangeEntry', async () => {
        const Who = () => <b>{useTimelineChangeEntry().user.username}</b>
        const { container } = await renderEntries(
            <li>
                <TimelineChangeEntry group={group()}>
                    <Who />
                </TimelineChangeEntry>
            </li>
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
