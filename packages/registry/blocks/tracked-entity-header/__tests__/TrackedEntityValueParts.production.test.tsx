import React from 'react'
import { page } from 'vitest/browser'
import { TrackedEntityAttribute } from '..'
import { renderParts } from './valuePartsSupport'

// Runs in the `browser-production` project, built with
// `process.env.NODE_ENV` set to "production" as an app's production build is.

describe('a misconfigured part in production', () => {
    it('shows a short message and logs the details once', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        await renderParts(
            <>
                <TrackedEntityAttribute attribute="nope0000001" />
                <TrackedEntityAttribute attribute="nope0000001" />
            </>
        )

        await expect
            .element(page.getByRole('alert').first())
            .toHaveTextContent("This part isn't set up correctly")
        expect(
            page.getByRole('alert').first().element().textContent
        ).not.toContain('nope0000001')
        expect(error).toHaveBeenCalledTimes(1)
        expect(String(error.mock.calls[0][0])).toContain('nope0000001')
        error.mockRestore()
    })
})
