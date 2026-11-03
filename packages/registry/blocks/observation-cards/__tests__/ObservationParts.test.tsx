import axe from 'axe-core'
import React from 'react'
import { render } from 'vitest-browser-react'
import {
    ObservationCard,
    ObservationChange,
    ObservationLabel,
    ObservationLegend,
    ObservationRecorded,
    ObservationSparkline,
    ObservationValue,
} from '..'
import { DE, march, NORMAL, renderWith, type FakeObservation } from './support'

const NOW = new Date('2026-06-01T12:00:00.000Z')

const cardOf = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('[data-slot="observation-card"]')

const slot = (container: HTMLElement, name: string) =>
    container.querySelector<HTMLElement>(`[data-slot="${name}"]`)

const legendCard = (observation: FakeObservation) =>
    renderWith(
        <ObservationCard dataElement={DE}>
            <ObservationLegend />
        </ObservationCard>,
        { readings: march(5), ...observation }
    )

describe('ObservationLegend', () => {
    it('renders nothing when the value has no legend', async () => {
        const { container } = await legendCard({})
        expect(container.querySelector('[data-slot="badge"]')).toBeNull()
    })

    it('colours the badge from a legend, with dark text on a light colour', async () => {
        const { container } = await legendCard({
            legends: [{ ...NORMAL, startValue: 0, endValue: 10 }],
        })
        const badge = container.querySelector<HTMLElement>(
            '[data-slot="badge"]'
        )
        expect(badge?.textContent).toBe('Normal')
        expect(badge?.style.backgroundColor).toBe('rgb(255, 239, 120)')
        expect(badge?.style.color).toBe('rgb(0, 0, 0)')
    })

    it('accepts a metadata colour without a leading #, with light text on a dark colour', async () => {
        const { container } = await legendCard({
            legends: [
                { name: 'Alpha', color: '003366', startValue: 0, endValue: 10 },
            ],
        })
        const badge = container.querySelector<HTMLElement>(
            '[data-slot="badge"]'
        )
        expect(badge?.textContent).toBe('Alpha')
        expect(badge?.style.backgroundColor).toBe('rgb(0, 51, 102)')
        expect(badge?.style.color).toBe('rgb(255, 255, 255)')
    })

    it('shows an option with no colour as a plain badge', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE}>
                <ObservationValue />
            </ObservationCard>,
            {
                valueType: 'TEXT',
                readings: [{ value: 'Z', day: '2026-03-01' }],
                options: [{ code: 'Z', name: 'Z' }],
            }
        )
        const badge = container.querySelector<HTMLElement>(
            '[data-slot="badge"]'
        )
        expect(badge?.textContent).toBe('Z')
        expect(badge?.style.backgroundColor).toBe('')
    })
})

describe('ObservationChange', () => {
    it('the change line names a legend move', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} unit="g/dL">
                <ObservationChange />
            </ObservationCard>,
            {
                readings: [
                    { value: '10.8', day: '2026-03-03' },
                    { value: '12.0', day: '2026-03-12' },
                ],
                legends: [
                    { ...NORMAL, name: 'Low', startValue: 0, endValue: 11 },
                    { ...NORMAL, startValue: 11 },
                ],
            }
        )
        const line = slot(container, 'observation-change')
        expect(line?.textContent).toBe(
            'up 1.2 g/dL since Mar 3, 2026, now Normal (was Low)'
        )
        expect(
            line?.querySelector('[data-slot="change-arrow"] svg')
        ).not.toBeNull()
    })

    it('names no change between option codes, even numeric ones', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE}>
                <ObservationChange />
            </ObservationCard>,
            {
                valueType: 'INTEGER',
                readings: march(1, 2),
                options: [
                    { code: '1', name: 'Mild' },
                    { code: '2', name: 'Severe' },
                ],
            }
        )
        expect(slot(container, 'observation-change')).toBeNull()
        expect(container.textContent).not.toContain('since')
    })
})

const sparklineCard = (
    observation: FakeObservation,
    sparkline = <ObservationSparkline />
) =>
    renderWith(
        <ObservationCard dataElement={DE}>{sparkline}</ObservationCard>,
        {
            label: 'Weight',
            ...observation,
        }
    )

