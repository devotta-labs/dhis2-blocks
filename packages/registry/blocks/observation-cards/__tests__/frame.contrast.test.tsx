import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { CardNote, STALE_BAND } from '../card/frame'

describe('observation card frame with more contrast', () => {
    it('edges and writes the stale band in the darkest yellow', async () => {
        await render(
            <div data-testid="band" className={`border-t ${STALE_BAND}`}>
                Out of date
            </div>
        )
        const band = getComputedStyle(page.getByTestId('band').element())
        expect(band.borderTopColor).toBe('rgb(111, 50, 5)')
        expect(band.color).toBe('rgb(111, 50, 5)')
    })

    it('writes a warning note in the darkest yellow', async () => {
        await render(<CardNote tone="warning">Check this</CardNote>)
        const note = page.getByText('Check this').element().parentElement
        expect(note && getComputedStyle(note).color).toBe('rgb(111, 50, 5)')
    })
})
