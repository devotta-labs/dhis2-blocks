import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    find,
    OpenMenu,
    OpenSelect,
    OpenTooltip,
    WarningAlert,
    slot,
    style,
} from './surfaces.fixtures'

describe('surfaces in the default theme', () => {
    it('highlight a menu item in the accent colour', async () => {
        await render(<OpenMenu />)
        await userEvent.hover(page.getByRole('menuitem', { name: 'Rename' }))
        expect(style(await slot('dropdown-menu-item')).backgroundColor).toBe(
            'rgb(243, 245, 247)'
        )
    })

    it('fill the selected option', async () => {
        await render(<OpenSelect />)
        await expect
            .element(page.getByRole('option', { name: 'Alpha' }))
            .toBeVisible()
        const selected = await find('[data-slot="select-item"][data-selected]')
        expect(style(selected).backgroundColor).toBe('rgb(224, 242, 241)')
    })

    it('colour a warning alert icon', async () => {
        const screen = await render(<WarningAlert />)
        expect(style(screen.getByTestId('alert-icon').element()).color).toBe(
            'rgb(187, 70, 13)'
        )
    })

    it('invert the tooltip', async () => {
        await render(<OpenTooltip />)
        const tooltip = style(await slot('tooltip-content'))
        expect(tooltip.color).toBe('rgb(255, 255, 255)')
        expect(tooltip.backgroundColor).toBe('rgb(33, 41, 52)')
    })
})
