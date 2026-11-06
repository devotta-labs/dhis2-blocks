import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { SidebarFixture } from './SidebarFixture'
import { roleColour } from '../../../test/roleColour'

describe('sidebar with more contrast', () => {
    it('writes its links in near white', async () => {
        await render(<SidebarFixture />)
        const link = page.getByRole('link', { name: 'Reports' }).element()
        expect(getComputedStyle(link).color).toBe(
            roleColour('sidebar-foreground')
        )
    })

    it('marks the current page with a light teal bar', async () => {
        await render(<SidebarFixture />)
        const current = page.getByRole('link', { name: 'Home' }).element()
        expect(getComputedStyle(current, '::before').backgroundColor).toBe(
            roleColour('sidebar-primary')
        )
    })
})
