import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { AppNavigation } from './sidebar.fixtures'

// Runs with the system asking for reduced motion (the browser-motion project).
test('the sidebar collapses without sliding for reduced motion', async () => {
    await page.viewport(1280, 720)
    await render(<AppNavigation />)
    for (const slot of ['sidebar-gap', 'sidebar-container']) {
        const element = document.querySelector(`[data-slot="${slot}"]`)
        if (element === null) {
            throw new Error(`No ${slot}`)
        }
        expect(getComputedStyle(element).transitionProperty).toBe('none')
    }
})
