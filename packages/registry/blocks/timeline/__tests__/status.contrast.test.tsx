import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { TimelineMarker } from '../ui/TimelineParts'

const markerIn = (phase: string) => (
    <div className="group/phase" data-phase={phase}>
        <div className="group/item">
            <TimelineMarker data-testid="marker" />
        </div>
    </div>
)

const borderOf = () =>
    getComputedStyle(page.getByTestId('marker').element()).borderTopColor

describe('timeline markers with more contrast', () => {
    it('edges an overdue marker in the dark destructive indicator', async () => {
        await render(markerIn('overdue'))
        expect(borderOf()).toBe('rgb(137, 21, 21)')
    })

    it('edges a future marker in the dark neutral indicator', async () => {
        await render(markerIn('future'))
        expect(borderOf()).toBe('rgb(64, 75, 90)')
    })
})
