import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    OpenAlertDialog,
    OpenCombobox,
    OpenDialog,
    OpenMenu,
    OpenPopover,
    OpenTooltip,
    PlainCard,
    slot,
    style,
} from './surfaces.fixtures'

describe('surfaces in forced colours', () => {
    it.each([
        ['popover-content', OpenPopover],
        ['dropdown-menu-content', OpenMenu],
        ['combobox-content', OpenCombobox],
        ['dialog-content', OpenDialog],
        ['alert-dialog-content', OpenAlertDialog],
        ['card', PlainCard],
        ['tooltip-content', OpenTooltip],
    ] as const)('keep an edge on %s', async (name, Surface) => {
        await render(<Surface />)
        const surface = style(await slot(name))
        expect(surface.borderTopStyle).toBe('solid')
        expect(surface.borderTopWidth).toBe('1px')
    })

    it('outline the highlighted combobox option', async () => {
        await render(<OpenCombobox />)
        const option = page.getByRole('option', { name: 'Beta' })
        await userEvent.hover(option)
        expect(style(option.element()).outlineStyle).toBe('solid')
    })
})
