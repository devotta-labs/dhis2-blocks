import axe from 'axe-core'
import React from 'react'
import { render } from 'vitest-browser-react'
import type {
    ObservationPoint,
    ObservationSeries,
} from '../use-tracked-entity-observations'
import { Sparkline } from './Sparkline'

const makePoint = (day: number, value: number): ObservationPoint => ({
    value: String(value),
    numericValue: value,
    occurredAt: `2026-03-${String(day).padStart(2, '0')}T00:00:00.000`,
    source: {
        eventId: `ev${day}`,
        programStageId: 's1',
        programStageName: 'Visit',
    },
})

const makeSeries = (points: ObservationPoint[]): ObservationSeries => ({
    dataElementId: 'de1',
    label: 'Weight',
    valueType: 'NUMBER',
    points,
    latest: points.at(-1),
    partial: false,
})

describe('Sparkline', () => {
    it('renders one point as a dot without throwing', async () => {
        const { container } = await render(
            <Sparkline series={makeSeries([makePoint(1, 70)])} />
        )
        await expect
            .poll(() => container.querySelectorAll('.recharts-dot').length)
            .toBe(1)
    })

    it('caps to the last maxPoints points', async () => {
        const points = Array.from({ length: 10 }, (_, i) =>
            makePoint(i + 1, 70 + i)
        )
        const { container } = await render(
            <Sparkline series={makeSeries(points)} maxPoints={4} />
        )
        expect(container.textContent).toContain(
            '4 readings from 2026-03-07 to 2026-03-10, latest 79'
        )
        await expect
            .poll(
                () => container.querySelectorAll('.recharts-line-curve').length
            )
            .toBe(1)
    })

    it('leaves out points with no numeric value', async () => {
        const gap: ObservationPoint = {
            ...makePoint(2, 0),
            value: 'abc',
            numericValue: undefined,
        }
        const { container } = await render(
            <Sparkline
                series={makeSeries([makePoint(1, 70), gap, makePoint(3, 72)])}
            />
        )
        expect(container.textContent).toContain('2 readings')
    })

    it('summary text names count, range and latest', async () => {
        const { container } = await render(
            <Sparkline
                series={makeSeries([
                    makePoint(1, 70),
                    makePoint(5, 71.4000000000001),
                    makePoint(12, 72),
                ])}
            />
        )
        expect(container.textContent).toContain(
            '3 readings from 2026-03-01 to 2026-03-12, latest 72'
        )
    })

    it('hides the chart from assistive technology and exposes the summary', async () => {
        const { container } = await render(
            <Sparkline
                series={makeSeries([makePoint(1, 70), makePoint(2, 71)])}
            />
        )
        const chart = container.querySelector('[data-slot="chart"]')
        expect(chart?.getAttribute('aria-hidden')).toBe('true')
        const summary = container.querySelector('.sr-only')
        expect(summary?.textContent).toContain('2 readings')
        expect(chart?.contains(summary ?? null)).toBe(false)
    })

    it('renders nothing when no point has a numeric value', async () => {
        const { container } = await render(
            <Sparkline series={makeSeries([])} />
        )
        expect(container.querySelector('[data-slot="chart"]')).toBeNull()
    })

    it('has no axe violations', async () => {
        const { container } = await render(
            <Sparkline
                series={makeSeries([
                    makePoint(1, 70),
                    makePoint(2, 71),
                    makePoint(3, 72),
                ])}
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
