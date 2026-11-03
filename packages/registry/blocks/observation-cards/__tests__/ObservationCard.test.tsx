import axe from 'axe-core'
import React from 'react'
import { page } from 'vitest/browser'
import { ObservationCard } from '..'
import { DE, march, NORMAL, PROGRAM, renderWith } from './support'

const NOW = new Date('2026-06-01T12:00:00.000Z')

const cardOf = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('[data-slot="observation-card"]')

const slot = (container: HTMLElement, name: string) =>
    container.querySelector<HTMLElement>(`[data-slot="${name}"]`)

describe('ObservationCard states', () => {
    it('pending shows a skeleton and the label is not yet known', async () => {
        // An empty label is no label.
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} label="" />,
            {},
            'pending'
        )
        expect(
            container.querySelectorAll('[data-slot="skeleton"]').length
        ).toBeGreaterThan(0)
        expect(container.querySelector('[role="heading"]')).toBeNull()
        expect(cardOf(container)?.getAttribute('aria-busy')).toBe('true')
        expect(cardOf(container)?.hasAttribute('aria-label')).toBe(false)
        expect(container.textContent).toContain('Loading')
        expect(container.textContent).not.toContain('Never recorded')
    })

    it('pending shows the label when the host supplies one', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} label="Haemoglobin" />,
            {},
            'pending'
        )
        expect(container.querySelector('[role="heading"]')?.textContent).toBe(
            'Haemoglobin'
        )
        expect(
            container.querySelectorAll('[data-slot="skeleton"]').length
        ).toBeGreaterThan(0)
    })

    it('error shows "Couldn\'t load this value", named from the metadata', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} />,
            {},
            'error'
        )
        expect(container.textContent).toContain("Couldn't load this value")
        expect(container.textContent).not.toContain('Never recorded')
        expect(
            slot(container, 'observation-error')?.querySelector('svg')
        ).not.toBeNull()
        expect(cardOf(container)?.getAttribute('aria-label')).toBe(
            'Haemoglobin'
        )
    })

    it('a misconfigured card shows the full setup message in development', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} label="Haemoglobin" />,
            {},
            'misconfigured'
        )
        const message = slot(container, 'observation-config-error')
        expect(message?.getAttribute('role')).toBe('alert')
        expect(message?.textContent).toBe(
            `Data element ${DE} is not captured by any stage of program ${PROGRAM}. Captured data elements: none`
        )
        expect(container.querySelector('[role="heading"]')?.textContent).toBe(
            'Haemoglobin'
        )
        expect(container.textContent).not.toContain('Never recorded')
    })

    it('an empty series shows "Never recorded"', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} />
        )
        expect(container.textContent).toContain('Never recorded')
        expect(container.querySelector('[data-slot="chart"]')).toBeNull()
        expect(slot(container, 'observation-recorded')).toBeNull()
    })

    it('partial with no readings keeps the note beside "Never recorded"', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} />,
            { partial: true }
        )
        expect(container.textContent).toContain('Never recorded')
        expect(container.textContent).toContain(
            'Some visits are hidden by your access'
        )
    })

    it('an unsupported type shows "This value type can\'t be shown here" with the label and date', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} />,
            {
                label: 'Location',
                valueType: 'COORDINATE',
                readings: [{ value: '[1,2]', day: '2026-03-12' }],
            }
        )
        expect(container.textContent).toContain(
            "This value type can't be shown here"
        )
        expect(container.textContent).not.toContain('[1,2]')
        expect(container.querySelector('[role="heading"]')?.textContent).toBe(
            'Location'
        )
        expect(container.textContent).toContain(
            'Recorded Mar 12, 2026 · Antenatal visit'
        )
    })
})

