import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { ObservationCard, ObservationRecorded, ObservationSparkline } from '..'
import { roleColour } from '../../../test/roleColour'
import { CardNote, STALE_BAND } from '../card/frame'
import { DE, march, renderWith } from './support'

describe('observation card frame with more contrast', () => {
    it('edges and writes the stale band in the darkest yellow', async () => {
        await render(
            <div data-testid="band" className={`border-t ${STALE_BAND}`}>
                Out of date
            </div>
        )
        const band = getComputedStyle(page.getByTestId('band').element())
        expect(band.borderTopColor).toBe(roleColour('warning-border'))
        expect(band.color).toBe(roleColour('warning-strong'))
    })

    it('writes a warning note in the darkest yellow', async () => {
        await render(<CardNote tone="warning">Check this</CardNote>)
        const note = page.getByText('Check this').element().parentElement
        expect(note && getComputedStyle(note).color).toBe(roleColour('warning'))
    })

    it('draws the sparkline in the dark primary', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE}>
                <ObservationSparkline />
            </ObservationCard>,
            { readings: march(70, 72) }
        )
        await expect
            .poll(() => container.querySelector('.recharts-line-curve'))
            .not.toBeNull()
        const curve = container.querySelector('.recharts-line-curve')
        expect(curve && getComputedStyle(curve).stroke).toBe(
            roleColour('primary')
        )
    })

    it('outlines the focused recorded note in the dark ring', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE}>
                <ObservationRecorded />
            </ObservationCard>,
            { readings: march(70, 72) }
        )
        await expect
            .poll(() => container.querySelector('[data-slot="recorded-note"]'))
            .not.toBeNull()
        await userEvent.tab()
        const note = container.querySelector('[data-slot="recorded-note"]')
        expect(document.activeElement).toBe(note)
        const outline = note && getComputedStyle(note)
        expect(outline?.outlineStyle).toBe('solid')
        expect(outline?.outlineColor).toBe(roleColour('ring'))
    })
})
