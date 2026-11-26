import React from 'react'
import { render } from 'vitest-browser-react'
import { TallySheet } from '..'
import { buttonIn } from './sheet.test-utils'
import { VACCINATIONS } from './tally.fixture'

describe('a count button with reduced motion', () => {
    it('fades its colour after a tap and does not move', async () => {
        await render(<TallySheet layout={VACCINATIONS} label="Tally" />)
        const { transitionProperty } = getComputedStyle(buttonIn('OPV 1', 0))
        expect(transitionProperty).toBe('background-color')
    })

    it('marks a held count without growing it', async () => {
        await render(<TallySheet layout={VACCINATIONS} label="Tally" />)
        const button = buttonIn('OPV 1', 0)
        button.dispatchEvent(
            new PointerEvent('pointerdown', {
                bubbles: true,
                pointerId: 3,
                pointerType: 'touch',
            })
        )
        await expect.element(button).toHaveAttribute('data-scrubbing')
        const { scale, transitionDuration } = getComputedStyle(button)
        expect(['none', '1']).toContain(scale)
        expect(transitionDuration).toBe('0s')
    })
})
