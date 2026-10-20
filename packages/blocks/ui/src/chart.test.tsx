import * as React from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Line, LineChart } from 'recharts'
import { ChartContainer, type ChartConfig } from './chart'

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

const config = {
    value: { label: 'Value', color: 'var(--color-dhis2-primary)' },
} satisfies ChartConfig

describe('chart container', () => {
    const original = globalThis.IS_REACT_ACT_ENVIRONMENT

    beforeEach(() => {
        globalThis.IS_REACT_ACT_ENVIRONMENT = true
    })
    afterEach(() => {
        globalThis.IS_REACT_ACT_ENVIRONMENT = original
    })

    it('exposes each series colour as a --color-<key> variable on the chart', () => {
        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)
        act(() => {
            root.render(
                <ChartContainer config={config} className="h-24 w-48">
                    <LineChart
                        data={[
                            { visit: 'a', value: 1 },
                            { visit: 'b', value: 3 },
                            { visit: 'c', value: 2 },
                        ]}
                    >
                        <Line dataKey="value" stroke="var(--color-value)" />
                    </LineChart>
                </ChartContainer>
            )
        })

        const chart = container.querySelector<HTMLElement>(
            '[data-slot="chart"]'
        )
        if (chart === null) throw new Error('chart did not render')
        expect(
            getComputedStyle(chart).getPropertyValue('--color-value').trim()
        ).not.toBe('')

        act(() => root.unmount())
        container.remove()
    })
})
