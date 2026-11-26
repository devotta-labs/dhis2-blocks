import React from 'react'
import { render } from 'vitest-browser-react'
import { TallySheet } from '..'
import { buttonIn, cellIn } from './sheet.test-utils'
import { VACCINATIONS } from './tally.fixture'

describe('closed cells in forced colours', () => {
    it('dashes a closed cell apart from an open one', async () => {
        await render(<TallySheet layout={VACCINATIONS} label="Tally" />)
        const closed = cellIn('BCG', 2).querySelector(
            '[data-slot="tally-closed"]'
        )
        if (closed === null) throw new Error('No closed cell')
        const hatch = getComputedStyle(closed)
        const open = getComputedStyle(buttonIn('BCG', 0))
        expect(hatch.borderTopStyle).toBe('dashed')
        expect(open.borderTopStyle).toBe('solid')
        expect(hatch.borderTopColor).not.toBe(hatch.backgroundColor)
    })
})
