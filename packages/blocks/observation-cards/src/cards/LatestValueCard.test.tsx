import axe from 'axe-core'
import React from 'react'
import { render } from 'vitest-browser-react'
import type {
    ObservationPoint,
    ObservationResult,
    ObservationSeries,
} from '../use-tracked-entity-observations'
import { LatestValueCard } from './LatestValueCard'

const makePoint = (
    value: string,
    occurredAt = '2026-03-12T00:00:00.000',
    stage = 'Antenatal visit'
): ObservationPoint => {
    const point: ObservationPoint = {
        value,
        occurredAt,
        source: {
            eventId: 'ev1',
            programStageId: 's1',
            programStageName: stage,
        },
    }
    const numeric = Number(value)
    if (value !== '' && Number.isFinite(numeric)) {
        point.numericValue = numeric
    }
    return point
}

const makeSeries = (
    points: ObservationPoint[],
    overrides: Partial<ObservationSeries> = {}
): ObservationSeries => ({
    dataElementId: 'de1',
    label: 'Blood group',
    valueType: 'TEXT',
    points,
    latest: points.at(-1),
    previous: points.at(-2),
    partial: false,
    ...overrides,
})

const success = (series: ObservationSeries): ObservationResult => ({
    status: 'success',
    series,
})

const NOW = new Date('2026-06-01T12:00:00.000Z')