describe('ObservationSparkline', () => {
    it('plots one point as a dot when asked for the last reading only', async () => {
        const { container } = await sparklineCard(
            { readings: march(70, 72) },
            <ObservationSparkline points={1} />
        )
        expect(container.textContent).toContain(
            '1 reading on Mar 2, 2026, latest 72'
        )
        await expect
            .poll(() => container.querySelectorAll('.recharts-dot').length)
            .toBe(1)
    })

    it('caps to the last few points', async () => {
        const { container } = await sparklineCard(
            { readings: march(70, 71, 72, 73, 74, 75, 76, 77, 78, 79) },
            <ObservationSparkline points={4} />
        )
        expect(container.textContent).toContain(
            '4 readings from Mar 7, 2026 to Mar 10, 2026, latest 79'
        )
        await expect
            .poll(
                () => container.querySelectorAll('.recharts-line-curve').length
            )
            .toBe(1)
    })

    it('plots twelve points by default', async () => {
        const { container } = await sparklineCard({
            readings: march(...Array.from({ length: 15 }, (_, i) => 60 + i)),
        })
        expect(container.textContent).toContain(
            '12 readings from Mar 4, 2026 to Mar 15, 2026, latest 74'
        )
    })

    it('plots nothing for 0 points', async () => {
        const { container } = await sparklineCard(
            { readings: march(70, 71) },
            <ObservationSparkline points={0} />
        )
        expect(container.querySelector('[data-slot="chart"]')).toBeNull()
    })

    it('marks only the latest reading with a dot', async () => {
        const { container } = await sparklineCard({
            readings: march(70, 72, 71),
        })
        await expect
            .poll(() => container.querySelectorAll('.recharts-dot').length)
            .toBe(1)
    })

    it('fits the scale to the readings rather than starting at zero', async () => {
        const { container } = await sparklineCard({ readings: march(79, 77.4) })
        await expect
            .poll(() => container.querySelector('.recharts-line-curve'))
            .not.toBeNull()
        const box = container
            .querySelector<SVGPathElement>('.recharts-line-curve')
            ?.getBBox()
        const svgHeight =
            container.querySelector('svg.recharts-surface')?.clientHeight ?? 0
        // From zero up, a 2% change would span about 1px of a 40px chart.
        expect(box?.height).toBeGreaterThan(svgHeight / 2)
    })

    it('leaves out readings with no numeric value', async () => {
        const { container } = await sparklineCard({
            readings: [
                { value: '70', day: '2026-03-01' },
                { value: 'abc', day: '2026-03-02' },
                { value: '72', day: '2026-03-03' },
            ],
        })
        expect(container.textContent).toContain('2 readings')
    })

    it('summary text names count, range and latest', async () => {
        const { container } = await sparklineCard({
            readings: [
                { value: '70', day: '2026-03-01' },
                { value: '71.4', day: '2026-03-05' },
                { value: '72', day: '2026-03-12' },
            ],
        })
        expect(container.textContent).toContain(
            '3 readings from Mar 1, 2026 to Mar 12, 2026, latest 72'
        )
    })

    it('hides the chart from assistive technology and exposes the summary', async () => {
        const { container } = await sparklineCard({ readings: march(70, 71) })
        const chart = slot(container, 'chart')
        expect(chart?.getAttribute('aria-hidden')).toBe('true')
        const summary = slot(container, 'observation-sparkline')?.querySelector(
            '.sr-only'
        )
        expect(summary?.textContent).toContain('2 readings')
        expect(chart?.contains(summary ?? null)).toBe(false)
    })

    it('renders nothing with fewer than two numeric readings', async () => {
        const none = await sparklineCard({ readings: march(70) })
        expect(slot(none.container, 'observation-sparkline')).toBeNull()
    })

    it('writes an apostrophe and an ampersand in the summary literally', async () => {
        const { container } = await sparklineCard({
            valueType: 'INTEGER',
            readings: march(1, 2),
            options: [
                { code: '1', name: 'Mother & child' },
                { code: '2', name: "Child's choice" },
            ],
        })
        const summary = slot(container, 'observation-sparkline')?.querySelector(
            '.sr-only'
        )?.textContent
        expect(summary).toContain("latest Child's choice")
        expect(summary).not.toContain('&#39;')
        expect(summary).not.toContain('&amp;')
    })

    it('has no axe violations', async () => {
        const { container } = await sparklineCard({
            readings: march(70, 71, 72),
        })
        await expect
            .poll(
                () => container.querySelectorAll('.recharts-line-curve').length
            )
            .toBe(1)
        const results = await axe.run(container)
        expect(results.violations).toEqual([])
    })
})

