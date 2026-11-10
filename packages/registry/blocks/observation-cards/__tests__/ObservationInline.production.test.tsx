import React from 'react'
import { ObservationInline } from '..'
import { DE, renderWith } from './support'

// Runs in the `browser-production` project.

describe('a misconfigured ObservationInline in production', () => {
    it('shows a short message instead of the setup details', async () => {
        const { container } = await renderWith(
            <ObservationInline dataElement={DE} />,
            {},
            'misconfigured'
        )
        const message = container.querySelector(
            '[data-slot="observation-config-error"]'
        )
        expect(message?.textContent).toBe("This part isn't set up correctly")
        expect(container.textContent).not.toContain(DE)
    })
})
