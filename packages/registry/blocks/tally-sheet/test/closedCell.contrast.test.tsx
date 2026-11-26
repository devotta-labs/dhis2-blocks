import React from 'react'
import { render } from 'vitest-browser-react'
import { contrastRatio } from '../../../test/contrastRatio'
import { roleColour } from '../../../test/roleColour'
import { TallySheet } from '..'
import { cellIn } from './sheet.test-utils'
import { VACCINATIONS } from './tally.fixture'

describe('closed cells with more contrast', () => {
    it('hatches in the border colour, at 3:1 or more on the cell', async () => {
        await render(<TallySheet layout={VACCINATIONS} label="Tally" />)
        const closed = cellIn('BCG', 2).querySelector(
            '[data-slot="tally-closed"]'
        )
        if (closed === null) throw new Error('No closed cell')
        const { backgroundImage, backgroundColor } = getComputedStyle(closed)
        const line =
            backgroundImage.match(/rgba?\([^)]*\)|color\([^)]*\)/)?.[0] ?? ''
        expect(line).toBe(roleColour('border-strong'))
        expect(contrastRatio(line, backgroundColor)).toBeGreaterThanOrEqual(3)
    })
})
