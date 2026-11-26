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
})
