import axe from 'axe-core'
import React from 'react'
import { render } from 'vitest-browser-react'
import type {
    ObservationPoint,
    ObservationResult,
    ObservationSeries,
} from '../use-tracked-entity-observations'
import { TrendCard } from './TrendCard'

const makePoint = (
    day: number,
    value: number,
    stage = 'Antenatal visit'
): ObservationPoint => ({
    value: String(value),
    numericValue: value,
    occurredAt: `2026-03-${String(day).padStart(2, '0')}T00:00:00.000`,
    source: {
        eventId: `ev${day}`,
        programStageId: 's1',
        programStageName: stage,
    },
})

const makeSeries = (
    points: ObservationPoint[],
    overrides: Partial<ObservationSeries> = {}
): ObservationSeries => {
    const latest = points.at(-1)
    const previous = points.at(-2)
    return {
        dataElementId: 'de1',
        label: 'Haemoglobin',
        valueType: 'NUMBER',
        points,
        latest,
        previous,
        change:
            latest?.numericValue !== undefined &&
            previous?.numericValue !== undefined
                ? latest.numericValue - previous.numericValue
                : undefined,
        partial: false,
        ...overrides,
    }
}

const success = (series: ObservationSeries): ObservationResult => ({
    status: 'success',
    series,
})

describe('TrendCard', () => {
    it('pending shows a skeleton and the label is not yet known', async () => {
        const { container } = await render(
            <TrendCard observation={{ status: 'pending' }} />
        )
        expect(
            container.querySelectorAll('[data-slot="skeleton"]').length
        ).toBeGreaterThan(0)
        expect(container.querySelector('[role="heading"]')).toBeNull()
        expect(
            container
                .querySelector('[data-slot="card"]')
                ?.hasAttribute('aria-labelledby')
        ).toBe(false)
        expect(container.textContent).not.toContain('Never recorded')
    })

    it('pending shows the label when the host supplies one', async () => {
        const { container } = await render(
            <TrendCard
                observation={{ status: 'pending' }}
                label="Haemoglobin"
            />
        )
        expect(container.querySelector('[role="heading"]')?.textContent).toBe(
            'Haemoglobin'
        )
        expect(
            container.querySelectorAll('[data-slot="skeleton"]').length
        ).toBeGreaterThan(0)
    })

    it('error shows "Couldn\'t load this value" and never "Never recorded"', async () => {
        const { container } = await render(
            <TrendCard
                observation={{ status: 'error', error: new Error('boom') }}
            />
        )
        expect(container.textContent).toContain("Couldn't load this value")
        expect(container.textContent).not.toContain('Never recorded')
    })

    it('empty series shows "Never recorded"', async () => {
        const { container } = await render(
            <TrendCard observation={success(makeSeries([]))} />
        )
        expect(container.textContent).toContain('Never recorded')
        expect(container.querySelector('[data-slot="chart"]')).toBeNull()
    })

    it('normal shows value with unit, badge, change, recorded line and sparkline', async () => {
        const { container } = await render(
            <TrendCard
                unit="g/dL"
                observation={success(
                    makeSeries(
                        [makePoint(1, 9), makePoint(8, 10), makePoint(12, 16)],
                        {
                            legends: [
                                {
                                    name: 'Normal',
                                    color: '#ffef78',
                                    startValue: 12,
                                    endValue: 20,
                                },
                            ],
                        }
                    )
                )}
            />
        )
        const text = container.textContent ?? ''
        expect(text).toContain('Haemoglobin')
        expect(text).toContain('16')
        expect(text).toContain('g/dL')
        expect(
            container.querySelector('[data-slot="badge"]')?.textContent
        ).toBe('Normal')
        expect(text).toContain('▲ 6 since 2026-03-08')
        expect(text).toContain('Recorded 2026-03-12 · Antenatal visit')
        expect(text).not.toContain('hidden by your access')
        expect(container.querySelector('[data-slot="chart"]')).not.toBeNull()
    })

    it('falling change shows ▼ and the absolute value', async () => {
        const { container } = await render(
            <TrendCard
                observation={success(
                    makeSeries([makePoint(1, 12.5), makePoint(5, 10)])
                )}
            />
        )
        expect(container.textContent).toContain('▼ 2.5 since 2026-03-01')
        expect(container.textContent).not.toContain('-2.5')
    })

    it('no change between readings says so', async () => {
        const { container } = await render(
            <TrendCard
                observation={success(
                    makeSeries([makePoint(1, 10), makePoint(5, 10)])
                )}
            />
        )
        expect(container.textContent).toContain('No change since 2026-03-01')
        expect(container.textContent).not.toContain('▲')
        expect(container.textContent).not.toContain('▼')
    })

    it('single reading shows no change line', async () => {
        const { container } = await render(
            <TrendCard observation={success(makeSeries([makePoint(1, 10)]))} />
        )
        expect(container.textContent).not.toContain('since')
        expect(container.textContent).toContain('Recorded 2026-03-01')
    })

    it('partial shows "Some visits are hidden by your access"', async () => {
        const { container } = await render(
            <TrendCard
                observation={success(
                    makeSeries([makePoint(1, 10)], { partial: true })
                )}
            />
        )
        expect(container.textContent).toContain(
            'Some visits are hidden by your access'
        )
    })

    it('partial with no readings keeps the note beside "Never recorded"', async () => {
        const { container } = await render(
            <TrendCard
                observation={success(makeSeries([], { partial: true }))}
            />
        )
        expect(container.textContent).toContain('Never recorded')
        expect(container.textContent).toContain(
            'Some visits are hidden by your access'
        )
    })

    it('a non-numeric value type shows "This value type can\'t be shown as a trend"', async () => {
        const { container } = await render(
            <TrendCard
                observation={success(
                    makeSeries([makePoint(1, 1)], { valueType: 'TEXT' })
                )}
            />
        )
        expect(container.textContent).toContain(
            "This value type can't be shown as a trend"
        )
        expect(container.querySelector('[data-slot="chart"]')).toBeNull()
    })

    it('label prop overrides series label', async () => {
        const { container } = await render(
            <TrendCard
                label="Hb"
                observation={success(makeSeries([makePoint(1, 10)]))}
            />
        )
        expect(container.querySelector('[role="heading"]')?.textContent).toBe(
            'Hb'
        )
        expect(container.textContent).not.toContain('Haemoglobin')
    })

    it('names the card by its label for screen readers', async () => {
        const { container } = await render(
            <TrendCard observation={success(makeSeries([makePoint(1, 10)]))} />
        )
        const card = container.querySelector('[data-slot="card"]')
        const titleId = card?.getAttribute('aria-labelledby') ?? ''
        expect(container.querySelector(`[id="${titleId}"]`)?.textContent).toBe(
            'Haemoglobin'
        )
    })

    it('shows a value outside every legend with no badge', async () => {
        const { container } = await render(
            <TrendCard
                observation={success(
                    makeSeries([makePoint(1, 30)], {
                        legends: [
                            {
                                name: 'Normal',
                                color: '#ffef78',
                                startValue: 12,
                                endValue: 20,
                            },
                        ],
                    })
                )}
            />
        )
        expect(container.querySelector('[data-slot="badge"]')).toBeNull()
    })

    it('shows an apostrophe and an ampersand in the stage name literally', async () => {
        const { container } = await render(
            <TrendCard
                observation={success(
                    makeSeries([makePoint(1, 10, "Child's visit & labour")])
                )}
            />
        )
        expect(container.textContent).toContain(
            "Recorded 2026-03-01 · Child's visit & labour"
        )
        expect(container.textContent).not.toContain('&#39;')
        expect(container.textContent).not.toContain('&amp;')
    })

    it('rounds the value to two decimals', async () => {
        const { container } = await render(
            <TrendCard
                observation={success(makeSeries([makePoint(1, 71.456)]))}
            />
        )
        expect(container.textContent).toContain('71.46')
        expect(container.textContent).not.toContain('71.456')
    })

    it('has no axe violations in the normal state', async () => {
        const { container } = await render(
            <TrendCard
                unit="g/dL"
                observation={success(
                    makeSeries(
                        [makePoint(1, 9), makePoint(8, 10), makePoint(12, 16)],
                        {
                            partial: true,
                            legends: [
                                {
                                    name: 'Normal',
                                    color: '#ffef78',
                                    startValue: 12,
                                    endValue: 20,
                                },
                            ],
                        }
                    )
                )}
            />
        )
        await expect
            .poll(
                () => container.querySelectorAll('.recharts-line-curve').length
            )
            .toBe(1)
        const results = await axe.run(container)
        expect(results.violations).toEqual([])
    })
})
