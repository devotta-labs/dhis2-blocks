import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { MetadataErrorNotice } from '../form/MetadataErrorNotice'

describe('MetadataErrorNotice', () => {
    it('renders as a destructive alert', async () => {
        await render(
            <MetadataErrorNotice className="custom-notice">
                The program has no search attributes.
            </MetadataErrorNotice>
        )
        const notice = page.getByRole('alert').element()
        expect(notice.getAttribute('data-slot')).toBe('finder-metadata-error')
        expect(notice.classList.contains('custom-notice')).toBe(true)
        expect(getComputedStyle(notice).borderTopColor).toBe('rgb(211, 47, 47)')
        expect(getComputedStyle(notice).borderTopWidth).toBe('2px')
        expect(getComputedStyle(notice).color).toBe('rgb(33, 41, 52)')
    })
})
