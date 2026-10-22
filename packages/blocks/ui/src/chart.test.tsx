import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Line, LineChart } from 'recharts'
import { ChartContainer, ChartTooltipContent, type ChartConfig } from './chart'

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

const config = {
    value: { label: 'Value', color: 'var(--color-dhis2-primary)' },
} satisfies ChartConfig

describe('chart container', () => {
    const original = globalThis.IS_REACT_ACT_ENVIRONMENT

    let container: HTMLDivElement
    let root: Root

    beforeEach(() => {
        globalThis.IS_REACT_ACT_ENVIRONMENT = true
        container = document.createElement('div')
        document.body.appendChild(container)
        root = createRoot(container)
    })
    afterEach(() => {
        act(() => root.unmount())
        container.remove()
        globalThis.IS_REACT_ACT_ENVIRONMENT = original
    })

    it('exposes each series colour as a --color-<key> variable on the chart', () => {
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
    })

    it('leaves out a colour that could break out of the style element', () => {
        act(() => {
            root.render(
                <ChartContainer
                    config={{
                        safe: { color: '#123456' },
                        unsafe: {
                            color: 'red;}</style><img src=x onerror=alert(1)>',
                        },
                    }}
                >
                    <LineChart data={[{ value: 1 }]}>
                        <Line dataKey="value" />
                    </LineChart>
                </ChartContainer>
            )
        })

        const style = container.querySelector('style')?.textContent ?? ''
        expect(style).toContain('--color-safe: #123456;')
        expect(style).not.toContain('unsafe')
        expect(container.querySelector('img')).toBeNull()
    })

    it('labels a tooltip row from the config and formats numbers', () => {
        act(() => {
            root.render(
                <ChartContainer config={config}>
                    <div>
                        <ChartTooltipContent
                            active
                            label="value"
                            payload={[
                                {
                                    graphicalItemId: 'value',
                                    dataKey: 'value',
                                    name: 'value',
                                    value: 1234.5,
                                    payload: { visit: 'a', value: 1234.5 },
                                },
                            ]}
                        />
                    </div>
                </ChartContainer>
            )
        })

        expect(container.textContent).toContain('Value')
        expect(container.textContent).toContain('1,234.5')
    })
})
