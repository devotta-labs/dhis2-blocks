import React from 'react'
import { render } from 'vitest-browser-react'

describe('theme roles with more contrast', () => {
    it('runs with the OS asking for more contrast', () => {
        expect(matchMedia('(prefers-contrast: more)').matches).toBe(true)
    })

    it('resolve to their high-contrast values', async () => {
        const screen = await render(
            <p data-testid="muted" className="text-dhis2-muted-foreground">
                Muted
            </p>
        )
        const muted = screen.getByTestId('muted').element()
        expect(getComputedStyle(muted).color).toBe('rgb(64, 75, 90)')
    })
})
