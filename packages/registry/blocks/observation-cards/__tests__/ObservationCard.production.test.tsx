import React from 'react'
import { ObservationCard } from '..'
import { DE, PROGRAM, renderWith } from './support'

// Runs in the `browser-production` project, built with
// `process.env.NODE_ENV` set to "production" as an app's production build is.

describe('a misconfigured card in production', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('shows a short message and logs the setup details instead', async () => {
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

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
        await expect
            .poll(() => errors.mock.calls)
            .toEqual([
                [
                    `Data element ${DE} is not captured by any stage of program ${PROGRAM}. Captured data elements: none`,
                ],
            ])
    })
})