describe('the default arrangement', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('a card without children picks the trend arrangement for numeric types and the last recorded one otherwise', async () => {
        const numeric = await renderWith(<ObservationCard dataElement={DE} />, {
            readings: march(9, 10, 16),
            legends: [NORMAL],
        })
        expect(
            [
                ...numeric.container.querySelectorAll(
                    '[data-slot^="observation-"]'
                ),
            ].map((element) => element.getAttribute('data-slot'))
        ).toEqual([
            'observation-card',
            'observation-label',
            'observation-value',
            'observation-legend',
            'observation-change',
            'observation-sparkline',
            'observation-recorded',
        ])
        // The legend shares the value's row, so a wrapped legend never lowers the value.
        expect(
            slot(numeric.container, 'observation-legend')?.parentElement
        ).toBe(slot(numeric.container, 'observation-value')?.parentElement)
        await numeric.unmount()

        const text = await renderWith(<ObservationCard dataElement={DE} />, {
            label: 'Note',
            valueType: 'TEXT',
            readings: [
                { value: 'First', day: '2026-03-01' },
                { value: 'Second', day: '2026-03-02' },
            ],
        })
        expect(
            [
                ...text.container.querySelectorAll(
                    '[data-slot^="observation-"]'
                ),
            ].map((element) => element.getAttribute('data-slot'))
        ).toEqual([
            'observation-card',
            'observation-label',
            'observation-value',
            'observation-recorded',
        ])
        expect(text.container.textContent).not.toContain('since')
    })

    it('normal shows value with unit, badge, change, recorded line and sparkline', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} unit="g/dL" />,
            {
                readings: [
                    { value: '9', day: '2026-03-01' },
                    { value: '10', day: '2026-03-08' },
                    { value: '16', day: '2026-03-12' },
                ],
                legends: [NORMAL],
            }
        )
        const text = container.textContent ?? ''
        expect(text).toContain('Haemoglobin')
        expect(slot(container, 'value-text')?.textContent).toBe('16')
        expect(text).toContain('g/dL')
        expect(
            container.querySelector('[data-slot="badge"]')?.textContent
        ).toBe('Normal')
        expect(text).toContain('up 6 g/dL since Mar 8, 2026')
        expect(text).toContain('Recorded Mar 12, 2026 · Antenatal visit')
        expect(text).not.toContain('hidden by your access')
        await expect
            .poll(() => container.querySelector('[data-slot="chart"]'))
            .not.toBeNull()
    })

    it('falling change shows a down arrow and the absolute value', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} />,
            {
                readings: [
                    { value: '12.5', day: '2026-03-01' },
                    { value: '10', day: '2026-03-05' },
                ],
            }
        )
        expect(container.textContent).toContain('down 2.5 since Mar 1, 2026')
        expect(container.textContent).not.toContain('-2.5')
    })

    it('says the direction in words for screen readers and hides the arrow', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} />,
            { readings: march(10, 12) }
        )
        const arrow = slot(container, 'change-arrow')
        expect(arrow?.getAttribute('aria-hidden')).toBe('true')
        expect(arrow?.querySelector('svg')).not.toBeNull()
        expect(
            [...container.querySelectorAll('.sr-only')].map(
                (element) => element.textContent
            )
        ).toContain('up')
    })

    it('no change between readings says so', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} />,
            { readings: march(10, 10) }
        )
        expect(container.textContent).toContain('No change since Mar 1, 2026')
        expect(slot(container, 'change-arrow')).toBeNull()
    })

    it('single reading shows no change line and draws no sparkline', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} />,
            { readings: march(10) }
        )
        expect(container.textContent).not.toContain('since')
        expect(container.textContent).toContain('Recorded Mar 1, 2026')
        expect(container.querySelector('[data-slot="chart"]')).toBeNull()
    })

    it('partial shows "Some visits are hidden by your access"', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} />,
            { readings: march(10), partial: true }
        )
        expect(container.textContent).toContain(
            'Some visits are hidden by your access'
        )
    })

    it('label prop overrides the data element label and names the card', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} label="Hb" />,
            { readings: march(10) }
        )
        expect(container.querySelector('[role="heading"]')?.textContent).toBe(
            'Hb'
        )
        expect(container.textContent).not.toContain('Haemoglobin')
        await expect
            .element(page.getByRole('group', { name: 'Hb' }))
            .toBeInTheDocument()
    })

    it('names the card by its label for screen readers', async () => {
        // An empty label is no label: the element's own name is used.
        await renderWith(<ObservationCard dataElement={DE} label="" />, {
            readings: march(10),
        })
        await expect
            .element(page.getByRole('group', { name: 'Haemoglobin' }))
            .toBeInTheDocument()
    })

    it('shows a value outside every legend with no badge', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} />,
            { readings: march(30), legends: [NORMAL] }
        )
        expect(container.textContent).toContain('30')
        expect(container.querySelector('[data-slot="badge"]')).toBeNull()
    })

    it('shows an apostrophe and an ampersand in the stage name literally', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} />,
            {
                readings: [
                    {
                        value: '10',
                        day: '2026-03-01',
                        stage: "Child's visit & labour",
                    },
                ],
            }
        )
        expect(container.textContent).toContain(
            "Recorded Mar 1, 2026 · Child's visit & labour"
        )
        expect(container.textContent).not.toContain('&#39;')
        expect(container.textContent).not.toContain('&amp;')
    })

    it('shows the value as it was recorded', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} />,
            { readings: march(71.456) }
        )
        expect(slot(container, 'value-text')?.textContent).toBe('71.456')
    })

    it('option value shows the option name in a badge with its colour', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} />,
            {
                label: 'Blood group',
                valueType: 'TEXT',
                readings: [{ value: 'B_POS', day: '2026-03-12' }],
                options: [
                    { code: 'A_POS', name: 'A positive' },
                    { code: 'B_POS', name: 'B positive', color: '#ff0000' },
                ],
            }
        )
        const badge = container.querySelector<HTMLElement>(
            '[data-slot="badge"]'
        )
        expect(badge?.textContent).toBe('B positive')
        expect(badge?.style.backgroundColor).toBe('rgb(255, 0, 0)')
        expect(container.textContent).toContain(
            'Recorded Mar 12, 2026 · Antenatal visit'
        )
    })

    it('option code missing from the option set shows the raw code', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} />,
            {
                valueType: 'TEXT',
                readings: [{ value: 'GONE', day: '2026-03-12' }],
                options: [{ code: 'A_POS', name: 'A positive' }],
            }
        )
        expect(
            container.querySelector('[data-slot="badge"]')?.textContent
        ).toBe('GONE')
    })

    it('TRUE_ONLY unticked at last visit shows Not recorded with the last Yes', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} />,
            {
                label: 'HIV positive',
                valueType: 'TRUE_ONLY',
                readings: [
                    { value: 'true', day: '2026-02-01' },
                    { value: 'false', day: '2026-03-12' },
                ],
            }
        )
        expect(slot(container, 'value-text')?.textContent).toBe('Not recorded')
        expect(slot(container, 'observation-change')?.textContent).toBe(
            'Last recorded Yes on Feb 1, 2026'
        )
        expect(container.textContent).toContain('Recorded Mar 12, 2026')
    })

    it('no unit after a value that is not a number', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} unit="kg" />,
            {
                valueType: 'BOOLEAN',
                readings: [{ value: 'true', day: '2026-03-12' }],
            }
        )
        expect(container.textContent).toContain('Yes')
        expect(container.textContent).not.toContain('kg')
    })

    it('DATE value shows the formatted date', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} />,
            {
                valueType: 'DATE',
                readings: [{ value: '2026-01-05', day: '2026-03-12' }],
            }
        )
        expect(slot(container, 'value-text')?.textContent).toBe('Jan 5, 2026')
    })

    it('text value shows the text as plain text with no badge', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} />,
            {
                valueType: 'TEXT',
                readings: [{ value: 'Mild anaemia', day: '2026-03-12' }],
            }
        )
        expect(container.textContent).toContain('Mild anaemia')
        expect(container.querySelector('[data-slot="badge"]')).toBeNull()
    })

    it.each(['TEXT', 'LONG_TEXT'])(
        '%s renders at body size, clamped to three lines',
        async (valueType) => {
            const { container } = await renderWith(
                <ObservationCard dataElement={DE} />,
                {
                    valueType,
                    readings: [
                        {
                            value: 'Refer to the district hospital',
                            day: '2026-03-12',
                        },
                    ],
                }
            )
            const value = slot(container, 'value-text')
            expect(value?.classList).toContain('text-base')
            expect(value?.classList).toContain('line-clamp-3')
            expect(value?.classList).not.toContain('text-3xl')
        }
    )

    it('a number keeps the large size', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} />,
            { readings: march(16) }
        )
        const value = slot(container, 'value-text')
        expect(value?.classList).toContain('text-3xl')
        expect(value?.classList).not.toContain('line-clamp-3')
    })

    const bloodGroup = {
        label: 'Blood group',
        valueType: 'TEXT',
        readings: [{ value: 'O+', day: '2026-03-12' }],
    }

    it('stale point has the stale style and an "over {n} days ago" note', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(NOW)
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} staleAfterDays={30} />,
            bloodGroup
        )
        expect(cardOf(container)?.getAttribute('data-tone')).toBe('stale')
        expect(container.textContent).toContain(
            'Out of date: last recorded over 30 days ago'
        )
    })

    it('stale point mutes the value and shows the note as a warning', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(NOW)
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} staleAfterDays={30} />,
            bloodGroup
        )
        expect(cardOf(container)?.classList).toContain('text-dhis2-grey-600')
        const note = slot(container, 'stale-note')
        expect(note?.classList).toContain('text-dhis2-yellow-800')
        expect(note?.querySelector('[aria-hidden="true"] svg')).not.toBeNull()
        // Sighted users read "Out of date"; a screen reader hears the threshold.
        expect(
            [...(note?.querySelectorAll('[aria-hidden="true"]') ?? [])]
                .map((part) => part.textContent)
                .join('')
        ).toBe('Out of date')
        expect(note?.querySelector('.sr-only')?.textContent).toBe(
            'Out of date: last recorded over 30 days ago'
        )
        expect(slot(container, 'observation-recorded')?.classList).toContain(
            'bg-dhis2-yellow-050'
        )
    })

    it('stale point greys the sparkline too', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(NOW)
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} staleAfterDays={30} />,
            { readings: march(70, 72) }
        )
        await expect
            .poll(() => container.querySelector('.recharts-line-curve'))
            .not.toBeNull()
        const curve = container.querySelector('.recharts-line-curve')
        // --color-dhis2-grey-500
        expect(curve && getComputedStyle(curve).stroke).toBe(
            'rgb(160, 173, 186)'
        )
    })

    it('shows how long ago it was recorded, with the date and stage on hover', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(NOW)
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} staleAfterDays={30} />,
            bloodGroup
        )
        const trigger = slot(container, 'recorded-note')
        expect(
            trigger?.querySelector('[aria-hidden="true"]')?.textContent
        ).toBe('3 months ago')
        trigger?.focus()
        await expect
            .element(
                page
                    .getByText('Recorded Mar 12, 2026 · Antenatal visit', {
                        exact: true,
                    })
                    .last()
            )
            .toBeVisible()
    })

    it('a one-day threshold reads "1 day"', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(NOW)
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} staleAfterDays={1} />,
            bloodGroup
        )
        expect(
            slot(container, 'stale-note')?.querySelector('.sr-only')
                ?.textContent
        ).toBe('Out of date: last recorded over 1 day ago')
    })

    it('a recent point is not stale', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date('2026-03-20T12:00:00.000Z'))
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} staleAfterDays={30} />,
            bloodGroup
        )
        expect(cardOf(container)?.getAttribute('data-tone')).toBe('default')
        expect(container.textContent).not.toContain('Out of date')
        expect(slot(container, 'stale-note')).toBeNull()
        expect(cardOf(container)?.classList).not.toContain(
            'text-dhis2-grey-600'
        )
    })

    it('not stale without staleAfterDays', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(NOW)
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} />,
            bloodGroup
        )
        expect(cardOf(container)?.getAttribute('data-tone')).toBe('default')
        expect(container.textContent).not.toContain('Out of date')
    })

    it('has no axe violations in the trend arrangement', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} unit="g/dL" />,
            { readings: march(9, 10, 16), partial: true, legends: [NORMAL] }
        )
        await expect
            .poll(
                () => container.querySelectorAll('.recharts-line-curve').length
            )
            .toBe(1)
        const results = await axe.run(container)
        expect(results.violations).toEqual([])
    })

    it('has no axe violations with an option badge, partial note and stale note', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(NOW)
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} staleAfterDays={30} />,
            {
                ...bloodGroup,
                partial: true,
                readings: [{ value: 'B_POS', day: '2026-03-12' }],
                options: [
                    { code: 'B_POS', name: 'B positive', color: '#ffef78' },
                ],
            }
        )
        const results = await axe.run(container)
        expect(results.violations).toEqual([])
    })
})
