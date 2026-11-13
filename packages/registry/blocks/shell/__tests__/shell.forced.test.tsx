import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { Pane, PaneGroup, PaneHandle } from '..'

test('the resize handle shows focus with forced colours', async () => {
    await render(
        <div style={{ width: 600, height: 200 }}>
            <PaneGroup>
                <Pane defaultSize={200} />
                <PaneHandle aria-label="Resize" />
                <Pane />
            </PaneGroup>
        </div>
    )
    const handle = page.getByRole('separator', { name: 'Resize' }).element()
    handle.focus()
    const style = getComputedStyle(handle)
    expect(style.outlineStyle).toBe('solid')
    expect(style.outlineWidth).toBe('3px')
})
