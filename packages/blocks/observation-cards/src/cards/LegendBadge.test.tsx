import React from 'react'
import { render } from 'vitest-browser-react'
import { LegendBadge } from './LegendBadge'

describe('LegendBadge', () => {
    it('renders nothing when there is neither legend nor option', async () => {
        const { container } = await render(
            <LegendBadge legend={undefined} option={undefined} />
        )
        expect(container.querySelector('[data-slot="badge"]')).toBeNull()
    })

    it('colours the badge from a legend, with dark text on a light colour', async () => {
        const { container } = await render(
            <LegendBadge
                legend={{
                    name: 'Normal',
                    color: '#ffef78',
                    startValue: 0,
                    endValue: 10,
                }}
                option={undefined}
            />
        )
        const badge = container.querySelector<HTMLElement>(
            '[data-slot="badge"]'
        )
        expect(badge?.textContent).toBe('Normal')
        expect(badge?.style.backgroundColor).toBe('rgb(255, 239, 120)')
        expect(badge?.style.color).toBe('rgb(0, 0, 0)')
    })

    it('accepts a metadata colour without a leading #', async () => {
        const { container } = await render(
            <LegendBadge
                legend={undefined}
                option={{ code: 'A', name: 'Alpha', color: '003366' }}
            />
        )
        const badge = container.querySelector<HTMLElement>(
            '[data-slot="badge"]'
        )
        expect(badge?.textContent).toBe('Alpha')
        expect(badge?.style.backgroundColor).toBe('rgb(0, 51, 102)')
        expect(badge?.style.color).toBe('rgb(255, 255, 255)')
    })

    it('shows an option with no colour as a plain badge', async () => {
        const { container } = await render(
            <LegendBadge legend={undefined} option={{ code: 'Z', name: 'Z' }} />
        )
        const badge = container.querySelector<HTMLElement>(
            '[data-slot="badge"]'
        )
        expect(badge?.textContent).toBe('Z')
        expect(badge?.style.backgroundColor).toBe('')
    })
})
