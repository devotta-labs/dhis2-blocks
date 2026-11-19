import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { AppNavigation } from './sidebar.fixtures'

// Forced colours drop the accent fill, so the current page needs another mark.
describe('sidebar in forced colours', () => {
    beforeEach(async () => {
        await page.viewport(1280, 720)
    })

    it('outlines the current page', async () => {
        await render(<AppNavigation />)
        const today = page.getByRole('link', { name: 'Today' }).element()
        expect(getComputedStyle(today).outlineStyle).toBe('solid')
    })

    it('leaves other pages without an outline', async () => {
        await render(<AppNavigation />)
        const find = page.getByRole('button', { name: 'Find patient' })
        expect(getComputedStyle(find.element()).outlineStyle).toBe('none')
    })
})
