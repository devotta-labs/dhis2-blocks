import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { SidebarFixture } from './SidebarFixture'

describe('sidebar in forced colours', () => {
    it('keeps the current-page bar visible', async () => {
        await render(<SidebarFixture />)
        const current = page.getByRole('link', { name: 'Home' }).element()
        const bar = getComputedStyle(current, '::before').backgroundColor
        expect(bar).toBe(getComputedStyle(current).color)
    })
})
