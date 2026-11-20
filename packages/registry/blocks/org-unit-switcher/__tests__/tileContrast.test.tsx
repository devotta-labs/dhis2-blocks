import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { TILE_CLASSES } from '../tile'
import { contrastRatio } from '../../../test/contrastRatio'

describe('unit tiles in the default theme', () => {
    it.each(TILE_CLASSES)(
        'keeps the initial readable on %s',
        async (classes) => {
            await render(
                <span data-testid="tile" className={classes}>
                    A
                </span>
            )
            const style = getComputedStyle(page.getByTestId('tile').element())
            expect(
                contrastRatio(style.color, style.backgroundColor)
            ).toBeGreaterThanOrEqual(4.5)
        }
    )
})
