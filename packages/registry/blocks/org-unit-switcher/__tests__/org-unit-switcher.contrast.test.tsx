import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { TILE_CLASSES } from '../tile'
import { contrastRatio } from '../../../test/contrastRatio'
import { roleColour } from '../../../test/roleColour'
import { OrgUnitSwitcherFixture } from './OrgUnitSwitcherFixture'

describe('organisation unit switcher with more contrast', () => {
    // An earlier test's remembered unit must not decide the current one.
    beforeEach(() => localStorage.clear())

    it('writes the unit name in the foreground', async () => {
        await render(<OrgUnitSwitcherFixture />)
        const trigger = page.getByRole('button', {
            name: 'Organisation unit: Bristol Clinic',
        })
        await expect.element(trigger).toBeVisible()
        expect(getComputedStyle(trigger.element()).color).toBe(
            roleColour('foreground')
        )
    })

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
