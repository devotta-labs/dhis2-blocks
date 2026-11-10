import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    Divider,
    OpenMenu,
    OpenPopover,
    WarningAlert,
    slot,
    style,
} from './surfaces.fixtures'
import { roleColour } from '../test/roleColour'

describe('surfaces with more contrast', () => {
    it('edge a popover', async () => {
        await render(<OpenPopover />)
        expect(style(await slot('popover-content')).boxShadow).toContain(
            // The high-contrast edge is the border-strong grey.
            `${roleColour('border-strong')} 0px 0px 0px 1px`
        )
    })

    it('highlight a menu item a step darker', async () => {
        await render(<OpenMenu />)
        await userEvent.hover(page.getByRole('menuitem', { name: 'Rename' }))
        expect(style(await slot('dropdown-menu-item')).backgroundColor).toBe(
            roleColour('accent')
        )
    })

    it('draw a separator in mid grey', async () => {
        await render(<Divider />)
        expect(style(await slot('separator')).backgroundColor).toBe(
            roleColour('border')
        )
    })

    it('colour a warning alert icon in the darkest yellow', async () => {
        const screen = await render(<WarningAlert />)
        expect(style(screen.getByTestId('alert-icon').element()).color).toBe(
            roleColour('warning')
        )
    })
})
