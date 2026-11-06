import React from 'react'
import { render } from 'vitest-browser-react'
import { roleColour } from '../test/roleColour'

describe('theme roles', () => {
    it('resolve to their default values', async () => {
        const screen = await render(
            <p data-testid="muted" className="text-dhis2-muted-foreground">
                Muted
            </p>
        )
        const muted = screen.getByTestId('muted').element()
        expect(getComputedStyle(muted).color).toBe('rgb(74, 87, 104)') // grey-700
    })

    it('keep opacity modifiers translucent', async () => {
        const screen = await render(
            <span
                data-testid="ring"
                className="outline-2 outline-solid outline-dhis2-ring/35"
            >
                Ring
            </span>
        )
        const outline = getComputedStyle(
            screen.getByTestId('ring').element()
        ).outlineColor
        expect(outline).not.toBe(roleColour('ring'))
        expect(outline).toContain('0.35')
    })
})
