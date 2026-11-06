import React from 'react'
import { render } from 'vitest-browser-react'
import { OpenMenu, OpenPopover, slot, style } from './surfaces.fixtures'

describe('surfaces in forced colours', () => {
    it.each([
        ['popover-content', OpenPopover],
        ['dropdown-menu-content', OpenMenu],
    ] as const)('keep an edge on %s', async (name, Surface) => {
        await render(<Surface />)
        const surface = style(await slot(name))
        expect(surface.borderTopStyle).toBe('solid')
        expect(surface.borderTopWidth).toBe('1px')
    })
})
