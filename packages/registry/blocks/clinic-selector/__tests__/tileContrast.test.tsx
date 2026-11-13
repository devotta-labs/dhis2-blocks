import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { TILE_CLASSES } from '../tile'
import { contrastRatio } from '../../../test/contrastRatio'

// The theme has no dark roles today; the `.dark` case keeps the tiles checked if it gains them.
describe.each([
    ['light', ''],
    ['dark', 'dark'],
])('clinic tiles in the default %s theme', (_, theme) => {
    it.each(TILE_CLASSES)(
        'keeps the initial readable on %s',
        async (classes) => {
            await render(
                <div className={theme}>
                    <span data-testid="tile" className={classes}>
                        A
                    </span>
                </div>
            )
            const style = getComputedStyle(page.getByTestId('tile').element())
            expect(
                contrastRatio(style.color, style.backgroundColor)
            ).toBeGreaterThanOrEqual(4.5)
        }
    )
})
