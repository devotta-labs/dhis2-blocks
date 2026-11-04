import React from 'react'
import { ObservationCard } from '..'
import { DE, renderWith } from './support'

// Runs in the `browser-production` project, built with
// `process.env.NODE_ENV` set to "production" as an app's production build is.

describe('a misconfigured card in production', () => {
    it('shows a short message instead of the setup details', async () => {
        const { container } = await renderWith(
            <ObservationCard dataElement={DE} label="Haemoglobin" />,
            {},
            'misconfigured'
        )
        const message = container.querySelector(
            '[data-slot="observation-config-error"]'
        )
        expect(message?.textContent).toBe("This card isn't set up correctly")
        expect(container.textContent).not.toContain(DE)
    })
})