describe('a composed card', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders only the parts it is given, in their order', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE}>
                <ObservationValue unit="kg" />
                <ObservationLabel />
                <ObservationRecorded />
            </ObservationCard>,
            { label: 'Weight', readings: march(70, 72) }
        )
        expect(
            [...container.querySelectorAll('[data-slot^="observation-"]')].map(
                (element) => element.getAttribute('data-slot')
            )
        ).toEqual([
            'observation-card',
            'observation-value',
            'observation-label',
            'observation-recorded',
        ])
        expect(slot(container, 'observation-value')?.textContent).toBe('72kg')
    })

    it('a value takes its own unit, else the card unit', async () => {
        const own = await renderWith(
            <ObservationCard dataElement={DE} unit="g/dL">
                <ObservationValue unit="g/L" />
            </ObservationCard>,
            { readings: march(120) }
        )
        expect(slot(own.container, 'value-unit')?.textContent).toBe('g/L')
        await own.unmount()

        const card = await renderWith(
            <ObservationCard dataElement={DE} unit="g/dL">
                <ObservationValue />
            </ObservationCard>,
            { readings: march(12) }
        )
        expect(slot(card.container, 'value-unit')?.textContent).toBe('g/dL')
    })

    it('a composed card without ObservationRecorded still shows the date, stale and partial notes', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(NOW)
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} staleAfterDays={30}>
                <ObservationLabel />
                <ObservationValue />
            </ObservationCard>,
            {
                readings: [{ value: '12', day: '2026-03-12' }],
                partial: true,
            }
        )
        expect(
            container.querySelectorAll('[data-slot="observation-recorded"]')
        ).toHaveLength(1)
        expect(container.textContent).toContain(
            'Recorded Mar 12, 2026 · Antenatal visit'
        )
        expect(slot(container, 'stale-note')?.textContent).toBe(
            'Out of date: last recorded over 30 days ago'
        )
        expect(container.textContent).toContain(
            'Some visits are hidden by your access'
        )
    })

    it('a placed ObservationRecorded is the only recorded note', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE}>
                <ObservationRecorded className="custom" />
                <ObservationValue />
            </ObservationCard>,
            { readings: march(12) }
        )
        const notes = container.querySelectorAll(
            '[data-slot="observation-recorded"]'
        )
        expect(notes).toHaveLength(1)
        expect(notes[0]?.classList).toContain('custom')
        expect(slot(container, 'observation-card')?.firstElementChild).toBe(
            notes[0]
        )
    })

    it('parts pass through className and their element props', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} className="card-class">
                <ObservationLabel
                    className="label-class"
                    id="weight-label"
                    title="Weight"
                />
                <ObservationValue className="value-class" />
            </ObservationCard>,
            { readings: march(12) }
        )
        expect(slot(container, 'observation-card')?.classList).toContain(
            'card-class'
        )
        expect(slot(container, 'observation-label')?.id).toBe('weight-label')
        expect(slot(container, 'observation-label')?.classList).toContain(
            'label-class'
        )
        expect(slot(container, 'observation-label')?.title).toBe('Weight')
        expect(slot(container, 'observation-value')?.classList).toContain(
            'value-class'
        )
    })

    it('a part outside a card says where it belongs', async () => {
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
        await expect(render(<ObservationValue />)).rejects.toThrow(
            'Observation parts must be rendered inside ObservationCard'
        )
        errors.mockRestore()
    })
})

describe('calendars and sizes', () => {
    it('dates show in the Ethiopian calendar', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} />,
            {
                readings: [
                    { value: '10', day: '2026-03-03' },
                    { value: '12', day: '2026-03-12' },
                ],
            },
            'ready',
            'ethiopian'
        )
        expect(container.textContent).toContain('up 2 since 2018-06-24')
        expect(container.textContent).toContain(
            'Recorded 2018-07-03 · Antenatal visit'
        )
        expect(container.textContent).toContain(
            '2 readings from 2018-06-24 to 2018-07-03, latest 12'
        )
        expect(container.textContent).not.toContain('2026')
    })

    it('a 160px card has no horizontal overflow and no sparkline', async () => {
        const { container } = await renderWith(
            <div style={{ width: 160 }}>
                <ObservationCard dataElement={DE} unit="copies/mL" />
            </div>,
            {
                readings: [
                    { value: '1234000', day: '2026-03-03' },
                    { value: '1234567.891', day: '2026-03-12' },
                ],
                legends: [
                    { ...NORMAL, name: 'Low', startValue: 0, endValue: 11 },
                    { ...NORMAL, startValue: 11, endValue: 2000000 },
                ],
                partial: true,
            }
        )
        const card = cardOf(container)
        const row = slot(container, 'observation-value')
        expect(card).not.toBeNull()
        expect(row?.textContent).toBe('1,234,567.891copies/mL')
        expect(card?.clientWidth).toBeLessThanOrEqual(160)
        expect(card?.scrollWidth).toBeLessThanOrEqual(card?.clientWidth ?? 0)
        expect(row?.scrollWidth).toBeLessThanOrEqual(row?.clientWidth ?? 0)
        // The sparkline is the first thing a narrow card drops.
        expect(slot(container, 'chart')?.checkVisibility()).toBe(false)
        // Its summary stays for screen readers.
        const summary = slot(container, 'observation-sparkline')?.querySelector(
            '.sr-only'
        )
        expect(summary?.textContent).toBe(
            '2 readings from Mar 3, 2026 to Mar 12, 2026, latest 1,234,567.891'
        )
        expect(summary?.checkVisibility()).toBe(true)
    })

    it('a card in a plain flex row sizes from its content', async () => {
        const { container } = await renderWith(
            <div style={{ display: 'flex' }}>
                <ObservationCard dataElement={DE} unit="g/dL" />
            </div>,
            { readings: march(10.8, 12) }
        )
        expect(
            cardOf(container)?.getBoundingClientRect().width
        ).toBeGreaterThan(150)
    })
})