describe('LatestValueCard', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('pending shows a skeleton and no label until the host supplies one', async () => {
        const { container } = await render(
            <LatestValueCard observation={{ status: 'pending' }} />
        )
        expect(
            container.querySelectorAll('[data-slot="skeleton"]').length
        ).toBeGreaterThan(0)
        expect(container.querySelector('[role="heading"]')).toBeNull()
        expect(container.textContent).not.toContain('Never recorded')
    })

    it('pending shows the label when the host supplies one', async () => {
        const { container } = await render(
            <LatestValueCard
                observation={{ status: 'pending' }}
                label="Blood group"
            />
        )
        expect(container.querySelector('[role="heading"]')?.textContent).toBe(
            'Blood group'
        )
    })

    it('error shows "Couldn\'t load this value" and never "Never recorded"', async () => {
        const { container } = await render(
            <LatestValueCard
                observation={{ status: 'error', error: new Error('boom') }}
            />
        )
        expect(container.textContent).toContain("Couldn't load this value")
        expect(container.textContent).not.toContain('Never recorded')
    })

    it('empty series shows "Never recorded"', async () => {
        const { container } = await render(
            <LatestValueCard observation={success(makeSeries([]))} />
        )
        expect(container.textContent).toContain('Never recorded')
    })

    it('partial shows the note with a value and beside "Never recorded"', async () => {
        const withValue = await render(
            <LatestValueCard
                observation={success(
                    makeSeries([makePoint('O+')], { partial: true })
                )}
            />
        )
        expect(withValue.container.textContent).toContain(
            'Some visits are hidden by your access'
        )
        await withValue.unmount()

        const empty = await render(
            <LatestValueCard
                observation={success(makeSeries([], { partial: true }))}
            />
        )
        expect(empty.container.textContent).toContain('Never recorded')
        expect(empty.container.textContent).toContain(
            'Some visits are hidden by your access'
        )
    })

    it('option value shows the option name in a badge with its colour', async () => {
        const { container } = await render(
            <LatestValueCard
                observation={success(
                    makeSeries([makePoint('B_POS')], {
                        options: [
                            { code: 'A_POS', name: 'A positive' },
                            {
                                code: 'B_POS',
                                name: 'B positive',
                                color: '#ff0000',
                            },
                        ],
                    })
                )}
            />
        )
        const badge = container.querySelector<HTMLElement>(
            '[data-slot="badge"]'
        )
        expect(badge?.textContent).toBe('B positive')
        expect(badge?.style.backgroundColor).toBe('rgb(255, 0, 0)')
        expect(container.textContent).toContain(
            'Recorded 2026-03-12 · Antenatal visit'
        )
    })

    it('option code missing from the option set shows the raw code', async () => {
        const { container } = await render(
            <LatestValueCard
                observation={success(
                    makeSeries([makePoint('GONE')], {
                        options: [{ code: 'A_POS', name: 'A positive' }],
                    })
                )}
            />
        )
        expect(
            container.querySelector('[data-slot="badge"]')?.textContent
        ).toBe('GONE')
    })

    it('numeric value shows the value, unit and legend badge', async () => {
        const { container } = await render(
            <LatestValueCard
                unit="g/dL"
                observation={success(
                    makeSeries([makePoint('16')], {
                        valueType: 'NUMBER',
                        label: 'Haemoglobin',
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
        const text = container.textContent ?? ''
        expect(text).toContain('Haemoglobin')
        expect(text).toContain('16')
        expect(text).toContain('g/dL')
        expect(
            container.querySelector('[data-slot="badge"]')?.textContent
        ).toBe('Normal')
        expect(container.querySelector('[data-slot="chart"]')).toBeNull()
        expect(text).not.toContain('since')
    })

    it('numeric value outside every legend shows no badge', async () => {
        const { container } = await render(
            <LatestValueCard
                observation={success(
                    makeSeries([makePoint('30')], {
                        valueType: 'NUMBER',
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
        expect(container.textContent).toContain('30')
        expect(container.querySelector('[data-slot="badge"]')).toBeNull()
    })

    it("TRUE_ONLY unticked at last visit shows No with that visit's date", async () => {
        const { container } = await render(
            <LatestValueCard
                observation={success(
                    makeSeries(
                        [
                            makePoint('true', '2026-02-01T00:00:00.000'),
                            makePoint('false', '2026-03-12T00:00:00.000'),
                        ],
                        { valueType: 'TRUE_ONLY', label: 'HIV positive' }
                    )
                )}
            />
        )
        const text = container.textContent ?? ''
        expect(text).toContain('No')
        expect(text).not.toContain('Yes')
        expect(text).toContain('Recorded 2026-03-12')
    })

    it('BOOLEAN true shows Yes', async () => {
        const { container } = await render(
            <LatestValueCard
                observation={success(
                    makeSeries([makePoint('true')], { valueType: 'BOOLEAN' })
                )}
            />
        )
        expect(container.textContent).toContain('Yes')
    })

    it('DATE value shows the formatted date', async () => {
        const { container } = await render(
            <LatestValueCard
                observation={success(
                    makeSeries([makePoint('2026-01-05')], { valueType: 'DATE' })
                )}
            />
        )
        expect(container.textContent).toContain('2026-01-05')
    })

    it('text value shows the text as plain large text with no badge', async () => {
        const { container } = await render(
            <LatestValueCard
                observation={success(makeSeries([makePoint('Mild anaemia')]))}
            />
        )
        expect(container.textContent).toContain('Mild anaemia')
        expect(container.querySelector('[data-slot="badge"]')).toBeNull()
    })

    it('stale point has the stale style and an "over {n} days ago" note', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(NOW)
        const { container } = await render(
            <LatestValueCard
                staleAfterDays={30}
                observation={success(makeSeries([makePoint('O+')]))}
            />
        )
        expect(
            container
                .querySelector('[data-slot="card"]')
                ?.getAttribute('data-tone')
        ).toBe('stale')
        expect(container.textContent).toContain(
            'Last recorded over 30 days ago'
        )
    })

    it('a recent point is not stale', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date('2026-03-20T12:00:00.000Z'))
        const { container } = await render(
            <LatestValueCard
                staleAfterDays={30}
                observation={success(makeSeries([makePoint('O+')]))}
            />
        )
        expect(
            container
                .querySelector('[data-slot="card"]')
                ?.getAttribute('data-tone')
        ).toBe('default')
        expect(container.textContent).not.toContain('Last recorded over')
    })

    it('not stale without staleAfterDays', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(NOW)
        const { container } = await render(
            <LatestValueCard
                observation={success(makeSeries([makePoint('O+')]))}
            />
        )
        expect(
            container
                .querySelector('[data-slot="card"]')
                ?.getAttribute('data-tone')
        ).toBe('default')
        expect(container.textContent).not.toContain('Last recorded over')
    })

    it('unsupported type shows "This value type can\'t be shown here"', async () => {
        const { container } = await render(
            <LatestValueCard
                observation={success(
                    makeSeries([makePoint('POINT(1 2)')], {
                        valueType: 'COORDINATE',
                    })
                )}
            />
        )
        expect(container.textContent).toContain(
            "This value type can't be shown here"
        )
        expect(container.textContent).not.toContain('POINT(1 2)')
    })

    it('shows an apostrophe and an ampersand in the stage name literally', async () => {
        const { container } = await render(
            <LatestValueCard
                observation={success(
                    makeSeries([
                        makePoint(
                            'O+',
                            '2026-03-12T00:00:00.000',
                            "Child's visit & labour"
                        ),
                    ])
                )}
            />
        )
        expect(container.textContent).toContain(
            "Recorded 2026-03-12 · Child's visit & labour"
        )
        expect(container.textContent).not.toContain('&#39;')
        expect(container.textContent).not.toContain('&amp;')
    })

    it('label prop overrides series label and names the card', async () => {
        const { container } = await render(
            <LatestValueCard
                label="Group"
                observation={success(makeSeries([makePoint('O+')]))}
            />
        )
        const card = container.querySelector('[data-slot="card"]')
        const titleId = card?.getAttribute('aria-labelledby') ?? ''
        expect(container.querySelector(`[id="${titleId}"]`)?.textContent).toBe(
            'Group'
        )
        expect(container.textContent).not.toContain('Blood group')
    })

    it('has no axe violations with an option badge, partial note and stale note', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(NOW)
        const { container } = await render(
            <LatestValueCard
                staleAfterDays={30}
                observation={success(
                    makeSeries([makePoint('B_POS')], {
                        partial: true,
                        options: [
                            {
                                code: 'B_POS',
                                name: 'B positive',
                                color: '#ffef78',
                            },
                        ],
                    })
                )}
            />
        )
        const results = await axe.run(container)
        expect(results.violations).toEqual([])
    })
})
