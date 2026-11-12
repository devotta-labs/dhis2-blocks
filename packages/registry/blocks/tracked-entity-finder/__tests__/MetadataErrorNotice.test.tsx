import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { MetadataErrorNotice } from '../form/MetadataErrorNotice'
import { roleColour } from '../../../test/roleColour'

describe('MetadataErrorNotice', () => {
    it('renders as a destructive alert', async () => {
        await render(
            <MetadataErrorNotice
                className="custom-notice"
                message="The program has no search attributes."
            />
        )
        const notice = page.getByRole('alert').element()
        expect(notice.getAttribute('data-slot')).toBe('finder-metadata-error')
        expect(notice.classList.contains('custom-notice')).toBe(true)
        expect(getComputedStyle(notice).borderTopColor).toBe(
            roleColour('destructive-border')
        )
        expect(getComputedStyle(notice).borderTopWidth).toBe('2px')
        expect(getComputedStyle(notice).color).toBe(roleColour('foreground'))
    })
})
