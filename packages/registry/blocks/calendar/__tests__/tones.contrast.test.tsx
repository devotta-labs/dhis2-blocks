import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { TONE_DOT } from '../CalendarCell'

describe('calendar tones with more contrast', () => {
    it.each([
        ['critical', 'rgb(137, 21, 21)'],
        ['warning', 'rgb(187, 70, 13)'],
        ['neutral', 'rgb(64, 75, 90)'],
    ] as const)('darkens the %s dot', async (tone, colour) => {
        await render(<span data-testid="dot" className={TONE_DOT[tone]} />)
        expect(
            getComputedStyle(page.getByTestId('dot').element()).backgroundColor
        ).toBe(colour)
    })
})
